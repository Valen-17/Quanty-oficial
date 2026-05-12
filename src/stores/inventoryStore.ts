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
import { seedProducts } from "@/components/quanty/inventory/seed";
import { buildPersistOptions } from "@/lib/persist-helpers";

interface InventoryState {
  products: Product[];
  addProduct: (data: ProductInput) => void;
  updateProduct: (id: string, data: ProductInput) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (id: string, delta: number) => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      products: seedProducts,
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
      deleteProduct: (id) =>
        set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
      adjustStock: (id, delta) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id
              ? { ...p, units: Math.max(0, Math.min(999_999, p.units + delta)) }
              : p,
          ),
        })),
    }),
    buildPersistOptions<InventoryState, InventoryPersisted>({
      name: "quanty-inventory-v1",
      version: 2,
      schema: inventoryPersistedSchema,
      fallback: () => ({ products: seedProducts }),
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
