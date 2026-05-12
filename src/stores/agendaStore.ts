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
import { createScopedJsonStorage } from "@/lib/scoped-persist-storage";
import { mergeRemoteWithLocalLegacy } from "@/lib/merge-remote-with-local-legacy";
import {
  isRemoteAgendaEventId,
  safeCreateAgendaEvent,
  safeGetAgendaEvents,
  safeSoftDeleteAgendaEvent,
  safeUpdateAgendaEvent,
} from "@/repositories/agenda.repository";

export const eventStatusSchema = domainEventStatusSchema;
export type EventStatus = DomainEventStatus;
export const eventInputSchema = domainEventInputSchema;
export type EventInput = DomainEventInput;
export type AgendaEvent = DomainAgendaEvent;

interface AgendaState {
  events: AgendaEvent[];
  /** Último error de operaciones remotas (no persistido). */
  remoteAgendaError: string | null;
  createEvent: (data: EventInput) => AgendaEvent;
  updateEvent: (id: string, data: EventInput) => void;
  deleteEvent: (id: string) => void;
  setStatus: (id: string, status: EventStatus) => void;
  clearRemoteAgendaError: () => void;
  /** Fusiona eventos remotos con entradas solo locales (id no UUID). */
  syncAgendaFromRemote: () => Promise<boolean>;
  createAgendaEventOnRemote: (data: EventInput) => Promise<AgendaEvent | null>;
  updateAgendaEventOnRemote: (event: AgendaEvent) => Promise<boolean>;
  softDeleteAgendaEventOnRemote: (id: string) => Promise<boolean>;
}

export const useAgendaStore = create<AgendaState>()(
  persist(
    (set, get) => ({
      events: [],
      remoteAgendaError: null,
      clearRemoteAgendaError: () => set({ remoteAgendaError: null }),
      syncAgendaFromRemote: async () => {
        const res = await safeGetAgendaEvents();
        if (!res.ok) {
          set({ remoteAgendaError: res.error });
          return false;
        }
        const remote = res.data;
        const merged = mergeRemoteWithLocalLegacy(remote, get().events, isRemoteAgendaEventId);
        set({ events: merged, remoteAgendaError: null });
        return true;
      },
      createAgendaEventOnRemote: async (data) => {
        const res = await safeCreateAgendaEvent(data);
        if (!res.ok) {
          set({ remoteAgendaError: res.error });
          return null;
        }
        set((s) => ({
          events: [res.data, ...s.events.filter((ev) => ev.id !== res.data.id)],
          remoteAgendaError: null,
        }));
        return res.data;
      },
      updateAgendaEventOnRemote: async (event) => {
        const res = await safeUpdateAgendaEvent(event);
        if (!res.ok) {
          set({ remoteAgendaError: res.error });
          return false;
        }
        set((s) => ({
          events: s.events.map((ev) => (ev.id === event.id ? res.data : ev)),
          remoteAgendaError: null,
        }));
        return true;
      },
      softDeleteAgendaEventOnRemote: async (id) => {
        const res = await safeSoftDeleteAgendaEvent(id);
        if (!res.ok) {
          set({ remoteAgendaError: res.error });
          return false;
        }
        set((s) => ({
          events: s.events.filter((ev) => ev.id !== id),
          remoteAgendaError: null,
        }));
        return true;
      },
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
                  clientId: data.clientId ?? e.clientId,
                  quoteId: data.quoteId ?? e.quoteId,
                }
              : e,
          ),
        })),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      setStatus: (id, status) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, status } : e)),
        })),
    }),
    {
      ...buildPersistOptions<AgendaState, AgendaPersisted>({
        name: "quanty-agenda-v1",
        version: 2,
        schema: agendaPersistedSchema,
        fallback: () => ({ events: [] }),
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
      storage: createScopedJsonStorage(),
    },
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
