import { useAgendaStore } from "@/stores/agendaStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useExpensesStore } from "@/stores/expensesStore";
import { useInventoryStore } from "@/stores/inventoryStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useSettingsStore } from "@/stores/settingsStore";

// Recarga todos los stores desde localStorage.
export async function rehydrateAllScopedPersistStores(): Promise<void> {
  const stores = [
    useInventoryStore,
    useClientsStore,
    useQuotesStore,
    useExpensesStore,
    useAgendaStore,
    useSettingsStore,
  ] as const;
  await Promise.all(
    stores.map((s) => {
      const p = s.persist;
      return p?.rehydrate?.() ?? Promise.resolve();
    }),
  );
}
