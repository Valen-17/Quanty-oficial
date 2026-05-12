import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEntityId } from "@/domain/common";
import { inventoryPersistedSchema, type InventoryPersisted } from "@/domain/entities";
import {
  getAvailability,
  type Product,
  type ProductInput,
  type Availability,
} from "@/components/quanty/inventory/types";
import { buildPersistOptions } from "@/lib/persist-helpers";
import { createScopedJsonStorage } from "@/lib/scoped-persist-storage";
import { mergeRemoteWithLocalLegacy } from "@/lib/merge-remote-with-local-legacy";
import {
  isRemoteProductId,
  safeCreateProduct,
  safeGetProducts,
  safeSoftDeleteProduct,
  safeUpdateProduct,
} from "@/repositories/products.repository";

interface InventoryState {
  products: Product[];
  /** Último error de operaciones remotas de productos (no persistido). */
  remoteProductsError: string | null;
  addProduct: (data: ProductInput) => void;
  updateProduct: (id: string, data: ProductInput) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (id: string, delta: number) => void;
  clearRemoteProductsError: () => void;
  /** Sincroniza con Supabase y conserva productos solo locales (id no UUID). */
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
      addProduct: (data) =>
        set((s) => ({
          products: [
            {
              id: createEntityId("p"),
              ...data,
              description: data.description ?? "",
              imageUrl: data.imageUrl ?? "",
            },
            ...s.products,
          ],
        })),
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
      adjustStock: (id, delta) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, units: Math.max(0, Math.min(999_999, p.units + delta)) } : p,
          ),
        })),
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

// Selectors derivados
export const selectLowStock = (s: InventoryState) =>
  s.products
    .map((p) => ({ ...p, availability: getAvailability(p) }))
    .filter((p) => p.availability !== "disponible")
    .sort((a, b) => {
      // Agotados primero, luego pocas
      const order: Record<Availability, number> = { agotado: 0, pocas: 1, disponible: 2 };
      if (order[a.availability] !== order[b.availability]) {
        return order[a.availability] - order[b.availability];
      }
      return a.units / a.threshold - b.units / b.threshold;
    });

export const selectInventoryValue = (s: InventoryState) =>
  s.products.reduce((sum, p) => sum + p.price * p.units, 0);

export const selectInventoryCount = (s: InventoryState) => s.products.length;
