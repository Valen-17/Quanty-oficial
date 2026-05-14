import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, FileText, Eye } from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { QuoteFormModal } from "@/components/quanty/quotes/QuoteFormModal";
import { QuoteDetailModal } from "@/components/quanty/quotes/QuoteDetailModal";
import {
  quoteStatusLabel,
  quoteStatusStyles,
  useQuotesStore,
  type Quote,
  type QuoteInput,
  type QuoteStatus,
} from "@/stores/quotesStore";
import { fmtDate } from "@/lib/format";
import { useFmtCurrency } from "@/hooks/useFmtCurrency";
import { cn } from "@/lib/utils";
import { useClientsStore } from "@/stores/clientsStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { sendQuoteEmail } from "@/lib/sendQuoteEmail";

export const Route = createFileRoute("/cotizaciones")({
  head: () => ({
    meta: [
      { title: "Cotizaciones · Quanty" },
      {
        name: "description",
        content:
          "Crea cotizaciones con cálculo automático de mano de obra y descuento de stock al aprobar.",
      },
    ],
  }),
  component: CotizacionesPage,
});

type Filter = "todas" | QuoteStatus;
const filters: { id: Filter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "borrador", label: "Borradores" },
  { id: "enviada", label: "Enviadas" },
  { id: "aprobada", label: "Aprobadas" },
  { id: "rechazada", label: "Rechazadas" },
];

function CotizacionesPage() {
  const fmt = useFmtCurrency();
  const clients = useClientsStore((s) => s.clients);
  const profile = useSettingsStore((s) => s.profile);
  const quotes = useQuotesStore((s) => s.quotes);
  const createQuoteOnRemote = useQuotesStore((s) => s.createQuoteOnRemote);
  const remoteQuotesError = useQuotesStore((s) => s.remoteQuotesError);
  const clearRemoteQuotesError = useQuotesStore((s) => s.clearRemoteQuotesError);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("todas");
  const [openQuote, setOpenQuote] = useState<Quote | null>(null);

  const filtered = useMemo(
    () => (filter === "todas" ? quotes : quotes.filter((q) => q.status === filter)),
    [quotes, filter],
  );

  const stats = useMemo(() => {
    const byStatus: Record<QuoteStatus, number> = {
      borrador: 0,
      enviada: 0,
      aprobada: 0,
      rechazada: 0,
    };
    let totalApproved = 0;
    for (const q of quotes) {
      byStatus[q.status]++;
      if (q.status === "aprobada") totalApproved += q.total;
    }
    return { byStatus, totalApproved };
  }, [quotes]);

  const handleCreate = async (data: QuoteInput) => {
    const quote = await createQuoteOnRemote(data);
    if (!quote) return false;
    setOpenQuote(quote);
    const client = data.clientId ? clients.find((c) => c.id === data.clientId) : undefined;
    void sendQuoteEmail(quote, client?.email ?? "", profile.businessName ?? "", profile.currency);
    return true;
  };

  const openCreateModal = () => {
    clearRemoteQuotesError();
    setModalOpen(true);
  };

  // Mantener detalle sincronizado si el store cambia (al aprobar/cambiar estado)
  const liveOpenQuote = openQuote ? (quotes.find((q) => q.id === openQuote.id) ?? null) : null;

  return (
    <AppLayout
      title="Cotizaciones"
      subtitle="Genera propuestas comerciales y descuenta stock al aprobar."
      actions={
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" /> Nueva cotización
        </button>
      }
    >
      {remoteQuotesError && !modalOpen && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p className="min-w-0 flex-1">{remoteQuotesError}</p>
          <button
            type="button"
            onClick={() => clearRemoteQuotesError()}
            className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={quotes.length.toString()} />
        <Stat label="Borradores" value={stats.byStatus.borrador.toString()} />
        <Stat label="Aprobadas" value={stats.byStatus.aprobada.toString()} accent="success" />
        <Stat
          label="Ingresos aprobados"
          value={fmt.format(stats.totalApproved)}
          accent="primary"
        />
      </section>

      <div className="mb-4 flex flex-wrap gap-1.5 rounded-lg bg-muted p-1">
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

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 sm:px-5">Folio</th>
                <th className="px-4 py-3 sm:px-5">Cliente</th>
                <th className="px-4 py-3 sm:px-5">Fecha</th>
                <th className="px-4 py-3 text-center sm:px-5">Insumos</th>
                <th className="px-4 py-3 text-right sm:px-5">Total</th>
                <th className="px-4 py-3 sm:px-5">Estado</th>
                <th className="px-4 py-3 sm:px-5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <EmptyState onCreate={openCreateModal} hasFilter={filter !== "todas"} />
                  </td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr
                    key={q.id}
                    className="border-t border-border transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground sm:px-5">
                      {q.folio}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground sm:px-5">
                      {q.clientName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground sm:px-5">
                      {fmtDate.format(q.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground sm:px-5">
                      {q.items.length}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground sm:px-5">
                      {fmt.format(q.total)}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          quoteStatusStyles[q.status],
                        )}
                      >
                        {quoteStatusLabel[q.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5">
                      <button
                        onClick={() => setOpenQuote(q)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <QuoteFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          clearRemoteQuotesError();
        }}
        onCreated={handleCreate}
      />
      <QuoteDetailModal quote={liveOpenQuote} onClose={() => setOpenQuote(null)} />
    </AppLayout>
  );
}

function Stat({
  label,
  value,
  accent = "muted",
}: {
  label: string;
  value: string;
  accent?: "muted" | "success" | "primary";
}) {
  const accents: Record<string, string> = {
    muted: "text-foreground",
    success: "text-success",
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
        <FileText className="h-6 w-6" />
      </div>
      <p className="font-display text-base font-bold text-foreground">
        {hasFilter ? "Sin cotizaciones en este filtro" : "Aún no tienes cotizaciones"}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {hasFilter
          ? "Cambia el filtro o crea una nueva cotización."
          : "Crea tu primera cotización seleccionando insumos del inventario."}
      </p>
      {!hasFilter && (
        <button
          onClick={onCreate}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nueva cotización
        </button>
      )}
    </div>
  );
}
