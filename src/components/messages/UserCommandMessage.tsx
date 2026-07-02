import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import figures from 'figures';
import * as React from 'react';
import { COMMAND_MESSAGE_TAG } from '../../constants/xml.js';
import { Box, Text } from '../../ink.js';
import { extractTag } from '../../utils/messages.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
type Props = {
  addMargin: boolean;
  param: TextBlockParam;
};
export function UserCommandMessage({
  addMargin,
  param: { text },
}: Props) {
  const commandMessage = React.useMemo(() => extractTag(text, COMMAND_MESSAGE_TAG), [text]);
  const args = React.useMemo(() => extractTag(text, 'command-args'), [text]);
  const isSkillFormat = React.useMemo(() => extractTag(text, 'skill-format') === 'true', [text]);

  if (!commandMessage) {
    return null;
  }

  if (isSkillFormat) {
    const content = `Skill(${commandMessage})`;

    if (isBrowserRuntime()) {
      return <div className="oc-userCommandBubble">{content}</div>;
    }

    return <Box flexDirection="column" marginTop={addMargin ? 1 : 0} backgroundColor="userMessageBackground" paddingRight={1}>
        <Text><Text color="subtle">{figures.pointer} </Text><Text color="text">{content}</Text></Text>
      </Box>;
  }

  const content = `/${[commandMessage, args].filter(Boolean).join(' ')}`;

  if (isBrowserRuntime()) {
    return <div className="oc-userCommandBubble">{content}</div>;
  }

  return <Box flexDirection="column" marginTop={addMargin ? 1 : 0} backgroundColor="userMessageBackground" paddingRight={1}>
      <Text><Text color="subtle">{figures.pointer} </Text><Text color="text">{content}</Text></Text>
    </Box>;
}
