import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";

export const quoteStatusSchema = z.enum(["borrador", "enviada", "aprobada", "rechazada"]);
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export const quoteItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().min(1),
});
export type QuoteItem = z.infer<typeof quoteItemSchema>;

export const quoteInputSchema = z.object({
  clientName: z
    .string()
    .trim()
    .min(2, { message: "El cliente debe tener al menos 2 caracteres" })
    .max(80, { message: "Máximo 80 caracteres" }),
  notes: z
    .string()
    .trim()
    .max(280, { message: "Máximo 280 caracteres" })
    .optional()
    .or(z.literal("")),
  laborPercent: z
    .number({ invalid_type_error: "Debe ser un número" })
    .min(0, { message: "Mínimo 0%" })
    .max(100, { message: "Máximo 100%" }),
  items: z.array(quoteItemSchema).min(1, { message: "Agrega al menos un insumo" }),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export interface Quote extends QuoteInput {
  id: string;
  folio: string;
  status: QuoteStatus;
  createdAt: number;
  approvedAt?: number;
  notes: string;
  // Snapshot de cálculos al momento de creación/aprobación
  subtotal: number;
  laborAmount: number;
  total: number;
}

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
  deleteQuote: (id: string) => void;
}

export const useQuotesStore = create<QuotesState>()(
  persist(
    (set, get) => ({
      quotes: [],
      counter: 1000,
      createQuote: (data) => {
        const counter = get().counter + 1;
        const totals = calcTotals(data.items, data.laborPercent);
        const quote: Quote = {
          id: `q-${Date.now()}`,
          folio: `COT-${counter}`,
          status: "borrador",
          createdAt: Date.now(),
          notes: data.notes ?? "",
          ...data,
          ...totals,
        };
        set((s) => ({ quotes: [quote, ...s.quotes], counter }));
        return quote;
      },
      setStatus: (id, status) =>
        set((s) => ({
          quotes: s.quotes.map((q) =>
            q.id === id
              ? { ...q, status, approvedAt: status === "aprobada" ? Date.now() : q.approvedAt }
              : q,
          ),
        })),
      deleteQuote: (id) =>
        set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) })),
    }),
    { name: "quanty-quotes-v1" },
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
