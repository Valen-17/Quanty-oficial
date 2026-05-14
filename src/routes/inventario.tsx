import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Package, Pencil, Trash2, Minus, Plus as PlusIcon } from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { ProductFormModal } from "@/components/quanty/inventory/ProductFormModal";
import { ProductImage } from "@/components/quanty/inventory/ProductImage";
import {
  availabilityLabel,
  availabilityStyles,
  getAvailability,
  type Availability,
  type Product,
  type ProductInput,
} from "@/components/quanty/inventory/types";
import { useFmtMoney } from "@/hooks/useFmtCurrency";
import { cn } from "@/lib/utils";
import { isRemoteProductId } from "@/repositories/products.repository";
import { useInventoryStore } from "@/stores/inventoryStore";

export const Route = createFileRoute("/inventario")({
  head: () => ({
    meta: [
      { title: "Inventario · Quanty" },
      {
        name: "description",
        content: "Gestiona productos, stock y disponibilidad de tu inventario.",
      },
    ],
  }),
  component: InventarioPage,
});

type Filter = "todos" | Availability;

const filters: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "disponible", label: "Disponible" },
  { id: "pocas", label: "Pocas unidades" },
  { id: "agotado", label: "Agotado" },
];

function InventarioPage() {
  const fmtMoney = useFmtMoney();
  const products = useInventoryStore((s) => s.products);
  const createProductOnRemote = useInventoryStore((s) => s.createProductOnRemote);
  const updateProductOnRemote = useInventoryStore((s) => s.updateProductOnRemote);
  const softDeleteProductOnRemote = useInventoryStore((s) => s.softDeleteProductOnRemote);
  const updateProduct = useInventoryStore((s) => s.updateProduct);
  const deleteProduct = useInventoryStore((s) => s.deleteProduct);
  const adjustStock = useInventoryStore((s) => s.adjustStock);
  const remoteProductsError = useInventoryStore((s) => s.remoteProductsError);
  const clearRemoteProductsError = useInventoryStore((s) => s.clearRemoteProductsError);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQ =
        !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      const matchesF = filter === "todos" || getAvailability(p) === filter;
      return matchesQ && matchesF;
    });
  }, [products, query, filter]);

  const counts = useMemo(() => {
    const acc: Record<Availability, number> = { agotado: 0, pocas: 0, disponible: 0 };
    for (const p of products) acc[getAvailability(p)]++;
    return acc;
  }, [products]);

  const totalValue = useMemo(
    () => products.reduce((sum, p) => sum + p.price * p.units, 0),
    [products],
  );

  const handleSubmit = async (data: ProductInput, id?: string) => {
    if (id && isRemoteProductId(id)) {
      return await updateProductOnRemote(id, data);
    }
    if (id) {
      updateProduct(id, data);
      return true;
    }
    const created = await createProductOnRemote(data);
    return created !== null;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto del inventario?")) return;
    if (isRemoteProductId(id)) {
      await softDeleteProductOnRemote(id);
    } else {
      deleteProduct(id);
    }
  };

  const openNew = () => {
    clearRemoteProductsError();
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (p: Product) => {
    clearRemoteProductsError();
    setEditing(p);
    setModalOpen(true);
  };

  return (
    <AppLayout
      title="Inventario"
      subtitle="Controla tus productos, stock y disponibilidad."
      actions={
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" /> Agregar producto
        </button>
      }
    >
      {remoteProductsError && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p className="min-w-0 flex-1">{remoteProductsError}</p>
          <button
            type="button"
            onClick={() => clearRemoteProductsError()}
            className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Resumen rápido */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Total productos" value={products.length.toString()} />
        <SummaryStat label="Disponibles" value={counts.disponible.toString()} accent="success" />
        <SummaryStat label="Pocas unidades" value={counts.pocas.toString()} accent="warning" />
        <SummaryStat label="Valor inventario" value={fmtMoney(totalValue)} accent="primary" />
      </section>

      {/* Toolbar: buscador + filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 80))}
            maxLength={80}
            placeholder="Buscar por nombre o descripción"
            className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-lg bg-muted p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                filter === f.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 sm:px-5">Producto</th>
                <th className="px-4 py-3 sm:px-5">Descripción</th>
                <th className="px-4 py-3 text-right sm:px-5">Precio</th>
                <th className="px-4 py-3 text-center sm:px-5">Stock</th>
                <th className="px-4 py-3 sm:px-5">Estado</th>
                <th className="px-4 py-3 text-right sm:px-5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <EmptyState onCreate={openNew} hasFilter={query !== "" || filter !== "todos"} />
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const av = getAvailability(p);
                  return (
                    <tr
                      key={p.id}
                      className="border-t border-border transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-3">
                          <ProductImage src={p.imageUrl} alt={p.name} size="md" />
                          <div className="font-semibold text-foreground">{p.name}</div>
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-muted-foreground sm:px-5">
                        <span className="line-clamp-1">{p.description || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground sm:px-5">
                        {fmtMoney(p.price)}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => adjustStock(p.id, -1)}
                            disabled={p.units === 0}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Disminuir stock de ${p.name}`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[2.5rem] text-center font-mono font-bold text-foreground tabular-nums">
                            {p.units}
                          </span>
                          <button
                            onClick={() => adjustStock(p.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-all hover:border-success/40 hover:bg-success/10 hover:text-success"
                            aria-label={`Aumentar stock de ${p.name}`}
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            availabilityStyles[av],
                          )}
                        >
                          {availabilityLabel[av]}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                            aria-label={`Editar ${p.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Eliminar ${p.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="border-t border-border bg-muted/30 px-5 py-2.5 text-xs text-muted-foreground">
            Mostrando <span className="font-semibold text-foreground">{filtered.length}</span> de{" "}
            <span className="font-semibold text-foreground">{products.length}</span> productos
          </div>
        )}
      </div>

      <ProductFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => {
          setModalOpen(false);
          clearRemoteProductsError();
        }}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  );
}

function SummaryStat({
  label,
  value,
  accent = "muted",
}: {
  label: string;
  value: string;
  accent?: "muted" | "success" | "warning" | "primary";
}) {
  const accents: Record<string, string> = {
    muted: "text-foreground",
    success: "text-success",
    warning: "text-warning-foreground",
    primary: "text-primary",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-xl font-bold sm:text-2xl", accents[accent])}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ onCreate, hasFilter }: { onCreate: () => void; hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Package className="h-6 w-6" />
      </div>
      <p className="font-display text-base font-bold text-foreground">
        {hasFilter ? "Sin resultados" : "Aún no tienes productos"}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {hasFilter
          ? "Prueba con otra búsqueda o cambia los filtros."
          : "Agrega tu primer insumo para empezar a controlar tu inventario."}
      </p>
      {!hasFilter && (
        <button
          onClick={onCreate}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Agregar producto
        </button>
      )}
    </div>
  );
}
