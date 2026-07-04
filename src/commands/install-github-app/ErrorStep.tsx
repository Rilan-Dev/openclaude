import React from 'react';
import { GITHUB_ACTION_SETUP_DOCS_URL } from '../../constants/github-app.js';
import { Box, Text } from '../../ink.js';
import { isBrowserRuntime } from '../../utils/runtime.js';

interface ErrorStepProps {
  error: string | undefined;
  errorReason?: string;
  errorInstructions?: string[];
}

export function ErrorStep({ error, errorReason, errorInstructions }: ErrorStepProps): React.ReactNode {
  if (isBrowserRuntime()) {
    return (
      <section className="repl-webPicker repl-githubAppSurface">
        <div className="repl-webPickerHeader">
          <span className="repl-webPickerKicker">GitHub App</span>
          <h2>Setup failed</h2>
          <p>{error || 'The GitHub App setup could not complete.'}</p>
        </div>
        {errorReason ? <div className="repl-webPickerNotice repl-pluginError">{errorReason}</div> : null}
        {errorInstructions && errorInstructions.length > 0 ? (
          <div className="repl-pluginCompactList">
            {errorInstructions.map((instruction, index) => <span key={index}>{instruction}</span>)}
          </div>
        ) : null}
        <div className="repl-webPickerFooter">
          <a className="repl-githubAppLink" href={GITHUB_ACTION_SETUP_DOCS_URL} target="_blank" rel="noreferrer">Manual setup instructions</a>
        </div>
      </section>
    );
  }

  return (
    <>
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Install GitHub App</Text>
        </Box>
        <Text color="error">Error: {error}</Text>
        {errorReason ? (
          <Box marginTop={1}>
            <Text dimColor>Reason: {errorReason}</Text>
          </Box>
        ) : null}
        {errorInstructions && errorInstructions.length > 0 ? (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>How to fix:</Text>
            {errorInstructions.map((instruction, index) => (
              <Box key={index} marginLeft={2}>
                <Text dimColor>• </Text>
                <Text>{instruction}</Text>
              </Box>
            ))}
          </Box>
        ) : null}
        <Box marginTop={1}>
          <Text dimColor>For manual setup instructions, see: <Text color="claude">{GITHUB_ACTION_SETUP_DOCS_URL}</Text></Text>
        </Box>
      </Box>
      <Box marginLeft={3}>
        <Text dimColor>Press any key to exit</Text>
      </Box>
    </>
  );
}
