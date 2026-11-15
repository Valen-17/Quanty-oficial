import { supabase } from "@/integrations/supabase/client";
import { mergeCloudProfileIntoSettings } from "@/lib/profile-settings-sync";
import { getSessionUserId } from "@/repositories/shared";
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

// Trae el perfil de la nube a los ajustes locales.
async function syncProfileIntoSettingsStore(userId: string): Promise<void> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, business_name, phone, has_employees, employee_count, currency, language")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return;
  mergeCloudProfileIntoSettings(data);
}

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

// Evita aplicar datos si el usuario cambió durante la carga.
async function assertStillSameUser(expectedUserId: string, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false;
  const userId = await getSessionUserId();
  if (signal.aborted) return false;
  return userId === expectedUserId;
}

// Al iniciar sesión: carga lo local y sincroniza todos los módulos en paralelo.
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

  await syncProfileIntoSettingsStore(expectedUserId);
  if (signal.aborted) return;

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
