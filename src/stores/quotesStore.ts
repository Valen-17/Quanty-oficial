import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEntityId, nowTs } from "@/domain/common";
import {
  normalizeQuoteInputItems,
  quoteInputSchema as domainQuoteInputSchema,
  quoteItemSchema as domainQuoteItemSchema,
  quoteStatusSchema as domainQuoteStatusSchema,
  quotesPersistedSchema,
  type Quote as DomainQuote,
  type QuoteInput as DomainQuoteInput,
  type QuoteItem as DomainQuoteItem,
  type QuoteStatus as DomainQuoteStatus,
  type QuotesPersisted,
} from "@/domain/entities";
import { buildPersistOptions } from "@/lib/persist-helpers";
import { createScopedJsonStorage } from "@/lib/scoped-persist-storage";
import { mergeRemoteWithLocalLegacy } from "@/lib/merge-remote-with-local-legacy";
import {
  isRemoteQuoteId,
  safeApproveQuoteRemote,
  safeCreateQuote,
  safeGetQuotes,
  safeSoftDeleteQuote,
  safeUpdateQuote,
} from "@/repositories/quotes.repository";
import { useInventoryStore } from "@/stores/inventoryStore";

export const quoteStatusSchema = domainQuoteStatusSchema;
export type QuoteStatus = DomainQuoteStatus;
export const quoteItemSchema = domainQuoteItemSchema;
export type QuoteItem = DomainQuoteItem;
export const quoteInputSchema = domainQuoteInputSchema;
export type QuoteInput = DomainQuoteInput;
export type Quote = DomainQuote;

export function calcTotals(
  items: QuoteItem[],
  laborWorkers = 0,
  laborHours = 0,
  laborRate = 0,
) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const laborEmployeeAmount = Math.round(laborWorkers * laborHours * laborRate);
  const total = subtotal + laborEmployeeAmount;
  return { subtotal, laborEmployeeAmount, total };
}

function maxCounterFromFolios(quotes: Quote[], current: number): number {
  let m = current;
  for (const q of quotes) {
    const match = /^COT-(\d+)$/i.exec(q.folio.trim());
    if (match) m = Math.max(m, parseInt(match[1], 10));
  }
  return m;
}

