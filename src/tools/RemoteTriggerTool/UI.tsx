import React from 'react';
import { BrowserToolResultDisclosure } from '../../components/messages/UserToolResultMessage/BrowserToolResultDisclosure.js';
import { MessageResponse } from '../../components/MessageResponse.js';
import { Text } from '../../ink.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
import { countCharInString } from '../../utils/stringUtils.js';
import type { Input, Output } from './RemoteTriggerTool.js';
export function renderToolUseMessage(input: Partial<Input>): React.ReactNode {
  return `${input.action ?? ''}${input.trigger_id ? ` ${input.trigger_id}` : ''}`;
}
export function renderToolResultMessage(output: Output): React.ReactNode {
  const lines = countCharInString(output.json, '\n') + 1;
  if (isBrowserRuntime()) {
    return (
      <BrowserToolResultDisclosure title="Remote trigger completed" detail={`HTTP ${output.status} · ${lines} lines`} state="done">
        <pre className="oc-toolCodeBlock">{output.json}</pre>
      </BrowserToolResultDisclosure>
    );
  }
  return <MessageResponse>
      <Text>
        HTTP {output.status} <Text dimColor>({lines} lines)</Text>
      </Text>
    </MessageResponse>;
}
