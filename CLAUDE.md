# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

oh-my-pi is a fork of [badlogic/pi-mono](https://github.com/badlogic/pi-mono) — an AI coding agent for the terminal. It's a Bun + Rust monorepo with TypeScript packages and Rust N-API native addons. The primary focus is `packages/coding-agent/` (the CLI application). When the user says "agent" they mean the coding-agent package implementation, not the assistant.

## Commands

| Command | Description |
|---|---|
| `bun check` | Full check (TypeScript + Rust) |
| `bun check:ts` | Biome check + tsgo type checking |
| `bun check:rs` | cargo fmt --check + clippy |
| `bun lint` / `bun lint:ts` / `bun lint:rs` | Lint all / TS only / Rust only |
| `bun fmt` / `bun fmt:ts` / `bun fmt:rs` | Format all / TS only / Rust only |
| `bun fix` / `bun fix:ts` / `bun fix:rs` | Auto-fix all / TS only / Rust only |
| `bun run dev` | Run coding-agent from source |
| `bun --cwd=packages/natives run build:native` | Build Rust N-API addon |
| `bun --cwd=packages/natives run dev:native` | Build N-API addon in debug mode |
| `bun run test` | Run all package tests |
| `bun test test/specific.test.ts` | Run a single test file |
| `bun run release` | Release script (version bump, changelog, tag, publish) |

**Test prerequisites:** `bun install` for dependencies, then `bun --cwd=packages/natives run build:native` for the Rust addon (required by coding-agent and swarm-extension tests; agent package tests work without it).

**Do NOT** run `bun run dev`, `bun test`, or `bun run test` unless the user instructs. Do NOT use `tsc` or `npx tsc` — always use `bun check`. Do NOT commit unless the user asks.

## Package Architecture

```
packages/
  utils/          @oh-my-pi/pi-utils        Shared utilities (logger, streams, temp files)
  natives/        @oh-my-pi/pi-natives       N-API bindings (grep, shell, text, image, etc.)
  tui/            @oh-my-pi/pi-tui           Terminal UI with differential rendering
  ai/             @oh-my-pi/pi-ai            Multi-provider LLM client (Anthropic, OpenAI, Gemini, Bedrock, Cursor, Codex, Copilot)
  agent/          @oh-my-pi/pi-agent-core    Agent runtime with tool calling and state management
  coding-agent/   @oh-my-pi/pi-coding-agent  Main CLI application (PRIMARY FOCUS)
  stats/          @oh-my-pi/omp-stats        Local observability dashboard
  swarm-extension/ @oh-my-pi/swarm-extension Swarm orchestration extension
  react-edit-benchmark/ (private)            Edit benchmark suite for testing
crates/
  pi-natives/                Rust N-API addon (~8,200 lines: grep, shell, text, keys, highlight, glob, etc.)
  brush-core-vendored/       Vendored brush-shell for embedded bash
  brush-builtins-vendored/   Vendored bash builtins
```

**Dependency flow:** `utils` -> `natives` -> `tui` -> `ai` -> `agent` -> `coding-agent`

The Rust workspace (`Cargo.toml`) includes only `crates/pi-natives`; the vendored brush crates are patched via `[patch.crates-io]`.

## Coding Agent Internal Architecture

The coding-agent has a layered architecture:

```
CLI Layer:      cli.ts → main.ts → cli/args.ts
Mode Layer:     modes/interactive-mode.ts | modes/print-mode.ts | modes/rpc/
Core Layer:     session/agent-session.ts (central abstraction), sdk.ts, session/session-manager.ts
Tool Layer:     tools/ (read, write, edit, bash, grep, find, python, lsp, browser, ssh, etc.)
Extension Layer: extensibility/ (hooks, extensions, custom-tools, skills, slash-commands, plugins)
Discovery Layer: discovery/ (multi-source config from Claude, Cursor, Windsurf, Gemini, Codex, Cline, VS Code)
Capability Layer: capability/ (unified type system for all extensibility)
```

**AgentSession** (`session/agent-session.ts`) is the central abstraction. All three modes (interactive, print, RPC) use it. It wraps the SDK Agent with session persistence, model cycling, context compaction, bash execution, hook integration, and custom tool loading.

**Key directories in coding-agent/src:**
- `tools/` — Built-in tool implementations (each tool is a factory returning a tool definition)
- `prompts/` — All prompt templates as static `.md` files (system prompts, tool descriptions, agent prompts)
- `session/` — Session persistence (JSONL), auth storage (SQLite), compaction
- `modes/` — Run modes and TUI components/controllers/themes
- `extensibility/` — Hooks, extensions, custom tools, skills, slash commands, plugins
- `capability/` — Capability type registry and discovery orchestration
- `discovery/` — Multi-tool config discovery (8 AI coding tools supported)
- `web/` — Web scrapers (80+ sites) and search providers (Anthropic, Perplexity, Exa)
- `lsp/` — Language Server Protocol integration (40+ languages)
- `ipy/` — Python/IPython kernel integration
- `mcp/` — Model Context Protocol server management
- `task/` — Subagent spawning and parallel execution

## Code Conventions

### TypeScript

- **No `private`/`protected`/`public` keywords** on class fields/methods — use ES `#` private fields. Exception: constructor parameter properties (`constructor(private readonly x: T)`).
- **Never use `ReturnType<>`** — look up the actual type name instead.
- **Never use inline imports** — no `await import()`, no `import("pkg").Type`. Always top-level imports.
- **Never build prompts in code** — prompts live in static `.md` files, use Handlebars for dynamic content. Import via `import content from "./prompt.md" with { type: "text" }`.
- **No `any` types** unless absolutely necessary.
- Use `Promise.withResolvers()` instead of `new Promise((resolve, reject) => ...)`.
- **Namespace imports for node builtins**: `import * as fs from "node:fs/promises"`, `import * as path from "node:path"` — never named imports.

### Bun-First

- **File I/O**: `Bun.file().text()` / `Bun.write()` for files; `node:fs/promises` for directories.
- **Process execution**: Bun Shell `$` for simple commands; `Bun.spawn` only for long-running/streaming.
- **Sleep**: `Bun.sleep(ms)` not setTimeout wrappers.
- **JSON5/JSONL**: `Bun.JSON5.parse()`, `Bun.JSONL.parse()`.
- **String width**: `Bun.stringWidth()`, `Bun.wrapAnsi()`.
- **Binary lookup**: `Bun.which()`.
- **No `.exists()` before read** — use try-catch with `isEnoent` from `@oh-my-pi/pi-utils`.
- `Bun.write()` auto-creates parent dirs; don't add redundant `mkdir`.

### Logging

**Never use `console.log`/`console.error`/`console.warn`** in coding-agent — it corrupts TUI rendering. Use `logger` from `@oh-my-pi/pi-utils`. Logs go to `~/.omp/logs/`.

### TUI Rendering

All displayed text must be sanitized: `replaceTabs()` for tabs, `truncateToWidth()` for line length, `shortenPath()` for file paths. Apply to both happy paths and error messages.

### Formatting

- **Biome**: tabs, indent width 3, line width 120, LF line endings, double quotes, semicolons always, trailing commas
- **Rust**: nightly toolchain, tabs, tab_spaces=3, max_width=100, edition 2024

## Adding New Features

### Adding a New Tool
1. Create factory in `tools/` (e.g., `createMyTool(session: ToolSession)`)
2. Export from `tools/index.ts` and add to `BUILTIN_TOOLS` map
3. Add prompt template in `prompts/tools/my-tool.md`
4. Use `ToolResultBuilder` for results, `OutputMeta` for truncation metadata
5. For streaming: use `allocateOutputArtifact()` + `createTailBuffer()` + `onChunk` pattern

### Adding a New Slash Command
Add handler in `interactive-mode.ts` `setupEditorSubmitHandler()`. For commands needing session logic, add method to `AgentSession` first.

### Adding a New Extension Source
Create discovery module in `discovery/`, implement discovery functions, add to chain in `discovery/index.ts`.

## Config Directory Structure

```
~/.omp/agent/          User-level config
  agent.db             SQLite (settings, auth credentials)
  models.yml           Custom model providers
  sessions/            Session storage (JSONL files)
  themes/              Custom themes
  extensions/          User extensions
  hooks/pre|post/      User hooks
  tools/               Custom tools
  skills/              Skills (SKILL.md)
  commands/            Slash commands
  plugins/             Installed plugins

.omp/                  Project-level config
  SYSTEM.md            Project system prompt
  settings.json        Project settings
  extensions/          Project extensions
  hooks/               Project hooks
  agents/              Custom task agents
  mcp.json             MCP server config
  lsp.json             LSP server config
```

Config priority: `.omp` > `.pi` > `.claude` > `.codex` > `.gemini`

## Changelog

Each package has its own `packages/*/CHANGELOG.md`. New entries always go under `## [Unreleased]`. Never modify released version sections. Sections: `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Breaking Changes`.

Attribution: `Fixed foo bar ([#123](https://github.com/can1357/oh-my-pi/issues/123))` for internal changes; add `by [@user](url)` for external contributions.

## Releasing

Run `bun run release` — it handles version bumps, changelog finalization, commit, tag, publish. See `.claude/commands/release.md` for details.

## GitHub Issues

Always read all comments. Use standard labels (bug, enhancement, documentation). Close via commit with `fixes #<number>`. Use GitHub CLI for issues/PRs.

## Style

No emojis in commits, issues, PR comments, or code. Technical prose only — be kind but direct.

## Upstream Sync

This is a fork of pi-mono. Key divergences from upstream:
- Bun runtime instead of Node (no npm lockfiles, Bun APIs preferred)
- `bun:sqlite` for auth storage instead of `proper-lockfile` + JSON
- `StatusLineComponent` instead of upstream's `FooterDataProvider`
- Multi-credential auth with round-robin selection
- Native Bun `import()` for TypeScript loading (no `jiti`)
- Capability-based discovery system
- Tests use `bun:test` (not Vitest)

See `docs/porting-from-pi-mono.md` for the full merge guide and `docs/porting-to-natives.md` for N-API porting.

## Documentation

- `docs/QUICK_START.md` — Quick start with 14 use cases for new users
- `docs/USER_GUIDE.md` — Comprehensive user guide
- `docs/DEVELOPER_GUIDE.md` — Developer setup and architecture guide
- `packages/coding-agent/DEVELOPMENT.md` — Coding-agent internal architecture
- `packages/coding-agent/docs/` — Feature-specific docs (extensions, hooks, skills, models, sessions, etc.)
- `docs/ENHANCEMENTS.md` — Agent harness enhancement documentation (why/how/what for all 8 enhancements)
- `docs/porting-from-pi-mono.md` — Upstream merge guide
- `docs/porting-to-natives.md` — Rust N-API porting guide
