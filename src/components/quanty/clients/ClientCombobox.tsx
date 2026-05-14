import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, User } from "lucide-react";
import { useClientsStore, type Client } from "@/stores/clientsStore";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (name: string) => void;
  onSelectClient?: (client: Client) => void;
  onCreateNew: () => void;
  error?: boolean;
}

export function ClientCombobox({ value, onChange, onSelectClient, onCreateNew, error }: Props) {
  const clients = useClientsStore((s) => s.clients);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const selected = useMemo<Client | undefined>(
    () => clients.find((c) => c.name === value),
    [clients, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [clients, query]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2",
          error
            ? "border-destructive focus:ring-destructive/30"
            : "border-input focus:border-ring focus:ring-ring/20",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          {selected ? (
            <span className="min-w-0 truncate">
              <span className="font-medium text-foreground">{selected.name}</span>
              {selected.company && (
                <span className="ml-1.5 text-xs text-muted-foreground">· {selected.company}</span>
              )}
            </span>
          ) : value ? (
            <span className="truncate text-foreground">{value}</span>
          ) : (
            <span className="text-muted-foreground">Selecciona un cliente</span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--shadow-elegant)] animate-in fade-in zoom-in-95 duration-150">
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 60))}
              placeholder="Buscar cliente"
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                Sin coincidencias
              </li>
            ) : (
              filtered.map((c) => {
                const active = c.name === value;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(c.name);
                        onSelectClient?.(c);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
                        active && "bg-primary/5",
                      )}
                    >
                      <span className="min-w-0">
                        <p className="truncate font-medium text-foreground">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.company || c.email || c.phone || "Sin datos adicionales"}
                        </p>
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCreateNew();
            }}
            className="flex w-full items-center gap-2 border-t border-border bg-muted/30 px-3 py-2.5 text-left text-sm font-semibold text-primary hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> Crear nuevo cliente
          </button>
        </div>
      )}
    </div>
  );
}
