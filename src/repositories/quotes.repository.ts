import { z } from "zod";
import {
  normalizeQuoteInputItems,
  quoteInputSchema,
  quoteItemSchema,
  quoteSchema,
  quoteStatusSchema,
  type Quote,
  type QuoteInput,
  type QuoteItem,
} from "@/domain/entities";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database.types";
import { isRemoteClientId } from "@/repositories/clients.repository";
import { isRemoteProductId } from "@/repositories/products.repository";

export type QuoteRow = Tables<"quotes">;
export type QuoteLineItemRow = Tables<"quote_line_items">;

export type QuotesRepoResult<T> = { ok: true; data: T } | { ok: false; data: null; error: string };
export type QuotesDeleteResult = { ok: true } | { ok: false; error: string };

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRemoteQuoteId(id: string): boolean {
  return UUID_V4.test(id.trim());
}

const createRemoteQuoteParamsSchema = quoteInputSchema.extend({
  folio: z.string().min(1),
  status: quoteStatusSchema,
  subtotal: z.number().nonnegative(),
  laborAmount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  approvedAt: z.number().int().nonnegative().optional().nullable(),
});

export type CreateRemoteQuoteParams = z.infer<typeof createRemoteQuoteParamsSchema>;

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

function parseNumeric(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

async function requireAuthUserId(): Promise<QuotesRepoResult<string>> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return { ok: false, data: null, error: formatSupabaseError("Auth", error) };
  }
  const id = data.user?.id;
  if (!id) {
    return { ok: false, data: null, error: "Debes iniciar sesión para usar cotizaciones remotas." };
  }
  return { ok: true, data: id };
}

function lineRowToQuoteItem(row: QuoteLineItemRow): QuotesRepoResult<QuoteItem> {
  const unitPriceSnapshot = parseNumeric(row.unit_price_snapshot);
  const unitPriceRef = parseNumeric(row.unit_price);
  if (!Number.isFinite(unitPriceSnapshot) || unitPriceSnapshot < 0) {
    return { ok: false, data: null, error: `Precio snapshot inválido en línea ${row.id}.` };
  }
  const unitPrice = Number.isFinite(unitPriceRef) && unitPriceRef >= 0 ? unitPriceRef : unitPriceSnapshot;
  const productId =
    row.product_id && row.product_id.trim().length > 0 && isRemoteProductId(row.product_id)
      ? row.product_id.trim()
      : row.id;
  const candidate: QuoteItem = {
    productId,
    name: row.item_name,
    unitPrice,
    productNameSnapshot: row.product_name_snapshot,
    unitPriceSnapshot,
    quantity: row.quantity,
  };
  const parsed = quoteItemSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  return { ok: true, data: parsed.data };
}

function joinedRowToQuote(
  row: QuoteRow & { quote_line_items?: QuoteLineItemRow[] | null },
): QuotesRepoResult<Quote> {
  const rawLines = row.quote_line_items ?? [];
  const sorted = [...rawLines].sort((a, b) => a.line_no - b.line_no);
  const items: QuoteItem[] = [];
  for (const line of sorted) {
    const mapped = lineRowToQuoteItem(line);
    if (!mapped.ok) return mapped;
    items.push(mapped.data);
  }

  const laborPercent = parseNumeric(row.labor_percent);
  const subtotal = parseNumeric(row.subtotal);
  const laborAmount = parseNumeric(row.labor_amount);
  const total = parseNumeric(row.total);
  const createdAt = Date.parse(row.created_at);
  if (!Number.isFinite(laborPercent) || laborPercent < 0 || laborPercent > 100) {
    return { ok: false, data: null, error: `labor_percent inválido en cotización ${row.id}.` };
  }
  if (!Number.isFinite(subtotal) || subtotal < 0 || !Number.isFinite(laborAmount) || laborAmount < 0) {
    return { ok: false, data: null, error: `Montos inválidos en cotización ${row.id}.` };
  }
  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, data: null, error: `Total inválido en cotización ${row.id}.` };
  }
  if (!Number.isFinite(createdAt)) {
    return { ok: false, data: null, error: `Fecha inválida en cotización ${row.id}.` };
  }

  const approvedAt =
    row.approved_at != null && row.approved_at.length > 0 ? Date.parse(row.approved_at) : undefined;
  if (row.approved_at != null && row.approved_at.length > 0 && !Number.isFinite(approvedAt)) {
    return { ok: false, data: null, error: `approved_at inválido en cotización ${row.id}.` };
  }

  const candidate: Quote = {
    id: row.id,
    folio: row.folio,
    status: row.status,
    createdAt,
    approvedAt: approvedAt !== undefined && Number.isFinite(approvedAt) ? approvedAt : undefined,
    clientId: row.client_id && row.client_id.length > 0 ? row.client_id : undefined,
    clientName: row.client_name.trim(),
    clientNameSnapshot: row.client_name_snapshot.trim(),
    notes: row.notes ?? "",
    laborPercent,
    items,
    subtotal,
    laborAmount,
    total,
  };

  const parsed = quoteSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  return { ok: true, data: parsed.data };
}

