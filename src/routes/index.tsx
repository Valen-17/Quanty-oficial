import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Wallet, Package, ShoppingBag, FileClock, Plus, FileText } from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { KpiCard } from "@/components/quanty/KpiCard";
import { RevenueChart } from "@/components/quanty/RevenueChart";
import { LowStockPanel } from "@/components/quanty/LowStockPanel";
import {
  selectInventoryCount,
  selectInventoryValue,
  useInventoryStore,
} from "@/stores/inventoryStore";
import {
  quoteStatusLabel,
  quoteStatusStyles,
  useQuotesStore,
} from "@/stores/quotesStore";
import { fmtCOP, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Quanty" },
      {
        name: "description",
        content:
          "Quanty: gestión de insumos, cotizaciones y finanzas para microempresas y trabajadores independientes.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const inventoryValue = useInventoryStore(selectInventoryValue);
  const inventoryCount = useInventoryStore(selectInventoryCount);

  return (
    <AppLayout
      title="Hola, Isabella 👋"
      subtitle="Este es el resumen de tu negocio en tiempo real."
      actions={
        <>
          <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
            Exportar
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5">
            <Plus className="h-4 w-4" /> Nueva cotización
          </button>
        </>
      }
    >
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Utilidades del mes"
          value="$8.420.000"
          delta={12.5}
          hint="vs. mes anterior"
          icon={Wallet}
          accent="primary"
        />
        <KpiCard
          label="Valor del inventario"
          value={fmtCOP.format(inventoryValue)}
          hint={`${inventoryCount} ${inventoryCount === 1 ? "producto" : "productos"}`}
          icon={Package}
          accent="success"
        />
        <KpiCard
          label="Ventas del mes"
          value="$13.960.000"
          delta={-4.1}
          hint="42 ventas"
          icon={ShoppingBag}
          accent="warning"
        />
        <KpiCard
          label="Cotizaciones pendientes"
          value="7"
          hint="3 vencen esta semana"
          icon={FileClock}
          accent="muted"
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart />
        </div>

        <LowStockPanel />
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              Cotizaciones recientes
            </h2>
            <p className="text-sm text-muted-foreground">Últimos movimientos comerciales</p>
          </div>
          <button className="text-sm font-semibold text-primary hover:underline">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 sm:px-6">Folio</th>
                <th className="px-5 py-3 sm:px-6">Cliente</th>
                <th className="px-5 py-3 text-right sm:px-6">Monto</th>
                <th className="px-5 py-3 sm:px-6">Estado</th>
              </tr>
            </thead>
            <tbody>
              {recentQuotes.map((q) => (
                <tr
                  key={q.id}
                  className="border-t border-border transition-colors hover:bg-muted/50"
                >
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground sm:px-6">
                    {q.id}
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground sm:px-6">{q.client}</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-foreground sm:px-6">
                    {fmtCOP.format(q.amount)}
                  </td>
                  <td className="px-5 py-3 sm:px-6">
                    <span
                      className={
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold " +
                        (q.status === "Aprobada"
                          ? "bg-success/15 text-success"
                          : q.status === "Pendiente"
                            ? "bg-warning/20 text-warning-foreground"
                            : "bg-primary/10 text-primary")
                      }
                    >
                      {q.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
}
