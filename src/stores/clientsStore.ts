import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEntityId, nowTs } from "@/domain/common";
import {
  clientInputSchema as domainClientInputSchema,
  clientsPersistedSchema,
  type Client as DomainClient,
  type ClientInput as DomainClientInput,
  type ClientsPersisted,
} from "@/domain/entities";
import { buildPersistOptions } from "@/lib/persist-helpers";
import { createScopedJsonStorage } from "@/lib/scoped-persist-storage";
import {
  isRemoteClientId,
  safeCreateClient,
  safeGetClients,
  safeSoftDeleteClient,
  safeUpdateClient,
} from "@/repositories/clients.repository";
import { mergeRemoteWithLocalLegacy } from "@/lib/merge-remote-with-local-legacy";

export const clientInputSchema = domainClientInputSchema;
export type ClientInput = DomainClientInput;
export type Client = DomainClient;

interface ClientsState {
  clients: Client[];
  /** Último error de operaciones remotas (no persistido). */
  remoteClientsError: string | null;
  createClient: (data: ClientInput) => Client;
  updateClient: (id: string, data: ClientInput) => void;
  deleteClient: (id: string) => void;
  clearRemoteClientsError: () => void;
  /** Sincroniza con Supabase y conserva clientes solo locales (id no UUID). */
  syncClientsFromRemote: () => Promise<boolean>;
  createClientOnRemote: (data: ClientInput) => Promise<Client | null>;
  updateClientOnRemote: (id: string, data: ClientInput) => Promise<boolean>;
  softDeleteClientOnRemote: (id: string) => Promise<boolean>;
}

export const useClientsStore = create<ClientsState>()(
  persist(
    (set, get) => ({
      clients: [],
      remoteClientsError: null,
      clearRemoteClientsError: () => set({ remoteClientsError: null }),
      syncClientsFromRemote: async () => {
        const res = await safeGetClients();
        if (!res.ok) {
          set({ remoteClientsError: res.error });
          return false;
        }
        const merged = mergeRemoteWithLocalLegacy(res.data, get().clients, isRemoteClientId);
        set({ clients: merged, remoteClientsError: null });
        return true;
      },
      createClientOnRemote: async (data) => {
        const res = await safeCreateClient(data);
        if (!res.ok) {
          set({ remoteClientsError: res.error });
          return null;
        }
        set((s) => ({
          clients: [res.data, ...s.clients.filter((c) => c.id !== res.data.id)],
          remoteClientsError: null,
        }));
        return res.data;
      },
      updateClientOnRemote: async (id, data) => {
        const res = await safeUpdateClient(id, data);
        if (!res.ok) {
          set({ remoteClientsError: res.error });
          return false;
        }
        set((s) => ({
          clients: s.clients.map((c) => (c.id === id ? res.data : c)),
          remoteClientsError: null,
        }));
        return true;
      },
      softDeleteClientOnRemote: async (id) => {
        const res = await safeSoftDeleteClient(id);
        if (!res.ok) {
          set({ remoteClientsError: res.error });
          return false;
        }
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
          remoteClientsError: null,
        }));
        return true;
      },
      createClient: (data) => {
        const client: Client = {
          id: createEntityId("c"),
          createdAt: nowTs(),
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
      deleteClient: (id) => set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),
    }),
    {
      ...buildPersistOptions<ClientsState, ClientsPersisted>({
        name: "quanty-clients-v1",
        version: 2,
        schema: clientsPersistedSchema,
        fallback: () => ({ clients: [] }),
        partialize: (state) => ({ clients: state.clients }),
        migrations: {
          2: (state) => ({
            clients: state.clients.map((c) => ({
              ...c,
              email: c.email ?? "",
              phone: c.phone ?? "",
              company: c.company ?? "",
              notes: c.notes ?? "",
            })),
          }),
        },
      }),
      storage: createScopedJsonStorage(),
    },
  ),
);
