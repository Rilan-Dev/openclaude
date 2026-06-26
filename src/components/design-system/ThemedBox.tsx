import { forwardRef, type ForwardedRef, type PropsWithChildren } from 'react';
import Box from '../../ink/components/Box.js';
import type { DOMElement } from '../../ink/dom.js';
import type { ClickEvent } from '../../ink/events/click-event.js';
import type { FocusEvent } from '../../ink/events/focus-event.js';
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js';
import type { Color, Styles } from '../../ink/styles.js';
import { getTheme, type Theme } from '../../utils/theme.js';
import { resolveThemeColor } from './themeColor.js';
import { useTheme } from './ThemeProvider.js';

// Color props that accept theme keys
type ThemedColorProps = {
  readonly borderColor?: keyof Theme | Color;
  readonly borderTopColor?: keyof Theme | Color;
  readonly borderBottomColor?: keyof Theme | Color;
  readonly borderLeftColor?: keyof Theme | Color;
  readonly borderRightColor?: keyof Theme | Color;
  readonly backgroundColor?: keyof Theme | Color;
};

// Base Styles without color props (they'll be overridden)
type BaseStylesWithoutColors = Omit<
  Styles,
  | 'textWrap'
  | 'borderColor'
  | 'borderTopColor'
  | 'borderBottomColor'
  | 'borderLeftColor'
  | 'borderRightColor'
  | 'backgroundColor'
>;

export type Props = BaseStylesWithoutColors &
  ThemedColorProps & {
    tabIndex?: number;
    autoFocus?: boolean;
    onClick?: (event: ClickEvent) => void;
    onFocus?: (event: FocusEvent) => void;
    onFocusCapture?: (event: FocusEvent) => void;
    onBlur?: (event: FocusEvent) => void;
    onBlurCapture?: (event: FocusEvent) => void;
    onKeyDown?: (event: KeyboardEvent) => void;
    onKeyDownCapture?: (event: KeyboardEvent) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  };

/**
 * Theme-aware Box component that resolves theme color keys to raw colors.
 * This wraps the base Box component with theme resolution for border colors.
 */
function ThemedBoxInner(
  props: PropsWithChildren<Props>,
  ref: ForwardedRef<DOMElement>,
) {
  const {
    borderColor,
    borderTopColor,
    borderBottomColor,
    borderLeftColor,
    borderRightColor,
    backgroundColor,
    children,
    ...rest
  } = props;

  const [themeName] = useTheme();
  const theme = getTheme(themeName);

  const resolvedBorderColor = resolveThemeColor(borderColor, theme);
  const resolvedBorderTopColor = resolveThemeColor(borderTopColor, theme);
  const resolvedBorderBottomColor = resolveThemeColor(borderBottomColor, theme);
  const resolvedBorderLeftColor = resolveThemeColor(borderLeftColor, theme);
  const resolvedBorderRightColor = resolveThemeColor(borderRightColor, theme);
  const resolvedBackgroundColor = resolveThemeColor(backgroundColor, theme);

  return (
    <Box
      ref={ref}
      borderColor={resolvedBorderColor}
      borderTopColor={resolvedBorderTopColor}
      borderBottomColor={resolvedBorderBottomColor}
      borderLeftColor={resolvedBorderLeftColor}
      borderRightColor={resolvedBorderRightColor}
      backgroundColor={resolvedBackgroundColor}
      {...rest}
    >
      {children}
    </Box>
  );
}

const ThemedBox = forwardRef<DOMElement, PropsWithChildren<Props>>(ThemedBoxInner);
ThemedBox.displayName = 'ThemedBox';

export default ThemedBox;
