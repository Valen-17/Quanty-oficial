import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEntityId, nowTs } from "@/domain/common";
import {
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
import { useInventoryStore } from "@/stores/inventoryStore";

export const quoteStatusSchema = domainQuoteStatusSchema;
export type QuoteStatus = DomainQuoteStatus;
export const quoteItemSchema = domainQuoteItemSchema;
export type QuoteItem = DomainQuoteItem;
export const quoteInputSchema = domainQuoteInputSchema;
export type QuoteInput = DomainQuoteInput;
export type Quote = DomainQuote;

export function calcTotals(items: QuoteItem[], laborPercent: number) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const laborAmount = Math.round((subtotal * laborPercent) / 100);
  const total = subtotal + laborAmount;
  return { subtotal, laborAmount, total };
}

interface QuotesState {
  quotes: Quote[];
  counter: number;
  createQuote: (data: QuoteInput) => Quote;
  setStatus: (id: string, status: QuoteStatus) => void;
  approveQuote: (id: string) => { ok: boolean; error?: string; issues?: ApprovalIssue[] };
  getApprovalIssues: (id: string) => ApprovalIssue[];
  deleteQuote: (id: string) => void;
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
      createQuote: (data) => {
        const counter = get().counter + 1;
        const normalizedItems = data.items.map((item) => ({
          ...item,
          productNameSnapshot: item.productNameSnapshot ?? item.name,
          unitPriceSnapshot: item.unitPriceSnapshot ?? item.unitPrice,
          // Compatibilidad actual con UI existente
          name: item.productNameSnapshot ?? item.name,
          unitPrice: item.unitPriceSnapshot ?? item.unitPrice,
        }));
        const totals = calcTotals(normalizedItems, data.laborPercent);
        const quote: Quote = {
          id: createEntityId("q"),
          folio: `COT-${counter}`,
          status: "borrador",
          createdAt: nowTs(),
          notes: data.notes ?? "",
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
      deleteQuote: (id) =>
        set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) })),
    }),
    buildPersistOptions<QuotesState, QuotesPersisted>({
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
