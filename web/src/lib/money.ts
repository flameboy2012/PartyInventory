import type { CoinPurse } from "./api/types";

const DENOMINATIONS: { key: keyof CoinPurse; label: string }[] = [
  { key: "platinum", label: "pp" },
  { key: "gold", label: "gp" },
  { key: "electrum", label: "ep" },
  { key: "silver", label: "sp" },
  { key: "copper", label: "cp" },
];

/** Formats a coin purse as e.g. "12 gp, 5 sp", omitting empty denominations. */
export function formatCoins(coins: CoinPurse): string {
  const parts = DENOMINATIONS.map(({ key, label }) => ({
    amount: Number(coins[key] ?? 0),
    label,
  }))
    .filter(({ amount }) => amount > 0)
    .map(({ amount, label }) => `${amount} ${label}`);

  return parts.length > 0 ? parts.join(", ") : "0 gp";
}
