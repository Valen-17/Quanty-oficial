import { useMemo } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { makeFmtCurrency } from "@/lib/format";

export function useFmtCurrency(): Intl.NumberFormat {
  const currency = useSettingsStore((s) => s.profile.currency);
  return useMemo(() => makeFmtCurrency(currency), [currency]);
}
