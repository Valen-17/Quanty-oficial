import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";

export const expenseTypeSchema = z.enum(["fijo", "variable"]);
export type ExpenseType = z.infer<typeof expenseTypeSchema>;

export const expenseInputSchema = z.object({
  concept: z
    .string()
    .trim()
    .min(2, { message: "Mínimo 2 caracteres" })
    .max(80, { message: "Máximo 80 caracteres" }),
  amount: z
    .number({ invalid_type_error: "Debe ser un número" })
    .positive({ message: "Debe ser mayor a 0" })
    .max(999_999_999),
  type: expenseTypeSchema,
  category: z
    .string()
    .trim()
    .max(40, { message: "Máximo 40 caracteres" })
    .optional()
    .or(z.literal("")),
  date: z.number().int().positive(),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export interface Expense extends ExpenseInput {
  id: string;
  category: string;
}

interface ExpensesState {
  expenses: Expense[];
  createExpense: (data: ExpenseInput) => Expense;
  updateExpense: (id: string, data: ExpenseInput) => void;
  deleteExpense: (id: string) => void;
}

const now = Date.now();
const day = 86_400_000;

const seed: Expense[] = [
  {
    id: "e-seed-1",
    concept: "Arriendo del local",
    amount: 1_200_000,
    type: "fijo",
    category: "Local",
    date: now - day * 18,
  },
  {
    id: "e-seed-2",
    concept: "Servicios públicos",
    amount: 320_000,
    type: "fijo",
    category: "Servicios",
    date: now - day * 12,
  },
  {
    id: "e-seed-3",
    concept: "Salario auxiliar",
    amount: 1_500_000,
    type: "fijo",
    category: "Nómina",
    date: now - day * 6,
  },
  {
    id: "e-seed-4",
    concept: "Compra de materiales",
    amount: 480_000,
    type: "variable",
    category: "Insumos",
    date: now - day * 3,
  },
  {
    id: "e-seed-5",
    concept: "Transporte y entregas",
    amount: 95_000,
    type: "variable",
    category: "Logística",
    date: now - day * 1,
  },
];

export const useExpensesStore = create<ExpensesState>()(
  persist(
    (set) => ({
      expenses: seed,
      createExpense: (data) => {
        const expense: Expense = {
          id: `e-${Date.now()}`,
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
      deleteExpense: (id) =>
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
    }),
    { name: "quanty-expenses-v1" },
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
