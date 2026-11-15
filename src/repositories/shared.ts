// Utilidades comunes de los repositorios de Supabase.

import { supabase } from "@/integrations/supabase/client";

// Resultado de una operación: los datos o un mensaje de error.
export type RepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; data: null; error: string; code?: string };

export type RepoDeleteResult = { ok: true } | { ok: false; error: string };

type SupabaseErrorLike = { message?: string; code?: string; details?: string } | null;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const UNIQUE_VIOLATION = "23505";

// Indica si el id es un UUID creado por Supabase.
export function isRemoteEntityId(id: string): boolean {
  return UUID_V4.test(id.trim());
}

// Convierte un error de Supabase en un mensaje legible.
export function formatSupabaseError(prefix: string, err: SupabaseErrorLike): string {
  if (!err) return `${prefix}: respuesta sin detalle.`;
  const parts = [err.message, err.code, err.details].filter(Boolean);
  return parts.length ? `${prefix}: ${parts.join(" — ")}` : `${prefix}: error desconocido.`;
}

// Mensaje para errores inesperados, como fallas de red.
export function mapUnknownError(prefix: string, error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return `${prefix}: ${m}`;
  }
  return `${prefix}: error de red o respuesta inválida.`;
}

// Atajo para devolver un error conservando su código.
export function failure<T>(prefix: string, err: SupabaseErrorLike): RepoResult<T> {
  return {
    ok: false,
    data: null,
    error: formatSupabaseError(prefix, err),
    code: err?.code ?? undefined,
  };
}

// Lee el usuario de la sesión local sin ir a la red.
export async function getSessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// Exige sesión iniciada antes de tocar datos remotos.
export async function requireAuthUserId(featureLabel: string): Promise<RepoResult<string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return { ok: false, data: null, error: formatSupabaseError("Auth", error) };
  }
  const id = data.session?.user?.id;
  if (!id) {
    return { ok: false, data: null, error: `Debes iniciar sesión para usar ${featureLabel}.` };
  }
  return { ok: true, data: id };
}
