import { useEffect, useRef, useState } from "react";
import { X, Package, Upload, Trash2 } from "lucide-react";
import { productSchema, type Product, type ProductInput } from "./types";
import { ProductImage } from "./ProductImage";
import { useInventoryStore } from "@/stores/inventoryStore";

interface Props {
  open: boolean;
  initial?: Product | null;
  onClose: () => void;
  onSubmit: (data: ProductInput, id?: string) => boolean | Promise<boolean>;
}

type FormState = {
  name: string;
  description: string;
  price: string;
  units: string;
  threshold: string;
  imageUrl: string;
};

const empty: FormState = {
  name: "",
  description: "",
  price: "",
  units: "",
  threshold: "10",
  imageUrl: "",
};

function toForm(p: Product): FormState {
  return {
    name: p.name,
    description: p.description ?? "",
    price: String(p.price),
    units: String(p.units),
    threshold: String(p.threshold),
    imageUrl: p.imageUrl ?? "",
  };
}

const MAX_IMAGE_BYTES = 1_500_000; // 1.5MB raw before base64 (~2MB encoded)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function compressImage(file: File, maxDim = 800, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function ProductFormModal({ open, initial, onClose, onSubmit }: Props) {
  const remoteProductsError = useInventoryStore((s) => s.remoteProductsError);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ? toForm(initial) : empty);
      setErrors({});
      setSubmitting(false);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof FormState>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrors((e) => ({ ...e, imageUrl: "Formato no soportado (JPG, PNG, WebP)" }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES * 4) {
      setErrors((e) => ({ ...e, imageUrl: "Imagen demasiado grande (máx 6MB)" }));
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      setForm((f) => ({ ...f, imageUrl: compressed }));
      setErrors((e) => ({ ...e, imageUrl: undefined }));
    } catch {
      setErrors((e) => ({ ...e, imageUrl: "No se pudo procesar la imagen" }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = productSchema.safeParse({
      name: form.name,
      description: form.description,
      price: form.price === "" ? NaN : Number(form.price),
      units: form.units === "" ? NaN : Number(form.units),
      threshold: form.threshold === "" ? NaN : Number(form.threshold),
      imageUrl: form.imageUrl,
    });

    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const ok = await Promise.resolve(
        onSubmit(
          {
            ...parsed.data,
            description: parsed.data.description ?? "",
            imageUrl: parsed.data.imageUrl ?? "",
          },
          initial?.id,
        ),
      );
      if (ok) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card shadow-[var(--shadow-elegant)] animate-in slide-in-from-bottom-4 duration-300 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {initial ? "Editar producto" : "Nuevo producto"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {initial ? "Actualiza los datos de tu insumo." : "Agrega un insumo al inventario."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          {remoteProductsError && (
            <p className="-mt-1 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {remoteProductsError}
            </p>
          )}
          <Field
            label="Imagen"
            hint="JPG, PNG o WebP. Se redimensiona automáticamente."
            error={errors.imageUrl}
          >
            <div className="flex items-center gap-3">
              <ProductImage src={form.imageUrl} alt={form.name || "Producto"} size="lg" />
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Procesando…" : form.imageUrl ? "Cambiar imagen" : "Subir imagen"}
                </button>
                {form.imageUrl && (
                  <button
                    type="button"
                    onClick={() => set("imageUrl", "")}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Quitar
                  </button>
                )}
              </div>
            </div>
          </Field>

          <Field label="Nombre" error={errors.name} required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={80}
              placeholder="Ej. Cemento gris 50kg"
              className={inputCls(!!errors.name)}
            />
          </Field>

          <Field label="Descripción" error={errors.description}>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={240}
              rows={2}
              placeholder="Detalles del producto"
              className={inputCls(!!errors.description) + " resize-none"}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio (COP)" error={errors.price} required>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0"
                className={inputCls(!!errors.price)}
              />
            </Field>
            <Field label="Unidades" error={errors.units} required>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step="1"
                value={form.units}
                onChange={(e) => set("units", e.target.value)}
                placeholder="0"
                className={inputCls(!!errors.units)}
              />
            </Field>
          </div>

          <Field
            label="Umbral de alerta"
            hint="Por debajo de este número el producto aparece como “Pocas unidades”."
            error={errors.threshold}
            required
          >
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step="1"
              value={form.threshold}
              onChange={(e) => set("threshold", e.target.value)}
              className={inputCls(!!errors.threshold)}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || uploading}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
            >
              {submitting ? "Guardando…" : initial ? "Guardar cambios" : "Agregar producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

function inputCls(hasError: boolean) {
  return (
    "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-colors " +
    (hasError
      ? "border-destructive focus:ring-destructive/30"
      : "border-input focus:border-ring focus:ring-ring/20")
  );
}
