import type { ReactNode } from 'react';
import {
  browserTextStyle,
  isBrowserInkRuntime,
} from '../browser-dom.js';
import type { Color, Styles, TextStyles } from '../styles.js';

type BaseProps = {
  /**
   * Change text color. Accepts a raw color value (rgb, hex, ansi).
   */
  readonly color?: Color;

  /**
   * Same as `color`, but for background.
   */
  readonly backgroundColor?: Color;

  /**
   * Make the text italic.
   */
  readonly italic?: boolean;

  /**
   * Make the text underlined.
   */
  readonly underline?: boolean;

  /**
   * Make the text crossed with a line.
   */
  readonly strikethrough?: boolean;

  /**
   * Inverse background and foreground colors.
   */
  readonly inverse?: boolean;

  /**
   * This property tells Ink to wrap or truncate text if its width is larger than container.
   * If `wrap` is passed (by default), Ink will wrap text and split it into multiple lines.
   * If `truncate-*` is passed, Ink will truncate text instead, which will result in one line of text with the rest cut off.
   */
  readonly wrap?: Styles['textWrap'];
  readonly children?: ReactNode;
};

/**
 * Bold and dim are mutually exclusive in terminals.
 * This type ensures you can use one or the other, but not both.
 */
type WeightProps =
  | {
      bold?: never;
      dim?: never;
    }
  | {
      bold: boolean;
      dim?: never;
    }
  | {
      dim: boolean;
      bold?: never;
    };

export type Props = BaseProps & WeightProps;

const WRAP_STYLES: Record<NonNullable<Styles['textWrap']>, Styles> = {
  wrap: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'wrap',
  },
  'wrap-trim': {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'wrap-trim',
  },
  end: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'end',
  },
  middle: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'middle',
  },
  'truncate-end': {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'truncate-end',
  },
  truncate: {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'truncate',
  },
  'truncate-middle': {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'truncate-middle',
  },
  'truncate-start': {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    textWrap: 'truncate-start',
  },
} as const;

/**
 * This component can display text, and change its style to make it colorful, bold, underline, italic or strikethrough.
 */
export default function Text({
  color,
  backgroundColor,
  bold,
  dim,
  italic = false,
  underline = false,
  strikethrough = false,
  inverse = false,
  wrap = 'wrap',
  children,
}: Props) {
  if (children === undefined || children === null) {
    return null;
  }

  if (isBrowserInkRuntime()) {
    return (
      <span
        style={browserTextStyle({
          color,
          backgroundColor,
          dim: dim || undefined,
          bold: bold || undefined,
          italic,
          underline,
          strikethrough,
          inverse,
          wrap,
        })}
      >
        {children}
      </span>
    );
  }

  const textStyles: TextStyles = {
    ...(color !== undefined ? { color } : {}),
    ...(backgroundColor !== undefined ? { backgroundColor } : {}),
    ...(dim ? { dim: true } : {}),
    ...(bold ? { bold: true } : {}),
    ...(italic ? { italic: true } : {}),
    ...(underline ? { underline: true } : {}),
    ...(strikethrough ? { strikethrough: true } : {}),
    ...(inverse ? { inverse: true } : {}),
  };

  return (
    <ink-text style={WRAP_STYLES[wrap]} textStyles={textStyles}>
      {children}
    </ink-text>
  );
}
