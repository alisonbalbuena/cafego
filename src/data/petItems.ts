import { ImageSourcePropType } from 'react-native';

export interface PetBackground {
  id: string;
  label: string;
  cost: number;
  color: string;
  /** Full-bleed scene art shown behind the buddy once purchased. Falls back
   * to a flat `color` fill when not yet provided. */
  image?: ImageSourcePropType;
}

// Shown before a background is ever purchased — not itself a shop item.
// Every account starts on this plain white background by default.
const NO_BACKGROUND: PetBackground = { id: 'none', label: '', cost: 0, color: '#ffffff' };

export const PET_BACKGROUND_ITEMS: PetBackground[] = [
  {
    id: 'garden',
    label: 'Garden patio',
    cost: 250,
    color: '#e3f0e0',
    image: require('../../assets/petBackgrounds/garden.png'),
  },
  {
    id: 'library',
    label: 'Library nook',
    cost: 250,
    color: '#e6e0f5',
    image: require('../../assets/petBackgrounds/library.png'),
  },
  {
    id: 'nightcafe',
    label: 'Night cafe',
    cost: 250,
    color: '#dbe2f0',
    image: require('../../assets/petBackgrounds/nightcafe.png'),
  },
  {
    id: 'rooftop',
    label: 'Bridge view',
    cost: 250,
    color: '#fce8d8',
    image: require('../../assets/petBackgrounds/bridge.png'),
  },
  {
    id: 'picnic',
    label: 'Picnic',
    cost: 250,
    color: '#eaf2df',
    image: require('../../assets/petBackgrounds/picnic.png'),
  },
  {
    id: 'playground',
    label: 'Playground',
    cost: 250,
    color: '#eef0e2',
    image: require('../../assets/petBackgrounds/playground.png'),
  },
];

export function getPetBackground(id?: string): PetBackground {
  return PET_BACKGROUND_ITEMS.find((b) => b.id === id) ?? NO_BACKGROUND;
}
