import React from 'react';
import { GITHUB_ACTION_SETUP_DOCS_URL } from '../../constants/github-app.js';
import { Box, Text } from '../../ink.js';
import { useKeybinding } from '../../keybindings/useKeybinding.js';
import { isBrowserRuntime } from '../../utils/runtime.js';
import type { Warning } from './types.js';

interface WarningsStepProps {
  warnings: Warning[];
  onContinue: () => void;
}

export function WarningsStep({ warnings, onContinue }: WarningsStepProps): React.ReactNode {
  useKeybinding('confirm:yes', onContinue, {
    context: 'Confirmation',
  });

  if (isBrowserRuntime()) {
    return (
      <section className="repl-webPicker repl-githubAppSurface">
        <div className="repl-webPickerHeader">
          <span className="repl-webPickerKicker">Setup warnings</span>
          <h2>Review before continuing</h2>
          <p>OpenClaude found possible setup issues. You can continue, or use manual setup if needed.</p>
        </div>
        <div className="repl-webPickerList">
          {warnings.map((warning, index) => (
            <div key={index} className="repl-webPickerOption repl-githubWarning">
              <span className="repl-webPickerOptionMark">WARN</span>
              <span className="repl-webPickerOptionCopy">
                <span className="repl-webPickerOptionTitle">{warning.title}</span>
                <span className="repl-webPickerOptionDescription">{warning.message}</span>
                {warning.instructions.length > 0 ? (
                  <span className="repl-pluginMetaLine">
                    {warning.instructions.map((instruction, instructionIndex) => <span key={instructionIndex}>{instruction}</span>)}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
        <div className="repl-webPickerFooter">
          <button type="button" className="repl-webPickerGhostButton" onClick={onContinue}>Continue anyway</button>
          <a className="repl-githubAppLink" href={GITHUB_ACTION_SETUP_DOCS_URL} target="_blank" rel="noreferrer">Manual setup</a>
        </div>
      </section>
    );
  }

  return (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Box flexDirection="column" marginBottom={1}>
        <Text bold>Setup Warnings</Text>
        <Text dimColor>We found some potential issues, but you can continue anyway</Text>
      </Box>
      {warnings.map((warning, index) => (
        <Box key={index} flexDirection="column" marginBottom={1}>
          <Text color="warning" bold>{warning.title}</Text>
          <Text>{warning.message}</Text>
          {warning.instructions.length > 0 ? (
            <Box flexDirection="column" marginLeft={2} marginTop={1}>
              {warning.instructions.map((instruction, instructionIndex) => <Text key={instructionIndex} dimColor>• {instruction}</Text>)}
            </Box>
          ) : null}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text bold color="permission">Press Enter to continue anyway, or Ctrl+C to exit and fix issues</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>You can also try the manual setup steps if needed: <Text color="claude">{GITHUB_ACTION_SETUP_DOCS_URL}</Text></Text>
      </Box>
    </Box>
  );
}
