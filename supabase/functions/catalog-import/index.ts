// Función de Supabase que importa productos y contactos usando una clave de API.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MAX_BODY_BYTES = 1_000_000;
const MAX_ITEMS = 500;
const DEFAULT_THRESHOLD = 5;
const LOOKUP_CHUNK = 100;
const UPDATE_CONCURRENCY = 10;
const API_KEY_RE = /^qk_[A-Za-z0-9_-]{20,100}$/;
const SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

type Skipped = { externalId: string; reason: string };

type ImportSummary = { received: number; created: number; updated: number; skipped: Skipped[] };

type ProductRecord = {
  externalId: string;
  name: string;
  description: string;
  price: number;
  units: number;
  imageUrl: string;
};

type ContactRecord = {
  externalId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
};

type Parsed<T> = { ok: true; value: T } | { ok: false; skipped: Skipped };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Hash de la clave para buscarla sin guardarla en texto plano.
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function readExternalId(raw: Record<string, unknown>): string {
  const value = raw.externalId ?? raw.id;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Valida un producto y lo convierte al formato de Quanty.
function parseProduct(input: unknown): Parsed<ProductRecord> {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const externalId = readExternalId(raw);
  const reject = (reason: string): Parsed<ProductRecord> => ({
    ok: false,
    skipped: { externalId, reason },
  });
  if (externalId.length < 1 || externalId.length > 64) return reject("externalId inválido");
  const name = readText(raw.nombre);
  if (name.length < 2 || name.length > 80)
    return reject("nombre debe tener entre 2 y 80 caracteres");
  const price = raw.precio;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 999_999_999) {
    return reject("precio debe ser un número mayor que 0");
  }
  const units = raw.cantidad;
  if (typeof units !== "number" || !Number.isInteger(units) || units < 0 || units > 999_999) {
    return reject("cantidad debe ser un entero entre 0 y 999999");
  }
  const category = readText(raw.categoria);
  if (category.length > 40) return reject("categoria supera 40 caracteres");
  const description = readText(raw.descripcion) || (category ? `Categoría: ${category}` : "");
  if (description.length > 240) return reject("descripcion supera 240 caracteres");
  const imageUrl = readText(raw.imagen);
  if (imageUrl && (imageUrl.length > 2000 || !isHttpUrl(imageUrl))) {
    return reject("imagen debe ser una URL http o https absoluta");
  }
  return { ok: true, value: { externalId, name, description, price, units, imageUrl } };
}

// Valida un contacto y lo convierte al formato de Quanty.
function parseContact(input: unknown): Parsed<ContactRecord> {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const externalId = readExternalId(raw);
  const reject = (reason: string): Parsed<ContactRecord> => ({
    ok: false,
    skipped: { externalId, reason },
  });
  if (externalId.length < 1 || externalId.length > 64) return reject("externalId inválido");
  const name = readText(raw.nombre);
  if (name.length < 2 || name.length > 80)
    return reject("nombre debe tener entre 2 y 80 caracteres");
  const email = readText(raw.email);
  if (email && (email.length > 120 || !EMAIL_RE.test(email))) return reject("email inválido");
  const phone = readText(raw.telefono);
  if (phone.length > 30) return reject("telefono supera 30 caracteres");
  const company = readText(raw.empresa);
  if (company.length > 80) return reject("empresa supera 80 caracteres");
  const notes = readText(raw.notas);
  if (notes.length > 280) return reject("notas supera 280 caracteres");
  return { ok: true, value: { externalId, name, email, phone, company, notes } };
}

// Separa válidos e inválidos y descarta ids repetidos.
function parseItems<T extends { externalId: string }>(
  items: unknown[],
  parse: (input: unknown) => Parsed<T>,
): { valid: T[]; skipped: Skipped[] } {
  const byId = new Map<string, T>();
  const skipped: Skipped[] = [];
  for (const item of items) {
    const parsed = parse(item);
    if (!parsed.ok) {
      skipped.push(parsed.skipped);
      continue;
    }
    if (byId.has(parsed.value.externalId)) {
      skipped.push({ externalId: parsed.value.externalId, reason: "externalId repetido" });
      continue;
    }
    byId.set(parsed.value.externalId, parsed.value);
  }
  return { valid: Array.from(byId.values()), skipped };
}

async function findExisting(
  admin: SupabaseClient,
  table: "products" | "clients",
  userId: string,
  source: string,
  externalIds: string[],
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (let i = 0; i < externalIds.length; i += LOOKUP_CHUNK) {
    const chunk = externalIds.slice(i, i + LOOKUP_CHUNK);
    const { data, error } = await admin
      .from(table)
      .select("id, external_id")
      .eq("user_id", userId)
      .eq("external_source", source)
      .is("deleted_at", null)
      .in("external_id", chunk);
    if (error) throw new Error(`lookup ${table}: ${error.message}`);
    for (const row of data ?? []) found.set(row.external_id as string, row.id as string);
  }
  return found;
}

async function runInBatches<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += UPDATE_CONCURRENCY) {
    await Promise.all(items.slice(i, i + UPDATE_CONCURRENCY).map(worker));
  }
}

