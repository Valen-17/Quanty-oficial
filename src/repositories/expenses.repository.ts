import {
  expenseInputSchema,
  expenseSchema,
  expenseTypeSchema,
  type Expense,
  type ExpenseInput,
} from "@/domain/entities";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database.types";

export type ExpenseRow = Tables<"expenses">;

export type ExpensesRepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; data: null; error: string };

export type ExpensesDeleteResult = { ok: true } | { ok: false; error: string };

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRemoteExpenseId(id: string): boolean {
  return UUID_V4.test(id.trim());
}

function parseTimestampMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}

function parseAmountFromRow(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function formatSupabaseError(prefix: string, err: { message?: string; code?: string; details?: string } | null): string {
  if (!err) return `${prefix}: respuesta sin detalle.`;
  const parts = [err.message, err.code, err.details].filter(Boolean);
  return parts.length ? `${prefix}: ${parts.join(" — ")}` : `${prefix}: error desconocido.`;
}

function mapUnknownError(prefix: string, error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return `${prefix}: ${m}`;
  }
  return `${prefix}: error de red o respuesta inválida.`;
}

async function requireAuthUserId(): Promise<ExpensesRepoResult<string>> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return { ok: false, data: null, error: formatSupabaseError("Auth", error) };
  }
  const id = data.user?.id;
  if (!id) {
    return { ok: false, data: null, error: "Debes iniciar sesión para usar gastos remotos." };
  }
  return { ok: true, data: id };
}

/** Mapea una fila SQL a dominio; falla si los datos no pasan el esquema canónico. */
export function expenseRowToDomain(row: ExpenseRow): Expense {
  const amount = parseAmountFromRow(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Monto inválido en gasto ${row.id}`);
  }

  const typeParsed = expenseTypeSchema.safeParse(row.type);
  if (!typeParsed.success) {
    throw new Error(`Tipo de gasto inválido en fila ${row.id} (esperado fijo|variable).`);
  }

  const dateMs = parseTimestampMs(row.expense_date);
  if (!Number.isFinite(dateMs)) {
    throw new Error(`Fecha inválida en gasto ${row.id}`);
  }

  const candidate: Expense = {
    id: row.id,
    concept: String(row.concept ?? "").trim(),
    amount,
    type: typeParsed.data,
    category: String(row.category ?? "").trim(),
    date: dateMs,
  };

  const validated = expenseSchema.safeParse(candidate);
  if (!validated.success) {
    const msg = validated.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Gasto ${row.id} inconsistente: ${msg}`);
  }

  return validated.data;
}

function expenseRowToDomainSafe(row: ExpenseRow): ExpensesRepoResult<Expense> {
  try {
    return { ok: true, data: expenseRowToDomain(row) };
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: e instanceof Error ? e.message : "Fila de gasto con datos inconsistentes.",
    };
  }
}

function expenseDateIsoFromMs(ms: number): string {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) {
    return new Date(0).toISOString();
  }
  return d.toISOString();
}

export async function getExpenses(): Promise<ExpensesRepoResult<Expense[]>> {
  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .is("deleted_at", null)
    .order("expense_date", { ascending: false });

  if (error) {
    return { ok: false, data: null, error: formatSupabaseError("No se pudieron cargar los gastos", error) };
  }

  const rows = (data ?? []) as ExpenseRow[];
  const out: Expense[] = [];
  for (const row of rows) {
    const mapped = expenseRowToDomainSafe(row);
    if (!mapped.ok) {
      return { ok: false, data: null, error: mapped.error };
    }
    out.push(mapped.data);
  }
  return { ok: true, data: out };
}

export async function createExpense(input: ExpenseInput): Promise<ExpensesRepoResult<Expense>> {
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, data: null, error: `Datos inválidos: ${msg}` };
  }

  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const v = parsed.data;
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: auth.data,
      concept: v.concept.trim(),
      amount: String(v.amount),
      type: v.type,
      category: v.category ?? "",
      expense_date: expenseDateIsoFromMs(v.date),
    })
    .select("*")
    .single();

  if (error) {
    return { ok: false, data: null, error: formatSupabaseError("No se pudo crear el gasto", error) };
  }
  if (!data) {
    return { ok: false, data: null, error: "El servidor no devolvió el gasto creado." };
  }

  return expenseRowToDomainSafe(data as ExpenseRow);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ExpensesRepoResult<Expense>> {
  if (!isRemoteExpenseId(id)) {
    return { ok: false, data: null, error: "Este gasto solo existe en local (sin UUID remoto)." };
  }

  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, data: null, error: `Datos inválidos: ${msg}` };
  }

  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const v = parsed.data;
  const { data, error } = await supabase
    .from("expenses")
    .update({
      concept: v.concept.trim(),
      amount: String(v.amount),
      type: v.type,
      category: v.category ?? "",
      expense_date: expenseDateIsoFromMs(v.date),
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    return { ok: false, data: null, error: formatSupabaseError("No se pudo actualizar el gasto", error) };
  }
  if (!data) {
    return { ok: false, data: null, error: "Gasto no encontrado, archivado o sin permiso (RLS)." };
  }

  return expenseRowToDomainSafe(data as ExpenseRow);
}

export async function softDeleteExpense(id: string): Promise<ExpensesDeleteResult> {
  if (!isRemoteExpenseId(id)) {
    return { ok: false, error: "Este gasto solo existe en local (sin UUID remoto)." };
  }

  const auth = await requireAuthUserId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("expenses")
    .update({ deleted_at: now })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: formatSupabaseError("No se pudo archivar el gasto", error) };
  }
  if (!data) {
    return { ok: false, error: "Gasto no encontrado, ya archivado o sin permiso." };
  }

  return { ok: true };
}

export async function safeGetExpenses(): Promise<ExpensesRepoResult<Expense[]>> {
  try {
    return await getExpenses();
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("getExpenses", e) };
  }
}

export async function safeCreateExpense(input: ExpenseInput): Promise<ExpensesRepoResult<Expense>> {
  try {
    return await createExpense(input);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("createExpense", e) };
  }
}

export async function safeUpdateExpense(id: string, input: ExpenseInput): Promise<ExpensesRepoResult<Expense>> {
  try {
    return await updateExpense(id, input);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("updateExpense", e) };
  }
}

export async function safeSoftDeleteExpense(id: string): Promise<ExpensesDeleteResult> {
  try {
    return await softDeleteExpense(id);
  } catch (e) {
    return { ok: false, error: mapUnknownError("softDeleteExpense", e) };
  }
}
