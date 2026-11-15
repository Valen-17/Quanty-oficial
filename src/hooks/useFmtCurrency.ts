import { useCallback, useMemo } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeFmtCurrency } from "@/lib/format";

// Formatea montos guardados en COP a la moneda elegida.
export function useFmtMoney(): (copAmount: number) => string {
  const currency = useSettingsStore((s) => s.profile.currency);
  const exchangeRate = useSettingsStore((s) => s.exchangeRate);
  const fmt = useMemo(() => makeFmtCurrency(currency), [currency]);
  return useCallback(
    (copAmount: number) => fmt.format(copAmount / exchangeRate),
    [fmt, exchangeRate],
  );
}
