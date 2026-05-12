import { useEffect, useState, type FormEvent } from "react";
import { X, CalendarDays } from "lucide-react";
import {
  eventInputSchema,
  eventStatusLabel,
  useAgendaStore,
  type AgendaEvent,
  type EventInput,
  type EventStatus,
} from "@/stores/agendaStore";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  initial?: AgendaEvent | null;
  defaultDate?: number;
  onClose: () => void;
  /** Devuelve true si la operación remota/local tuvo éxito (el padre cierra el modal). */
  onSubmit: (data: EventInput) => boolean | Promise<boolean>;
}

function toDateInput(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function EventFormModal({ open, initial, defaultDate, onClose, onSubmit }: Props) {
  const remoteAgendaError = useAgendaStore((s) => s.remoteAgendaError);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [time, setTime] = useState("09:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<EventStatus>("pendiente");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setClientName(initial.clientName);
      setDate(toDateInput(initial.date));
      setTime(initial.time);
      setLocation(initial.location);
      setNotes(initial.notes);
      setStatus(initial.status);
    } else {
      setTitle("");
      setClientName("");
      setDate(toDateInput(defaultDate ?? Date.now()));
      setTime("09:00");
      setLocation("");
      setNotes("");
      setStatus("pendiente");
    }
    setErrors({});
    setSubmitting(false);
  }, [open, initial, defaultDate]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = eventInputSchema.safeParse({
      title,
      clientName,
      date: new Date(date + "T12:00:00").getTime(),
      time,
      location,
      notes,
      status,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] = issue.message;
      setErrors(next);
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">
              {initial ? "Editar compromiso" : "Nuevo compromiso"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          {remoteAgendaError && (
            <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {remoteAgendaError}
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Visita técnica"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Cliente <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Hora</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              {errors.time && <p className="mt-1 text-xs text-destructive">{errors.time}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Ubicación <span className="text-muted-foreground">(opcional)</span>
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Dirección o lugar"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">Estado</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(eventStatusLabel) as EventStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors",
                    status === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {eventStatusLabel[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Notas <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Detalles internos…"
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] disabled:pointer-events-none disabled:opacity-60"
            >
              {initial ? "Guardar cambios" : "Crear compromiso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
