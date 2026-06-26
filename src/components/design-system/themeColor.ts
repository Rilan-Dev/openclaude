import type { Color } from '../../ink/styles.js';
import type { Theme } from '../../utils/theme.js';

/**
 * Resolves either a theme key or a raw Ink color into a raw color value.
 */
export function resolveThemeColor(
  color: keyof Theme | Color | undefined,
  theme: Theme,
): Color | undefined {
  if (!color) return undefined;

  if (
    color.startsWith('rgb(') ||
    color.startsWith('#') ||
    color.startsWith('ansi256(') ||
    color.startsWith('ansi:')
  ) {
    return color as Color;
  }

  return theme[color as keyof Theme] as Color;
}
