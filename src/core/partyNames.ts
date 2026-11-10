import type { PartyNames } from "./types";

export const PARTY_ROLES = ["arrendador", "arrendatario"] as const satisfies readonly (keyof PartyNames)[];

export function normalizePartyName(value: string): string | undefined {
  const name = value.trim().replace(/\s+/g, " ");
  return /^\p{L}[\p{L}\p{M} .'’-]*$/u.test(name) ? name : undefined;
}
