import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Clock,
  User,
} from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { EventFormModal } from "@/components/quanty/agenda/EventFormModal";
import { isRemoteAgendaEventId } from "@/repositories/agenda.repository";
import {
  eventStatusLabel,
  eventStatusStyles,
  useAgendaStore,
  type AgendaEvent,
  type EventInput,
  type EventStatus,
} from "@/stores/agendaStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda · Quanty" },
      {
        name: "description",
        content: "Organiza trabajos, citas y cotizaciones pendientes.",
      },
    ],
  }),
  component: AgendaPage,
});

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    const d = new Date(year, month, -startWeekday + i + 1);
    days.push({ date: d, inMonth: false });
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= lastDay; i++) {
    days.push({ date: new Date(year, month, i), inMonth: true });
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    days.push({ date: d, inMonth: false });
  }
  return days;
}

function AgendaPage() {
  const events = useAgendaStore((s) => s.events);
  const createEvent = useAgendaStore((s) => s.createEvent);
  const updateEvent = useAgendaStore((s) => s.updateEvent);
  const deleteEvent = useAgendaStore((s) => s.deleteEvent);
  const setEventStatus = useAgendaStore((s) => s.setStatus);
  const createAgendaEventOnRemote = useAgendaStore((s) => s.createAgendaEventOnRemote);
  const updateAgendaEventOnRemote = useAgendaStore((s) => s.updateAgendaEventOnRemote);
  const softDeleteAgendaEventOnRemote = useAgendaStore((s) => s.softDeleteAgendaEventOnRemote);
  const remoteAgendaError = useAgendaStore((s) => s.remoteAgendaError);
  const clearRemoteAgendaError = useAgendaStore((s) => s.clearRemoteAgendaError);

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<number>(() => startOfDay(Date.now()));
  const [todayKey] = useState<number>(() => startOfDay(Date.now()));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, AgendaEvent[]>();
    for (const e of events) {
      const k = startOfDay(e.date);
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [events]);

  const dayEvents = eventsByDay.get(selectedDay) ?? [];

  const upcoming = useMemo(() => {
    return events
      .filter((e) => e.date >= todayKey && e.status !== "cancelado" && e.status !== "completado")
      .sort((a, b) => a.date - b.date || a.time.localeCompare(b.time))
      .slice(0, 5);
  }, [events, todayKey]);

  const goPrev = () => {
    const m = cursor.month - 1;
    setCursor(m < 0 ? { year: cursor.year - 1, month: 11 } : { ...cursor, month: m });
  };
  const goNext = () => {
    const m = cursor.month + 1;
    setCursor(m > 11 ? { year: cursor.year + 1, month: 0 } : { ...cursor, month: m });
  };
  const goToday = () => {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelectedDay(startOfDay(Date.now()));
  };

  const openNew = () => {
    clearRemoteAgendaError();
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (e: AgendaEvent) => {
    clearRemoteAgendaError();
    setEditing(e);
    setOpen(true);
  };

  const handleSubmitEvent = async (data: EventInput) => {
    if (editing) {
      if (isRemoteAgendaEventId(editing.id)) {
        return await updateAgendaEventOnRemote({
          ...editing,
          ...data,
          clientName: data.clientName ?? "",
          location: data.location ?? "",
          notes: data.notes ?? "",
        });
      }
      updateEvent(editing.id, data);
      return true;
    }
    const createdRemote = await createAgendaEventOnRemote(data);
    if (createdRemote) return true;
    createEvent(data);
    return true;
  };

  return (
    <AppLayout
      title="Agenda"
      subtitle="Organiza trabajos y compromisos."
      actions={
        <>
          <button
            onClick={goToday}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Hoy
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> Nuevo compromiso
          </button>
        </>
      }
    >
      {remoteAgendaError && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p className="min-w-0 flex-1">{remoteAgendaError}</p>
          <button
            type="button"
            onClick={() => clearRemoteAgendaError()}
            className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {MONTHS[cursor.month]} {cursor.year}
              </h2>
              <p className="text-xs text-muted-foreground">
                {events.length} {events.length === 1 ? "compromiso" : "compromisos"} en total
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={goPrev}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goNext}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map(({ date, inMonth }, i) => {
              const k = startOfDay(date.getTime());
              const list = eventsByDay.get(k) ?? [];
              const isSelected = k === selectedDay;
              const isToday = k === todayKey;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(k)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-start gap-1 rounded-lg border p-1 text-xs transition-colors",
                    inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                    isSelected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday && "bg-[image:var(--gradient-primary)] text-primary-foreground",
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {list.length > 0 && (
                    <div className="flex gap-0.5">
                      {list.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            e.status === "confirmado" && "bg-primary",
                            e.status === "pendiente" && "bg-warning",
                            e.status === "completado" && "bg-success",
                            e.status === "cancelado" && "bg-destructive",
                          )}
                        />
                      ))}
                      {list.length > 3 && (
                        <span className="text-[9px] font-bold text-muted-foreground">
                          +{list.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-lg font-bold text-foreground">Próximos</h2>
          <p className="text-xs text-muted-foreground">5 compromisos más cercanos</p>
          {upcoming.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Sin próximos compromisos.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((e) => (
                <li
                  key={e.id}
                  className="cursor-pointer rounded-lg border border-border bg-background/60 p-3 transition-colors hover:bg-muted/50"
                  onClick={() => {
                    setSelectedDay(startOfDay(e.date));
                    setCursor({
                      year: new Date(e.date).getFullYear(),
                      month: new Date(e.date).getMonth(),
                    });
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{e.title}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        eventStatusStyles[e.status],
                      )}
                    >
                      {eventStatusLabel[e.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(e.date).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                    })}{" "}
                    · {e.time}
                    {e.clientName && ` · ${e.clientName}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">
              {new Date(selectedDay).toLocaleDateString("es-CO", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {dayEvents.length} {dayEvents.length === 1 ? "compromiso" : "compromisos"}
            </p>
          </div>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar
          </button>
        </div>

        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarDays className="h-6 w-6" />
            </div>
            <p className="font-display text-base font-bold text-foreground">Día libre</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              No tienes compromisos programados para esta fecha.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {dayEvents.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Clock className="h-4 w-4" />
                    <span className="mt-0.5 text-[10px] font-bold tabular-nums">{e.time}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{e.title}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          eventStatusStyles[e.status],
                        )}
                      >
                        {eventStatusLabel[e.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {e.clientName && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {e.clientName}
                        </span>
                      )}
                      {e.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {e.location}
                        </span>
                      )}
                    </div>
                    {e.notes && <p className="mt-1.5 text-xs text-muted-foreground">{e.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:flex-col sm:items-stretch">
                  <select
                    value={e.status}
                    onChange={(ev) => {
                      const status = ev.target.value as EventStatus;
                      if (isRemoteAgendaEventId(e.id)) {
                        void updateAgendaEventOnRemote({ ...e, status });
                      } else {
                        setEventStatus(e.id, status);
                      }
                    }}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    {(Object.keys(eventStatusLabel) as EventStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {eventStatusLabel[s]}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(e)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`¿Eliminar "${e.title}"?`)) return;
                        if (isRemoteAgendaEventId(e.id)) {
                          void softDeleteAgendaEventOnRemote(e.id);
                        } else {
                          deleteEvent(e.id);
                        }
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EventFormModal
        open={open}
        initial={editing}
        defaultDate={selectedDay}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmitEvent}
      />
    </AppLayout>
  );
}
