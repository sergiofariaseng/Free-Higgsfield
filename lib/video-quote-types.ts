export interface ApiBalance {
  status: "available" | "unavailable";
  usd: number | null;
  credits: number | null;
  checkedAt: number;
  reason?: string;
}
export interface VideoQuote {
  usd: number | null;
  credits: number | null;
  source: "api" | "configured-rate" | "unavailable";
  billingUnit: "credits" | "USD" | "tokens" | null;
  tokens: number | null;
  note: string;
  balance: ApiBalance;
  remainingUsd: number | null;
  remainingCredits: number | null;
  insufficient: boolean;
  expiresAt: number;
  confirmation: string | null;
}
