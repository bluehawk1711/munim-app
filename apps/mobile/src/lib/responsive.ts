/**
 * Responsive layout utilities for Munim mobile.
 *
 * All spacing, typography, and dimension values scale with device width
 * so the UI looks correct on small Android phones, standard phones,
 * large phones, and iPhones with notches/Dynamic Island.
 *
 * Usage:
 *   import { rw, rh, rs, rFont, SCREEN, GUTTER } from '../lib/responsive';
 *
 *   <View style={{ padding: rw(16), marginTop: rs(8) }}>
 *     <Text style={{ fontSize: rFont(15) }}>Hello</Text>
 *   </View>
 */

import {Dimensions, PixelRatio} from 'react-native';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

/**
 * Baseline design width (iPhone 14 / typical Android design spec).
 * All scale calculations reference this.
 */
const BASE_WIDTH = 390;

/** Screen dimensions for conditional logic. */
export const SCREEN = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmall: SCREEN_WIDTH < 360,
  isMedium: SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 400,
  isLarge: SCREEN_WIDTH >= 400,
} as const;

/** Consistent horizontal padding for screens and cards. */
export const GUTTER = rw(16);

/**
 * Scale a horizontal value relative to the baseline design width.
 * Use for: padding, margins, widths, horizontal offsets.
 */
export function rw(value: number): number {
  return PixelRatio.roundToNearestPixel((SCREEN_WIDTH / BASE_WIDTH) * value);
}

/**
 * Scale a vertical value. Uses the same ratio as horizontal for consistency.
 * Use for: vertical padding, margins, heights.
 */
export function rh(value: number): number {
  return PixelRatio.roundToNearestPixel((SCREEN_WIDTH / BASE_WIDTH) * value);
}

/**
 * Scale a font size. Applies the pixel ratio so text stays crisp.
 */
export function rFont(size: number): number {
  return PixelRatio.roundToNearestPixel((SCREEN_WIDTH / BASE_WIDTH) * size);
}

/**
 * Scale a general size (border-radius, icon size, etc.).
 */
export function rs(value: number): number {
  return PixelRatio.roundToNearestPixel((SCREEN_WIDTH / BASE_WIDTH) * value);
}

/**
 * Consistent spacing scale — use these instead of raw numbers.
 * Based on a 4px grid, scaled to the device.
 */
export const spacing = {
  xs: rs(4),
  sm: rs(8),
  md: rs(12),
  lg: rs(16),
  xl: rs(20),
  xxl: rs(24),
  xxxl: rs(32),
} as const;

/**
 * Typography scale — consistent font sizes used across all screens.
 */
export const typography = {
  /** Screen title */
  h1: rFont(22),
  /** Section title */
  h2: rFont(17),
  /** Card title */
  h3: rFont(15),
  /** Primary value (large number) */
  valueLarge: rFont(20),
  /** Standard body text */
  body: rFont(15),
  /** Secondary text / descriptions */
  secondary: rFont(14),
  /** Label above inputs */
  label: rFont(12),
  /** Caption / timestamp */
  caption: rFont(11),
  /** Badge text */
  badge: rFont(10),
  /** Tab label */
  tab: rFont(10),
} as const;

/**
 * Consistent border radii.
 */
export const radii = {
  sm: rs(8),
  md: rs(10),
  lg: rs(14),
  xl: rs(20),
  full: 9999,
} as const;

/**
 * Minimum touch target size (44x44 pt per Apple HIG / Material).
 */
export const TOUCH_TARGET = 44;

/**
 * Standard card horizontal margin.
 */
export const CARD_MARGIN = GUTTER;

/**
 * Two-column grid gap.
 */
export const GRID_GAP = rs(10);
