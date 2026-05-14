export async function fetchCopRate(targetCurrency: string): Promise<number> {
  if (targetCurrency === "COP") return 1;
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/COP`);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    const rate = data?.rates?.[targetCurrency];
    if (typeof rate !== "number" || rate <= 0) throw new Error("invalid rate");
    return 1 / rate;
  } catch {
    return 1;
  }
}
