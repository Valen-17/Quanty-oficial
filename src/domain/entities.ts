import { z } from "zod";
import { idSchema, timestampSchema } from "./common";

export const productSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240),
  price: z.number().positive().max(999_999_999),
  units: z.number().int().min(0).max(999_999),
  threshold: z.number().int().min(1).max(9_999),
  imageUrl: z.string().max(2_000_000),
});
export const productInputSchema = productSchema.omit({ id: true }).extend({
  description: z.string().trim().max(240).or(z.literal("")).default(""),
  imageUrl: z.string().max(2_000_000).or(z.literal("")).default(""),
});
export type Product = z.infer<typeof productSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;

export const clientSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120).or(z.literal("")),
  phone: z.string().trim().max(30).or(z.literal("")),
  company: z.string().trim().max(80).or(z.literal("")),
  notes: z.string().trim().max(280).or(z.literal("")),
  createdAt: timestampSchema,
});
export const clientInputSchema = clientSchema.omit({ id: true, createdAt: true });
export type Client = z.infer<typeof clientSchema>;
export type ClientInput = z.infer<typeof clientInputSchema>;

export const quoteStatusSchema = z.enum(["borrador", "enviada", "aprobada", "rechazada"]);
export const quoteItemSchema = z.object({
  productId: idSchema,
  name: z.string(),
  unitPrice: z.number().nonnegative(),
  productNameSnapshot: z.string().optional(),
  unitPriceSnapshot: z.number().nonnegative().optional(),
  quantity: z.number().int().min(1),
});

export const quoteSchema = z.object({
  id: idSchema,
  folio: z.string(),
  status: quoteStatusSchema,
  createdAt: timestampSchema,
  approvedAt: timestampSchema.optional(),
  clientId: idSchema.optional(),
  clientName: z.string().trim().min(2).max(80),
  clientNameSnapshot: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(280).or(z.literal("")),
  laborPercent: z.number().min(0).max(100),
  laborWorkers: z.number().int().nonnegative().default(0),
  laborHours: z.number().nonnegative().default(0),
  laborRate: z.number().nonnegative().default(0),
  laborEmployeeAmount: z.number().nonnegative().default(0),
  items: z.array(quoteItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  laborAmount: z.number().nonnegative(),
  total: z.number().nonnegative(),
});
export const quoteInputSchema = z.object({
  clientId: idSchema.optional(),
  clientName: z.string().trim().min(2).max(80),
  clientNameSnapshot: z.string().trim().min(2).max(80).optional(),
  notes: z.string().trim().max(280).or(z.literal("")).optional(),
  laborPercent: z.number().min(0).max(100),
  laborWorkers: z.number().int().nonnegative().default(0),
  laborHours: z.number().nonnegative().default(0),
  laborRate: z.number().nonnegative().default(0),
  items: z.array(quoteItemSchema).min(1),
});
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;
export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;

/** Normaliza ítems y snapshots como en el store local (UI / persistencia). */
export function normalizeQuoteInputItems(items: QuoteInput["items"]): QuoteItem[] {
  return items.map((item) => {
    const productNameSnapshot = item.productNameSnapshot ?? item.name;
    const unitPriceSnapshot = item.unitPriceSnapshot ?? item.unitPrice;
    return {
      ...item,
      productNameSnapshot,
      unitPriceSnapshot,
      name: productNameSnapshot,
      unitPrice: unitPriceSnapshot,
    };
  });
}

export const expenseTypeSchema = z.enum(["fijo", "variable"]);
export const expenseSchema = z.object({
  id: idSchema,
  concept: z.string().trim().min(2).max(80),
  amount: z.number().positive().max(999_999_999),
  type: expenseTypeSchema,
  category: z.string().trim().max(40).or(z.literal("")),
  date: timestampSchema,
});
export const expenseInputSchema = expenseSchema.omit({ id: true });
export type ExpenseType = z.infer<typeof expenseTypeSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const eventStatusSchema = z.enum(["pendiente", "confirmado", "completado", "cancelado"]);
export const agendaEventSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(2).max(80),
  clientName: z.string().trim().max(80).or(z.literal("")),
  /** Opcional: vínculo remoto a cliente (UUID). Eventos legacy no lo tienen. */
  clientId: z.string().trim().min(1).optional(),
  /** Opcional: vínculo remoto a cotización (UUID). */
  quoteId: z.string().trim().min(1).optional(),
  date: timestampSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().trim().max(120).or(z.literal("")),
  notes: z.string().trim().max(280).or(z.literal("")),
  status: eventStatusSchema,
  createdAt: timestampSchema,
});
export const eventInputSchema = agendaEventSchema.omit({ id: true, createdAt: true });
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type AgendaEvent = z.infer<typeof agendaEventSchema>;
export type EventInput = z.infer<typeof eventInputSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  businessName: z.string().trim().max(80).or(z.literal("")),
  email: z.string().trim().email().max(120).or(z.literal("")),
  phone: z.string().trim().max(30).or(z.literal("")),
  currency: z.string().min(3).max(5),
  language: z.enum(["es", "en"]),
  hasEmployees: z.boolean().default(false),
  employeeCount: z.number().int().nonnegative().default(0),
});
export type Profile = z.infer<typeof profileSchema>;

export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  notifyLowStock: z.boolean(),
  notifyQuoteUpdates: z.boolean(),
  notifyAgenda: z.boolean(),
  weeklyDigest: z.boolean(),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const inventoryPersistedSchema = z.object({
  products: z.array(productSchema),
});
export const clientsPersistedSchema = z.object({
  clients: z.array(clientSchema),
});
export const quotesPersistedSchema = z.object({
  quotes: z.array(quoteSchema),
  counter: z.number().int().nonnegative(),
});
export const expensesPersistedSchema = z.object({
  expenses: z.array(expenseSchema),
});
export const agendaPersistedSchema = z.object({
  events: z.array(agendaEventSchema),
});
export const settingsPersistedSchema = z.object({
  profile: profileSchema,
  preferences: preferencesSchema,
});

export type InventoryPersisted = z.infer<typeof inventoryPersistedSchema>;
export type ClientsPersisted = z.infer<typeof clientsPersistedSchema>;
export type QuotesPersisted = z.infer<typeof quotesPersistedSchema>;
export type ExpensesPersisted = z.infer<typeof expensesPersistedSchema>;
export type AgendaPersisted = z.infer<typeof agendaPersistedSchema>;
export type SettingsPersisted = z.infer<typeof settingsPersistedSchema>;
