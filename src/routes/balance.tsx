import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  PiggyBank,
  Receipt,
} from "lucide-react";
import { AppLayout } from "@/components/quanty/AppLayout";
import { KpiCard } from "@/components/quanty/KpiCard";
import { ExpenseFormModal } from "@/components/quanty/balance/ExpenseFormModal";
import {
  expenseTypeLabel,
  expenseTypeStyles,
  useExpensesStore,
  type Expense,
  type ExpenseInput,
  type ExpenseType,
} from "@/stores/expensesStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { fmtDate } from "@/lib/format";
import { useFmtMoney } from "@/hooks/useFmtCurrency";
import { cn } from "@/lib/utils";
import { isRemoteExpenseId } from "@/repositories/expenses.repository";
import { selectFinancialSummary, selectQuoteCountByStatus } from "@/stores/selectors";

export const Route = createFileRoute("/balance")({
  head: () => ({
    meta: [
      { title: "Balance · Quanty" },
      {
        name: "description",
        content: "Desglose de costos fijos y variables, y cálculo de ganancias.",
      },
    ],
  }),
  component: BalancePage,
});

type Filter = "todos" | ExpenseType;

// Página de ingresos, gastos y utilidad.
function BalancePage() {
  const fmtMoney = useFmtMoney();
  const expenses = useExpensesStore((s) => s.expenses);
  const createExpense = useExpensesStore((s) => s.createExpense);
  const updateExpense = useExpensesStore((s) => s.updateExpense);
  const deleteExpense = useExpensesStore((s) => s.deleteExpense);
  const createExpenseOnRemote = useExpensesStore((s) => s.createExpenseOnRemote);
  const updateExpenseOnRemote = useExpensesStore((s) => s.updateExpenseOnRemote);
  const softDeleteExpenseOnRemote = useExpensesStore((s) => s.softDeleteExpenseOnRemote);
  const remoteExpensesError = useExpensesStore((s) => s.remoteExpensesError);
  const clearRemoteExpensesError = useExpensesStore((s) => s.clearRemoteExpensesError);
  const quotes = useQuotesStore((s) => s.quotes);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [filter, setFilter] = useState<Filter>("todos");

  const summary = useMemo(() => selectFinancialSummary(quotes, expenses), [quotes, expenses]);
  const quoteByStatus = useMemo(() => selectQuoteCountByStatus(quotes), [quotes]);
  const income = summary.income;
  const fixedTotal = summary.fixed;
  const variableTotal = summary.variable;
  const totalExpenses = summary.total;
  const profit = summary.profit;
  const margin = summary.margin;

  const filtered = useMemo(() => {
    const list = filter === "todos" ? expenses : expenses.filter((e) => e.type === filter);
    return [...list].sort((a, b) => b.date - a.date);
  }, [expenses, filter]);

  const openNew = () => {
    clearRemoteExpensesError();
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (e: Expense) => {
    clearRemoteExpensesError();
    setEditing(e);
    setOpen(true);
  };

  const handleSubmitExpense = async (data: ExpenseInput) => {
    if (editing) {
      if (isRemoteExpenseId(editing.id)) {
        return await updateExpenseOnRemote(editing.id, data);
      }
      updateExpense(editing.id, data);
      return true;
    }
    const created = await createExpenseOnRemote(data);
    if (created) return true;
    createExpense(data);
    return true;
  };

  return (
    <AppLayout
      title="Balance"
      subtitle="Costos fijos, variables y ganancias automáticas."
      actions={
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" /> Nuevo gasto
        </button>
      }
    >
      {remoteExpensesError && !open && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p className="min-w-0 flex-1">{remoteExpensesError}</p>
          <button
            type="button"
            onClick={() => clearRemoteExpensesError()}
            className="shrink-0 font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Cerrar
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ingresos aprobados"
          value={fmtMoney(income)}
          hint={`${quoteByStatus.aprobada} cotizaciones`}
          icon={TrendingUp}
          accent="success"
        />
        <KpiCard
          label="Costos fijos"
          value={fmtMoney(fixedTotal)}
          hint={`${expenses.filter((e) => e.type === "fijo").length} conceptos`}
          icon={Receipt}
          accent="primary"
        />
        <KpiCard
          label="Costos variables"
          value={fmtMoney(variableTotal)}
          hint={`${expenses.filter((e) => e.type === "variable").length} conceptos`}
          icon={TrendingDown}
          accent="warning"
        />
        <KpiCard
          label={profit >= 0 ? "Ganancia" : "Pérdida"}
          value={fmtMoney(Math.abs(profit))}
          hint={`Margen ${margin.toFixed(1)}%`}
          icon={PiggyBank}
          accent={profit >= 0 ? "success" : "muted"}
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Distribución</h2>
              <p className="text-xs text-muted-foreground">Composición de tus egresos</p>
            </div>
          </div>
          {totalExpenses === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay gastos.</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(fixedTotal / totalExpenses) * 100}%` }}
                />
                <div
                  className="h-full bg-warning"
                  style={{ width: `${(variableTotal / totalExpenses) * 100}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Fijos</span>
                  <span className="ml-auto font-mono font-semibold text-foreground">
                    {((fixedTotal / totalExpenses) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                  <span className="text-muted-foreground">Variables</span>
                  <span className="ml-auto font-mono font-semibold text-foreground">
                    {((variableTotal / totalExpenses) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-lg font-bold text-foreground">Resumen</h2>
          <p className="text-xs text-muted-foreground">Ingresos vs gastos del periodo</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ingresos</span>
              <span className="font-mono font-semibold text-success">+{fmtMoney(income)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Egresos</span>
              <span className="font-mono font-semibold text-destructive">
                -{fmtMoney(totalExpenses)}
              </span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">
                  {profit >= 0 ? "Ganancia neta" : "Pérdida neta"}
                </span>
                <span
                  className={cn(
                    "font-mono text-base font-bold",
                    profit >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {profit >= 0 ? "+" : "-"}
                  {fmtMoney(Math.abs(profit))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Gastos registrados</h2>
            <p className="text-sm text-muted-foreground">Edita o elimina cualquier gasto</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "fijo", "variable"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {f === "todos" ? "Todos" : f === "fijo" ? "Fijos" : "Variables"}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Wallet className="h-6 w-6" />
            </div>
            <p className="font-display text-base font-bold text-foreground">Sin gastos</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Registra tu primer gasto para ver el cálculo de ganancia.
            </p>
            <button
              onClick={openNew}
              className="mt-1 inline-flex items-center gap-2 rounded-lg bg-[image:var(--gradient-primary)] px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Nuevo gasto
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 sm:px-6">Concepto</th>
                  <th className="px-5 py-3 sm:px-6">Tipo</th>
                  <th className="px-5 py-3 sm:px-6">Categoría</th>
                  <th className="px-5 py-3 sm:px-6">Fecha</th>
                  <th className="px-5 py-3 text-right sm:px-6">Monto</th>
                  <th className="px-5 py-3 sm:px-6"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium text-foreground sm:px-6">{e.concept}</td>
                    <td className="px-5 py-3 sm:px-6">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          expenseTypeStyles[e.type],
                        )}
                      >
                        {expenseTypeLabel[e.type]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground sm:px-6">{e.category || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground sm:px-6">
                      {fmtDate.format(e.date)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-foreground sm:px-6">
                      {fmtMoney(e.amount)}
                    </td>
                    <td className="px-5 py-3 sm:px-6">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(e)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (!confirm(`¿Eliminar "${e.concept}"?`)) return;
                            if (isRemoteExpenseId(e.id)) {
                              void softDeleteExpenseOnRemote(e.id);
                            } else {
                              deleteExpense(e.id);
                            }
                          }}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ExpenseFormModal
        open={open}
        initial={editing}
        onClose={() => {
          clearRemoteExpensesError();
          setOpen(false);
        }}
        onSubmit={handleSubmitExpense}
      />
    </AppLayout>
  );
}
