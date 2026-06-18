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
