# oh-my-pi Developer Guide

A step-by-step guide for developers who want to contribute to or customize oh-my-pi. This guide assumes you have programming experience (C, C++, Java, Python, etc.) but may be new to TypeScript, Bun, Rust N-API, or full-stack web development.

## Table of Contents

1. [Understanding the Technology Stack](#understanding-the-technology-stack)
2. [Setting Up Your Development Environment](#setting-up-your-development-environment)
3. [Project Structure Overview](#project-structure-overview)
4. [Package Architecture](#package-architecture)
5. [Building the Project](#building-the-project)
6. [Running in Development Mode](#running-in-development-mode)
7. [Testing](#testing)
8. [Code Style and Conventions](#code-style-and-conventions)
9. [Adding a New Tool](#adding-a-new-tool)
10. [Adding a New Slash Command](#adding-a-new-slash-command)
11. [Adding an Extension Source](#adding-an-extension-source)
12. [The Agent Session Architecture](#the-agent-session-architecture)
13. [TUI (Terminal User Interface) System](#tui-terminal-user-interface-system)
14. [The Rust Native Addon](#the-rust-native-addon)
15. [CI/CD Pipeline](#cicd-pipeline)
16. [Releasing](#releasing)
17. [Troubleshooting Common Issues](#troubleshooting-common-issues)
18. [Glossary](#glossary)

---

## Understanding the Technology Stack

If you are coming from C/C++/Java, here is a mapping of concepts you already know to the technologies used in this project.

### TypeScript (instead of Java/C#)

TypeScript is a typed superset of JavaScript. Think of it as "JavaScript with types." If you know Java:

| Java Concept | TypeScript Equivalent |
|---|---|
| `public class Foo {}` | `class Foo {}` (no access modifiers - see note below) |
| `interface Bar {}` | `interface Bar {}` (same concept) |
| `List<String>` | `string[]` or `Array<string>` |
| `Map<String, Integer>` | `Map<string, number>` or `Record<string, number>` |
| `@Override` | No equivalent needed (duck typing) |
| `null` | `null` and `undefined` (two kinds of "nothing") |
| `final` | `const` for variables, `readonly` for properties |
| `package` / `import` | `import { Foo } from "./foo"` (file-based modules) |
| `.jar` files | npm packages (installed to `node_modules/`) |
| Maven/Gradle | `package.json` + `bun install` |

**Important project convention:** This project uses ES `#` private fields instead of the `private` keyword. So instead of:
```typescript
class Foo {
   private bar: string; // DON'T DO THIS in this project
}
```
You write:
```typescript
class Foo {
   #bar: string; // DO THIS - ES private field
}
```
The exception is constructor parameter properties: `constructor(private readonly x: T)` is allowed.

### Bun (instead of Node.js)

Bun is a JavaScript/TypeScript runtime, like Node.js but faster. Think of it as the "JVM" for TypeScript. Key differences from Node.js:

| What | Node.js | Bun |
|---|---|---|
| Runtime | `node script.js` | `bun script.ts` (runs TS directly!) |
| Package manager | `npm install` | `bun install` (much faster) |
| Test runner | Jest/Vitest | `bun test` (built-in) |
| File I/O | `fs.readFileSync()` | `Bun.file("path").text()` |
| Write files | `fs.writeFileSync()` | `Bun.write("path", content)` |
| Run commands | `child_process.exec()` | Bun Shell `$\`command\`` |
| Sleep | `setTimeout` wrapper | `Bun.sleep(ms)` |
| JSON5 | Needs library | `Bun.JSON5.parse()` |

**In this project, always prefer Bun APIs over Node.js APIs.**

### Rust N-API (the "native addon")

N-API is a bridge between Rust (or C/C++) and JavaScript. Think of it like JNI (Java Native Interface) but for JavaScript. The project compiles ~7,500 lines of Rust into a `.node` binary file that JavaScript can `require()`.

Why Rust? For performance-critical operations:
- **grep** - Regex search over files (uses ripgrep internals)
- **shell** - Embedded bash execution (uses brush-shell)
- **text** - ANSI-aware text processing (width calculation, truncation, wrapping)
- **keys** - Keyboard input parsing (Kitty protocol)
- **highlight** - Syntax highlighting (uses syntect)
- **glob** - File discovery with `.gitignore` support

You do NOT need Rust installed to work on TypeScript code. The native addon is pre-built for common platforms. You only need Rust if you modify files in `crates/`.

### Monorepo Structure

A monorepo is a single repository containing multiple packages (like a multi-module Maven project). This project uses Bun workspaces:

```
oh-my-pi/
  package.json          <-- Root: defines workspaces
  packages/
    utils/              <-- @oh-my-pi/pi-utils
    natives/            <-- @oh-my-pi/pi-natives
    tui/                <-- @oh-my-pi/pi-tui
    ai/                 <-- @oh-my-pi/pi-ai
    agent/              <-- @oh-my-pi/pi-agent-core
    coding-agent/       <-- @oh-my-pi/pi-coding-agent (MAIN)
    stats/              <-- @oh-my-pi/omp-stats
  crates/
    pi-natives/         <-- Rust N-API addon
    brush-core-vendored/      <-- Vendored bash engine
    brush-builtins-vendored/  <-- Vendored bash builtins
```

Packages reference each other using `"workspace:*"` in their `package.json` files.

---

## Setting Up Your Development Environment

### Step 1: Install Bun

Bun is required (version >= 1.3.7).

**macOS / Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows:**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify installation:
```bash
bun --version
# Should print 1.3.7 or higher
```

### Step 2: Install Rust (only if modifying native code)

If you plan to modify the Rust code in `crates/`, install the Rust toolchain:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

The project uses the **nightly** toolchain (specified in `rust-toolchain.toml`). Rustup will automatically use it.

Verify:
```bash
rustc --version
# Should show "nightly" in the version
cargo --version
```

### Step 3: Clone the Repository

```bash
git clone https://github.com/can1357/oh-my-pi.git
cd oh-my-pi
```

### Step 4: Install Dependencies

```bash
bun install
```

This installs all JavaScript/TypeScript dependencies for all packages in the monorepo. Dependencies are stored in `node_modules/` (similar to Maven's `.m2` cache but local to the project).

### Step 5: Build the Native Addon

```bash
bun --cwd=packages/natives run build:native
```

This compiles the Rust code into a platform-specific `.node` file (e.g., `pi-natives.linux-x64.node`). This step takes 2-5 minutes on first build.

For faster debug builds during development:
```bash
bun --cwd=packages/natives run dev:native
```

### Step 6: Verify Everything Works

```bash
# Run the full check (TypeScript + Rust)
bun check

# Run tests
bun run test
```

If both pass, your environment is ready.

### Step 7: Set Up an API Key

To actually run the coding agent, you need an API key from at least one LLM provider:

```bash
# Pick one:
export ANTHROPIC_API_KEY="your-key-here"   # Anthropic Claude (recommended)
export OPENAI_API_KEY="your-key-here"      # OpenAI
export GOOGLE_API_KEY="your-key-here"      # Google Gemini
```

Add this to your shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.profile`) so it persists.

Alternatively, you can place API keys in a `.env` file. omp loads `.env` files automatically from `~/.omp/agent/.env` (user-level), `.omp/.env` (project-level), `cwd/.env`, and `~/.env`, in that priority order. For example:

```bash
mkdir -p ~/.omp/agent
echo 'ANTHROPIC_API_KEY=your-key-here' > ~/.omp/agent/.env
```

---

## Project Structure Overview

### Root Files

| File | Purpose |
|---|---|
| `package.json` | Root monorepo config, workspace definitions, shared scripts |
| `Cargo.toml` | Rust workspace config |
| `biome.json` | TypeScript linter/formatter config (like ESLint + Prettier combined) |
| `tsconfig.base.json` | Shared TypeScript compiler settings |
| `tsconfig.json` | Root TypeScript project references |
| `rust-toolchain.toml` | Pins Rust to nightly channel |
| `rustfmt.toml` | Rust formatting rules |
| `bunfig.toml` | Bun configuration (loaders for .md and .py files as text) |
| `CLAUDE.md` | Guidance for AI assistants working on this codebase |
| `AGENTS.md` | Development rules and conventions |

### The packages/ Directory

Each package is an independent npm package with its own `package.json`:

```
packages/
  utils/          Shared utilities (logger, streams, temp files)
  natives/        N-API bindings (Rust -> JavaScript bridge)
  tui/            Terminal UI with differential rendering
  ai/             Multi-provider LLM client
  agent/          Agent runtime (tool calling, state management)
  coding-agent/   THE MAIN APPLICATION (most development happens here)
  stats/          Local observability dashboard
```

---

## Package Architecture

The packages have a strict dependency chain (no circular dependencies):

```
utils --> natives --> tui --> ai --> agent --> coding-agent
```

Reading left-to-right:
- `utils` depends on nothing (base utilities)
- `natives` depends on `utils`
- `tui` depends on `natives` + `utils`
- `ai` depends on `tui` + `natives` + `utils`
- `agent` depends on `ai` + `tui` + `natives` + `utils`
- `coding-agent` depends on everything above

### Package Details

#### @oh-my-pi/pi-utils
Foundation package with zero external package dependencies (only `winston` for logging).
- `logger` - File-based logging (logs to `~/.omp/logs/`)
- `streams` - Stream utilities
- `temp` - Temporary file management
- `isEnoent()` - Check if an error is "file not found"

#### @oh-my-pi/pi-natives
Rust N-API bridge. Provides JavaScript wrappers around Rust functions:
- `grep()` - High-performance regex search
- `shellExecute()` - Embedded bash execution
- `textWidth()` - ANSI-aware string width calculation
- `highlight()` - Syntax highlighting
- `globSearch()` - File discovery

#### @oh-my-pi/pi-tui
Terminal UI library:
- Differential rendering (only redraws changed parts of the screen)
- Components (editors, selectors, borders, markdown rendering)
- Input handling (keyboard events)
- ANSI escape sequence management

#### @oh-my-pi/pi-ai
Multi-provider LLM client supporting:
- Anthropic (Claude), OpenAI (GPT), Google (Gemini)
- AWS Bedrock, Azure OpenAI, Google Vertex AI
- Cursor, GitHub Copilot, Groq, Mistral, OpenRouter
- Streaming responses, tool calling, image input

#### @oh-my-pi/pi-agent-core
Agent runtime that manages:
- Tool definitions and execution
- Conversation state
- Message history
- Model interaction loop

#### @oh-my-pi/pi-coding-agent (PRIMARY FOCUS)
The main CLI application. This is where most development happens. See the "Agent Session Architecture" section below for deep details.

---

## Building the Project

### Common Build Commands

```bash
# Full check: TypeScript type checking + Biome linting + Rust checks
bun check

# TypeScript only (Biome lint + tsgo type check)
bun check:ts

# Rust only (cargo fmt --check + clippy)
bun check:rs

# Format code (auto-fix)
bun fmt          # All
bun fmt:ts       # TypeScript only
bun fmt:rs       # Rust only

# Lint (check without fixing)
bun lint         # All
bun lint:ts      # TypeScript only
bun lint:rs      # Rust only

# Auto-fix lint issues
bun fix          # All
bun fix:ts       # TypeScript only
bun fix:rs       # Rust only

# Build the Rust native addon
bun --cwd=packages/natives run build:native     # Release (optimized)
bun --cwd=packages/natives run dev:native       # Debug (faster build)
```

**IMPORTANT:** Never use `tsc` or `npx tsc` for type checking. Always use `bun check` which runs `tsgo` (a Go-based TypeScript type checker that is much faster).

---

## Running in Development Mode

```bash
# Run the coding agent from source
bun run dev

# Or run directly
bun packages/coding-agent/src/cli.ts

# With arguments
bun packages/coding-agent/src/cli.ts --help
bun packages/coding-agent/src/cli.ts -p "Hello"

# RPC mode (headless, for programmatic control)
bun packages/coding-agent/src/cli.ts --mode rpc --no-session
```

---

## Testing

### Prerequisites

Before running tests, install dependencies and build the Rust native addon:

```bash
# Install all JavaScript/TypeScript dependencies
bun install

# Build the Rust N-API native addon (required for coding-agent and swarm-extension tests)
bun --cwd=packages/natives run build:native
```

The native addon build requires a Rust nightly toolchain and takes several minutes on the first build. Without it, tests that import from `@oh-my-pi/pi-coding-agent` or `@oh-my-pi/pi-natives` will fail with `Failed to load pi_natives native addon`.

The `agent` package tests do **not** require the native addon and can run immediately after `bun install`.

### Running Tests

```bash
# Run ALL tests across all packages
bun run test

# Run tests for a specific package
bun --cwd=packages/agent test
bun --cwd=packages/coding-agent test

# Run a specific test file
bun test packages/coding-agent/test/executor-utils.test.ts

# Run multiple specific test files
bun test packages/swarm-extension/test/dag.test.ts packages/swarm-extension/test/schema.test.ts

# Run tests matching a pattern
bun test --testNamePattern="RPC"
```

Tests use `bun:test` (Bun's built-in test runner, similar to Jest). Test files are named `*.test.ts` and live in `test/` directories within each package.

### Test Inventory

#### packages/agent (pi-agent-core)

| Test file | Tests | Description |
|---|---|---|
| `agent.test.ts` | Core Agent class | Agent construction, prompting, message handling |
| `agent-loop.test.ts` | Agent loop basics | Basic loop execution, tool calling, stop conditions |
| `agent-loop-extended.test.ts` | Agent loop advanced | Follow-up queuing, tool concurrency (shared vs exclusive), steering interruption |
| `agent-loop-telemetry.test.ts` | TurnMetrics | Per-turn telemetry emission: LLM latency, tool times, context size, token usage |

Shared test utilities in `test/mock-stream.ts`: `MockAssistantStream`, `createMockStreamFn()`, `createAssistantMessage()`, `createToolCall()`.

#### packages/coding-agent (pi-coding-agent)

| Test file | Tests | Description |
|---|---|---|
| `executor-utils.test.ts` | 55 | Subagent executor pure utilities: model pattern normalization, output schema handling, tool arg previews, usage token extraction, report finding dedup, abort timeout |
| `ttsr.test.ts` | 22 | Time-Traveling Streamed Rules: pattern matching, rule injection, abort/retry |
| `streaming-edit-abort.test.ts` | 5 | Streaming edit abort: successful patches, failing patches, missing files, multi-line diffs |
| `compaction.test.ts` | 19+2 skip | Context compaction: token estimation, cut points, `shouldCompact`, session context building |
| `edit-diff.test.ts` | - | Edit/diff patch application |
| `args.test.ts` | - | CLI argument parsing |
| `rpc.test.ts` | - | RPC protocol commands and responses |
| `skills.test.ts` | - | Skill discovery and loading |
| `extensions-*.test.ts` | - | Extension discovery and event dispatch |
| `compaction-hooks*.test.ts` | - | Compaction hook integration |
| `model-registry.test.ts` | - | Model registry and resolution |
| `settings-manager.test.ts` | - | Settings loading and merging |

(See `packages/coding-agent/test/` for the full list of test files.)

#### packages/swarm-extension

| Test file | Tests | Description |
|---|---|---|
| `dag.test.ts` | - | DAG dependency graph: topological sort, cycle detection (Kahn's algorithm), execution wave computation |
| `schema.test.ts` | - | Swarm task and agent configuration schema validation |

For detailed documentation of each agent harness enhancement (mock streams, telemetry, MCP resilience, compaction metrics, etc.), see [ENHANCEMENTS.md](ENHANCEMENTS.md). For introspective deep dives into the agent harness internals and subagent orchestration code paths, see [`docs_by_omp/`](../docs_by_omp/).

### Known Platform Issues

- **Windows EBUSY errors**: The `streaming-edit-abort.test.ts` `afterEach` cleanup may report `EBUSY: resource busy or locked` on Windows because SQLite file handles linger after `session.dispose()`. Tests still pass; the errors are cleanup warnings only.

### Example Test Structure

```typescript
import { describe, it, expect } from "bun:test";

describe("myFunction", () => {
   it("should return correct result", () => {
      expect(myFunction(1, 2)).toBe(3);
   });

   it("should handle edge case", () => {
      expect(() => myFunction(null)).toThrow();
   });
});
```

---

## Code Style and Conventions

### Formatting Rules

The project uses **Biome** for TypeScript formatting (configured in `biome.json`):

| Setting | Value |
|---|---|
| Indentation | Tabs (not spaces) |
| Indent width | 3 |
| Line width | 120 characters |
| Line endings | LF (Unix-style) |
| Quotes | Double quotes `"` |
| Semicolons | Always required |
| Trailing commas | Always |

For Rust (configured in `rustfmt.toml`):

| Setting | Value |
|---|---|
| Indentation | Tabs |
| Tab spaces | 3 |
| Max width | 100 |
| Edition | 2024 |

### TypeScript Conventions

1. **No `private`/`protected`/`public` keywords** on class fields/methods. Use ES `#` private fields:
   ```typescript
   class MyClass {
      #internalState: string;  // Private
      publicField: number;     // Public (no keyword needed)
   }
   ```
   Exception: constructor parameter properties `constructor(private readonly x: T)` are allowed.

2. **Never use `ReturnType<>`** - Look up the actual type name instead.

3. **Never use inline imports**:
   ```typescript
   // BAD
   const mod = await import("./module");
   type Foo = import("./types").Foo;

   // GOOD
   import { Foo } from "./types";
   import { something } from "./module";
   ```

4. **Prompts live in `.md` files**, not in code strings:
   ```typescript
   // BAD
   const prompt = "You are a helpful assistant...";

   // GOOD
   import prompt from "./prompts/my-prompt.md" with { type: "text" };
   ```
   Use Handlebars syntax (`{{variable}}`) for dynamic content in prompts.

5. **No `any` types** unless absolutely necessary.

6. **Use `Promise.withResolvers()`** instead of the traditional Promise constructor:
   ```typescript
   // Traditional (avoid)
   const promise = new Promise((resolve, reject) => { ... });

   // Preferred
   const { promise, resolve, reject } = Promise.withResolvers();
   ```

7. **Namespace imports for Node builtins**:
   ```typescript
   // BAD
   import { readFile } from "node:fs/promises";

   // GOOD
   import * as fs from "node:fs/promises";
   import * as path from "node:path";
   ```

### Bun-First Patterns

Always prefer Bun APIs over Node.js APIs:

```typescript
// File reading
const text = await Bun.file("path/to/file").text();
const json = await Bun.file("path/to/file").json();

// File writing (auto-creates parent directories)
await Bun.write("path/to/file", content);

// Running shell commands
import { $ } from "bun";
const result = await $`git status`.text();

// Sleep
await Bun.sleep(1000); // 1 second

// JSON5 parsing
const config = Bun.JSON5.parse(configText);

// Check if binary exists
const path = Bun.which("git");

// String width (ANSI-aware)
const width = Bun.stringWidth(text);
```

**Anti-pattern to avoid:**
```typescript
// DON'T check if file exists before reading
if (await fs.exists(path)) {
   const content = await Bun.file(path).text();
}

// DO use try-catch with isEnoent
import { isEnoent } from "@oh-my-pi/pi-utils";
try {
   const content = await Bun.file(path).text();
} catch (e) {
   if (isEnoent(e)) {
      // File doesn't exist
   } else {
      throw e;
   }
}
```

### Logging

**CRITICAL: Never use `console.log`, `console.error`, or `console.warn` in the coding-agent package.** These corrupt the TUI rendering.

Always use the `logger` from `@oh-my-pi/pi-utils`:

```typescript
import { logger } from "@oh-my-pi/pi-utils";

logger.info("Something happened");
logger.warn("Watch out");
logger.error("Something failed", { error });
logger.debug("Debug info");
```

Logs go to `~/.omp/logs/` with daily rotation.

### TUI Text Sanitization

All text displayed in the terminal must be sanitized:

```typescript
import { replaceTabs, truncateToWidth, shortenPath } from "@oh-my-pi/pi-tui";

// Replace tabs with spaces (tabs break alignment)
const clean = replaceTabs(rawText);

// Truncate to terminal width
const fitted = truncateToWidth(text, terminalWidth);

// Shorten file paths for display
const short = shortenPath("/very/long/path/to/file.ts");
```

---

## Adding a New Tool

Tools are functions that the LLM can call (like "read a file", "run a bash command", "search the web"). Here is how to add one:

### Step 1: Create the Tool Factory

Create a new file `packages/coding-agent/src/tools/my-tool.ts`:

```typescript
import type { ToolSession, AgentToolResult } from "@oh-my-pi/pi-agent-core";
import { toolResult } from "./tool-result";
import toolPrompt from "../prompts/tools/my-tool.md" with { type: "text" };
import { Type } from "@sinclair/typebox";

export interface MyToolDetails {
   // Details shown in TUI alongside the tool result
   filesProcessed?: number;
}

export function createMyTool(session: ToolSession) {
   return {
      name: "my_tool",
      description: toolPrompt,
      parameters: Type.Object({
         input: Type.String({ description: "What to process" }),
         verbose: Type.Optional(Type.Boolean({ description: "Show details" })),
      }),
      async execute(
         toolCallId: string,
         params: { input: string; verbose?: boolean },
         onUpdate?: (partial: AgentToolResult<MyToolDetails>) => void,
         signal?: AbortSignal,
      ): Promise<AgentToolResult<MyToolDetails>> {
         // Your tool logic here
         const result = await doSomething(params.input);

         return toolResult<MyToolDetails>({ filesProcessed: 5 })
            .text(result)
            .done();
      },
   };
}
```

### Step 2: Create the Prompt Template

Create `packages/coding-agent/src/prompts/tools/my-tool.md`:

```markdown
Describe what this tool does, when to use it, and what the parameters mean.

- `input`: The text to process
- `verbose`: If true, include additional details in the output
```

### Step 3: Register the Tool

Edit `packages/coding-agent/src/tools/index.ts`:

```typescript
import { createMyTool } from "./my-tool";

export const BUILTIN_TOOLS = new Map([
   // ... existing tools
   ["my_tool", createMyTool],
]);
```

### Step 4: Test

Run the agent and ask it to use your tool:
```bash
bun run dev
# Then type: "Use the my_tool to process 'hello world'"
```

---

## Adding a New Slash Command

Slash commands are user-typed commands like `/theme`, `/review`, `/clear`.

### UI-Only Commands

For commands that only affect the UI (no session logic needed):

Edit `packages/coding-agent/src/modes/interactive-mode.ts`, find `setupEditorSubmitHandler()`:

```typescript
case "/mycommand": {
   const args = text.slice("/mycommand".length).trim();
   // Do something with args
   this.showStatus(`Executed mycommand with: ${args}`);
   return;
}
```

### Commands Needing Session Logic

For commands that interact with the AI session:

1. Add a method to `AgentSession` in `session/agent-session.ts`
2. Call it from the slash command handler in `interactive-mode.ts`

---

## Adding an Extension Source

Extension sources discover configuration from different AI tools (Claude, Cursor, Windsurf, etc.).

### Step 1: Create Discovery Module

Create `packages/coding-agent/src/discovery/my-source.ts`:

```typescript
import type { DiscoveryResult } from "./index";

export async function discoverMySource(projectDir: string): Promise<DiscoveryResult[]> {
   // Look for configuration files
   // Return capability objects
}
```

### Step 2: Register in Discovery Chain

Edit `packages/coding-agent/src/discovery/index.ts` to add your source to the discovery chain.

---

## The Agent Session Architecture

`AgentSession` (in `session/agent-session.ts`) is the central abstraction of the entire application. All three run modes use it:

```
InteractiveMode  ──┐
PrintMode        ──┼──> AgentSession ──> SDK Agent ──> LLM Provider
RPC Mode         ──┘
```

AgentSession manages:
- **Session persistence** - Conversations saved as JSONL files
- **Model cycling** - Switch between models mid-session
- **Context compaction** - When conversations get too long, summarize older parts
- **Tool loading** - Built-in + custom + extension tools
- **Hook execution** - Pre/post hooks for tool calls
- **Bash execution** - Shell commands run through a persistent session
- **Extension integration** - Load and run extensions

### The Layered Architecture

```
CLI Layer:        cli.ts -> main.ts -> cli/args.ts
                       |
Mode Layer:       interactive-mode.ts | print-mode.ts | rpc/
                       |
Core Layer:       agent-session.ts, sdk.ts, session-manager.ts
                       |
Tool Layer:       tools/ (read, write, edit, bash, grep, etc.)
                       |
Extension Layer:  extensibility/ (hooks, extensions, custom-tools, skills)
                       |
Discovery Layer:  discovery/ (multi-source config from Claude, Cursor, Windsurf, etc.)
```

### Key Source Directories in coding-agent/src/

| Directory | What it Contains |
|---|---|
| `tools/` | Built-in tool implementations (read, write, edit, bash, grep, etc.) |
| `prompts/` | All prompt templates as `.md` files |
| `session/` | Session persistence (JSONL), auth storage (SQLite) |
| `modes/` | Run modes (interactive TUI, print, RPC) and TUI components |
| `extensibility/` | Hooks, extensions, custom tools, skills, slash commands |
| `capability/` | Capability type registry and discovery orchestration |
| `discovery/` | Config discovery from 8 AI coding tools |
| `web/` | Web scrapers (80+ sites) and search providers |
| `lsp/` | Language Server Protocol integration (40+ languages) |
| `ipy/` | Python/IPython kernel integration |
| `mcp/` | Model Context Protocol server management |
| `task/` | Subagent spawning and parallel execution |

---

## TUI (Terminal User Interface) System

The TUI uses differential rendering - it only redraws parts of the screen that changed. This is managed by the `@oh-my-pi/pi-tui` package.

### Key Concepts

- **Components** - UI elements (editor, message display, footer, selectors)
- **Differential rendering** - Compare old and new screen buffers, only send changes
- **ANSI escape sequences** - Control codes that tell the terminal how to display text (colors, cursor position, etc.)

### Important TUI Rules

1. Always sanitize text before display (see TUI Text Sanitization above)
2. Never use `console.log` (corrupts the screen)
3. Components should override `invalidate()` to rebuild on theme changes
4. Keep InteractiveMode focused on UI; delegate business logic to AgentSession

---

## The Rust Native Addon

The Rust code lives in `crates/pi-natives/` and compiles to a `.node` file.

### Architecture

```
crates/pi-natives/
  src/
    lib.rs          <-- Entry point, exports N-API functions
    grep.rs         <-- Regex search (~1,300 lines)
    shell.rs        <-- Embedded bash (~1,025 lines)
    text.rs         <-- Text processing (~1,280 lines)
    keys.rs         <-- Keyboard parsing (~1,300 lines)
    highlight.rs    <-- Syntax highlighting (~475 lines)
    glob.rs         <-- File discovery (~340 lines)
    task.rs         <-- Work scheduler (~350 lines)
    ps.rs           <-- Process management (~290 lines)
    prof.rs         <-- Profiler (~250 lines)
    system_info.rs  <-- System info (~170 lines)
    image.rs        <-- Image processing (~150 lines)
    clipboard.rs    <-- Clipboard (~95 lines)
    html.rs         <-- HTML to Markdown (~50 lines)
```

### Building

```bash
# Release build (optimized, slower to compile)
bun --cwd=packages/natives run build:native

# Debug build (faster to compile, slower to run)
bun --cwd=packages/natives run dev:native
```

### Rust Formatting Rules

- Nightly toolchain required
- Tabs for indentation, tab_spaces=3
- Max width 100 characters
- Edition 2024
- Strict clippy lints (deny correctness/suspicious, warn all categories)

### Adding a New Native Function

1. Add your Rust function in `crates/pi-natives/src/`
2. Export it via N-API in `lib.rs`
3. Add a TypeScript wrapper in `packages/natives/src/`
4. Build and test

---

## CI/CD Pipeline

The CI runs on GitHub Actions (`.github/workflows/ci.yml`) with these jobs:

1. **rust** - Checks Rust formatting (`cargo fmt --check`) and lints (`clippy`)
2. **native** - Builds the native addon for 5 platforms:
   - Linux x64, Linux ARM64
   - macOS x64, macOS ARM64
   - Windows x64
3. **test** - Installs deps, builds native, runs `bun check` and `bun test`
4. **release** - Triggered on git tags, publishes to npm

---

## Releasing

Releases are handled by `bun run release` which:

1. Bumps version numbers across all packages
2. Updates CHANGELOG.md files (moves `[Unreleased]` to version header)
3. Creates a git commit and tag
4. Publishes to npm

See `.claude/commands/release.md` for the detailed release process.

### Changelog Format

Each package has its own `packages/*/CHANGELOG.md`. New entries always go under `## [Unreleased]`:

```markdown
## [Unreleased]

### Added
- New feature description ([#123](https://github.com/can1357/oh-my-pi/issues/123))

### Changed
- Updated behavior description

### Fixed
- Bug fix description

### Removed
- Removed feature description
```

Never modify released version sections.

---

## Troubleshooting Common Issues

### "Cannot find module @oh-my-pi/pi-natives"
The native addon is not built. Run:
```bash
bun --cwd=packages/natives run build:native
```

### "bun: command not found"
Bun is not installed or not in your PATH. Re-install Bun and ensure `~/.bun/bin` is in your PATH:
```bash
export PATH="$HOME/.bun/bin:$PATH"
```

### Type check failures with tsc
Do NOT use `tsc`. Always use:
```bash
bun check
```

### Rust build failures
Ensure you have the nightly toolchain:
```bash
rustup update nightly
rustup default nightly
```

### Tests failing with "ENOENT"
Make sure you are running tests from the monorepo root, not from inside a package directory.

### TUI rendering corruption
If the terminal looks garbled after a crash, run:
```bash
reset
```
The agent has crash handlers to prevent this, but it can still happen occasionally.

### "API key not found"
Set your API key as an environment variable:
```bash
export ANTHROPIC_API_KEY="your-key-here"
```
Add it to your shell profile for persistence, or place it in `~/.omp/agent/.env`.

---

## Glossary

| Term | Definition |
|---|---|
| **Agent** | The AI coding assistant (the coding-agent package) |
| **AgentSession** | Central class managing conversation state, tools, and LLM interaction |
| **Biome** | TypeScript linter and formatter (replaces ESLint + Prettier) |
| **Bun** | JavaScript/TypeScript runtime (replaces Node.js) |
| **Capability** | A discoverable configuration item (tool, hook, rule, skill, etc.) |
| **Compaction** | Summarizing old conversation messages to save context space |
| **Extension** | A TypeScript module that hooks into the agent lifecycle |
| **Hook** | A TypeScript module that intercepts specific agent events |
| **JSONL** | JSON Lines format - one JSON object per line (used for sessions) |
| **LLM** | Large Language Model (Claude, GPT, Gemini, etc.) |
| **MCP** | Model Context Protocol - standard for connecting AI to external tools |
| **N-API** | Node API - bridge between native code (Rust/C++) and JavaScript |
| **omp** | Short for "oh-my-pi" - the CLI command name |
| **RPC** | Remote Procedure Call - headless mode for programmatic control |
| **Skill** | An on-demand capability package (SKILL.md + scripts) |
| **Slash command** | User-typed command starting with `/` (e.g., `/theme`, `/review`) |
| **TTSR** | Time Traveling Streamed Rules - rules that inject themselves when needed |
| **tsgo** | Go-based TypeScript type checker (faster than standard tsc) |
| **TUI** | Terminal User Interface - the visual interface in the terminal |
| **Workspace** | A monorepo concept where multiple packages share one repository |
