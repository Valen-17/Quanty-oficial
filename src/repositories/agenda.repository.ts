// Acceso a la tabla de compromisos de la agenda en Supabase.

import {
  agendaEventSchema,
  eventInputSchema,
  eventStatusSchema,
  type AgendaEvent,
  type EventInput,
} from "@/domain/entities";
import { supabase } from "@/integrations/supabase/client";
import {
  formatSupabaseError,
  isRemoteEntityId,
  mapUnknownError,
  requireAuthUserId,
  type RepoDeleteResult,
  type RepoResult,
} from "@/repositories/shared";
import type { Tables } from "@/integrations/supabase/database.types";
import { isRemoteClientId } from "@/repositories/clients.repository";
import { isRemoteQuoteId } from "@/repositories/quotes.repository";

export type AgendaEventRow = Tables<"agenda_events">;

export type AgendaRepoResult<T> = RepoResult<T>;
export type AgendaDeleteResult = RepoDeleteResult;

export const isRemoteAgendaEventId = isRemoteEntityId;

function parseTimestamp(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function startOfDayLocal(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Une la fecha y la hora del formulario en una sola fecha ISO.
export function eventInputToScheduledAtIso(input: EventInput): string {
  const [h, m] = input.time.split(":").map((x) => parseInt(x, 10));
  const base = new Date(input.date);
  base.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return base.toISOString();
}

// Separa la fecha ISO en día y hora para el formulario.
function scheduledAtIsoToDateAndTime(iso: string): { date: number; time: string } {
  const d = new Date(iso);
  const date = startOfDayLocal(d.getTime());
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date, time: `${hh}:${mm}` };
}

// Pasa una fila de la base de datos al modelo de la app.
export function agendaRowToDomain(row: AgendaEventRow): AgendaEvent {
  const { date, time } = scheduledAtIsoToDateAndTime(row.scheduled_at);
  const statusParsed = eventStatusSchema.safeParse(row.status);
  if (!statusParsed.success) {
    throw new Error(`Estado de agenda inválido en fila ${row.id}`);
  }
  const candidate: AgendaEvent = {
    id: row.id,
    title: String(row.title ?? "").trim(),
    clientName: String(row.client_name_snapshot ?? "").trim(),
    clientId: row.client_id && row.client_id.length > 0 ? row.client_id : undefined,
    quoteId: row.quote_id && row.quote_id.length > 0 ? row.quote_id : undefined,
    date,
    time,
    location: row.location ?? "",
    notes: row.description ?? "",
    status: statusParsed.data,
    createdAt: parseTimestamp(row.created_at),
  };
  const parsed = agendaEventSchema.safeParse(candidate);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Evento ${row.id} inconsistente: ${msg}`);
  }
  return parsed.data;
}

function agendaRowToDomainSafe(row: AgendaEventRow): AgendaRepoResult<AgendaEvent> {
  try {
    return { ok: true, data: agendaRowToDomain(row) };
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: e instanceof Error ? e.message : "Fila de agenda con datos inconsistentes.",
    };
  }
}

function clientIdForInsert(e: Pick<AgendaEvent, "clientId">): string | null {
  return e.clientId && isRemoteClientId(e.clientId) ? e.clientId : null;
}

function quoteIdForInsert(e: Pick<AgendaEvent, "quoteId">): string | null {
  return e.quoteId && isRemoteQuoteId(e.quoteId) ? e.quoteId : null;
}

// Lista los compromisos activos del usuario.
export async function getAgendaEvents(): Promise<AgendaRepoResult<AgendaEvent[]>> {
  const auth = await requireAuthUserId("la agenda remota");
  if (!auth.ok) return auth;

  const { data, error } = await supabase
    .from("agenda_events")
    .select("*")
    .eq("user_id", auth.data)
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudieron cargar los eventos", error),
    };
  }

  const rows = (data ?? []) as AgendaEventRow[];
  const out: AgendaEvent[] = [];
  for (const row of rows) {
    const mapped = agendaRowToDomainSafe(row);
    if (!mapped.ok) return { ok: false, data: null, error: mapped.error };
    out.push(mapped.data);
  }
  return { ok: true, data: out };
}

// Valida y crea un compromiso.
export async function createAgendaEvent(input: EventInput): Promise<AgendaRepoResult<AgendaEvent>> {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, data: null, error: `Datos inválidos: ${msg}` };
  }

  const auth = await requireAuthUserId("la agenda remota");
  if (!auth.ok) return auth;

  const v = parsed.data;
  const scheduledAt = eventInputToScheduledAtIso(v);
  const snapshot = (v.clientName ?? "").trim();

  const { data, error } = await supabase
    .from("agenda_events")
    .insert({
      user_id: auth.data,
      client_id: null,
      quote_id: null,
      title: v.title.trim(),
      description: v.notes ?? "",
      location: v.location ?? "",
      scheduled_at: scheduledAt,
      status: v.status,
      client_name_snapshot: snapshot,
    })
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudo crear el evento", error),
    };
  }
  if (!data) {
    return { ok: false, data: null, error: "El servidor no devolvió el evento creado." };
  }

  return agendaRowToDomainSafe(data as AgendaEventRow);
}

// Valida y actualiza un compromiso existente.
export async function updateAgendaEvent(
  event: AgendaEvent,
): Promise<AgendaRepoResult<AgendaEvent>> {
  if (!isRemoteAgendaEventId(event.id)) {
    return { ok: false, data: null, error: "Este evento solo existe en local (sin UUID remoto)." };
  }

  const parsed = agendaEventSchema.safeParse(event);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, data: null, error: `Datos inválidos: ${msg}` };
  }

  const auth = await requireAuthUserId("la agenda remota");
  if (!auth.ok) return auth;

  const e = parsed.data;
  const scheduledAt = eventInputToScheduledAtIso({
    title: e.title,
    clientName: e.clientName,
    date: e.date,
    time: e.time,
    location: e.location,
    notes: e.notes,
    status: e.status,
  });

  const { data, error } = await supabase
    .from("agenda_events")
    .update({
      client_id: clientIdForInsert(e),
      quote_id: quoteIdForInsert(e),
      title: e.title.trim(),
      description: e.notes ?? "",
      location: e.location ?? "",
      scheduled_at: scheduledAt,
      status: e.status,
      client_name_snapshot: (e.clientName ?? "").trim(),
    })
    .eq("id", e.id)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudo actualizar el evento", error),
    };
  }
  if (!data) {
    return { ok: false, data: null, error: "Evento no encontrado, archivado o sin permiso (RLS)." };
  }

  return agendaRowToDomainSafe(data as AgendaEventRow);
}

// Archiva el compromiso marcando la fecha de borrado.
export async function softDeleteAgendaEvent(id: string): Promise<AgendaDeleteResult> {
  if (!isRemoteAgendaEventId(id)) {
    return { ok: false, error: "Este evento solo existe en local (sin UUID remoto)." };
  }

  const auth = await requireAuthUserId("la agenda remota");
  if (!auth.ok) return { ok: false, error: auth.error };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("agenda_events")
    .update({ deleted_at: now })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: formatSupabaseError("No se pudo archivar el evento", error) };
  }
  if (!data) {
    return { ok: false, error: "Evento no encontrado, ya archivado o sin permiso." };
  }

  return { ok: true };
}

// Versiones seguras: capturan errores inesperados y devuelven un resultado.
export async function safeGetAgendaEvents(): Promise<AgendaRepoResult<AgendaEvent[]>> {
  try {
    return await getAgendaEvents();
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("getAgendaEvents", e) };
  }
}

export async function safeCreateAgendaEvent(
  input: EventInput,
): Promise<AgendaRepoResult<AgendaEvent>> {
  try {
    return await createAgendaEvent(input);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("createAgendaEvent", e) };
  }
}

export async function safeUpdateAgendaEvent(
  event: AgendaEvent,
): Promise<AgendaRepoResult<AgendaEvent>> {
  try {
    return await updateAgendaEvent(event);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("updateAgendaEvent", e) };
  }
}

export async function safeSoftDeleteAgendaEvent(id: string): Promise<AgendaDeleteResult> {
  try {
    return await softDeleteAgendaEvent(id);
  } catch (e) {
    return { ok: false, error: mapUnknownError("softDeleteAgendaEvent", e) };
  }
}
