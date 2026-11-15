// Cálculos derivados para el dashboard y el balance.

import type { Expense } from "@/stores/expensesStore";
import type { Quote, QuoteStatus } from "@/stores/quotesStore";

// Suma los totales de las cotizaciones aprobadas.
export function selectApprovedIncome(quotes: Quote[]) {
  return quotes.filter((q) => q.status === "aprobada").reduce((sum, q) => sum + q.total, 0);
}

// Cuenta las cotizaciones de cada estado.
export function selectQuoteCountByStatus(quotes: Quote[]) {
  const byStatus: Record<QuoteStatus, number> = {
    borrador: 0,
    enviada: 0,
    aprobada: 0,
    rechazada: 0,
  };
  for (const quote of quotes) byStatus[quote.status] += 1;
  return byStatus;
}

// Cuenta borradores y enviadas.
export function selectPendingQuotesCount(quotes: Quote[]) {
  return quotes.filter((q) => q.status === "borrador" || q.status === "enviada").length;
}

// Suma los gastos fijos, variables y el total.
export function selectExpenseTotals(expenses: Expense[]) {
  const fixed = expenses.filter((e) => e.type === "fijo").reduce((sum, e) => sum + e.amount, 0);
  const variable = expenses
    .filter((e) => e.type === "variable")
    .reduce((sum, e) => sum + e.amount, 0);
  return { fixed, variable, total: fixed + variable };
}

// Resumen de ingresos, gastos, utilidad y margen.
export function selectFinancialSummary(quotes: Quote[], expenses: Expense[]) {
  const income = selectApprovedIncome(quotes);
  const expenseTotals = selectExpenseTotals(expenses);
  const profit = income - expenseTotals.total;
  const margin = income > 0 ? (profit / income) * 100 : 0;
  return { income, ...expenseTotals, profit, margin };
}

function monthKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Agrupa ingresos y gastos por mes para el gráfico.
export function selectFinanceSeries(quotes: Quote[], expenses: Expense[], monthsBack = 9) {
  const now = new Date();
  const keys: string[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const incomeByMonth = new Map<string, number>();
  const expensesByMonth = new Map<string, number>();

  for (const q of quotes) {
    if (q.status !== "aprobada") continue;
    const key = monthKey(q.approvedAt ?? q.createdAt);
    incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + q.total);
  }

  for (const e of expenses) {
    const key = monthKey(e.date);
    expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + e.amount);
  }

  return keys.map((key) => {
    const [year, month] = key.split("-");
    const labelDate = new Date(Number(year), Number(month) - 1, 1);
    const monthLabel = labelDate.toLocaleDateString("es-CO", { month: "short" });
    return {
      key,
      month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1).replace(".", ""),
      ingresos: incomeByMonth.get(key) ?? 0,
      gastos: expensesByMonth.get(key) ?? 0,
    };
  });
}
