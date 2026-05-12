import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEntityId, nowTs } from "@/domain/common";
import {
  agendaPersistedSchema,
  eventInputSchema as domainEventInputSchema,
  eventStatusSchema as domainEventStatusSchema,
  type AgendaEvent as DomainAgendaEvent,
  type AgendaPersisted,
  type EventInput as DomainEventInput,
  type EventStatus as DomainEventStatus,
} from "@/domain/entities";
import { buildPersistOptions } from "@/lib/persist-helpers";

export const eventStatusSchema = domainEventStatusSchema;
export type EventStatus = DomainEventStatus;
export const eventInputSchema = domainEventInputSchema;
export type EventInput = DomainEventInput;
export type AgendaEvent = DomainAgendaEvent;

interface AgendaState {
  events: AgendaEvent[];
  createEvent: (data: EventInput) => AgendaEvent;
  updateEvent: (id: string, data: EventInput) => void;
  deleteEvent: (id: string) => void;
  setStatus: (id: string, status: EventStatus) => void;
}

const now = Date.now();
const day = 86_400_000;

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const seed: AgendaEvent[] = [
  {
    id: "ev-seed-1",
    title: "Visita técnica - oficina",
    clientName: "María Restrepo",
    date: startOfDay(now + day * 1),
    time: "09:00",
    location: "Cra 45 #12-34, Medellín",
    notes: "Llevar muestras de tela.",
    status: "confirmado",
    createdAt: now - day * 2,
  },
  {
    id: "ev-seed-2",
    title: "Entrega de cotización",
    clientName: "Juan Cárdenas",
    date: startOfDay(now + day * 3),
    time: "15:30",
    location: "",
    notes: "",
    status: "pendiente",
    createdAt: now - day * 1,
  },
  {
    id: "ev-seed-3",
    title: "Instalación de evento",
    clientName: "Carolina Mejía",
    date: startOfDay(now + day * 6),
    time: "07:00",
    location: "Hotel Estelar",
    notes: "Coordinar con logística.",
    status: "pendiente",
    createdAt: now,
  },
];

export const useAgendaStore = create<AgendaState>()(
  persist(
    (set) => ({
      events: seed,
      createEvent: (data) => {
        const event: AgendaEvent = {
          id: createEntityId("ev"),
          createdAt: nowTs(),
          ...data,
          clientName: data.clientName ?? "",
          location: data.location ?? "",
          notes: data.notes ?? "",
        };
        set((s) => ({ events: [event, ...s.events] }));
        return event;
      },
      updateEvent: (id, data) =>
        set((s) => ({
          events: s.events.map((e) =>
            e.id === id
              ? {
                  ...e,
                  ...data,
                  clientName: data.clientName ?? "",
                  location: data.location ?? "",
                  notes: data.notes ?? "",
                }
              : e,
          ),
        })),
      deleteEvent: (id) =>
        set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      setStatus: (id, status) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, status } : e)),
        })),
    }),
    buildPersistOptions<AgendaState, AgendaPersisted>({
      name: "quanty-agenda-v1",
      version: 2,
      schema: agendaPersistedSchema,
      fallback: () => ({ events: seed }),
      partialize: (state) => ({ events: state.events }),
      migrations: {
        2: (state) => ({
          events: state.events.map((e) => ({
            ...e,
            clientName: e.clientName ?? "",
            location: e.location ?? "",
            notes: e.notes ?? "",
          })),
        }),
      },
    }),
  ),
);

export const eventStatusLabel: Record<EventStatus, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const eventStatusStyles: Record<EventStatus, string> = {
  pendiente: "bg-muted text-muted-foreground",
  confirmado: "bg-primary/10 text-primary",
  completado: "bg-success/15 text-success",
  cancelado: "bg-destructive/10 text-destructive",
};