interface QuotesState {
  quotes: Quote[];
  counter: number;
  remoteQuotesError: string | null;
  createQuote: (data: QuoteInput) => Quote;
  setStatus: (id: string, status: QuoteStatus) => void;
  approveQuote: (id: string) => { ok: boolean; error?: string; issues?: ApprovalIssue[] };
  getApprovalIssues: (id: string) => ApprovalIssue[];
  deleteQuote: (id: string) => void;
  clearRemoteQuotesError: () => void;
  /** Sincroniza con Supabase y conserva cotizaciones solo locales (id no UUID). Recalcula `counter` con folios fusionados. */
  syncQuotesFromRemote: () => Promise<boolean>;
  createQuoteOnRemote: (data: QuoteInput) => Promise<Quote | null>;
  updateQuoteOnRemote: (quote: Quote) => Promise<boolean>;
  softDeleteQuoteOnRemote: (id: string) => Promise<boolean>;
  approveQuoteOnRemote: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export interface ApprovalIssue {
  productId: string;
  name: string;
  available: number;
  needed: number;
}

export const useQuotesStore = create<QuotesState>()(
  persist(
    (set, get) => ({
      quotes: [],
      counter: 1000,
      remoteQuotesError: null,
      clearRemoteQuotesError: () => set({ remoteQuotesError: null }),
      syncQuotesFromRemote: async () => {
        const res = await safeGetQuotes();
        if (!res.ok) {
          set({ remoteQuotesError: res.error });
          return false;
        }
        const merged = mergeRemoteWithLocalLegacy(res.data, get().quotes, isRemoteQuoteId);
        const counter = maxCounterFromFolios(merged, get().counter);
        set({ quotes: merged, counter, remoteQuotesError: null });
        return true;
      },
      createQuoteOnRemote: async (data) => {
        const normalizedItems = normalizeQuoteInputItems(data.items);
        const totals = calcTotals(
          normalizedItems,
          data.laborWorkers ?? 0,
          data.laborHours ?? 0,
          data.laborRate ?? 0,
        );
        const counter = get().counter + 1;
        const folio = `COT-${counter}`;
        const res = await safeCreateQuote({
          ...data,
          clientNameSnapshot: data.clientNameSnapshot ?? data.clientName,
          items: normalizedItems,
          folio,
          status: "borrador",
          approvedAt: null,
          ...totals,
        });
        if (!res.ok) {
          set({ remoteQuotesError: res.error });
          return null;
        }
        set((s) => ({
          quotes: [res.data, ...s.quotes.filter((q) => q.id !== res.data.id)],
          counter,
          remoteQuotesError: null,
        }));
        return res.data;
      },
      updateQuoteOnRemote: async (quote) => {
        const res = await safeUpdateQuote(quote);
        if (!res.ok) {
          set({ remoteQuotesError: res.error });
          return false;
        }
        set((s) => ({
          quotes: s.quotes.map((q) => (q.id === quote.id ? res.data : q)),
          remoteQuotesError: null,
        }));
        return true;
      },
      softDeleteQuoteOnRemote: async (id) => {
        const res = await safeSoftDeleteQuote(id);
        if (!res.ok) {
          set({ remoteQuotesError: res.error });
          return false;
        }
        set((s) => ({
          quotes: s.quotes.filter((q) => q.id !== id),
          remoteQuotesError: null,
        }));
        return true;
      },
      approveQuoteOnRemote: async (id) => {
        const res = await safeApproveQuoteRemote(id);
        if (!res.ok) {
          set({ remoteQuotesError: res.error });
          return { ok: false as const, error: res.error };
        }
        set((s) => ({
          quotes: s.quotes.map((q) => (q.id === id ? res.data : q)),
          remoteQuotesError: null,
        }));
        void useInventoryStore.getState().syncProductsFromRemote();
        return { ok: true as const };
      },
      createQuote: (data) => {
        const counter = get().counter + 1;
        const normalizedItems = normalizeQuoteInputItems(data.items);
        const totals = calcTotals(
          normalizedItems,
          data.laborWorkers ?? 0,
          data.laborHours ?? 0,
          data.laborRate ?? 0,
        );
        const quote: Quote = {
          id: createEntityId("q"),
          folio: `COT-${counter}`,
          status: "borrador",
          createdAt: nowTs(),
          notes: data.notes ?? "",
          laborWorkers: data.laborWorkers ?? 0,
          laborHours: data.laborHours ?? 0,
          laborRate: data.laborRate ?? 0,
          ...data,
          clientNameSnapshot: data.clientNameSnapshot ?? data.clientName,
          clientName: data.clientNameSnapshot ?? data.clientName,
          items: normalizedItems,
          ...totals,
        };
        set((s) => ({ quotes: [quote, ...s.quotes], counter }));
        return quote;
      },
      setStatus: (id, status) =>
        set((s) => ({
          quotes: s.quotes.map((q) =>
            q.id === id
              ? { ...q, status, approvedAt: status === "aprobada" ? nowTs() : q.approvedAt }
              : q,
          ),
        })),
      getApprovalIssues: (id) => {
        const quote = get().quotes.find((q) => q.id === id);
        if (!quote) return [];
        const products = useInventoryStore.getState().products;
        return quote.items
          .map((i) => {
            const p = products.find((x) => x.id === i.productId);
            const available = p?.units ?? 0;
            return available < i.quantity
              ? {
                  productId: i.productId,
                  name: i.productNameSnapshot ?? i.name,
                  available,
                  needed: i.quantity,
                }
              : null;
          })
          .filter(Boolean) as ApprovalIssue[];
      },
      approveQuote: (id) => {
        const quote = get().quotes.find((q) => q.id === id);
        if (!quote) return { ok: false, error: "Cotización no encontrada" };
        if (quote.status === "aprobada") return { ok: true };
        if (quote.status === "rechazada") {
          return { ok: false, error: "No puedes aprobar una cotización rechazada" };
        }
        const issues = get().getApprovalIssues(id);
        if (issues.length > 0) return { ok: false, issues };

        const { adjustStock } = useInventoryStore.getState();
        for (const it of quote.items) adjustStock(it.productId, -it.quantity);

        set((s) => ({
          quotes: s.quotes.map((q) =>
            q.id === id ? { ...q, status: "aprobada", approvedAt: nowTs() } : q,
          ),
        }));
        return { ok: true };
      },
      deleteQuote: (id) => set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) })),
    }),
    {
      ...buildPersistOptions<QuotesState, QuotesPersisted>({
        name: "quanty-quotes-v1",
        version: 2,
        schema: quotesPersistedSchema,
        fallback: () => ({ quotes: [], counter: 1000 }),
        partialize: (state) => ({ quotes: state.quotes, counter: state.counter }),
        migrations: {
          2: (state) => ({
            ...state,
            quotes: state.quotes.map((q) => ({
              ...q,
              notes: q.notes ?? "",
              laborWorkers: q.laborWorkers ?? 0,
              laborHours: q.laborHours ?? 0,
              laborRate: q.laborRate ?? 0,
              laborEmployeeAmount: q.laborEmployeeAmount ?? 0,
              clientNameSnapshot: q.clientNameSnapshot ?? q.clientName,
              clientName: q.clientNameSnapshot ?? q.clientName,
              items: q.items.map((it) => ({
                ...it,
                productNameSnapshot: it.productNameSnapshot ?? it.name,
                unitPriceSnapshot: it.unitPriceSnapshot ?? it.unitPrice,
                name: it.productNameSnapshot ?? it.name,
                unitPrice: it.unitPriceSnapshot ?? it.unitPrice,
              })),
            })),
          }),
        },
      }),
      storage: createScopedJsonStorage(),
    },
  ),
);

export const quoteStatusLabel: Record<QuoteStatus, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export const quoteStatusStyles: Record<QuoteStatus, string> = {
  borrador: "bg-muted text-muted-foreground",
  enviada: "bg-primary/10 text-primary",
  aprobada: "bg-success/15 text-success",
  rechazada: "bg-destructive/10 text-destructive",
};
