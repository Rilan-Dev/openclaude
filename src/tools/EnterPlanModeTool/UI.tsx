import * as React from 'react';
import { BLACK_CIRCLE } from 'src/constants/figures.js';
import { PRODUCT_DISPLAY_NAME } from 'src/constants/product.js';
import { getModeColor } from 'src/utils/permissions/PermissionMode.js';
import { BrowserToolResultDisclosure } from '../../components/messages/UserToolResultMessage/BrowserToolResultDisclosure.js';
import { Box, Text } from '../../ink.js';
import type { ToolProgressData } from '../../Tool.js';
import type { ProgressMessage } from '../../types/message.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
import type { ThemeName } from '../../utils/theme.js';
import type { Output } from './EnterPlanModeTool.js';
export function renderToolUseMessage(): React.ReactNode {
  return null;
}
export function renderToolResultMessage(_output: Output, _progressMessagesForMessage: ProgressMessage<ToolProgressData>[], _options: {
  theme: ThemeName;
}): React.ReactNode {
  if (isBrowserRuntime()) {
    return (
      <BrowserToolResultDisclosure title="Plan mode enabled" detail="Designing an implementation approach" state="done">
        <div className="oc-agentProgressLine">{PRODUCT_DISPLAY_NAME} is exploring the work before making changes.</div>
      </BrowserToolResultDisclosure>
    );
  }
  return <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        <Text color={getModeColor('plan')}>{BLACK_CIRCLE}</Text>
        <Text> Entered plan mode</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text dimColor>
          {PRODUCT_DISPLAY_NAME} is now exploring and designing an implementation approach.
        </Text>
      </Box>
    </Box>;
}
export function renderToolUseRejectedMessage(): React.ReactNode {
  if (isBrowserRuntime()) {
    return (
      <BrowserToolResultDisclosure title="Plan mode declined" state="done">
        <div className="oc-agentProgressLine">The request stayed in the current permission mode.</div>
      </BrowserToolResultDisclosure>
    );
  }
  return <Box flexDirection="row" marginTop={1}>
      <Text color={getModeColor('default')}>{BLACK_CIRCLE}</Text>
      <Text> User declined to enter plan mode</Text>
    </Box>;
}
