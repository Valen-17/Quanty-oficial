import { ArrowUpRight, PackageCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  selectLowStock,
  useInventoryStore,
} from "@/stores/inventoryStore";
import { availabilityLabel, availabilityStyles } from "@/components/quanty/inventory/types";
import { cn } from "@/lib/utils";

export function LowStockPanel() {
  const items = useInventoryStore(selectLowStock);
  const top = items.slice(0, 5);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Stock bajo</h2>
          <p className="text-xs text-muted-foreground">Datos en vivo de tu inventario</p>
        </div>
        {items.length > 0 ? (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning-foreground">
            {items.length} {items.length === 1 ? "alerta" : "alertas"}
          </span>
        ) : (
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">
            Todo OK
          </span>
        )}
      </div>

      {top.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
            <PackageCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sin alertas de stock</p>
          <p className="text-xs text-muted-foreground">
            Todos tus productos están por encima del umbral.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {top.map((item) => {
            const pct = Math.min(100, (item.units / item.threshold) * 100);
            return (
              <li key={item.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="line-clamp-1 font-medium text-foreground">{item.name}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      availabilityStyles[item.availability],
                    )}
                  >
                    {availabilityLabel[item.availability]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        item.availability === "agotado"
                          ? "bg-destructive"
                          : "bg-[image:var(--gradient-primary)]",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {item.units}/{item.threshold}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        to="/inventario"
        className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
      >
        Ver inventario <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
