import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, KeyRound, Loader2, PlugZap, RefreshCw, Trash2 } from "lucide-react";
import {
  catalogImportEndpoint,
  safeCreateApiKey,
  safeDeleteApiKey,
  safeListApiKeys,
  type ApiKeySummary,
} from "@/repositories/apiKeys.repository";
import { fmtDate } from "@/lib/format";
import { useClientsStore } from "@/stores/clientsStore";
import { useInventoryStore } from "@/stores/inventoryStore";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30";

type CopyTarget = "endpoint" | "secret" | null;

export function ApiKeysPanel() {
  const syncProducts = useInventoryStore((s) => s.syncProductsFromRemote);
  const syncClients = useClientsStore((s) => s.syncClientsFromRemote);
  const endpoint = catalogImportEndpoint();

  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Bruma Café");
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopyTarget>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void safeListApiKeys().then((res) => {
      if (cancelled) return;
      if (res.ok) setKeys(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = async (value: string, target: Exclude<CopyTarget, null>) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona el texto y cópialo manualmente.");
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const res = await safeCreateApiKey(name);
    setCreating(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setKeys((prev) => [res.data.summary, ...prev]);
    setNewSecret(res.data.secret);
  };

  const handleRevoke = async (key: ApiKeySummary) => {
    if (!confirm(`¿Revocar la clave "${key.name}"? Las apps que la usan dejarán de funcionar.`)) {
      return;
    }
    setError(null);
    const res = await safeDeleteApiKey(key.id);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setKeys((prev) => prev.filter((k) => k.id !== key.id));
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    const [productsOk, clientsOk] = await Promise.all([syncProducts(), syncClients()]);
    setSyncing(false);
    setSyncMessage(
      productsOk && clientsOk
        ? "Inventario y clientes actualizados."
        : "No se pudo actualizar todo. Revisa tu conexión e inténtalo de nuevo.",
    );
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PlugZap className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Integraciones</h2>
          <p className="text-xs text-muted-foreground">
            Conecta tiendas como Bruma Café para importar productos y clientes sin digitarlos.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold text-foreground">Endpoint de importación</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
              {endpoint}
            </code>
            <button
              type="button"
              onClick={() => copy(endpoint, "endpoint")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              {copied === "endpoint" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copiar
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            La app externa envía un POST con el encabezado <code>x-api-key</code>.
          </p>
        </div>

        {newSecret && (
          <div
            className="rounded-xl border border-warning/40 bg-warning/10 p-3"
            role="status"
            aria-live="polite"
          >
            <p className="text-xs font-semibold text-foreground">
              Copia tu clave ahora: no se volverá a mostrar.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-background px-3 py-2 font-mono text-xs text-foreground">
                {newSecret}
              </code>
              <button
                type="button"
                onClick={() => copy(newSecret, "secret")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[image:var(--gradient-primary)] px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                {copied === "secret" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copiar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setNewSecret(null)}
              className="mt-2 text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Ya la guardé
            </button>
          </div>
        )}

        <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="api-key-name"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Nombre de la clave
            </label>
            <input
              id="api-key-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Bruma Café"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Generar clave
          </button>
        </form>

        {error && (
          <p
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">Claves activas</p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Cargando claves…</p>
          ) : keys.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no has creado claves.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {keys.map((key) => (
                <li key={key.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{key.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-mono">{key.prefix}…</span> · creada{" "}
                      {fmtDate.format(key.createdAt)} ·{" "}
                      {key.lastUsedAt ? `último uso ${fmtDate.format(key.lastUsedAt)}` : "sin usar"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(key)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revocar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Traer datos importados
          </button>
          {syncMessage && <span className="text-xs text-muted-foreground">{syncMessage}</span>}
        </div>
      </div>
    </section>
  );
}
