import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";

export const clientInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres" })
    .max(80, { message: "Máximo 80 caracteres" }),
  email: z
    .string()
    .trim()
    .email({ message: "Correo inválido" })
    .max(120)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(30, { message: "Máximo 30 caracteres" })
    .optional()
    .or(z.literal("")),
  company: z
    .string()
    .trim()
    .max(80, { message: "Máximo 80 caracteres" })
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(280, { message: "Máximo 280 caracteres" })
    .optional()
    .or(z.literal("")),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

export interface Client extends ClientInput {
  id: string;
  createdAt: number;
}

interface ClientsState {
  clients: Client[];
  createClient: (data: ClientInput) => Client;
  updateClient: (id: string, data: ClientInput) => void;
  deleteClient: (id: string) => void;
}

const seed: Client[] = [
  {
    id: "c-seed-1",
    name: "María Restrepo",
    email: "maria@restrepo.co",
    phone: "+57 300 555 1122",
    company: "Diseños MR",
    notes: "",
    createdAt: Date.now() - 86400000 * 12,
  },
  {
    id: "c-seed-2",
    name: "Juan Cárdenas",
    email: "juan.cardenas@correo.com",
    phone: "+57 312 444 9988",
    company: "",
    notes: "Prefiere pagos a 15 días.",
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: "c-seed-3",
    name: "Carolina Mejía",
    email: "",
    phone: "+57 301 222 3344",
    company: "Eventos Mejía",
    notes: "",
    createdAt: Date.now() - 86400000 * 2,
  },
];

export const useClientsStore = create<ClientsState>()(
  persist(
    (set) => ({
      clients: seed,
      createClient: (data) => {
        const client: Client = {
          id: `c-${Date.now()}`,
          createdAt: Date.now(),
          ...data,
          email: data.email ?? "",
          phone: data.phone ?? "",
          company: data.company ?? "",
          notes: data.notes ?? "",
        };
        set((s) => ({ clients: [client, ...s.clients] }));
        return client;
      },
      updateClient: (id, data) =>
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...data,
                  email: data.email ?? "",
                  phone: data.phone ?? "",
                  company: data.company ?? "",
                  notes: data.notes ?? "",
                }
              : c,
          ),
        })),
      deleteClient: (id) =>
        set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),
    }),
    { name: "quanty-clients-v1" },
  ),
);
