import type { ExchangeRate } from "./currency";
/** Display USD without inventing a BRL rate when no quote provider is configured. */
export async function getExchangeRate(): Promise<ExchangeRate | null> { return null; }
