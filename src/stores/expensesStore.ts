// Estado de los gastos: caché local y sincronización con Supabase.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createEntityId } from "@/domain/common";
import {
  expenseInputSchema as domainExpenseInputSchema,
  expenseTypeSchema as domainExpenseTypeSchema,
  expensesPersistedSchema,
  type Expense as DomainExpense,
  type ExpenseInput as DomainExpenseInput,
  type ExpenseType as DomainExpenseType,
  type ExpensesPersisted,
} from "@/domain/entities";
import { buildPersistOptions } from "@/lib/persist-helpers";
import { createScopedJsonStorage } from "@/lib/scoped-persist-storage";
import { mergeRemoteWithLocalLegacy } from "@/lib/merge-remote-with-local-legacy";
import {
  isRemoteExpenseId,
  safeCreateExpense,
  safeGetExpenses,
  safeSoftDeleteExpense,
  safeUpdateExpense,
} from "@/repositories/expenses.repository";

export const expenseTypeSchema = domainExpenseTypeSchema;
export type ExpenseType = DomainExpenseType;
export const expenseInputSchema = domainExpenseInputSchema;
export type ExpenseInput = DomainExpenseInput;
export type Expense = DomainExpense;

interface ExpensesState {
  expenses: Expense[];
  remoteExpensesError: string | null;
  createExpense: (data: ExpenseInput) => Expense;
  updateExpense: (id: string, data: ExpenseInput) => void;
  deleteExpense: (id: string) => void;
  clearRemoteExpensesError: () => void;
  syncExpensesFromRemote: () => Promise<boolean>;
  createExpenseOnRemote: (data: ExpenseInput) => Promise<Expense | null>;
  updateExpenseOnRemote: (id: string, data: ExpenseInput) => Promise<boolean>;
  softDeleteExpenseOnRemote: (id: string) => Promise<boolean>;
}

export const useExpensesStore = create<ExpensesState>()(
  persist(
    (set, get) => ({
      expenses: [],
      remoteExpensesError: null,
      clearRemoteExpensesError: () => set({ remoteExpensesError: null }),
      // Trae los gastos remotos y conserva los que solo existen en local.
      syncExpensesFromRemote: async () => {
        const res = await safeGetExpenses();
        if (!res.ok) {
          set({ remoteExpensesError: res.error });
          return false;
        }
        const merged = mergeRemoteWithLocalLegacy(res.data, get().expenses, isRemoteExpenseId);
        set({ expenses: merged, remoteExpensesError: null });
        return true;
      },
      createExpenseOnRemote: async (data) => {
        const res = await safeCreateExpense(data);
        if (!res.ok) {
          set({ remoteExpensesError: res.error });
          return null;
        }
        set((s) => ({
          expenses: [res.data, ...s.expenses.filter((e) => e.id !== res.data.id)],
          remoteExpensesError: null,
        }));
        return res.data;
      },
      updateExpenseOnRemote: async (id, data) => {
        const res = await safeUpdateExpense(id, data);
        if (!res.ok) {
          set({ remoteExpensesError: res.error });
          return false;
        }
        set((s) => ({
          expenses: s.expenses.map((e) => (e.id === id ? res.data : e)),
          remoteExpensesError: null,
        }));
        return true;
      },
      softDeleteExpenseOnRemote: async (id) => {
        const res = await safeSoftDeleteExpense(id);
        if (!res.ok) {
          set({ remoteExpensesError: res.error });
          return false;
        }
        set((s) => ({
          expenses: s.expenses.filter((e) => e.id !== id),
          remoteExpensesError: null,
        }));
        return true;
      },
      createExpense: (data) => {
        const expense: Expense = {
          id: createEntityId("e"),
          ...data,
          category: data.category ?? "",
        };
        set((s) => ({ expenses: [expense, ...s.expenses] }));
        return expense;
      },
      updateExpense: (id, data) =>
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, ...data, category: data.category ?? "" } : e,
          ),
        })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
    }),
    {
      ...buildPersistOptions<ExpensesState, ExpensesPersisted>({
        name: "quanty-expenses-v1",
        version: 2,
        schema: expensesPersistedSchema,
        fallback: () => ({ expenses: [] }),
        partialize: (state) => ({ expenses: state.expenses }),
        migrations: {
          2: (state) => ({
            expenses: state.expenses.map((e) => ({
              ...e,
              category: e.category ?? "",
            })),
          }),
        },
      }),
      storage: createScopedJsonStorage(),
    },
  ),
);

export const expenseTypeLabel: Record<ExpenseType, string> = {
  fijo: "Costo fijo",
  variable: "Costo variable",
};

export const expenseTypeStyles: Record<ExpenseType, string> = {
  fijo: "bg-primary/10 text-primary",
  variable: "bg-warning/15 text-warning-foreground",
};