// Actualiza lo que ya existe y crea lo nuevo.
async function upsertRecords<T extends { externalId: string }>(
  admin: SupabaseClient,
  table: "products" | "clients",
  userId: string,
  source: string,
  records: T[],
  toUpdate: (record: T) => Record<string, unknown>,
  toInsert: (record: T) => Record<string, unknown>,
  summary: ImportSummary,
): Promise<void> {
  if (records.length === 0) return;
  const existing = await findExisting(
    admin,
    table,
    userId,
    source,
    records.map((record) => record.externalId),
  );
  const updates = records.filter((record) => existing.has(record.externalId));
  const inserts = records.filter((record) => !existing.has(record.externalId));

  await runInBatches(updates, async (record) => {
    const { error } = await admin
      .from(table)
      .update(toUpdate(record))
      .eq("id", existing.get(record.externalId) as string)
      .eq("user_id", userId);
    if (error) summary.skipped.push({ externalId: record.externalId, reason: error.message });
    else summary.updated += 1;
  });

  if (inserts.length === 0) return;
  const rows = inserts.map((record) => ({
    ...toInsert(record),
    user_id: userId,
    external_source: source,
    external_id: record.externalId,
  }));
  const { error } = await admin.from(table).insert(rows);
  if (error) {
    for (const record of inserts) {
      summary.skipped.push({ externalId: record.externalId, reason: error.message });
    }
    return;
  }
  summary.created += inserts.length;
}

function emptySummary(received: number, skipped: Skipped[]): ImportSummary {
  return { received, created: 0, updated: 0, skipped: [...skipped] };
}

// Punto de entrada: valida la clave, el cuerpo y procesa la importación.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const apiKey = req.headers.get("x-api-key")?.trim() ?? "";
  if (!API_KEY_RE.test(apiKey)) return jsonResponse({ error: "Clave de API inválida" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return jsonResponse({ error: "Servicio no configurado" }, 500);

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const keyHash = await sha256Hex(apiKey);
    const { data: keyRow, error: keyError } = await admin
      .from("api_keys")
      .select("id, user_id")
      .eq("key_hash", keyHash)
      .maybeSingle();
    if (keyError) throw new Error(`api key lookup: ${keyError.message}`);
    if (!keyRow) return jsonResponse({ error: "Clave de API inválida" }, 401);

    await admin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id);

    // GET devuelve el stock actual en Quanty de los productos importados.
    if (req.method === "GET") {
      const source = new URL(req.url).searchParams.get("source")?.trim() || "bruma-cafe";
      if (!SOURCE_RE.test(source)) {
        return jsonResponse({ error: "source debe usar minúsculas, números o guiones" }, 400);
      }
      const { data, error } = await admin
        .from("products")
        .select("external_id, name, units, threshold, price, updated_at")
        .eq("user_id", keyRow.user_id)
        .eq("external_source", source)
        .is("deleted_at", null);
      if (error) throw new Error(`stock lookup: ${error.message}`);
      const productos = (data ?? []).map((row) => ({
        id: row.external_id,
        nombre: row.name,
        cantidad: row.units,
        umbral: row.threshold,
        precio: Number(row.price),
        actualizado: row.updated_at,
      }));
      return jsonResponse({ ok: true, source, productos }, 200);
    }

    const declaredLength = Number(req.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "El cuerpo supera 1 MB" }, 413);
    }
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: "El cuerpo supera 1 MB" }, 413);
    }

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "El cuerpo debe ser un objeto JSON válido" }, 400);
    }

    const source = typeof body.source === "string" ? body.source.trim() : "bruma-cafe";
    if (!SOURCE_RE.test(source)) {
      return jsonResponse({ error: "source debe usar minúsculas, números o guiones" }, 400);
    }

    const rawProducts = body.productos;
    const rawContacts = body.contactos;
    if (rawProducts !== undefined && !Array.isArray(rawProducts)) {
      return jsonResponse({ error: "productos debe ser un arreglo" }, 400);
    }
    if (rawContacts !== undefined && !Array.isArray(rawContacts)) {
      return jsonResponse({ error: "contactos debe ser un arreglo" }, 400);
    }
    const productItems = (rawProducts as unknown[] | undefined) ?? [];
    const contactItems = (rawContacts as unknown[] | undefined) ?? [];
    if (productItems.length === 0 && contactItems.length === 0) {
      return jsonResponse({ error: "Envía al menos un producto o un contacto" }, 400);
    }
    if (productItems.length > MAX_ITEMS || contactItems.length > MAX_ITEMS) {
      return jsonResponse({ error: `Máximo ${MAX_ITEMS} elementos por lista` }, 413);
    }

    const userId = keyRow.user_id as string;
    const products = parseItems(productItems, parseProduct);
    const contacts = parseItems(contactItems, parseContact);
    const productSummary = emptySummary(productItems.length, products.skipped);
    const contactSummary = emptySummary(contactItems.length, contacts.skipped);

    await upsertRecords(
      admin,
      "products",
      userId,
      source,
      products.valid,
      (record) => ({
        name: record.name,
        description: record.description,
        price: String(record.price),
        units: record.units,
        image_url: record.imageUrl,
      }),
      (record) => ({
        name: record.name,
        description: record.description,
        price: String(record.price),
        units: record.units,
        threshold: DEFAULT_THRESHOLD,
        image_url: record.imageUrl,
      }),
      productSummary,
    );

    await upsertRecords(
      admin,
      "clients",
      userId,
      source,
      contacts.valid,
      (record) => ({
        name: record.name,
        email: record.email,
        phone: record.phone,
        company: record.company,
        notes: record.notes,
      }),
      (record) => ({
        name: record.name,
        email: record.email,
        phone: record.phone,
        company: record.company,
        notes: record.notes,
      }),
      contactSummary,
    );

    return jsonResponse({ source, productos: productSummary, contactos: contactSummary }, 200);
  } catch (err) {
    console.error("catalog-import error", err);
    return jsonResponse({ error: "Error interno" }, 500);
  }
});
