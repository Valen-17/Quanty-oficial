import { create } from "zustand";
import { persist } from "zustand/middleware";
import { inventoryPersistedSchema, type InventoryPersisted } from "@/domain/entities";
import type { Product, ProductInput } from "@/components/quanty/inventory/types";
import { buildPersistOptions } from "@/lib/persist-helpers";
import { createScopedJsonStorage } from "@/lib/scoped-persist-storage";
import { mergeRemoteWithLocalLegacy } from "@/lib/merge-remote-with-local-legacy";
import {
  isRemoteProductId,
  safeCreateProduct,
  safeGetProducts,
  safeSoftDeleteProduct,
  safeUpdateProduct,
  safeUpdateProductUnits,
} from "@/repositories/products.repository";

const MAX_UNITS = 999_999;

const stockSyncQueue = new Map<string, Promise<void>>();

function clampUnits(units: number): number {
  return Math.max(0, Math.min(MAX_UNITS, units));
}

interface InventoryState {
  products: Product[];
  remoteProductsError: string | null;
  updateProduct: (id: string, data: ProductInput) => void;
  deleteProduct: (id: string) => void;
  applyStockDelta: (id: string, delta: number) => void;
  clearRemoteProductsError: () => void;
  syncProductsFromRemote: () => Promise<boolean>;
  createProductOnRemote: (data: ProductInput) => Promise<Product | null>;
  updateProductOnRemote: (id: string, data: ProductInput) => Promise<boolean>;
  softDeleteProductOnRemote: (id: string) => Promise<boolean>;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      products: [],
      remoteProductsError: null,
      clearRemoteProductsError: () => set({ remoteProductsError: null }),
      syncProductsFromRemote: async () => {
        const res = await safeGetProducts();
        if (!res.ok) {
          set({ remoteProductsError: res.error });
          return false;
        }
        const merged = mergeRemoteWithLocalLegacy(res.data, get().products, isRemoteProductId);
        set({ products: merged, remoteProductsError: null });
        return true;
      },
      createProductOnRemote: async (data) => {
        const res = await safeCreateProduct(data);
        if (!res.ok) {
          set({ remoteProductsError: res.error });
          return null;
        }
        set((s) => ({
          products: [res.data, ...s.products.filter((p) => p.id !== res.data.id)],
          remoteProductsError: null,
        }));
        return res.data;
      },
      updateProductOnRemote: async (id, data) => {
        const res = await safeUpdateProduct(id, data);
        if (!res.ok) {
          set({ remoteProductsError: res.error });
          return false;
        }
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? res.data : p)),
          remoteProductsError: null,
        }));
        return true;
      },
      softDeleteProductOnRemote: async (id) => {
        const res = await safeSoftDeleteProduct(id);
        if (!res.ok) {
          set({ remoteProductsError: res.error });
          return false;
        }
        set((s) => ({
          products: s.products.filter((p) => p.id !== id),
          remoteProductsError: null,
        }));
        return true;
      },
      updateProduct: (id, data) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...data,
                  description: data.description ?? "",
                  imageUrl: data.imageUrl ?? "",
                }
              : p,
          ),
        })),
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
      applyStockDelta: (id, delta) => {
        const current = get().products.find((p) => p.id === id);
        if (!current) return;
        const nextUnits = clampUnits(current.units + delta);
        if (nextUnits === current.units) return;
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, units: nextUnits } : p)),
        }));
        if (!isRemoteProductId(id)) return;
        const previous = stockSyncQueue.get(id) ?? Promise.resolve();
        const task = previous.then(async () => {
          const latest = get().products.find((p) => p.id === id);
          if (!latest) return;
          const res = await safeUpdateProductUnits(id, latest.units);
          if (!res.ok) {
            await get().syncProductsFromRemote();
            set({ remoteProductsError: res.error });
          }
        });
        stockSyncQueue.set(id, task);
        void task.finally(() => {
          if (stockSyncQueue.get(id) === task) stockSyncQueue.delete(id);
        });
      },
    }),
    {
      ...buildPersistOptions<InventoryState, InventoryPersisted>({
        name: "quanty-inventory-v1",
        version: 2,
        schema: inventoryPersistedSchema,
        fallback: () => ({ products: [] }),
        partialize: (state) => ({ products: state.products }),
        migrations: {
          2: (state) => ({
            products: state.products.map((p) => ({
              ...p,
              description: p.description ?? "",
              imageUrl: p.imageUrl ?? "",
            })),
          }),
        },
      }),
      storage: createScopedJsonStorage(),
    },
  ),
);

export const selectInventoryValue = (s: InventoryState) =>
  s.products.reduce((sum, p) => sum + p.price * p.units, 0);

export const selectInventoryCount = (s: InventoryState) => s.products.length;
