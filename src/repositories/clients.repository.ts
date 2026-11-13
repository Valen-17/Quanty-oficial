import { clientInputSchema, type Client, type ClientInput } from "@/domain/entities";
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

export type ClientRow = Tables<"clients">;

export type ClientsRepoResult<T> = RepoResult<T>;

export type ClientsDeleteResult = RepoDeleteResult;

export const isRemoteClientId = isRemoteEntityId;

function parseTimestamp(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export function clientRowToDomain(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name.trim(),
    email: row.email ?? "",
    phone: row.phone ?? "",
    company: row.company ?? "",
    notes: row.notes ?? "",
    createdAt: parseTimestamp(row.created_at),
  };
}

export async function getClients(): Promise<ClientsRepoResult<Client[]>> {
  const auth = await requireAuthUserId("clientes remotos");
  if (!auth.ok) return auth;

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", auth.data)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudieron cargar los clientes", error),
    };
  }

  const rows = (data ?? []) as ClientRow[];
  return { ok: true, data: rows.map(clientRowToDomain) };
}

export async function createClient(input: ClientInput): Promise<ClientsRepoResult<Client>> {
  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, data: null, error: `Datos inválidos: ${msg}` };
  }

  const auth = await requireAuthUserId("clientes remotos");
  if (!auth.ok) return auth;

  const v = parsed.data;
  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: auth.data,
      name: v.name.trim(),
      email: v.email ?? "",
      phone: v.phone ?? "",
      company: v.company ?? "",
      notes: v.notes ?? "",
    })
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudo crear el cliente", error),
    };
  }
  if (!data) {
    return { ok: false, data: null, error: "El servidor no devolvió el cliente creado." };
  }

  return { ok: true, data: clientRowToDomain(data as ClientRow) };
}

export async function updateClient(
  id: string,
  input: ClientInput,
): Promise<ClientsRepoResult<Client>> {
  if (!isRemoteClientId(id)) {
    return { ok: false, data: null, error: "Este cliente solo existe en local (sin UUID remoto)." };
  }

  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, data: null, error: `Datos inválidos: ${msg}` };
  }

  const auth = await requireAuthUserId("clientes remotos");
  if (!auth.ok) return auth;

  const v = parsed.data;
  const { data, error } = await supabase
    .from("clients")
    .update({
      name: v.name.trim(),
      email: v.email ?? "",
      phone: v.phone ?? "",
      company: v.company ?? "",
      notes: v.notes ?? "",
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudo actualizar el cliente", error),
    };
  }
  if (!data) {
    return { ok: false, data: null, error: "Cliente no encontrado o sin permiso (RLS)." };
  }

  return { ok: true, data: clientRowToDomain(data as ClientRow) };
}

export async function softDeleteClient(id: string): Promise<ClientsDeleteResult> {
  if (!isRemoteClientId(id)) {
    return { ok: false, error: "Este cliente solo existe en local (sin UUID remoto)." };
  }

  const auth = await requireAuthUserId("clientes remotos");
  if (!auth.ok) return { ok: false, error: auth.error };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("clients")
    .update({ deleted_at: now })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: formatSupabaseError("No se pudo archivar el cliente", error) };
  }
  if (!data) {
    return { ok: false, error: "Cliente no encontrado, ya archivado o sin permiso." };
  }

  return { ok: true };
}

export async function safeGetClients(): Promise<ClientsRepoResult<Client[]>> {
  try {
    return await getClients();
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("getClients", e) };
  }
}

export async function safeCreateClient(input: ClientInput): Promise<ClientsRepoResult<Client>> {
  try {
    return await createClient(input);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("createClient", e) };
  }
}

export async function safeUpdateClient(
  id: string,
  input: ClientInput,
): Promise<ClientsRepoResult<Client>> {
  try {
    return await updateClient(id, input);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("updateClient", e) };
  }
}

export async function safeSoftDeleteClient(id: string): Promise<ClientsDeleteResult> {
  try {
    return await softDeleteClient(id);
  } catch (e) {
    return { ok: false, error: mapUnknownError("softDeleteClient", e) };
  }
}
