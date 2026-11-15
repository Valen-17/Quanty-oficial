import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  Building2,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { ClientFormModal } from "@/components/quanty/clients/ClientFormModal";
import { isRemoteClientId } from "@/repositories/clients.repository";
import { useClientsStore, type Client, type ClientInput } from "@/stores/clientsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { fmtDate } from "@/lib/format";
import { useFmtMoney } from "@/hooks/useFmtCurrency";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · Quanty" },
      {
        name: "description",
        content: "Directorio de clientes con historial de cotizaciones e información de contacto.",
      },
    ],
  }),
  component: ClientesPage,
});

// Página del directorio de clientes.
function ClientesPage() {
  const fmtMoney = useFmtMoney();
  const clients = useClientsStore((s) => s.clients);
  const createClientOnRemote = useClientsStore((s) => s.createClientOnRemote);
  const updateClientOnRemote = useClientsStore((s) => s.updateClientOnRemote);
  const softDeleteClientOnRemote = useClientsStore((s) => s.softDeleteClientOnRemote);
  const updateClient = useClientsStore((s) => s.updateClient);
  const deleteClient = useClientsStore((s) => s.deleteClient);
  const remoteClientsError = useClientsStore((s) => s.remoteClientsError);
  const clearRemoteClientsError = useClientsStore((s) => s.clearRemoteClientsError);
  const quotes = useQuotesStore((s) => s.quotes);

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);

  const stats = useMemo(() => {
    const totals = new Map<string, { count: number; sum: number }>();
    for (const q of quotes) {
      const key = q.clientId ?? q.clientName;
      const t = totals.get(key) ?? { count: 0, sum: 0 };
      t.count++;
      if (q.status === "aprobada") t.sum += q.total;
      totals.set(key, t);
    }
    return totals;
  }, [quotes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q),
    );
  }, [clients, query]);

  const openNew = () => {
    clearRemoteClientsError();
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (c: Client) => {
    clearRemoteClientsError();
    setEditing(c);
    setModalOpen(true);
  };
  const handleSubmit = async (data: ClientInput) => {
    if (editing) {
      if (isRemoteClientId(editing.id)) {
        return await updateClientOnRemote(editing.id, data);
      }
      updateClient(editing.id, data);
      return true;
    }
    const created = await createClientOnRemote(data);
    return created !== null;
  };

  const [deleteBusy, setDeleteBusy] = useState(false);

  return (
    <AppLayout
      title="Clientes"
      subtitle="Tu directorio centralizado, conectado a cotizaciones."
      actions={
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" /> Nuevo cliente
        </button>
      }
    >
      {remoteClientsError && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p className="min-w-0 flex-1">{remoteClientsError}</p>
          <button
            type="button"
            onClick={() => clearRemoteClientsError()}
            className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Clientes" value={clients.length.toString()} />
        <Stat
          label="Con cotización"
          value={Array.from(stats.values())
            .filter((v) => v.count > 0)
            .length.toString()}
        />
        <Stat label="Cotizaciones" value={quotes.length.toString()} accent="primary" />
        <Stat
          label="Aprobado total"
          value={fmtMoney(Array.from(stats.values()).reduce((s, v) => s + v.sum, 0))}
          accent="success"
        />
      </section>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, empresa, correo…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length} de {clients.length} clientes
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <p className="font-display text-base font-bold text-foreground">
            {query ? "Sin coincidencias" : "Aún no tienes clientes"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {query
              ? "Ajusta tu búsqueda o crea un nuevo cliente."
              : "Crea tu primer cliente para empezar a cotizar más rápido."}
          </p>
          <button
            onClick={openNew}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Nuevo cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const s = stats.get(c.id) ?? stats.get(c.name);
            return (
              <article
                key={c.id}
                className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/30"
              >
                <header className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] font-display text-base font-bold text-primary-foreground">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-bold text-foreground">
                      {c.name}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">
                      Alta {fmtDate.format(c.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </header>

                <ul className="space-y-1.5 text-sm">
                  {c.company && (
                    <li className="flex items-center gap-2 text-foreground">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{c.company}</span>
                    </li>
                  )}
                  {c.email && (
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <a href={`mailto:${c.email}`} className="truncate hover:text-primary">
                        {c.email}
                      </a>
                    </li>
                  )}
                  {c.phone && (
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <a href={`tel:${c.phone}`} className="truncate hover:text-primary">
                        {c.phone}
                      </a>
                    </li>
                  )}
                  {!c.company && !c.email && !c.phone && (
                    <li className="text-xs text-muted-foreground">Sin datos de contacto</li>
                  )}
                </ul>

                {c.notes && (
                  <p className="line-clamp-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    {c.notes}
                  </p>
                )}

                <footer className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    {s?.count ?? 0} {s?.count === 1 ? "cotización" : "cotizaciones"}
                  </span>
                  <span className="font-mono font-semibold text-success">
                    {fmtMoney(s?.sum ?? 0)}
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <ClientFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          clearRemoteClientsError();
        }}
        onSubmit={handleSubmit}
      />

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-card p-5 shadow-[var(--shadow-elegant)]">
            <h3 className="font-display text-base font-bold text-foreground">Eliminar cliente</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              ¿Seguro que deseas eliminar a{" "}
              <strong className="text-foreground">{confirmDelete.name}</strong>? Las cotizaciones
              existentes no se verán afectadas.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!confirmDelete) return;
                  setDeleteBusy(true);
                  try {
                    if (isRemoteClientId(confirmDelete.id)) {
                      const ok = await softDeleteClientOnRemote(confirmDelete.id);
                      if (ok) setConfirmDelete(null);
                    } else {
                      deleteClient(confirmDelete.id);
                      setConfirmDelete(null);
                    }
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
                disabled={deleteBusy}
                className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
              >
                {deleteBusy ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
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
