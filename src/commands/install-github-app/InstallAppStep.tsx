import React from 'react';
import { GITHUB_ACTION_SETUP_DOCS_URL } from '../../constants/github-app.js';
import { Box, Text } from '../../ink.js';
import { useKeybinding } from '../../keybindings/useKeybinding.js';
import { isBrowserRuntime } from '../../utils/runtime.js';

interface InstallAppStepProps {
  repoUrl: string;
  onSubmit: () => void;
}

export function InstallAppStep({ repoUrl, onSubmit }: InstallAppStepProps): React.ReactNode {
  useKeybinding('confirm:yes', onSubmit, {
    context: 'Confirmation',
  });

  if (isBrowserRuntime()) {
    return (
      <section className="repl-webPicker repl-githubAppSurface">
        <div className="repl-webPickerHeader">
          <span className="repl-webPickerKicker">GitHub App</span>
          <h2>Install the Claude GitHub App</h2>
          <p>Install the app for the selected repository, then continue setup here.</p>
        </div>
        <div className="repl-pluginMetaGrid">
          <span>Repository <strong>{repoUrl}</strong></span>
          <span>App URL <strong>github.com/apps/claude</strong></span>
        </div>
        <div className="repl-webPickerNotice">Grant access to this specific repository before continuing.</div>
        <div className="repl-webPickerFooter">
          <button type="button" className="repl-webPickerGhostButton" onClick={onSubmit}>I installed the app</button>
          <a className="repl-githubAppLink" href="https://github.com/apps/claude" target="_blank" rel="noreferrer">Open GitHub App</a>
          <a className="repl-githubAppLink" href={GITHUB_ACTION_SETUP_DOCS_URL} target="_blank" rel="noreferrer">Manual setup</a>
        </div>
      </section>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Install the Claude GitHub App</Text>
      </Box>
      <Box marginBottom={1}>
        <Text>Opening browser to install the Claude GitHub App…</Text>
      </Box>
      <Box marginBottom={1}>
        <Text>If your browser doesn't open automatically, visit:</Text>
      </Box>
      <Box marginBottom={1}>
        <Text underline>https://github.com/apps/claude</Text>
      </Box>
      <Box marginBottom={1}>
        <Text>Please install the app for repository: <Text bold>{repoUrl}</Text></Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>Important: Make sure to grant access to this specific repository</Text>
      </Box>
      <Box>
        <Text bold color="permission">Press Enter once you've installed the app…</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Having trouble? See manual setup instructions at: <Text color="claude">{GITHUB_ACTION_SETUP_DOCS_URL}</Text></Text>
      </Box>
    </Box>
  );
}
