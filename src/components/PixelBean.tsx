import React from 'react';
import { View } from 'react-native';

// A coffee bean silhouette on a 9x13 bitmap grid. '1' = filled pixel, '0' =
// empty (transparent) — including the center groove that reads as a bean.
const BEAN_GRID = [
  '000111000',
  '001111100',
  '011111110',
  '011101110',
  '111101111',
  '111101111',
  '111101111',
  '111101111',
  '111101111',
  '011101110',
  '011111110',
  '001111100',
  '000111000',
];

interface Props {
  /** Fill color for the bean's pixels. */
  color: string;
  /** Rendered width in px — height follows the grid's aspect ratio. */
  size?: number;
}

export default function PixelBean({ color, size = 18 }: Props) {
  const cols = BEAN_GRID[0].length;
  const pixel = size / cols;

  return (
    <View style={{ width: pixel * cols }}>
      {BEAN_GRID.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.split('').map((cell, c) => (
            <View
              key={c}
              style={{
                width: pixel,
                height: pixel,
                backgroundColor: cell === '1' ? color : 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
