import React from 'react';
import { BrowserToolResultDisclosure } from '../../components/messages/UserToolResultMessage/BrowserToolResultDisclosure.js';
import { MessageResponse } from '../../components/MessageResponse.js';
import { Text } from '../../ink.js';
import { truncate } from '../../utils/format.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
import type { CreateOutput } from './CronCreateTool.js';
import type { DeleteOutput } from './CronDeleteTool.js';
import type { ListOutput } from './CronListTool.js';

// --- CronCreate -------------------------------------------------------------

export function renderCreateToolUseMessage(input: Partial<{
  cron: string;
  prompt: string;
}>): React.ReactNode {
  return `${input.cron ?? ''}${input.prompt ? `: ${truncate(input.prompt, 60, true)}` : ''}`;
}
export function renderCreateResultMessage(output: CreateOutput): React.ReactNode {
  if (isBrowserRuntime()) {
    return (
      <BrowserToolResultDisclosure title="Scheduled job" detail={output.humanSchedule} state="done">
        <div className="oc-toolResultEmpty">{output.id}</div>
      </BrowserToolResultDisclosure>
    );
  }
  return <MessageResponse>
      <Text>
        Scheduled <Text bold>{output.id}</Text>{' '}
        <Text dimColor>({output.humanSchedule})</Text>
      </Text>
    </MessageResponse>;
}

// --- CronDelete -------------------------------------------------------------

export function renderDeleteToolUseMessage(input: Partial<{
  id: string;
}>): React.ReactNode {
  return input.id ?? '';
}
export function renderDeleteResultMessage(output: DeleteOutput): React.ReactNode {
  if (isBrowserRuntime()) {
    return (
      <BrowserToolResultDisclosure title="Cancelled scheduled job" detail={output.id} state="done">
        <div className="oc-toolResultEmpty">This job will no longer run.</div>
      </BrowserToolResultDisclosure>
    );
  }
  return <MessageResponse>
      <Text>
        Cancelled <Text bold>{output.id}</Text>
      </Text>
    </MessageResponse>;
}

// --- CronList ---------------------------------------------------------------

export function renderListToolUseMessage(): React.ReactNode {
  return '';
}
export function renderListResultMessage(output: ListOutput): React.ReactNode {
  if (output.jobs.length === 0) {
    if (isBrowserRuntime()) {
      return (
        <BrowserToolResultDisclosure title="Scheduled jobs" detail="No jobs" state="done">
          <div className="oc-toolResultEmpty">No scheduled jobs are configured.</div>
        </BrowserToolResultDisclosure>
      );
    }
    return <MessageResponse>
        <Text dimColor>No scheduled jobs</Text>
      </MessageResponse>;
  }
  if (isBrowserRuntime()) {
    return (
      <BrowserToolResultDisclosure title="Scheduled jobs" detail={`${output.jobs.length} configured`} state="done">
        <div className="oc-toolResultStack">
          {output.jobs.map(job => (
            <div className="oc-toolResultRow" key={job.id}>
              <strong>{job.id}</strong>
              <span>{job.humanSchedule}</span>
            </div>
          ))}
        </div>
      </BrowserToolResultDisclosure>
    );
  }
  return <MessageResponse>
      {output.jobs.map(j => <Text key={j.id}>
          <Text bold>{j.id}</Text> <Text dimColor>{j.humanSchedule}</Text>
        </Text>)}
    </MessageResponse>;
}

// --- Shared -----------------------------------------------------------------
