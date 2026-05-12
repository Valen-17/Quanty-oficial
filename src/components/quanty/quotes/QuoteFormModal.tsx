import { useEffect, useMemo, useState } from "react";
import { X, FileText, Search, Plus, Minus, Trash2, AlertTriangle } from "lucide-react";
import {
  calcTotals,
  quoteInputSchema,
  type QuoteInput,
  type QuoteItem,
} from "@/stores/quotesStore";
import { useInventoryStore } from "@/stores/inventoryStore";
import { useClientsStore, type ClientInput } from "@/stores/clientsStore";
import { ClientCombobox } from "@/components/quanty/clients/ClientCombobox";
import { ClientFormModal } from "@/components/quanty/clients/ClientFormModal";
import { ProductImage } from "@/components/quanty/inventory/ProductImage";
import { fmtCOP } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (data: QuoteInput) => void;
}

export function QuoteFormModal({ open, onClose, onCreated }: Props) {
  const products = useInventoryStore((s) => s.products);
  const createClient = useClientsStore((s) => s.createClient);

  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [laborPercent, setLaborPercent] = useState("20");
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clientModalOpen, setClientModalOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setClientId(undefined);
      setClientName("");
      setNotes("");
      setLaborPercent("20");
      setItems([]);
      setQuery("");
      setErrors({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => p.units > 0 || items.some((i) => i.productId === p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query, items]);

  const totals = useMemo(
    () => calcTotals(items, Number(laborPercent) || 0),
    [items, laborPercent],
  );

  const addItem = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) => {
      const found = prev.find((i) => i.productId === productId);
      if (found) {
        // No exceder stock disponible
        if (found.quantity >= p.units) return prev;
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        { productId: p.id, name: p.name, unitPrice: p.price, quantity: 1 },
      ];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) =>
      prev
        .map((i) =>
          i.productId === productId
            ? { ...i, quantity: Math.min(p.units, Math.max(0, i.quantity + delta)) }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (productId: string) =>
    setItems((prev) => prev.filter((i) => i.productId !== productId));

  // Stock disponible por producto en el contexto del item ya agregado
  const stockOf = (productId: string) =>
    products.find((p) => p.id === productId)?.units ?? 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-card shadow-[var(--shadow-elegant)] animate-in slide-in-from-bottom-4 duration-300 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Nueva cotización</h2>
              <p className="text-xs text-muted-foreground">
                Selecciona insumos del inventario y define la mano de obra.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = quoteInputSchema.safeParse({
              clientId,
              clientName,
              clientNameSnapshot: clientName,
              notes,
              laborPercent: laborPercent === "" ? NaN : Number(laborPercent),
              items,
            });
            if (!parsed.success) {
              const errs: Record<string, string> = {};
              for (const issue of parsed.error.issues) {
                const key = String(issue.path[0]);
                if (!errs[key]) errs[key] = issue.message;
              }
              setErrors(errs);
              return;
            }
            (onCreated as unknown as (d: QuoteInput) => void)({
              ...parsed.data,
              notes: parsed.data.notes ?? "",
            });
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-5">
            {/* Catálogo */}
            <div className="border-b border-border md:col-span-2 md:border-b-0 md:border-r">
              <div className="p-4">
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  Insumos del inventario
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value.slice(0, 60))}
                    placeholder="Buscar producto"
                    className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto px-2 pb-3 md:max-h-[44vh]">
                {filteredProducts.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No hay productos disponibles. Agrega stock en el inventario.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filteredProducts.map((p) => {
                      const inCart = items.find((i) => i.productId === p.id)?.quantity ?? 0;
                      const remaining = p.units - inCart;
                      const disabled = remaining <= 0;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => addItem(p.id)}
                            disabled={disabled}
                            className={cn(
                              "group flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                              disabled ? "cursor-not-allowed opacity-50" : "hover:bg-primary/5",
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <ProductImage src={p.imageUrl} alt={p.name} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {p.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {fmtCOP.format(p.price)} · stock: {p.units}
                                </p>
                              </div>
                            </div>
                            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                              + Agregar
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Items y datos */}
            <div className="flex min-h-0 flex-col md:col-span-3">
              <div className="space-y-3 border-b border-border p-4">
                <Field label="Cliente" error={errors.clientName} required>
                  <ClientCombobox
                    value={clientName}
                    onChange={(name) => {
                      setClientName(name);
                    }}
                    onSelectClient={(client) => {
                      setClientId(client.id);
                    }}
                    onCreateNew={() => setClientModalOpen(true)}
                    error={!!errors.clientName}
                  />
                </Field>
                <Field
                  label={`Mano de obra (${Number(laborPercent) || 0}%)`}
                  error={errors.laborPercent}
                  required
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={laborPercent}
                      onChange={(e) => setLaborPercent(e.target.value)}
                      className="flex-1 accent-[oklch(0.48_0.22_295)]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={laborPercent}
                      onChange={(e) => setLaborPercent(e.target.value)}
                      className={cn(inputCls(!!errors.laborPercent), "w-20 text-right")}
                    />
                  </div>
                </Field>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between px-4 pt-3">
                  <p className="text-xs font-semibold text-foreground">
                    Insumos seleccionados{" "}
                    <span className="text-muted-foreground">({items.length})</span>
                  </p>
                  {errors.items && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                      <AlertTriangle className="h-3 w-3" /> {errors.items}
                    </span>
                  )}
                </div>
                <div className="min-h-[8rem] flex-1 overflow-y-auto px-2 py-2">
                  {items.length === 0 ? (
                    <div className="m-2 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                      <p className="text-sm font-medium text-foreground">Sin insumos</p>
                      <p className="text-xs text-muted-foreground">
                        Selecciona productos del catálogo de la izquierda.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {items.map((it) => {
                        const max = stockOf(it.productId);
                        return (
                          <li key={it.productId} className="flex items-center gap-2 px-2 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{it.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {fmtCOP.format(it.unitPrice)} · máx {max}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateQty(it.productId, -1)}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label="Disminuir cantidad"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="min-w-[2rem] text-center font-mono text-sm font-bold text-foreground">
                                {it.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQty(it.productId, 1)}
                                disabled={it.quantity >= max}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Aumentar cantidad"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <span className="hidden w-24 text-right font-mono text-sm font-semibold text-foreground sm:inline">
                              {fmtCOP.format(it.unitPrice * it.quantity)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeItem(it.productId)}
                              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Quitar insumo"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="border-t border-border p-4">
                  <Field label="Notas (opcional)" error={errors.notes}>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={280}
                      rows={2}
                      placeholder="Condiciones, plazos, observaciones…"
                      className={cn(inputCls(!!errors.notes), "resize-none")}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </div>

          {/* Resumen + acciones */}
          <div className="border-t border-border bg-muted/30 px-5 py-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Total label="Subtotal" value={fmtCOP.format(totals.subtotal)} />
              <Total
                label={`Mano de obra ${Number(laborPercent) || 0}%`}
                value={fmtCOP.format(totals.laborAmount)}
              />
              <Total label="Total" value={fmtCOP.format(totals.total)} accent />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5"
              >
                Crear borrador
              </button>
            </div>
          </div>
        </form>
      </div>

      <ClientFormModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        onSubmit={(data: ClientInput) => {
          const c = createClient(data);
          setClientId(c.id);
          setClientName(c.name);
          setClientModalOpen(false);
        }}
      />
    </div>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
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
      {error && <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>}
    </label>
  );
}

function Total({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-3 py-2",
        accent ? "border-primary/30 bg-primary/5" : "border-border",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-sm font-bold tabular-nums sm:text-base",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-colors",
    hasError
      ? "border-destructive focus:ring-destructive/30"
      : "border-input focus:border-ring focus:ring-ring/20",
  );
}
