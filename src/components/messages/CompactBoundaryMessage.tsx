import { c as _c } from "react-compiler-runtime";
import { Box, Text } from '../../ink.js';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
export function CompactBoundaryMessage() {
  const $ = _c(2);
  const historyShortcut = useShortcutDisplay("app:toggleTranscript", "Global", "ctrl+o");
  if (isBrowserRuntime()) {
    return (
      <div className="oc-historyBoundaryCard">
        <div className="oc-historyBoundaryTitle">Conversation compacted</div>
        <div className="oc-historyBoundaryMeta">Older context was summarized to keep the chat responsive.</div>
      </div>
    );
  }
  let t0;
  if ($[0] !== historyShortcut) {
    t0 = <Box marginY={1}><Text dimColor={true}>✻ Conversation compacted ({historyShortcut} for history)</Text></Box>;
    $[0] = historyShortcut;
    $[1] = t0;
  } else {
    t0 = $[1];
  }
  return t0;
}
