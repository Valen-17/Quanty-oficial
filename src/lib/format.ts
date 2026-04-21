// Formatos deterministas para evitar mismatches de hidratación SSR/CSR.
// Siempre usar locale explícito.

export const fmtCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export const fmtNumber = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

export const fmtDate = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
