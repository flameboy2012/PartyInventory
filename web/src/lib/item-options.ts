import type { ItemRarity, ItemType } from "./api/types";

export const ITEM_TYPES: ItemType[] = [
  "Weapon",
  "Armor",
  "Potion",
  "Scroll",
  "Gear",
  "Treasure",
  "Other",
];

export const ITEM_RARITIES: ItemRarity[] = [
  "Common",
  "Uncommon",
  "Rare",
  "VeryRare",
  "Legendary",
  "Artifact",
];

/**
 * How each rarity is written for players. `VeryRare` is the only one the API spells differently
 * from the way it reads. Keyed exhaustively, so a new rarity on the API fails to compile here
 * rather than showing up raw in the UI.
 */
export const ITEM_RARITY_LABELS: Record<ItemRarity, string> = {
  Common: "Common",
  Uncommon: "Uncommon",
  Rare: "Rare",
  VeryRare: "Very rare",
  Legendary: "Legendary",
  Artifact: "Artifact",
};

/** Rank used to order an item list by rarity. Higher is rarer. */
export const ITEM_RARITY_ORDER: Record<ItemRarity, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  VeryRare: 3,
  Legendary: 4,
  Artifact: 5,
};
