import type { Plugin } from 'vite'

const SOURCE_FILE_RE = /\.[cm]?[jt]sx?(?:$|\?)/

// Only transform literal relative requires:
// require('./x.js')
// require('../x.js')
// require('./x?raw')
const REQUIRE_RE =
  /\brequire\s*\(\s*(['"])(\.{1,2}\/(?:[^'"\\]|\\.)+)\1\s*\)/g

function escapeForTemplateLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
}

export function browserRequireToStaticImport(): Plugin {
  return {
    name: 'openclaude-browser-require-to-static-import',
    enforce: 'pre',

    transform(code, id) {
      if (
        id.includes('/node_modules/') ||
        !SOURCE_FILE_RE.test(id) ||
        !code.includes('require(')
      ) {
        return null
      }

      const imports: string[] = []
      const declarations: string[] = []
      const replacements: Array<{
        start: number
        end: number
        text: string
      }> = []

      const seen = new Map<string, string>()
      let index = 0

      REQUIRE_RE.lastIndex = 0

      for (
        let match = REQUIRE_RE.exec(code);
        match;
        match = REQUIRE_RE.exec(code)
      ) {
        const specifier = match[2]

        let localName = seen.get(specifier)

        if (!localName) {
          localName = `__browserRequire_${index++}`
          seen.set(specifier, localName)

          if (specifier.includes('?raw')) {
            const rawName = `${localName}_raw`

            imports.push(
              `import ${rawName} from ${JSON.stringify(specifier)};`,
            )

            declarations.push(`
const ${localName} = Object.assign(new String(${rawName}), {
  default: ${rawName},
  __esModule: true,
  toString: () => ${rawName},
  trim: () => ${rawName}.trim(),
  trimEnd: () => ${rawName}.trimEnd(),
  trimStart: () => ${rawName}.trimStart(),
});
`)
          } else {
            imports.push(
              `import * as ${localName} from ${JSON.stringify(specifier)};`,
            )
          }
        }

        replacements.push({
          start: match.index,
          end: match.index + match[0].length,
          text: localName,
        })
      }

      if (replacements.length === 0) {
        return null
      }

      let output = code

      for (const replacement of replacements.reverse()) {
        output =
          output.slice(0, replacement.start) +
          replacement.text +
          output.slice(replacement.end)
      }

      // ESM evaluates imported modules in the textual order their import
      // statements appear. The original `require('./x')` calls were written as
      // lazy/deferred precisely to avoid evaluating their targets during the
      // host module's own init (breaking circular-import cycles). If we hoist
      // the generated imports ABOVE the file's existing imports, those targets
      // evaluate first and the cycle returns (e.g. forkSubagent -> coordinator
      // -> constants/tools -> ToolSearch prompt re-export => TDZ on
      // TOOL_SEARCH_TOOL_NAME). Emitting the generated imports AFTER the
      // original code keeps the file's own imports evaluating first, preserving
      // the original ordering as closely as static imports allow.
      //
      // `declarations` (the `?raw` wrappers) are body statements that read the
      // imported bindings; imports always finish evaluating before any body
      // runs, so the bindings are populated by the time the declarations
      // execute. They go before `output` so the local names exist before use.
      return {
        code: [
          declarations.join('\n'),
          output,
          imports.join('\n'),
        ]
          .filter(Boolean)
          .join('\n\n'),
        map: null,
      }
    },
  }
}