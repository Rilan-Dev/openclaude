import { isBrowserInkRuntime } from './browser-dom.js'
import type { DOMElement } from './dom.js'

type Output = {
  /**
   * Element width.
   */
  width: number

  /**
   * Element height.
   */
  height: number
}

/**
 * Measure the dimensions of a particular `<Box>` element.
 */
const measureElement = (node: DOMElement | HTMLElement): Output => {
  if (isBrowserInkRuntime() && 'getBoundingClientRect' in node) {
    const rect = node.getBoundingClientRect()
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }
  }

  if (!('yogaNode' in node)) {
    return {
      width: 0,
      height: 0,
    }
  }

  return {
    width: node.yogaNode?.getComputedWidth() ?? 0,
    height: node.yogaNode?.getComputedHeight() ?? 0,
  }
}

export default measureElement
