import { useEffect } from "react";
import { fetchCopRate } from "@/lib/exchangeRate";
import { useSettingsStore } from "@/stores/settingsStore";

export function useExchangeRateSync() {
  const currency = useSettingsStore((s) => s.profile.currency);
  const setExchangeRate = useSettingsStore((s) => s.setExchangeRate);

  useEffect(() => {
    let cancelled = false;
    void fetchCopRate(currency).then((rate) => {
      if (!cancelled && rate !== null) setExchangeRate(rate);
    });
    return () => {
      cancelled = true;
    };
  }, [currency, setExchangeRate]);
}
