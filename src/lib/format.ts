const CURRENCY_LOCALE: Record<string, string> = {
  COP: "es-CO",
  USD: "en-US",
  MXN: "es-MX",
  EUR: "de-DE",
};

// Formateador de moneda según la divisa del usuario.
export function makeFmtCurrency(currency: string): Intl.NumberFormat {
  const locale = CURRENCY_LOCALE[currency] ?? "es-CO";
  const cur = CURRENCY_LOCALE[currency] ? currency : "COP";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 0,
  });
}

// Formato corto de fecha en español.
export const fmtDate = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