function quoteItemsToLineInserts(
  quoteId: string,
  items: QuoteItem[],
): Pick<
  Tables<"quote_line_items">,
  "quote_id" | "line_no" | "product_id" | "item_name" | "unit_price" | "product_name_snapshot" | "unit_price_snapshot" | "quantity"
>[] {
  return items.map((item, index) => ({
    quote_id: quoteId,
    line_no: index,
    product_id: isRemoteProductId(item.productId) ? item.productId : null,
    item_name: item.name,
    unit_price: String(item.unitPrice),
    product_name_snapshot: item.productNameSnapshot ?? item.name,
    unit_price_snapshot: String(item.unitPriceSnapshot ?? item.unitPrice),
    quantity: item.quantity,
  }));
}

export async function getQuotes(): Promise<QuotesRepoResult<Quote[]>> {
  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const { data, error } = await supabase
    .from("quotes")
    .select("*, quote_line_items(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, data: null, error: formatSupabaseError("No se pudieron cargar las cotizaciones", error) };
  }

  const rows = (data ?? []) as (QuoteRow & { quote_line_items?: QuoteLineItemRow[] | null })[];
  const out: Quote[] = [];
  for (const row of rows) {
    const mapped = joinedRowToQuote(row);
    if (!mapped.ok) return mapped;
    out.push(mapped.data);
  }
  return { ok: true, data: out };
}

export async function createQuote(params: CreateRemoteQuoteParams): Promise<QuotesRepoResult<Quote>> {
  const parsedParams = createRemoteQuoteParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return { ok: false, data: null, error: `Datos inválidos: ${parsedParams.error.issues.map((i) => i.message).join("; ")}` };
  }
  const p = parsedParams.data;
  if (p.status === "aprobada" && (p.approvedAt == null || !Number.isFinite(p.approvedAt))) {
    return { ok: false, data: null, error: "approvedAt es obligatorio cuando status es aprobada." };
  }

  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const items = normalizeQuoteInputItems(p.items);
  const clientNameSnapshot = p.clientNameSnapshot ?? p.clientName;
  const clientId = p.clientId && isRemoteClientId(p.clientId) ? p.clientId : null;

  const approvedIso =
    p.status === "aprobada" && p.approvedAt != null && Number.isFinite(p.approvedAt)
      ? new Date(p.approvedAt).toISOString()
      : null;

  const { data: header, error: headerError } = await supabase
    .from("quotes")
    .insert({
      user_id: auth.data,
      client_id: clientId,
      folio: p.folio.trim(),
      status: p.status,
      client_name: p.clientName.trim(),
      client_name_snapshot: clientNameSnapshot.trim(),
      notes: p.notes ?? "",
      labor_percent: String(p.laborPercent),
      subtotal: String(p.subtotal),
      labor_amount: String(p.laborAmount),
      total: String(p.total),
      approved_at: approvedIso,
    })
    .select("*")
    .single();

  if (headerError || !header) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudo crear la cotización", headerError),
    };
  }

  const quoteId = (header as QuoteRow).id;
  const linePayload = quoteItemsToLineInserts(quoteId, items);
  const { error: linesError } = await supabase.from("quote_line_items").insert(linePayload);

  if (linesError) {
    await supabase.from("quotes").update({ deleted_at: new Date().toISOString() }).eq("id", quoteId);
    return { ok: false, data: null, error: formatSupabaseError("No se pudieron crear las líneas de la cotización", linesError) };
  }

  const { data: rejoined, error: readError } = await supabase
    .from("quotes")
    .select("*, quote_line_items(*)")
    .eq("id", quoteId)
    .single();

  if (readError || !rejoined) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("Cotización creada pero no se pudo releer", readError),
    };
  }

  return joinedRowToQuote(rejoined as QuoteRow & { quote_line_items?: QuoteLineItemRow[] | null });
}

