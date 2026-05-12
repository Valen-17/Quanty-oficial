import { supabase } from "@/integrations/supabase/client";
import { rehydrateAllScopedPersistStores } from "@/lib/rehydrate-persist-stores";
import { useClientsStore } from "@/stores/clientsStore";
import { useExpensesStore } from "@/stores/expensesStore";
import { useInventoryStore } from "@/stores/inventoryStore";
import {
  type RemoteBootstrapModule,
  type RemoteBootstrapModuleErrors,
  useRemoteBootstrapStore,
} from "@/stores/remoteBootstrapStore";
import { useAgendaStore } from "@/stores/agendaStore";
import { useQuotesStore } from "@/stores/quotesStore";

function clearModuleRemoteErrors() {
  useClientsStore.getState().clearRemoteClientsError();
  useInventoryStore.getState().clearRemoteProductsError();
  useQuotesStore.getState().clearRemoteQuotesError();
  useExpensesStore.getState().clearRemoteExpensesError();
  useAgendaStore.getState().clearRemoteAgendaError();
}

function readModuleErrorAfterFailedSync(key: RemoteBootstrapModule): string {
  switch (key) {
    case "clients":
      return useClientsStore.getState().remoteClientsError ?? "Clientes: error desconocido.";
    case "products":
      return useInventoryStore.getState().remoteProductsError ?? "Productos: error desconocido.";
    case "quotes":
      return useQuotesStore.getState().remoteQuotesError ?? "Cotizaciones: error desconocido.";
    case "expenses":
      return useExpensesStore.getState().remoteExpensesError ?? "Gastos: error desconocido.";
    case "agenda":
      return useAgendaStore.getState().remoteAgendaError ?? "Agenda: error desconocido.";
    default:
      return "Error desconocido.";
  }
}

async function assertStillSameUser(expectedUserId: string, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false;
  const { data, error } = await supabase.auth.getUser();
  if (signal.aborted) return false;
  if (error) return false;
  return data.user?.id === expectedUserId;
}

/**
 * Rehidrata persist con scope actual y sincroniza lectura remota de módulos híbridos.
 * No muta formularios; solo `sync*FromRemote`. Idempotente respecto a errores por módulo.
 */
export async function rehydrateThenBootstrapRemoteModules(
  expectedUserId: string,
  signal: AbortSignal,
): Promise<void> {
  try {
    await rehydrateAllScopedPersistStores();
  } catch {
    return;
  }
  if (signal.aborted) return;
  if (!(await assertStillSameUser(expectedUserId, signal))) return;

  clearModuleRemoteErrors();
  const generation = useRemoteBootstrapStore.getState().startRemoteBootstrap(expectedUserId);

  const tasks: Array<[RemoteBootstrapModule, () => Promise<boolean>]> = [
    ["clients", () => useClientsStore.getState().syncClientsFromRemote()],
    ["products", () => useInventoryStore.getState().syncProductsFromRemote()],
    ["quotes", () => useQuotesStore.getState().syncQuotesFromRemote()],
    ["expenses", () => useExpensesStore.getState().syncExpensesFromRemote()],
    ["agenda", () => useAgendaStore.getState().syncAgendaFromRemote()],
  ];

  const errors: RemoteBootstrapModuleErrors = {};

  await Promise.all(
    tasks.map(async ([key, syncFn]) => {
      if (signal.aborted) return;
      try {
        const ok = await syncFn();
        if (signal.aborted) return;
        if (!ok) {
          errors[key] = readModuleErrorAfterFailedSync(key);
        }
      } catch (e) {
        if (signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        errors[key] = `${key}: ${msg}`;
      }
    }),
  );

  if (signal.aborted) {
    useRemoteBootstrapStore.getState().abortRemoteBootstrap(generation);
    return;
  }
  if (!(await assertStillSameUser(expectedUserId, signal))) {
    useRemoteBootstrapStore.getState().abortRemoteBootstrap(generation);
    return;
  }

  useRemoteBootstrapStore.getState().completeRemoteBootstrap(generation, Date.now(), errors);
}
