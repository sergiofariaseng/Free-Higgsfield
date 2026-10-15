import type { ApiBalance } from "./video-quote-types";

/** Neither the supplied API docs nor the official Python/TS SDKs document a
 * balance endpoint. Keep this explicit until an official contract is provided.
 * Never use the website subscription credits or local spending as API balance. */
export async function getApiBalance(): Promise<ApiBalance> {
  return { status: "unavailable", usd: null, credits: null, checkedAt: Date.now(),
    reason: "A consulta automática de saldo da API ainda não está disponível. Confira o saldo no console Higgsfield API." };
}
export function balanceAfter(balance: ApiBalance, usd: number | null, credits: number | null) {
  const available = balance.status === "available";
  const remainingUsd = available && balance.usd !== null && usd !== null ? Math.round((balance.usd - usd) * 1e8) / 1e8 : null;
  const remainingCredits = available && balance.credits !== null && credits !== null ? Math.round((balance.credits - credits) * 1e8) / 1e8 : null;
  return { remainingUsd, remainingCredits, insufficient: (remainingUsd !== null && remainingUsd < 0) || (remainingCredits !== null && remainingCredits < 0) };
}