export async function updateQuote(quote: Quote): Promise<QuotesRepoResult<Quote>> {
  if (!isRemoteQuoteId(quote.id)) {
    return { ok: false, data: null, error: "Esta cotización solo existe en local (sin UUID remoto)." };
  }

  const parsed = quoteSchema.safeParse(quote);
  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const q = parsed.data;
  if (q.status === "aprobada" && (q.approvedAt == null || !Number.isFinite(q.approvedAt))) {
    return { ok: false, data: null, error: "approvedAt es obligatorio cuando status es aprobada." };
  }

  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const items = normalizeQuoteInputItems(q.items);
  const clientId = q.clientId && isRemoteClientId(q.clientId) ? q.clientId : null;
  const approvedIso =
    q.status === "aprobada" && q.approvedAt != null && Number.isFinite(q.approvedAt)
      ? new Date(q.approvedAt).toISOString()
      : null;

  const { error: delErr } = await supabase.from("quote_line_items").delete().eq("quote_id", q.id);
  if (delErr) {
    return { ok: false, data: null, error: formatSupabaseError("No se pudieron actualizar las líneas (delete)", delErr) };
  }

  const { error: upErr } = await supabase
    .from("quotes")
    .update({
      client_id: clientId,
      folio: q.folio.trim(),
      status: q.status,
      client_name: q.clientName.trim(),
      client_name_snapshot: q.clientNameSnapshot.trim(),
      notes: q.notes ?? "",
      labor_percent: String(q.laborPercent),
      subtotal: String(q.subtotal),
      labor_amount: String(q.laborAmount),
      total: String(q.total),
      approved_at: approvedIso,
    })
    .eq("id", q.id);

  if (upErr) {
    return { ok: false, data: null, error: formatSupabaseError("No se pudo actualizar la cotización", upErr) };
  }

  const linePayload = quoteItemsToLineInserts(q.id, items);
  const { error: insErr } = await supabase.from("quote_line_items").insert(linePayload);
  if (insErr) {
    return { ok: false, data: null, error: formatSupabaseError("No se pudieron insertar las líneas actualizadas", insErr) };
  }

  const { data: rejoined, error: readError } = await supabase
    .from("quotes")
    .select("*, quote_line_items(*)")
    .eq("id", q.id)
    .single();

  if (readError || !rejoined) {
    return { ok: false, data: null, error: formatSupabaseError("Cotización actualizada pero no se pudo releer", readError) };
  }

  return joinedRowToQuote(rejoined as QuoteRow & { quote_line_items?: QuoteLineItemRow[] | null });
}

async function fetchQuoteJoinedById(quoteId: string): Promise<QuotesRepoResult<Quote>> {
  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const { data, error } = await supabase
    .from("quotes")
    .select("*, quote_line_items(*)")
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    return { ok: false, data: null, error: formatSupabaseError("No se pudo cargar la cotización", error) };
  }
  if (!data) {
    return { ok: false, data: null, error: "Cotización no encontrada o sin permiso." };
  }

  return joinedRowToQuote(data as QuoteRow & { quote_line_items?: QuoteLineItemRow[] | null });
}

export async function approveQuoteRemote(id: string): Promise<QuotesRepoResult<Quote>> {
  if (!isRemoteQuoteId(id)) {
    return { ok: false, data: null, error: "Esta cotización solo existe en local (sin UUID remoto)." };
  }

  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const { error: rpcError } = await supabase.rpc("approve_quote", { p_quote_id: id });
  if (rpcError) {
    return { ok: false, data: null, error: formatSupabaseError("No se pudo aprobar la cotización", rpcError) };
  }

  return fetchQuoteJoinedById(id);
}

export async function safeApproveQuoteRemote(id: string): Promise<QuotesRepoResult<Quote>> {
  try {
    return await approveQuoteRemote(id);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("approveQuoteRemote", e) };
  }
}

export async function softDeleteQuote(id: string): Promise<QuotesDeleteResult> {
  if (!isRemoteQuoteId(id)) {
    return { ok: false, error: "Esta cotización solo existe en local (sin UUID remoto)." };
  }

  const auth = await requireAuthUserId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("quotes")
    .update({ deleted_at: now })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: formatSupabaseError("No se pudo archivar la cotización", error) };
  }
  if (!data) {
    return { ok: false, error: "Cotización no encontrada, ya archivada o sin permiso." };
  }

  return { ok: true };
}

export async function safeGetQuotes(): Promise<QuotesRepoResult<Quote[]>> {
  try {
    return await getQuotes();
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("getQuotes", e) };
  }
}

export async function safeCreateQuote(params: CreateRemoteQuoteParams): Promise<QuotesRepoResult<Quote>> {
  try {
    return await createQuote(params);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("createQuote", e) };
  }
}

export async function safeUpdateQuote(quote: Quote): Promise<QuotesRepoResult<Quote>> {
  try {
    return await updateQuote(quote);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("updateQuote", e) };
  }
}

export async function safeSoftDeleteQuote(id: string): Promise<QuotesDeleteResult> {
  try {
    return await softDeleteQuote(id);
  } catch (e) {
    return { ok: false, error: mapUnknownError("softDeleteQuote", e) };
  }
}
