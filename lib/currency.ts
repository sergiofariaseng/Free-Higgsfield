export interface ExchangeRate {
  rate: number;
  date: string;
  fetchedAt: number;
  stale: boolean;
}

export function formatBrl(usd: number | null | undefined, rate: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  if (usd !== 0 && (rate == null || !Number.isFinite(rate) || rate <= 0)) return "—";
  const value = usd === 0 ? 0 : usd * rate!;
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
  }).format(value);
}
