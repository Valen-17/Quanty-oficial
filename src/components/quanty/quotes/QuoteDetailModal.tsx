import { X, FileText, Check, Send, Trash2, Printer, Download } from "lucide-react";
import {
  quoteStatusLabel,
  quoteStatusStyles,
  useQuotesStore,
  type Quote,
} from "@/stores/quotesStore";
import { isRemoteQuoteId } from "@/repositories/quotes.repository";
import { fmtDate } from "@/lib/format";
import { useFmtMoney } from "@/hooks/useFmtCurrency";
import { useSettingsStore } from "@/stores/settingsStore";
import { useClientsStore } from "@/stores/clientsStore";
import { findClientEmail, sendQuoteEmail, type QuoteEmailEvent } from "@/lib/sendQuoteEmail";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface Props {
  quote: Quote | null;
  onClose: () => void;
}

export function QuoteDetailModal({ quote, onClose }: Props) {
  const fmtMoney = useFmtMoney();
  const currency = useSettingsStore((s) => s.profile.currency);
  const exchangeRate = useSettingsStore((s) => s.exchangeRate);
  const clients = useClientsStore((s) => s.clients);

  const fireEmail = (q: Quote, event: QuoteEmailEvent) => {
    void sendQuoteEmail(q, event);
  };
  const setStatus = useQuotesStore((s) => s.setStatus);
  const approveQuote = useQuotesStore((s) => s.approveQuote);
  const approveQuoteOnRemote = useQuotesStore((s) => s.approveQuoteOnRemote);
  const getApprovalIssues = useQuotesStore((s) => s.getApprovalIssues);
  const deleteQuote = useQuotesStore((s) => s.deleteQuote);
  const setQuoteStatusOnRemote = useQuotesStore((s) => s.setQuoteStatusOnRemote);
  const softDeleteQuoteOnRemote = useQuotesStore((s) => s.softDeleteQuoteOnRemote);
  const remoteQuotesError = useQuotesStore((s) => s.remoteQuotesError);
  const clearRemoteQuotesError = useQuotesStore((s) => s.clearRemoteQuotesError);

  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    clearRemoteQuotesError();
  }, [quote?.id, clearRemoteQuotesError]);

  useEffect(() => {
    if (!quote) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quote, onClose]);

  if (!quote) return null;

  const canApprove = quote.status !== "aprobada" && quote.status !== "rechazada";

  const stockProblems = getApprovalIssues(quote.id);

  const handleApprove = async () => {
    if (actionBusy) return;
    if (stockProblems.length > 0) {
      alert(
        "Stock insuficiente para:\n" +
          stockProblems
            .map((p) => `• ${p.name} (necesitas ${p.needed}, hay ${p.available})`)
            .join("\n"),
      );
      return;
    }
    setActionBusy(true);
    if (!confirm("Aprobar cotización y descontar stock del inventario?")) {
      setActionBusy(false);
      return;
    }
    try {
      if (isRemoteQuoteId(quote.id)) {
        const r = await approveQuoteOnRemote(quote.id);
        if (!r.ok && r.error) alert(r.error);
        else fireEmail(quote, "aprobada");
      } else {
        const result = approveQuote(quote.id);
        if (!result.ok && result.error) {
          alert(result.error);
        } else {
          fireEmail(quote, "aprobada");
        }
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleSend = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      if (isRemoteQuoteId(quote.id)) {
        const ok = await setQuoteStatusOnRemote(quote.id, "enviada");
        if (!ok) return;
      } else {
        setStatus(quote.id, "enviada");
      }
      fireEmail(quote, "enviada");
    } finally {
      setActionBusy(false);
    }
  };
  const handleReject = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    if (!confirm("¿Marcar como rechazada?")) {
      setActionBusy(false);
      return;
    }
    try {
      if (isRemoteQuoteId(quote.id)) {
        const ok = await setQuoteStatusOnRemote(quote.id, "rechazada");
        if (!ok) return;
      } else {
        setStatus(quote.id, "rechazada");
      }
      fireEmail(quote, "rechazada");
    } finally {
      setActionBusy(false);
    }
  };
  const handleDelete = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    if (!confirm("¿Eliminar esta cotización? Esta acción no se puede deshacer.")) {
      setActionBusy(false);
      return;
    }
    try {
      if (isRemoteQuoteId(quote.id)) {
        const ok = await softDeleteQuoteOnRemote(quote.id);
        if (!ok) return;
      } else {
        deleteQuote(quote.id);
      }
      onClose();
    } finally {
      setActionBusy(false);
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
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-card shadow-[var(--shadow-elegant)] animate-in slide-in-from-bottom-4 duration-300 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">{quote.folio}</h2>
              <p className="text-xs text-muted-foreground">
                Creada el {fmtDate.format(quote.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                quoteStatusStyles[quote.status],
              )}
            >
              {quoteStatusLabel[quote.status]}
            </span>
            <button
              onClick={onClose}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {remoteQuotesError && (
          <div
            className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive"
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

        <div className="flex-1 overflow-y-auto bg-muted/20 px-5 py-6">
          <article className="mx-auto max-w-2xl rounded-xl border border-border bg-background p-6 shadow-sm">
            <header className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Cotización
                </p>
                <h3 className="font-display text-2xl font-bold text-foreground">{quote.folio}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fecha: {fmtDate.format(quote.createdAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-bold text-foreground">Quanty</p>
                <p className="text-xs text-muted-foreground">Insumos & Cotizaciones</p>
              </div>
            </header>

            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Cliente
              </p>
              <p className="font-semibold text-foreground">{quote.clientName}</p>
              {(() => {
                const email = quote.clientId
                  ? clients.find((c) => c.id === quote.clientId)?.email
                  : undefined;
                return email ? <p className="text-xs text-muted-foreground">{email}</p> : null;
              })()}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2">Insumo</th>
                  <th className="py-2 text-center">Cant.</th>
                  <th className="py-2 text-right">P. Unit.</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((it) => (
                  <tr key={it.productId} className="border-b border-border/50">
                    <td className="py-2.5 font-medium text-foreground">{it.name}</td>
                    <td className="py-2.5 text-center font-mono">{it.quantity}</td>
                    <td className="py-2.5 text-right font-mono">{fmtMoney(it.unitPrice)}</td>
                    <td className="py-2.5 text-right font-mono font-semibold">
                      {fmtMoney(it.unitPrice * it.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 flex justify-end">
              <dl className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-mono font-medium">{fmtMoney(quote.subtotal)}</dd>
                </div>
                {(quote.laborEmployeeAmount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      M.O. empleados ({quote.laborWorkers ?? 0} × {quote.laborHours ?? 0}h)
                    </dt>
                    <dd className="font-mono font-medium">
                      {fmtMoney(quote.laborEmployeeAmount ?? 0)}
                    </dd>
                  </div>
                )}
                <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
                  <dt className="text-sm font-bold text-foreground">Total</dt>
                  <dd className="font-mono text-lg font-bold text-primary">
                    {fmtMoney(quote.total)}
                  </dd>
                </div>
              </dl>
            </div>

            {quote.notes && (
              <div className="mt-6 rounded-lg bg-muted p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Notas
                </p>
                <p className="mt-1 text-sm text-foreground">{quote.notes}</p>
              </div>
            )}
          </article>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-5 py-3">
          <button
            onClick={handleDelete}
            disabled={actionBusy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const { downloadQuotePdf } = await import("@/lib/quotePdf");
                downloadQuotePdf(quote, currency, findClientEmail(quote.clientId), exchangeRate);
              }}
              disabled={actionBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Descargar PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={actionBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            {quote.status === "borrador" && (
              <button
                onClick={handleSend}
                disabled={actionBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Marcar como enviada
              </button>
            )}
            {canApprove && (
              <button
                onClick={handleReject}
                disabled={actionBusy}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                Rechazar
              </button>
            )}
            {canApprove && (
              <button
                onClick={handleApprove}
                disabled={actionBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:-translate-y-0.5 transition-transform disabled:pointer-events-none disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Aprobar y descontar stock
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
