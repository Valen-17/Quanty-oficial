import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";

export const eventStatusSchema = z.enum(["pendiente", "confirmado", "completado", "cancelado"]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const eventInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, { message: "Mínimo 2 caracteres" })
    .max(80, { message: "Máximo 80 caracteres" }),
  clientName: z
    .string()
    .trim()
    .max(80, { message: "Máximo 80 caracteres" })
    .optional()
    .or(z.literal("")),
  date: z.number().int().positive(),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, { message: "Formato HH:MM" }),
  location: z
    .string()
    .trim()
    .max(120, { message: "Máximo 120 caracteres" })
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(280, { message: "Máximo 280 caracteres" })
    .optional()
    .or(z.literal("")),
  status: eventStatusSchema,
});
export type EventInput = z.infer<typeof eventInputSchema>;

export interface AgendaEvent extends EventInput {
  id: string;
  clientName: string;
  location: string;
  notes: string;
  createdAt: number;
}

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
          id: `ev-${Date.now()}`,
          createdAt: Date.now(),
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
    { name: "quanty-agenda-v1" },
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
