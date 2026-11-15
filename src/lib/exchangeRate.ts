// Consulta cuánto vale 1 COP en la moneda elegida; devuelve null si falla.
export async function fetchCopRate(targetCurrency: string): Promise<number | null> {
  if (targetCurrency === "COP") return 1;
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/COP");
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const rates =
      data && typeof data === "object" && "rates" in data
        ? (data as { rates?: Record<string, unknown> }).rates
        : undefined;
    const rate = rates?.[targetCurrency];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
    return 1 / rate;
  } catch {
    return null;
  }
}
