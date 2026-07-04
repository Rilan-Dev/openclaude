import React from 'react';
import { logEvent } from 'src/services/analytics/index.js';
import { Box, Link, Text } from '../ink.js';
import { isBrowserRuntime } from '../utils/runtime.js';
import { updateSettingsForSource } from '../utils/settings/settings.js';
import { Select } from './CustomSelect/index.js';
import { Dialog } from './design-system/Dialog.js';

// NOTE: This copy is legally reviewed — do not modify without Legal team approval.
export const AUTO_MODE_DESCRIPTION = "Auto mode lets Claude handle permission prompts automatically — Claude checks each tool call for risky actions and prompt injection before executing. Actions Claude identifies as safe are executed, while actions Claude identifies as risky are blocked and Claude may try a different approach. Ideal for long-running tasks. Sessions are slightly more expensive. Claude can make mistakes that allow harmful commands to run, it's recommended to only use in isolated environments. Shift+Tab to change mode.";
type Props = {
  onAccept(): void;
  onDecline(): void;
  // Startup gate: decline exits the process, so relabel accordingly.
  declineExits?: boolean;
};
export function AutoModeOptInDialog(t0: Props) {
  const {
    onAccept,
    onDecline,
    declineExits
  } = t0;
  const t6 = declineExits ? "No, exit" : "No, go back";
  React.useEffect(_temp, []);
  const onChange = React.useCallback((value: 'accept' | 'accept-default' | 'decline') => {
    switch (value) {
      case 'accept':
        logEvent('tengu_auto_mode_opt_in_dialog_accept', {});
        updateSettingsForSource('userSettings', {
          skipAutoPermissionPrompt: true,
        });
        onAccept();
        return;
      case 'accept-default':
        logEvent('tengu_auto_mode_opt_in_dialog_accept_default', {});
        updateSettingsForSource('userSettings', {
          skipAutoPermissionPrompt: true,
          permissions: {
            defaultMode: 'auto',
          },
        });
        onAccept();
        return;
      case 'decline':
        logEvent('tengu_auto_mode_opt_in_dialog_decline', {});
        onDecline();
    }
  }, [onAccept, onDecline]);

  const options = [
    {
      label: 'Yes, and make it my default mode',
      value: 'accept-default' as const,
    },
    {
      label: 'Yes, enable auto mode',
      value: 'accept' as const,
    },
    {
      label: t6,
      value: 'decline' as const,
    },
  ];

  if (isBrowserRuntime()) {
    return (
      <div className="repl-webPermissionCard repl-webPermissionCard--mode" role="dialog" aria-modal="true" aria-label="Enable auto mode">
        <div className="repl-webPermissionHalo" />
        <div className="repl-webPermissionHeader">
          <div>
            <div className="repl-webPermissionKicker">Session automation</div>
            <h2>Enable auto mode?</h2>
          </div>
          <span className="repl-webPermissionBadge">Review</span>
        </div>
        <div className="repl-webPermissionBody">
          <div className="repl-webPermissionContent">
            <p>{AUTO_MODE_DESCRIPTION}</p>
            <a href="https://code.claude.com/docs/en/security" target="_blank" rel="noreferrer">
              Security guide
            </a>
          </div>
          <div className="repl-webPermissionActions">
            <button type="button" className="repl-webPermissionAction" data-primary="true" onClick={() => onChange('accept-default')}>
              <span>Make default</span>
              <small>Enable auto mode for future sessions.</small>
            </button>
            <button type="button" className="repl-webPermissionAction" onClick={() => onChange('accept')}>
              <span>Enable once</span>
              <small>Use auto mode for this session.</small>
            </button>
            <button type="button" className="repl-webPermissionAction" data-danger={declineExits ? 'true' : undefined} onClick={() => onChange('decline')}>
              <span>{t6}</span>
              <small>{declineExits ? 'Exit this startup flow.' : 'Return without enabling auto mode.'}</small>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Dialog title="Enable auto mode?" color="warning" onCancel={onDecline}>
    <Box flexDirection="column" gap={1}>
      <Text>{AUTO_MODE_DESCRIPTION}</Text>
      <Link url="https://code.claude.com/docs/en/security" />
    </Box>
    <Select options={options} onChange={value => onChange(value as 'accept' | 'accept-default' | 'decline')} onCancel={onDecline} />
  </Dialog>;
}
function _temp() {
  logEvent("tengu_auto_mode_opt_in_dialog_shown", {});
}
