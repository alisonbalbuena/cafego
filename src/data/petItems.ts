export interface PetItem {
  id: string;
  emoji: string;
  label: string;
  cost: number;
}

export const PET_FOOD_ITEMS: PetItem[] = [
  { id: 'apple', emoji: '🍎', label: 'Apple', cost: 10 },
  { id: 'sandwich', emoji: '🥪', label: 'Sandwich', cost: 25 },
  { id: 'pizza', emoji: '🍕', label: 'Pizza', cost: 50 },
  { id: 'cake', emoji: '🎂', label: 'Cake', cost: 100 },
];

export const PET_CLOTHING_ITEMS: PetItem[] = [
  { id: 'bowtie', emoji: '🎀', label: 'Bow tie', cost: 30 },
  { id: 'glasses', emoji: '👓', label: 'Glasses', cost: 40 },
  { id: 'backpack', emoji: '🎒', label: 'Backpack', cost: 60 },
  { id: 'labcoat', emoji: '🥼', label: 'Lab coat', cost: 90 },
  { id: 'cap', emoji: '🎓', label: 'Grad cap', cost: 120 },
];

export interface PetBackground {
  id: string;
  label: string;
  cost: number;
  color: string;
  emoji: string;
}

// Placeholder color + emoji until real background art is provided.
export const PET_BACKGROUND_ITEMS: PetBackground[] = [
  { id: 'default', label: 'Cozy corner', cost: 0, color: '#f4e9dc', emoji: '☕' },
  { id: 'garden', label: 'Garden patio', cost: 50, color: '#e3f0e0', emoji: '🪴' },
  { id: 'library', label: 'Library nook', cost: 80, color: '#e6e0f5', emoji: '📚' },
  { id: 'nightcafe', label: 'Night cafe', cost: 120, color: '#dbe2f0', emoji: '🌙' },
  { id: 'rooftop', label: 'Rooftop view', cost: 150, color: '#fce8d8', emoji: '🌆' },
];

export function getPetBackground(id?: string): PetBackground {
  return PET_BACKGROUND_ITEMS.find((b) => b.id === id) ?? PET_BACKGROUND_ITEMS[0];
}

export function growthFromCost(cost: number): number {
  return Math.ceil(cost / 10);
}

export interface PetStage {
  key: string;
  label: string;
  emoji: string;
  minGrowth: number;
}

export const PET_STAGES: PetStage[] = [
  { key: 'baby', label: 'Baby', emoji: '👶', minGrowth: 0 },
  { key: 'toddler', label: 'Toddler', emoji: '🧒', minGrowth: 20 },
  { key: 'kid', label: 'Kid', emoji: '🧑‍🎓', minGrowth: 50 },
  { key: 'nerd', label: 'Nerdy Scholar', emoji: '🤓', minGrowth: 100 },
];

export function getPetStage(growth: number): PetStage {
  let current = PET_STAGES[0];
  for (const stage of PET_STAGES) {
    if (growth >= stage.minGrowth) current = stage;
  }
  return current;
}

export function getNextPetStage(growth: number): PetStage | null {
  return PET_STAGES.find((stage) => stage.minGrowth > growth) ?? null;
}
