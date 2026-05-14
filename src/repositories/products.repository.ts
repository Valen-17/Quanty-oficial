import { productInputSchema, type Product, type ProductInput } from "@/domain/entities";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database.types";

export type ProductRow = Tables<"products">;

export type ProductsRepoResult<T> =
  | { ok: true; data: T }
  | { ok: false; data: null; error: string };

export type ProductsDeleteResult = { ok: true } | { ok: false; error: string };

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRemoteProductId(id: string): boolean {
  return UUID_V4.test(id.trim());
}

function parsePriceFromRow(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function formatSupabaseError(
  prefix: string,
  err: { message?: string; code?: string; details?: string } | null,
): string {
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

async function requireAuthUserId(): Promise<ProductsRepoResult<string>> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return { ok: false, data: null, error: formatSupabaseError("Auth", error) };
  }
  const id = data.user?.id;
  if (!id) {
    return { ok: false, data: null, error: "Debes iniciar sesión para usar productos remotos." };
  }
  return { ok: true, data: id };
}

export function productRowToDomain(row: ProductRow): Product {
  const price = parsePriceFromRow(row.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Precio inválido en fila de producto ${row.id}`);
  }
  return {
    id: row.id,
    name: row.name.trim(),
    description: row.description ?? "",
    price,
    units: row.units,
    threshold: row.threshold,
    imageUrl: row.image_url ?? "",
  };
}

function productRowToDomainSafe(row: ProductRow): ProductsRepoResult<Product> {
  try {
    return { ok: true, data: productRowToDomain(row) };
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: e instanceof Error ? e.message : "Fila de producto con datos inconsistentes.",
    };
  }
}

export async function getProducts(): Promise<ProductsRepoResult<Product[]>> {
  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudieron cargar los productos", error),
    };
  }

  const rows = (data ?? []) as ProductRow[];
  const out: Product[] = [];
  for (const row of rows) {
    const mapped = productRowToDomainSafe(row);
    if (!mapped.ok) {
      return { ok: false, data: null, error: mapped.error };
    }
    out.push(mapped.data);
  }
  return { ok: true, data: out };
}

export async function createProduct(input: ProductInput): Promise<ProductsRepoResult<Product>> {
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, data: null, error: `Datos inválidos: ${msg}` };
  }

  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const v = parsed.data;
  const { data, error } = await supabase
    .from("products")
    .insert({
      user_id: auth.data,
      name: v.name.trim(),
      description: v.description ?? "",
      price: String(v.price),
      units: v.units,
      threshold: v.threshold,
      image_url: v.imageUrl ?? "",
    })
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudo crear el producto", error),
    };
  }
  if (!data) {
    return { ok: false, data: null, error: "El servidor no devolvió el producto creado." };
  }

  return productRowToDomainSafe(data as ProductRow);
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ProductsRepoResult<Product>> {
  if (!isRemoteProductId(id)) {
    return {
      ok: false,
      data: null,
      error: "Este producto solo existe en local (sin UUID remoto).",
    };
  }

  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { ok: false, data: null, error: `Datos inválidos: ${msg}` };
  }

  const auth = await requireAuthUserId();
  if (!auth.ok) return auth;

  const v = parsed.data;
  const { data, error } = await supabase
    .from("products")
    .update({
      name: v.name.trim(),
      description: v.description ?? "",
      price: String(v.price),
      units: v.units,
      threshold: v.threshold,
      image_url: v.imageUrl ?? "",
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      data: null,
      error: formatSupabaseError("No se pudo actualizar el producto", error),
    };
  }
  if (!data) {
    return { ok: false, data: null, error: "Producto no encontrado o sin permiso (RLS)." };
  }

  return productRowToDomainSafe(data as ProductRow);
}

export async function softDeleteProduct(id: string): Promise<ProductsDeleteResult> {
  if (!isRemoteProductId(id)) {
    return { ok: false, error: "Este producto solo existe en local (sin UUID remoto)." };
  }

  const auth = await requireAuthUserId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("products")
    .update({ deleted_at: now })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: formatSupabaseError("No se pudo archivar el producto", error) };
  }
  if (!data) {
    return { ok: false, error: "Producto no encontrado, ya archivado o sin permiso." };
  }

  return { ok: true };
}

export async function safeGetProducts(): Promise<ProductsRepoResult<Product[]>> {
  try {
    return await getProducts();
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("getProducts", e) };
  }
}

export async function safeCreateProduct(input: ProductInput): Promise<ProductsRepoResult<Product>> {
  try {
    return await createProduct(input);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("createProduct", e) };
  }
}

export async function safeUpdateProduct(
  id: string,
  input: ProductInput,
): Promise<ProductsRepoResult<Product>> {
  try {
    return await updateProduct(id, input);
  } catch (e) {
    return { ok: false, data: null, error: mapUnknownError("updateProduct", e) };
  }
}

export async function safeSoftDeleteProduct(id: string): Promise<ProductsDeleteResult> {
  try {
    return await softDeleteProduct(id);
  } catch (e) {
    return { ok: false, error: mapUnknownError("softDeleteProduct", e) };
  }
}
