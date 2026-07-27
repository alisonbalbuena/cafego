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
  { id: 'garden', label: 'Garden patio', cost: 0, color: '#e3f0e0', emoji: '🪴' },
  { id: 'library', label: 'Library nook', cost: 0, color: '#e6e0f5', emoji: '📚' },
  { id: 'nightcafe', label: 'Night cafe', cost: 0, color: '#dbe2f0', emoji: '🌙' },
  { id: 'rooftop', label: 'Rooftop view', cost: 0, color: '#fce8d8', emoji: '🌆' },
];

export function getPetBackground(id?: string): PetBackground {
  return PET_BACKGROUND_ITEMS.find((b) => b.id === id) ?? PET_BACKGROUND_ITEMS[0];
}
