import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import { useExpensesStore } from "@/stores/expensesStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { selectFinanceSeries } from "@/stores/selectors";
import { useFmtMoney } from "@/hooks/useFmtCurrency";
import { useSettingsStore } from "@/stores/settingsStore";

export function RevenueChart() {
  const quotes = useQuotesStore((s) => s.quotes);
  const expenses = useExpensesStore((s) => s.expenses);
  const data = useMemo(() => selectFinanceSeries(quotes, expenses), [quotes, expenses]);
  const fmtMoney = useFmtMoney();
  const exchangeRate = useSettingsStore((s) => s.exchangeRate);
  const formatAxis = (value: number) => {
    const converted = value / exchangeRate;
    if (Math.abs(converted) >= 1_000_000) return `${Math.round(converted / 100_000) / 10}M`;
    if (Math.abs(converted) >= 1_000) return `${Math.round(converted / 100) / 10}k`;
    return String(Math.round(converted));
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">Balance financiero</h2>
          <p className="text-sm text-muted-foreground">Ingresos vs. gastos últimos 9 meses</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Ingresos
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-chart-3" /> Gastos
          </span>
        </div>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.48 0.22 295)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="oklch(0.48 0.22 295)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.74 0.18 320)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="oklch(0.74 0.18 320)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.015 295)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="oklch(0.5 0.03 285)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="oklch(0.5 0.03 285)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatAxis(v)}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(1 0 0)",
                border: "1px solid oklch(0.92 0.015 295)",
                borderRadius: "12px",
                fontSize: "12px",
                boxShadow: "0 10px 30px -10px oklch(0.48 0.22 295 / 0.25)",
              }}
              formatter={(value) => [fmtMoney(Number(value) || 0), ""] as [string, string]}
            />
            <Area
              type="monotone"
              dataKey="ingresos"
              stroke="oklch(0.48 0.22 295)"
              strokeWidth={2.5}
              fill="url(#colorIngresos)"
            />
            <Area
              type="monotone"
              dataKey="gastos"
              stroke="oklch(0.74 0.18 320)"
              strokeWidth={2.5}
              fill="url(#colorGastos)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
