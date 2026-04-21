import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, Package, ShoppingBag, FileClock, Plus, FileText } from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { KpiCard } from "@/components/quanty/KpiCard";
import { RevenueChart } from "@/components/quanty/RevenueChart";
import { LowStockPanel } from "@/components/quanty/LowStockPanel";
import { QuoteFormModal } from "@/components/quanty/quotes/QuoteFormModal";
import { QuoteDetailModal } from "@/components/quanty/quotes/QuoteDetailModal";
import {
  selectInventoryCount,
  selectInventoryValue,
  useInventoryStore,
} from "@/stores/inventoryStore";
import {
  quoteStatusLabel,
  quoteStatusStyles,
  useQuotesStore,
  type Quote,
  type QuoteInput,
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
  const quotes = useQuotesStore((s) => s.quotes);
  const createQuote = useQuotesStore((s) => s.createQuote);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [openQuote, setOpenQuote] = useState<Quote | null>(null);

  const liveOpenQuote = openQuote ? quotes.find((q) => q.id === openQuote.id) ?? null : null;

  const handleCreate = (data: QuoteInput) => {
    const q = createQuote(data);
    setQuoteModalOpen(false);
    setOpenQuote(q);
  };

  const recentQuotes = useMemo(
    () => [...quotes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [quotes],
  );

  const pendingCount = useMemo(
    () => quotes.filter((q) => q.status === "borrador" || q.status === "enviada").length,
    [quotes],
  );

  const approvedTotal = useMemo(
    () => quotes.filter((q) => q.status === "aprobada").reduce((s, q) => s + q.total, 0),
    [quotes],
  );

  return (
    <AppLayout
      title="Hola, Isabella 👋"
      subtitle="Este es el resumen de tu negocio en tiempo real."
      actions={
        <>
          <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
            Exportar
          </button>
          <button
            onClick={() => setQuoteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> Nueva cotización
          </button>
        </>
      }
    >
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ingresos aprobados"
          value={fmtCOP.format(approvedTotal)}
          hint={`${quotes.filter((q) => q.status === "aprobada").length} cotizaciones`}
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
          label="Cotizaciones totales"
          value={quotes.length.toString()}
          hint="Acumulado histórico"
          icon={ShoppingBag}
          accent="warning"
        />
        <KpiCard
          label="Cotizaciones pendientes"
          value={pendingCount.toString()}
          hint="Borradores y enviadas"
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
          <Link
            to="/cotizaciones"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Ver todas
          </Link>
        </div>
        {recentQuotes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <p className="font-display text-base font-bold text-foreground">
              Aún no tienes cotizaciones
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crea tu primera cotización para verla aquí en tiempo real.
            </p>
            <Link
              to="/cotizaciones"
              className="mt-1 inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Nueva cotización
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 sm:px-6">Folio</th>
                  <th className="px-5 py-3 sm:px-6">Cliente</th>
                  <th className="px-5 py-3 sm:px-6">Fecha</th>
                  <th className="px-5 py-3 text-right sm:px-6">Monto</th>
                  <th className="px-5 py-3 sm:px-6">Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => setOpenQuote(q)}
                    className="cursor-pointer border-t border-border transition-colors hover:bg-muted/50"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground sm:px-6">
                      {q.folio}
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground sm:px-6">
                      {q.clientName}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground sm:px-6">
                      {fmtDate.format(q.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-foreground sm:px-6">
                      {fmtCOP.format(q.total)}
                    </td>
                    <td className="px-5 py-3 sm:px-6">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          quoteStatusStyles[q.status],
                        )}
                      >
                        {quoteStatusLabel[q.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
