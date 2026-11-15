import { supabase } from "@/integrations/supabase/client";
import {
  formatSupabaseError,
  mapUnknownError,
  requireAuthUserId,
  type RepoDeleteResult,
  type RepoResult,
} from "@/repositories/shared";

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface CreatedApiKey {
  summary: ApiKeySummary;
  secret: string;
}

const SECRET_PREFIX = "qk_";
const VISIBLE_PREFIX_LENGTH = 10;
const SUMMARY_COLUMNS = "id, name, key_prefix, created_at, last_used_at";
const FEATURE_LABEL = "claves de integración";

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return SECRET_PREFIX + toBase64Url(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function rowToSummary(row: ApiKeyRow): ApiKeySummary {
  const lastUsed = row.last_used_at ? Date.parse(row.last_used_at) : NaN;
  return {
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    createdAt: Date.parse(row.created_at),
    lastUsedAt: Number.isFinite(lastUsed) ? lastUsed : null,
  };
}

export function catalogImportEndpoint(): string {
  const base = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/functions/v1/catalog-import`;
}

export async function listApiKeys(): Promise<RepoResult<ApiKeySummary[]>> {
  const auth = await requireAuthUserId(FEATURE_LABEL);
  if (!auth.ok) return auth;
  const { data, error } = await supabase
    .from("api_keys")
    .select(SUMMARY_COLUMNS)
    .eq("user_id", auth.data)
    .order("created_at", { ascending: false });
  if (error) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudieron cargar las claves", error),
    };
  }
  return { ok: true, data: (data ?? []).map(rowToSummary) };
}

export async function createApiKey(name: string): Promise<RepoResult<CreatedApiKey>> {
  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 60) {
    return { ok: false, data: null, error: "El nombre debe tener entre 2 y 60 caracteres." };
  }
  const auth = await requireAuthUserId(FEATURE_LABEL);
  if (!auth.ok) return auth;
  const secret = generateSecret();
  const keyHash = await sha256Hex(secret);
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: auth.data,
      name: cleanName,
      key_prefix: secret.slice(0, VISIBLE_PREFIX_LENGTH),
      key_hash: keyHash,
    })
    .select(SUMMARY_COLUMNS)
    .single();
  if (error) {
    const limitReached = error.message?.includes("API_KEYS_LIMIT_REACHED");
    return {
      ok: false,
      data: null,
      error: limitReached
        ? "Llegaste al máximo de 10 claves. Revoca una antes de crear otra."
        : formatSupabaseError("No se pudo crear la clave", error),
    };
  }
  return { ok: true, data: { summary: rowToSummary(data), secret } };
}

export async function deleteApiKey(id: string): Promise<RepoDeleteResult> {
  const auth = await requireAuthUserId(FEATURE_LABEL);
  if (!auth.ok) return { ok: false, error: auth.error };
  const { data, error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.data)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: formatSupabaseError("No se pudo revocar la clave", error) };
  if (!data) return { ok: false, error: "La clave no existe o ya fue revocada." };
  return { ok: true };
}

export async function safeListApiKeys(): Promise<RepoResult<ApiKeySummary[]>> {
  try {
    return await listApiKeys();
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("listApiKeys", e) };
  }
}

export async function safeCreateApiKey(name: string): Promise<RepoResult<CreatedApiKey>> {
  try {
    return await createApiKey(name);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("createApiKey", e) };
  }
}

export async function safeDeleteApiKey(id: string): Promise<RepoDeleteResult> {
  try {
    return await deleteApiKey(id);
  } catch (e) {
    return { ok: false, error: mapUnknownError("deleteApiKey", e) };
  }
}
