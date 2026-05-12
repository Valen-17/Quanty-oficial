import { useEffect, useState } from "react";
import { X, UserPlus } from "lucide-react";
import { clientInputSchema, useClientsStore, type Client, type ClientInput } from "@/stores/clientsStore";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  initial?: Client | null;
  onClose: () => void;
  /** Devuelve true si la operación remota/local tuvo éxito (el padre cierra el modal). */
  onSubmit: (data: ClientInput) => boolean | Promise<boolean>;
}

export function ClientFormModal({ open, initial, onClose, onSubmit }: Props) {
  const remoteClientsError = useClientsStore((s) => s.remoteClientsError);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setEmail(initial?.email ?? "");
      setPhone(initial?.phone ?? "");
      setCompany(initial?.company ?? "");
      setNotes(initial?.notes ?? "");
      setErrors({});
      setSubmitting(false);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = clientInputSchema.safeParse({ name, email, phone, company, notes });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0]);
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const ok = await Promise.resolve(onSubmit(parsed.data));
      if (ok) onClose();
    } finally {
      setSubmitting(false);
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
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-card shadow-[var(--shadow-elegant)] animate-in slide-in-from-bottom-4 duration-300 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {initial ? "Editar cliente" : "Nuevo cliente"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Mantén tu directorio actualizado para cotizar más rápido.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {remoteClientsError && (
            <p className="border-b border-destructive/20 bg-destructive/10 px-5 py-2 text-xs font-medium text-destructive">
              {remoteClientsError}
            </p>
          )}
          <div className="space-y-3 p-5">
            <Field label="Nombre" required error={errors.name}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Ej. María Restrepo"
                className={inputCls(!!errors.name)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Correo" error={errors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={120}
                  placeholder="cliente@correo.com"
                  className={inputCls(!!errors.email)}
                />
              </Field>
              <Field label="Teléfono" error={errors.phone}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={30}
                  placeholder="+57 300 000 0000"
                  className={inputCls(!!errors.phone)}
                />
              </Field>
            </div>
            <Field label="Empresa" error={errors.company}>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={80}
                placeholder="Opcional"
                className={inputCls(!!errors.company)}
              />
            </Field>
            <Field label="Notas" error={errors.notes}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Preferencias, condiciones de pago, etc."
                className={cn(inputCls(!!errors.notes), "resize-none")}
              />
            </Field>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
            >
              {submitting ? "Guardando…" : initial ? "Guardar cambios" : "Crear cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
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

function inputCls(hasError: boolean) {
  return cn(
    "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-colors",
    hasError
      ? "border-destructive focus:ring-destructive/30"
      : "border-input focus:border-ring focus:ring-ring/20",
  );
}
