# oh-my-pi Architecture

A comprehensive architecture document covering the design of oh-my-pi at multiple abstraction levels, with communication flow diagrams and references to key implementation files.

## Table of Contents

1. [System Context (Level 0)](#1-system-context-level-0)
2. [Package Architecture (Level 1)](#2-package-architecture-level-1)
3. [Coding-Agent Layered Architecture (Level 2)](#3-coding-agent-layered-architecture-level-2)
4. [Communication Flows (Level 3)](#4-communication-flows-level-3)
   - [Application Startup](#41-application-startup-flow)
   - [Prompt-Response Cycle](#42-prompt-response-cycle)
   - [Tool Execution Pipeline](#43-tool-execution-pipeline)
   - [Streaming Response Pipeline](#44-streaming-response-pipeline)
   - [Hook and Extension Interception](#45-hook-and-extension-interception)
   - [Session Persistence](#46-session-persistence)
   - [Context Compaction](#47-context-compaction)
   - [Subagent Task Execution](#48-subagent-task-execution)
   - [MCP Server Communication](#49-mcp-server-communication)
   - [TUI Differential Rendering](#410-tui-differential-rendering)
5. [Component Deep Dives (Level 4)](#5-component-deep-dives-level-4)
   - [AgentSession](#51-agentsession)
   - [Agent Loop](#52-agent-loop)
   - [LLM Provider Abstraction](#53-llm-provider-abstraction)
   - [Capability Discovery System](#54-capability-discovery-system)
   - [Session Tree Structure](#55-session-tree-structure)
   - [OutputSink and Streaming Output](#56-outputsink-and-streaming-output)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)

---

## 1. System Context (Level 0)

At the highest level, oh-my-pi is a terminal-based AI coding agent that sits between the user and multiple external systems.

```
                              +------------------+
                              |  User in Terminal |
                              +--------+---------+
                                       |
                                       v
                        +------------------------------+
                        |          oh-my-pi            |
                        |    Coding Agent CLI App      |
                        +--+--------+--------+--------++
                           |        |        |         |
          +----------------+--+  +--+------+ | +-------+----------+
          |                   |  |         | | |                   |
          v                   v  v         v v v                   v
  +---------------+  +-----------+  +---------------+  +----------------+
  | LLM Providers |  |   Local   |  |    Remote     |  |    Remote      |
  |               |  |   System  |  |    Systems    |  |    Systems     |
  | - Anthropic   |  |           |  |               |  |                |
  |   Claude      |  | - Files   |  | - Web/Search  |  | - MCP Servers  |
  | - OpenAI GPT  |  | - Shell   |  |   80+ sites   |  |   Ext. Tools   |
  | - Google      |  | - Git     |  | - SSH Servers |  |                |
  |   Gemini      |  | - LSP     |  |               |  |                |
  | - AWS Bedrock |  |   40+ lang|  |               |  |                |
  | - Azure       |  | - Python  |  |               |  |                |
  | - Groq/xAI/   |  |   Kernel  |  |               |  |                |
  |   Mistral/... |  | - Browser |  |               |  |                |
  +---------------+  +-----------+  +---------------+  +----------------+
```

**Key interactions:**
- **User** communicates via terminal (interactive TUI, print mode, or RPC protocol)
- **LLM Providers** receive prompts and return streaming responses with tool calls
- **Local System** tools (file I/O, shell, git, LSP, Python) are invoked by the LLM through tool definitions
- **Remote Systems** (web, SSH, MCP) extend the agent's reach beyond the local machine

---

## 2. Package Architecture (Level 1)

The monorepo contains 6 TypeScript packages and 3 Rust crates with a strict dependency hierarchy.

```
  TypeScript Packages                           Rust Crates
  =====================                         ============

  +-------------------------------------------+
  | @oh-my-pi/pi-coding-agent                 |
  | Main CLI application  (PRIMARY FOCUS)     |
  | packages/coding-agent/                    |
  +---------------------+---------------------+
                        |
                        | depends on
                        v
  +-------------------------------------------+    +------------------+
  | @oh-my-pi/pi-agent-core                   |    | @oh-my-pi/       |
  | Agent loop, tool execution                |    | omp-stats        |
  | packages/agent/                           |    | Observability    |
  +---------------------+---------------------+    | packages/stats/  |
                        |                          +------------------+
                        v
  +-------------------------------------------+
  | @oh-my-pi/pi-ai                           |
  | Multi-provider LLM client (15+ providers) |
  | packages/ai/                              |
  +---------------------+---------------------+
                        |
                        v
  +-------------------------------------------+
  | @oh-my-pi/pi-tui                          |
  | Terminal UI, differential rendering       |
  | packages/tui/                             |
  +---------------------+---------------------+
                        |
                        v
  +-------------------------------------------+    +-------------------------------+
  | @oh-my-pi/pi-natives                      |<---| crates/pi-natives/            |
  | Rust N-API bridge (13 modules)            |    | ~7,500 lines Rust N-API addon |
  | packages/natives/                         |    | compiled to .node binary      |
  +---------------------+---------------------+    +------+------------+-----------+
                        |                                  ^            ^
                        v                                  |            |
  +-------------------------------------------+    +------+------+  +--+-----------+
  | @oh-my-pi/pi-utils                        |    | brush-core- |  | brush-       |
  | Logger, streams, temp files               |    | vendored/   |  | builtins-    |
  | packages/utils/                           |    | Bash engine |  | vendored/    |
  +-------------------------------------------+    +-------------+  +--------------+
```

### Package Responsibilities

| Package | Size | Key Exports | Purpose |
|---------|------|-------------|---------|
| `pi-utils` | Foundation | `logger`, `isEnoent()`, `Snowflake`, streams | Shared utilities with zero circular deps |
| `pi-natives` | Bridge | `grep()`, `glob()`, `visibleWidth()`, `highlightCode()`, `Shell`, `PtySession` | TypeScript wrappers around 13 Rust N-API modules |
| `pi-tui` | UI | `TUI`, `Editor`, `Container`, `Markdown`, `SelectList` | Differential rendering engine and UI components |
| `pi-ai` | LLM | `stream()`, `streamSimple()`, `getModel()`, provider implementations | Multi-provider streaming client (15+ providers) |
| `pi-agent-core` | Runtime | `Agent`, `agentLoop()`, tool execution, event system | Core agent loop: prompt -> model -> tools -> response |
| `pi-coding-agent` | App | `AgentSession`, modes, tools, extensions, discovery | **Primary focus** - the full CLI application |

### Rust Native Modules

The Rust crate (`crates/pi-natives/`) compiles to a platform-specific `.node` addon:

| Module | Lines | Key Functions | Powered By |
|--------|-------|---------------|------------|
| `grep` | ~1,300 | `grep()`, `searchContent()`, `fuzzyFind()` | ripgrep internals |
| `shell` | ~1,025 | `executeShell()`, `Shell` sessions | brush-shell (vendored) |
| `text` | ~1,280 | `visibleWidth()`, `truncateToWidth()`, `wrapTextWithAnsi()` | unicode-width |
| `keys` | ~1,300 | `parseKey()`, `parseKittySequence()` | PHF perfect-hash |
| `highlight` | ~475 | `highlightCode()`, language detection | syntect |
| `glob` | ~340 | `glob()`, gitignore-aware discovery | ignore + globset |
| `task` | ~350 | Blocking work scheduler on libuv pool | tokio + napi |
| `ps` | ~290 | `killTree()`, `listDescendants()` | libc / libproc |
| `prof` | ~250 | Circular buffer profiler, flamegraph | inferno |
| `system_info` | ~170 | `getSystemInfo()` | sysinfo |
| `image` | ~150 | Decode/encode/resize images | image crate |
| `clipboard` | ~95 | `copyToClipboard()`, `readImageFromClipboard()` | arboard |
| `html` | ~50 | `htmlToMarkdown()` | html-to-markdown-rs |

---

## 3. Coding-Agent Layered Architecture (Level 2)

The coding-agent (`packages/coding-agent/src/`) has a layered architecture where each layer depends only on the layers below it.

```
  +=========================================================================+
  |  CLI LAYER                                                              |
  |                                                                         |
  |  cli.ts -----> main.ts                                                  |
  |  cli/args.ts   commands/ (launch, commit, config, grep, plugin, setup)  |
  +====================================+====================================+
                                       |
                                       v
  +=========================================================================+
  |  MODE LAYER                                                             |
  |                                                                         |
  |  modes/interactive-mode.ts    modes/print-mode.ts    modes/rpc/         |
  |  (TUI + diff rendering)      (non-interactive)       (JSON protocol)    |
  |                                                                         |
  |  modes/components/            modes/controllers/                        |
  |  (footer, editor, msgs)      (command, event, input, selector)          |
  +====================================+====================================+
                                       |
                                       v
  +=========================================================================+
  |  CORE LAYER                                                             |
  |                                                                         |
  |  session/agent-session.ts  <--- THE central abstraction                 |
  |  sdk.ts                    <--- Session factory + discovery              |
  |  system-prompt.ts          <--- System prompt builder                    |
  |  main.ts                   <--- Startup orchestrator                     |
  |  session/session-manager.ts     config/settings-manager.ts              |
  +====================================+====================================+
                                       |
                                       v
  +=========================================================================+
  |  TOOL LAYER                                                             |
  |                                                                         |
  |  tools/ (read, write, edit, bash, grep, find, python, ssh, browser,     |
  |          task, todo, web-search, web-fetch, notebook, lsp, ...)         |
  |  tools/tool-result.ts          tools/output-utils.ts                    |
  +====================================+====================================+
                                       |
                                       v
  +=========================================================================+
  |  EXTENSION LAYER                                                        |
  |                                                                         |
  |  extensibility/hooks/           extensibility/extensions/               |
  |  (event interception)           (lifecycle plugins)                     |
  |  extensibility/custom-tools/    extensibility/skills.ts                 |
  |  extensibility/plugins/         (npm-based plugins)                     |
  +====================================+====================================+
                                       |
                                       v
  +=========================================================================+
  |  DISCOVERY LAYER                                                        |
  |                                                                         |
  |  capability/ (unified type registry, one per capability type)           |
  |  discovery/ (Claude, Cursor, Windsurf, Gemini, Codex, Cline,           |
  |              Copilot, VS Code)                                          |
  +====================================+====================================+
                                       |
                                       v
  +=========================================================================+
  |  INTEGRATION LAYER                                                      |
  |                                                                         |
  |  web/scrapers/   web/search/   lsp/        ipy/       mcp/             |
  |  80+ sites       3 providers   40+ langs   Python     MCP servers      |
  |                                            kernel                       |
  |  task/           ssh/                                                   |
  |  Subagent spawn  Remote exec                                            |
  +=========================================================================+
```

### Key Source Directories

| Directory | Files | Purpose |
|-----------|-------|---------|
| `tools/` | 25+ | Built-in tool implementations (each is a factory function) |
| `prompts/` | 30+ | All prompt templates as static `.md` files (Handlebars) |
| `session/` | 10+ | Session persistence (JSONL), auth storage (SQLite), compaction |
| `modes/` | 30+ | Run modes and TUI components/controllers/themes |
| `extensibility/` | 20+ | Hooks, extensions, custom tools, skills, slash commands, plugins |
| `capability/` | 12 | Capability type definitions (one per capability type) |
| `discovery/` | 12 | Config discovery from 8 AI coding tools |
| `web/` | 80+ | Site-specific scrapers and search providers |
| `lsp/` | 10+ | Language Server Protocol client and configs |
| `ipy/` | 6 | Python/IPython kernel integration |
| `mcp/` | 8 | Model Context Protocol server management |
| `task/` | 8 | Subagent spawning and parallel execution |

---

## 4. Communication Flows (Level 3)

### 4.1 Application Startup Flow

The startup sequence from `omp` command to ready-for-input state.

```
  User          cli.ts         main.ts          sdk.ts          AgentSession    InteractiveMode
   |               |               |               |               |               |
   |  omp [args]   |               |               |               |               |
   +-------------->|               |               |               |               |
   |               | Detect subcmd |               |               |               |
   |               | (default:     |               |               |               |
   |               |  "launch")    |               |               |               |
   |               |               |               |               |               |
   |               | runRootCommand(parsed, rawArgs)|               |               |
   |               +-------------->|               |               |               |
   |               |               |               |               |               |
   |               |               | Initialize theme              |               |
   |               |               | Parse CLI args                |               |
   |               |               |               |               |               |
   |               |               | discoverAuthStorage()         |               |
   |               |               +-------------->|               |               |
   |               |               |<- AuthStorage -+               |               |
   |               |               |   (SQLite)    |               |               |
   |               |               |               |               |               |
   |               |               | discoverModels(auth)          |               |
   |               |               +-------------->|               |               |
   |               |               |<- ModelRegistry+               |               |
   |               |               |               |               |               |
   |               |               | buildSessionOptions()         |               |
   |               |               | (resolve system prompt,       |               |
   |               |               |  model, tools, skills,        |               |
   |               |               |  hooks, extensions)           |               |
   |               |               |               |               |               |
   |               |               | createAgentSession(options)   |               |
   |               |               +-------------->|               |               |
   |               |               |               | Discover & load skills        |
   |               |               |               | Discover rules (ctx + TTSR)   |
   |               |               |               | Discover context files         |
   |               |               |               | Create tools via createTools() |
   |               |               |               | Discover MCP tools             |
   |               |               |               | Load extensions                |
   |               |               |               | Build tool registry            |
   |               |               |               | Create Agent (pi-agent-core)   |
   |               |               |               | Build system prompt            |
   |               |               |               |               |               |
   |               |               |               | new AgentSession(config)       |
   |               |               |               +-------------->|               |
   |               |               |               |<--- session --+               |
   |               |               |<-- { session, extensions, mcpManager, ... }   |
   |               |               |               |               |               |
   |               |               | new InteractiveMode(session, ...)             |
   |               |               +---------------------------------------------->|
   |               |               |               |               |  init()       |
   |               |               |               |               |  Setup UI     |
   |               |               |               |               |  Subscribe    |
   |               |               |               |               |  Welcome scr  |
   |               |               |               |               |               |
   |<-------------------------------------------------------------------------- Ready
   |               |               |               |               |               |
```

**Key files:**
- `packages/coding-agent/src/cli.ts` — CLI entry, command routing
- `packages/coding-agent/src/main.ts` — `runRootCommand()`, startup orchestration
- `packages/coding-agent/src/sdk.ts` — `createAgentSession()`, discovery functions
- `packages/coding-agent/src/session/agent-session.ts` — `AgentSession` constructor

---

### 4.2 Prompt-Response Cycle

The core interaction loop: user types a prompt, the LLM responds with text and tool calls, tools execute, results feed back to the LLM.

```
  User       InteractiveMode   AgentSession     Agent         agentLoop()    LLM Provider    Tools
   |               |               |               |               |               |           |
   | Type prompt   |               |               |               |               |           |
   +-------------->|               |               |               |               |           |
   |               | prompt(text)  |               |               |               |           |
   |               +-------------->|               |               |               |           |
   |               |               | Check slash cmds              |               |           |
   |               |               | Check templates               |               |           |
   |               |               | prompt(userMsg)|              |               |           |
   |               |               +-------------->|               |               |           |
   |               |               |               | agentLoop()   |               |           |
   |               |               |               +-------------->|               |           |
   |               |               |               |               |               |           |
   |               |               |    +----------+----- AGENT TURN LOOP --------+           |
   |               |               |    |          |               |               |           |
   |               |               |    |          | transformContext(messages)     |           |
   |               |               |    |          | convertToLlm(messages)        |           |
   |               |               |    |          |               |               |           |
   |               |               |    |          | streamSimple(model, ctx, opts)|           |
   |               |               |    |          +------------------------------>|           |
   |               |               |    |          |               |               |           |
   |               |               |    |   emit(message_start)   |               |           |
   |               |<--------------+----+----------+               |               |           |
   |               |  render msg   |    |          |               |               |           |
   |               |               |    |          |    text_delta / toolcall_delta |           |
   |               |               |    |   emit(message_update)  |<--------------+           |
   |               |<--------------+----+----------+               |               |           |
   |               |  update UI    |    |          |               |               |           |
   |               |               |    |          |     done (with tool_calls?)   |           |
   |               |               |    |          |               |<--------------+           |
   |               |               |    |          |               |               |           |
   |               |               |    |  if tool_calls:         |               |           |
   |               |               |    |   emit(tool_exec_start) |               |           |
   |               |               |    |          | execute(id, params, signal)   |           |
   |               |               |    |          +---------------------------------------------->|
   |               |               |    |          |               |               |   result  |
   |               |               |    |          |<----------------------------------------------+
   |               |               |    |   emit(tool_exec_end)   |               |           |
   |               |               |    |          | Append results to context     |           |
   |               |               |    |          | Continue loop (back to LLM)   |           |
   |               |               |    |          |               |               |           |
   |               |               |    |  if NO tool_calls:      |               |           |
   |               |               |    |   emit(message_end)     |               |           |
   |               |               |    |          | Exit loop     |               |           |
   |               |               |    +----------+               |               |           |
   |               |               |               |               |               |           |
   |               |  emit(agent_end)              |               |               |           |
   |<--------------+ Show response |               |               |               |           |
   |               |               |               |               |               |           |
```

**Key files:**
- `packages/agent/src/agent.ts` — `Agent.prompt()`, message queuing
- `packages/agent/src/agent-loop.ts` — `agentLoop()`, turn management
- `packages/ai/src/stream.ts` — `stream()` dispatcher, `streamSimple()` wrapper

---

### 4.3 Tool Execution Pipeline

Detailed view of how a single tool call flows through the system, including hook/extension interception.

```
  +----------------------------------+
  | LLM returns tool_call            |
  | (e.g., bash with command)        |
  +----------------+-----------------+
                   |
                   v
  +----------------------------------+
  | Extension emitToolCall()         |
  +----------------+-----------------+
                   |
                   v
  +----------------------------------+
  | Hook emitToolCall()              |
  +----------------+-----------------+
                   |
                   v
              +----+----+
              |Blocked? |
              +--+----+-+
                 |    |
        Yes -----+    +----- No
        |                    |
        v                    v
  +--------------+  +------------------+
  | Return block |  | Tool.execute()   |
  | reason as    |  | (streaming via   |
  | tool error   |  |  onUpdate)       |
  +---------+----+  +--------+---------+
            |                |
            |                v
            |       +------------------+
            |       | Extension        |
            |       | emitToolResult() |
            |       +--------+---------+
            |                |
            |                v
            |       +------------------+
            |       | Hook             |
            |       | emitToolResult() |
            |       +--------+---------+
            |                |
            |                v
            |       +------------------+
            |       | wrapToolWith     |
            |       | MetaNotice()     |
            |       | (truncation info)|
            |       +--------+---------+
            |                |
            v                v
  +----------------------------------+
  |      Final AgentToolResult       |
  +----------------+-----------------+
                   |
                   v
  +----------------------------------+
  |      Return to LLM context       |
  +----------------------------------+
```

**Extension interception points** (from `extensibility/extensions/runner.ts`):

```typescript
// Before tool execution - can block
emitToolCall(event: ToolCallEvent): Promise<{ block?: boolean; reason?: string }>

// After tool execution - can modify result
emitToolResult(event: ToolResultEvent): Promise<ModifiedToolResult>
```

**Key files:**
- `packages/coding-agent/src/extensibility/hooks/runner.ts` — `HookRunner.emitToolCall()`
- `packages/coding-agent/src/extensibility/extensions/runner.ts` — `ExtensionRunner.emitToolCall()`
- `packages/coding-agent/src/tools/output-meta.ts` — `wrapToolWithMetaNotice()`

---

### 4.4 Streaming Response Pipeline

How streaming data flows from the LLM provider through the system to the terminal.

```
  LLM Provider        pi-ai            pi-agent-core       pi-coding-agent          Mode Layer          pi-tui
  ============     ============       ==============      =================       =============      ===========

  +----------+     +----------+       +-----------+       +---------------+       +------------+     +----------+
  | HTTP/SSE |---->| Provider |------>| agentLoop |------>| AgentSession  |------>| Event      |---->| TUI      |
  | Stream   |     | stream   |       | Buffer    |       | #handleAgent  |       | Controller |     | render() |
  +----------+     | function |       | events,   |       | Event()       |       | Update UI  |     | Diff     |
                   +----+-----+       | build     |       +-------+-------+       | components |     | render   |
                        |             | partial   |           |   |   |           +------+-----+     +----+-----+
                        v             | message   |           |   |   |                  |                |
                   +----------+       +-----+-----+           |   |   |                  v                v
                   | Event    |             |                  |   |   |           +------------+     +----------+
                   | Stream   |             v                  |   |   |           | Assistant  |     | Terminal |
                   | <T>      |       +-----------+            |   |   |           | Message    |     | stdout   |
                   | Async    |       | Agent     |            |   |   |           | Component  |     +----------+
                   | iterator |       | .emit()   |            |   |   |           +------------+
                   +----------+       | Publish   |            |   |   |
                                      +-----------+            |   |   |
                                                               v   v   v
                                                          +----+---+---+----+
                                                          | TTSR   | Ext   |
                                                          | Mgr    | emit  |
                                                          | pattern| events|
                                                          | match  |       |
                                                          +--------+--+----+
                                                                      |
                                                                      v
                                                              +-------+------+
                                                              | SessionMgr   |
                                                              | Append JSONL |
                                                              +--------------+
```

**Event types flowing through the pipeline:**

| Event | Source | Contains |
|-------|--------|----------|
| `message_start` | Agent | Partial `AssistantMessage` |
| `message_update` | Agent | Updated partial with new content |
| `text_delta` | Provider | Incremental text chunk |
| `thinking_delta` | Provider | Incremental reasoning chunk |
| `toolcall_start` | Provider | Tool call ID and name |
| `toolcall_delta` | Provider | Incremental tool arguments |
| `toolcall_end` | Provider | Complete tool call |
| `message_end` | Agent | Final complete message |
| `agent_end` | Agent | Completion reason, error state |

**Key files:**
- `packages/ai/src/utils/event-stream.ts` — `EventStream<T, R>` async iterator
- `packages/agent/src/agent-loop.ts` — Event buffering and emission
- `packages/coding-agent/src/session/agent-session.ts` — `#handleAgentEvent()`

---

### 4.5 Hook and Extension Interception

The complete event lifecycle showing every interception point available to hooks and extensions.

```
  +--------------------+
  |   Session Start    |
  +---------+----------+
            |
            v
  +--------------------+
  | emitBeforeAgent    |  Inject messages,
  | Start()            |  modify system prompt
  +---------+----------+
            |
            v
  +--------------------+
  | emitInput()        |  Transform user text,
  |                    |  handle custom input
  +---------+----------+
            |
            v
  +--------------------+
  | emitContext         |  Modify message array
  | (messages)         |  (chained through all hooks)
  +---------+----------+
            |
            v
  +--------------------+
  | emitToolCall()     |  Block or allow
  +---+------------+---+
      |            |
  Allowed      Blocked
      |            |
      v            |
  +----------+     |
  | Tool     |     |
  | executes |     |
  +----+-----+     |
       |           |
       v           |
  +----------+     |
  | emitTool |     |
  | Result() |     |
  | (modify  |     |
  |  output) |     |
  +----+-----+     |
       |           |
       +-----+-----+
             |
             v
  +--------------------+
  |     Turn end       |
  +---+--------+-------+
      |        |
  More turns   Done
      |        |
      |        v
      |   +--------------------+
      |   | emitCompacting()   |  Custom compaction
      |   +---------+----------+
      |             |
      |             v
      |   +--------------------+
      |   | emitSession        |  Can cancel
      |   | Branch()           |
      |   +---------+----------+
      |             |
      |             v
      |   +--------------------+
      |   | emitSession        |  Can cancel
      |   | Tree()             |
      |   +---------+----------+
      |             |
      |             v
      |   +--------------------+
      |   | emitSession        |  Cleanup
      |   | Shutdown()         |
      |   +--------------------+
      |
      +---> (back to emitContext)
```

**Extension API methods** (from `extensibility/extensions/types.ts`):

| Method | When Called | Can... |
|--------|-----------|--------|
| `emitBeforeAgentStart()` | Before first LLM call | Inject messages, replace system prompt |
| `emitInput()` | On user text submission | Transform text, mark as "handled" |
| `emitContext()` | Before each LLM call | Modify message array (structured clone) |
| `emitToolCall()` | Before tool execution | Block with reason |
| `emitToolResult()` | After tool execution | Modify content, details, isError flag |
| `emit("session_before_compact")` | Before compaction | Cancel operation |
| `emit("session_before_branch")` | Before branching | Cancel operation |
| `emit("session_shutdown")` | Before exit | Perform cleanup |

---

### 4.6 Session Persistence

How conversations are stored as append-only JSONL trees.

```
  Runtime (AgentSession)            SessionManager                 JSONL File
  ======================            ==============                 =========

  +------------------+             +----------------+
  | In-memory        | appendMsg() |                |     Line 1: {type: session, version: 3,
  | messages         +------------>| appendMessage  |              id, cwd}
  +------------------+             | appendModel    |
                                   | Change()       |     Line 2: {type: message, id: A,
  +------------------+             | appendCompact  |              parentId: null}
  | Leaf pointer     |             | ion()          |
  | (current branch  |             | appendCustom   |     Line 3: {type: message, id: B,
  |  tip)            |             | Entry()        |              parentId: A}
  +--------+---------+             +-------+--------+
           |                               |              Line 4: {type: message, id: C,
           |                               |                       parentId: B}
           |  buildSessionContext()         |
           +------------------------------>|              Line 5: {type: message, id: D,
           |  (walk tree from leaf to root)|                       parentId: B}  <-- branch
           |                               |
           |  getTree()                    |              Line 6: {type: compaction, id: E,
           +------------------------------>|                       parentId: D}
           |  (full tree structure)        |
           +------------------+            |
                              |            |
                              v            v
                     +------------------+
                     | Rebuilt messages  |
                     +------------------+
```

**Tree structure example:**

```
     A (root message)
     |
     B (user prompt)
    / \
   C   D  <-- Branch point: two different responses
   |   |
   ...  E (compaction of D's branch)
        |
        F (new messages after compaction)
```

**File location:** `~/.omp/agent/sessions/<cwd-path>/<timestamp>_<sessionId>.jsonl`

**Key files:**
- `packages/coding-agent/src/session/session-manager.ts` — JSONL read/write, tree navigation
- `packages/coding-agent/src/session/agent-session.ts` — `branch()`, `navigateTree()`

---

### 4.7 Context Compaction

When the conversation approaches the context window limit, compaction summarizes older messages.

```
  AgentSession       Extensions       Compaction System     LLM Provider     SessionManager
       |                  |                  |                    |                |
       | Context usage > threshold           |                    |                |
       | (or user types /compact)            |                    |                |
       |                  |                  |                    |                |
       | emit("session_before_compact")      |                    |                |
       +----------------->|                  |                    |                |
       |<-- {cancel?} ---+                  |                    |                |
       |                  |                  |                    |                |
       |  [if not cancelled]                 |                    |                |
       |                  |                  |                    |                |
       | compact(instructions?)              |                    |                |
       +------------------------------------>|                    |                |
       |                  |                  |                    |                |
       |                  |                  | Select messages to |                |
       |                  |                  | summarize (keep    |                |
       |                  |                  | recent N tokens)   |                |
       |                  |                  |                    |                |
       |                  |                  | "Summarize this..."                 |
       |                  |                  +------------------->|                |
       |                  |                  |<-- summary text --+                |
       |                  |                  |                    |                |
       |                  | emit("compacting")                   |                |
       |                  |<-----------------+                    |                |
       |                  +-- modified? ---->|                    |                |
       |                  |                  |                    |                |
       |                  |                  | appendCompaction(summary,           |
       |                  |                  |   firstKeptEntryId, tokensBefore)   |
       |                  |                  +------------------------------------>|
       |                  |                  |                    |    Write JSONL  |
       |                  |                  |                    |                |
       |<------------ CompactionResult ------+                    |                |
       |                  |                  |                    |                |
       | Rebuild message array               |                    |                |
       | (summary + kept messages)           |                    |                |
       |                  |                  |                    |                |
```

**Compaction preserves:**
- System prompt (always)
- Recent messages (configurable via `compaction.keepRecentTokens`)
- Custom data from hooks (`preserveData`)
- Extension state

**Key files:**
- `packages/coding-agent/src/session/compaction/index.ts` — Compaction logic
- `packages/coding-agent/src/session/agent-session.ts` — `compact()`, auto-compaction trigger

---

### 4.8 Subagent Task Execution

How the Task tool spawns independent sub-agents for parallel work.

```
  Parent Agent                    Task Executor                     Child Agent
  ============                    =============                     ===========

  +------------+                  +--------------+
  | Task Tool  |  runSubprocess() |              |
  | tools/     +----------------->| executor.ts  |
  | task.ts    |                  |              |
  +------+-----+                  | Validate     |
         ^                        | depth        |                  +--------------+
         |                        | Resolve model|                  |              |
         |                        | Create       |  new session     | Agent Loop   |
         |                        | session file +----------------->| (independent |
         |                        |              |                  |  execution)  |
         |                        +------+-------+                  +------+-------+
         |                               |                                 |
         |                               |                                 v
         |                               |                          +--------------+
         |                               |                          | Child Tools  |
         |                               |                          | read, write, |
         |                               |                          | edit, bash.. |
         |                               |                          +------+-------+
         |                               |                                 |
         |                        +------+-------+                         v
         |  onProgress            | Progress     |                  +--------------+
         |  (coalesced            | Tracking     |  events          | submit_result|
         |   150ms updates)       | <------------+-<----------------+ tool         |
         |<-----------------------+              |                  | (structured  |
         |                        +------+-------+                  |  output)     |
         |                               |                          +--------------+
         |                               |
         v                               v
  +------------+                  +--------------+
  | Parent     |<-- result -------| AgentTool    |
  | AgentSess. |                  | Result       |
  +------------+                  +--------------+

  Shared Resources (reused from parent):
  +---------------------------------------------+
  | MCP Proxy Tools | Auth Storage | Model Reg.  |
  +---------------------------------------------+
```

**Task depth control:** Subagents track their nesting level via `taskDepth`. At max depth, the Task tool is removed to prevent infinite recursion.

**Built-in agent types:** `explore`, `plan`, `browser`, `task`, `reviewer` — each with tailored system prompts and tool sets.

**Key files:**
- `packages/coding-agent/src/task/executor.ts` — `runSubprocess()`, progress tracking
- `packages/coding-agent/src/task/agents.ts` — Agent type definitions

---

### 4.9 MCP Server Communication

How MCP (Model Context Protocol) servers are discovered, connected, and used.

```
  sdk.ts          MCPManager         .mcp.json Config      Transport       MCP Server       Tool Registry
    |                 |                    |                   |               |                 |
    | discoverAndConnect()                 |                   |               |                 |
    +---------------->|                    |                   |               |                 |
    |                 | Read .omp/mcp.json |                   |               |                 |
    |                 | + ~/.omp/agent/    |                   |               |                 |
    |                 |   mcp.json         |                   |               |                 |
    |                 +------------------->|                   |               |                 |
    |                 |<-- config ---------+                   |               |                 |
    |                 |                    |                   |               |                 |
    |                 |        +-- Connect all servers in PARALLEL --+        |                 |
    |                 |        |           |                   |      |        |                 |
    |                 | Create transport   |                   |      |        |                 |
    |                 +-------------------------------------->|      |        |                 |
    |                 |        |           |   spawn/connect   |      |        |                 |
    |                 |        |           |                   +----->|        |                 |
    |                 |        |           |   initialize resp |      |        |                 |
    |                 |        |           |                   |<-----+        |                 |
    |                 |<--------------------------------------+      |        |                 |
    |                 |        |           |                   |      |        |                 |
    |                 | listTools()        |                   |      |        |                 |
    |                 +---------------------------------------------->|        |                 |
    |                 |<-- tool definitions -------------------------+        |                 |
    |                 |        +---------------------------------------------+                 |
    |                 |                    |                   |               |                 |
    |                 | Wait 250ms for connections             |               |                 |
    |                 | (use cache for pending)                |               |                 |
    |                 |                    |                   |               |                 |
    |                 | Create MCPTool wrappers                |               |                 |
    |                 +---------------------------------------------------------------->CustomTool[]
    |                 |                    |                   |               |     (bridged)   |
    |                 |                    |                   |               |                 |
    |                 |      During agent execution:           |               |                 |
    |                 |                    |                   |               |                 |
    |                 |  callTool(name, args)                  |               |                 |
    |<--------------------------------------------------------------- tools/call               |
    |                 +---------------------------------------------->|        |                 |
    |                 |                    |                   |       |        |                 |
    |                 |<----- result ------------------------------------+     |                 |
    |                 +--- formatted result ------------------------------------------->|        |
    |                 |                    |                   |               |                 |
```

**Key features:**
- **Parallel connection** — All servers connect simultaneously
- **Startup timeout** — 250ms grace period, then use cached tool definitions
- **Auth resolution** — OAuth credentials and shell variable substitution
- **Connection reuse** — Subagents proxy through parent's MCP connections

**Key files:**
- `packages/coding-agent/src/mcp/manager.ts` — `MCPManager`, connection lifecycle
- `packages/coding-agent/src/mcp/tool-bridge.ts` — MCPTool / DeferredMCPTool wrappers

---

### 4.10 TUI Differential Rendering

How the terminal UI efficiently updates the screen.

```
  Component Tree                          Render Pipeline
  ==============                          ===============

  +---------------------------+
  | TUI (root Container)      |           1. requestRender()
  |                           |                    |
  | +- WelcomeComponent      |                    v
  | +- chatContainer         |           2. Each component.render(width)
  | +- pendingMessagesContainer            --> string[]
  | +- statusContainer       |                    |
  | +- todoContainer         |                    v
  | +- StatusLineComponent   |           3. Overlay compositing
  |    (Footer bar)          |              Merge overlays into base lines
  | +- editorContainer       |                    |
  |    +- CustomEditor       |                    v
  |                           |           4. Line-by-line diff
  +---------------------------+              Compare with previousLines[]
                                                   |
                                          +--------+--------+
                                          |                 |
                                     Changed lines     Unchanged
                                          |            (skip)
                                          v
                                  5. Synchronized output
                                     ESC[?2026h ... ESC[?2026l
                                          |
                                          v
                                     Terminal stdout
```

**Rendering modes:**

| Mode | When | Cost |
|------|------|------|
| **Full re-render** | First render, terminal resize, content above viewport | All lines |
| **Partial update** | Normal updates (most common) | Only changed lines |
| **Cleanup** | Content shrunk | Clear extra lines |

**ANSI-aware operations** (all via Rust N-API for performance):
- `visibleWidth()` — Width ignoring escape codes and hyperlinks
- `truncateToWidth()` — Truncate with ellipsis, respecting wide chars
- `sliceWithWidth()` — Column-based extraction for overlay compositing
- `wrapTextWithAnsi()` — Line wrapping that preserves SGR codes across breaks

**Key files:**
- `packages/tui/src/tui.ts` — `TUI` class, `#doRender()` differential algorithm
- `packages/tui/src/components/` — All UI components

---

## 5. Component Deep Dives (Level 4)

### 5.1 AgentSession

`AgentSession` (`session/agent-session.ts`) is the central abstraction that all three modes share.

```
  +========================================================================+
  |                           AgentSession                                 |
  +========================================================================+
  | Fields:                                                                |
  |   +agent: Agent                                                        |
  |   +sessionManager: SessionManager                                      |
  |   +settings: Settings                                                  |
  |   -scopedModels: ScopedModel[]                                         |
  |   -extensionRunner: ExtensionRunner                                    |
  |   -toolRegistry: Map<string, AgentTool>                                |
  |   -ttsrManager: TtsrManager                                           |
  |   -steeringMessages: string[]                                          |
  |   -followUpMessages: string[]                                          |
  |   -eventListeners: AgentSessionEventListener[]                         |
  +------------------------------------------------------------------------+
  | Methods:                                                               |
  |   +prompt(text, options): Promise<void>                                |
  |   +steer(text): Promise<void>                                          |
  |   +followUp(text): Promise<void>                                       |
  |   +abort(): Promise<void>                                              |
  |                                                                        |
  |   +setModel(model, role): Promise<void>                                |
  |   +cycleModel(direction): Promise<ModelCycleResult>                    |
  |                                                                        |
  |   +compact(instructions): Promise<CompactionResult>                    |
  |   +getContextUsage(): ContextUsage                                     |
  |                                                                        |
  |   +branch(entryId): Promise<object>                                    |
  |   +navigateTree(targetId): Promise<object>                             |
  |   +newSession(): Promise<boolean>                                      |
  |                                                                        |
  |   +executeBash(command, options): Promise<BashResult>                   |
  |   +executePython(code): Promise<PythonResult>                          |
  |                                                                        |
  |   +subscribe(listener): () => void                                     |
  |   +dispose(): Promise<void>                                            |
  |                                                                        |
  |   -handleAgentEvent(event): void                                       |
  |   -emitExtensionEvent(event): void                                     |
  +========================================================================+
         |                        |                        |
         | wraps                  | persists via           | delegates to
         v                        v                        v
  +--------------+    +------------------+    +--------------------+
  |    Agent     |    |  SessionManager  |    |  ExtensionRunner   |
  +--------------+    +------------------+    +--------------------+
  | +prompt()    |    | +appendMessage() |    | +emit()            |
  | +continue()  |    | +buildSession    |    | +emitToolCall()    |
  | +steer()     |    |  Context()       |    | +emitToolResult()  |
  | +followUp()  |    | +getTree()       |    | +emitBeforeAgent   |
  | +subscribe() |    | +branch()        |    |  Start()           |
  | +state       |    | +flush()         |    | +getAllRegistered   |
  +--------------+    +------------------+    |  Tools()           |
                                              +--------------------+
```

**Internal event handling** in `#handleAgentEvent()`:

```
1. Emit to extensions (emitExtensionEvent)
2. Emit to all subscribed listeners
3. Persist messages (appendMessage on message_end)
4. Handle auto-retry (on retryable errors)
5. Handle auto-compaction (when context exceeds threshold)
6. Handle TTSR pattern matching:
   - Monitor text_delta and toolcall_delta
   - Check patterns against TtsrManager
   - If match: abort stream, inject rules, retry
7. Handle todo completion reminders
8. Handle streaming edit abort detection
```

---

### 5.2 Agent Loop

The agent loop in `packages/agent/src/agent-loop.ts` implements the core prompt-tool-response cycle.

```
                          +-------------+
                          | Turn Start  |
                          +------+------+
                                 |
                                 v
                     +-----------+----------+
                     | TransformContext     |
                     | Process pending msgs |
                     +-----------+----------+
                                 |
                                 v
                     +-----------+----------+
                     | ConvertToLLM        |
                     | Apply context mods   |
                     +-----------+----------+
                                 |
                                 v
                     +-----------+----------+
                     | StreamResponse      |
                     | Call LLM provider    |
                     +-----------+----------+
                                 |
                                 v
                     +-----------+----------+
                     | CheckToolCalls      |
                     +---+-------------+---+
                         |             |
                  Has tool calls    No tool calls
                         |             |
                         v             v
              +----------+---+  +------+--------+
              | ExecuteTools |  | CheckSteering |
              +----------+---+  +---+-------+---+
                         |          |       |
                         v      Has steer   No more
              +----------+---+  /follow-up  messages
              | Check        |      |           |
              | Interrupt    |      |           v
              +--+-------+--+      |    +------+---+
                 |       |         |    | AgentEnd |
          No interrupt  Steering   |    +----------+
                 |      received   |
                 v         |       |
          +------+----+   |       |
          | Check     |   |       |
          | Steering  +---+-------+
          +-----+-----+       |
                |              |
                +--> (back to Turn Start)
```

**Tool concurrency modes:**
- `"shared"` (default) — Tools in a batch execute in parallel
- `"exclusive"` — Tool executes alone, blocking others in the batch

**Message queue processing:**

```typescript
// Steering: interrupts current turn
agent.steer("new instruction")  // Queued, delivered after current tool batch

// Follow-up: continues after agent would stop
agent.followUp("also do this")  // Queued, delivered when agent has no more work
```

---

### 5.3 LLM Provider Abstraction

The `pi-ai` package provides a unified streaming interface across 15+ providers.

```
  Unified Interface
  =================

  +------------------+     +-------------------+
  | streamSimple()   +---->| mapOptionsForApi()|
  | (high-level API) |     | (normalize opts)  |
  +------------------+     +--------+----------+
                                    |
                                    v
                           +--------+----------+
                           | stream()          |
                           | (provider         |
                           |  dispatcher)      |
                           +---+---+---+---+---+
                               |   |   |   |
               model.api ------+   |   |   +------ model.api
                               |   |   |
                               v   v   v
  +------------------+ +-------+---+ +--+---------------+ +------------------+
  | streamAnthropic  | | streamOAI | | streamGoogle     | | streamBedrock    |
  | anthropic-       | | Completions| | google-          | | bedrock-         |
  | messages         | | openai-   | | generative-ai    | | converse-stream  |
  +--------+---------+ | completions| +--------+---------+ +--------+---------+
           |           +-----+-----+          |                     |
           |                 |                 |                     |
           v                 v                 v                     v
  +--------+---+   +---------+-+ +-------------+--+ +---------------+-+
  | streamOAI  |   | stream   | | streamVertex   | | streamAzure     |
  | Responses  |   | Cursor   | | google-vertex  | | azure-openai-   |
  | openai-    |   | cursor-  | +----------------+ | responses       |
  | responses  |   | agent    |                     +-----------------+
  +--------+---+   +----+-----+
           |             |
           +------+------+
                  |
                  v
      +-----------------------+
      | AssistantMessage      |
      | EventStream           |
      | (Async iterator of    |
      |  events)              |
      +-----------------------+
```

**Thinking/reasoning mapping per provider:**

| Provider | Thinking Mode | Mechanism |
|----------|---------------|-----------|
| Anthropic | `thinkingEnabled` + budget or `effort` | Budget-based (older) or effort level (Opus 4.6+) |
| OpenAI | `reasoningEffort` | `"minimal"` / `"low"` / `"medium"` / `"high"` |
| Google | `thinking.enabled` + `budgetTokens` or `level` | Budget (older) or level (Gemini 3+) |
| Bedrock | Same as Anthropic | Claude models on AWS |

**Key files:**
- `packages/ai/src/stream.ts` — `stream()`, `streamSimple()`, `mapOptionsForApi()`
- `packages/ai/src/providers/anthropic.ts` — Anthropic streaming implementation
- `packages/ai/src/providers/openai-completions.ts` — OpenAI implementation
- `packages/ai/src/providers/google.ts` — Google Gemini implementation

---

### 5.4 Capability Discovery System

The capability system provides unified configuration loading from 8 AI coding tools.

```
  Capability Registry (capability/)
  ==================================

  defineCapability<T>() -----> Capability Types:
                                 - context-file
                                 - extension
                                 - hook
                                 - instruction
                                 - mcp
                                 - rule
                                 - skill
                                 - slash-command
                                 - system-prompt
                                 - tool

  registerProvider<T>() -----> Discovery Providers (discovery/):

  +----------+  +----------+  +-----------+  +----------+  +----------+
  | builtin  |  | claude   |  | cursor    |  | windsurf |  | gemini   |
  | Built-in |  | .claude/ |  | .cursor/  |  | .wind-   |  | .gemini/ |
  | defaults |  | dirs     |  | .cursor-  |  | surf-    |  | dirs     |
  |          |  |          |  | rules     |  | rules    |  |          |
  +----+-----+  +----+-----+  +----+------+  +----+-----+  +----+-----+
       |              |             |              |              |
       +------+-------+------+-----+------+-------+------+------+
              |              |            |              |
  +----+-----+  +----+------+  +----+----+  +----+------+
  | codex    |  | cline     |  | vscode  |  | github    |
  | .codex/  |  | .cline-   |  | .vscode/|  | copilot-  |
  | AGENTS.md|  | rules     |  | settings|  | instruct  |
  |          |  | .mcp.json |  |         |  | ions.md   |
  +----------+  +-----------+  +---------+  +-----------+

  loadCapability<T>() -----> Parallel load from ALL providers
```

**Discovery flow for each capability:**

```
loadCapability(capabilityId, options)
  1. Filter providers by enabled state
  2. Call all providers in PARALLEL
  3. Each provider returns { items, warnings }
  4. Merge items with _source metadata
  5. Deduplicate by capability.key() (first wins)
  6. Validate via capability.validate()
  7. Return { items, all, warnings, providers }
```

**Priority order:** `.omp` > `.pi` > `.claude` > `.codex` > `.gemini`

**Key files:**
- `packages/coding-agent/src/capability/index.ts` — Registry, `loadCapability()`
- `packages/coding-agent/src/discovery/index.ts` — Provider imports and registration
- `packages/coding-agent/src/discovery/*.ts` — Per-source discovery modules

---

### 5.5 Session Tree Structure

Sessions use an append-only tree stored as JSONL, enabling branching and time-travel.

```
  JSONL File (append-only)
  ========================

  Line 1: Header     {type: session, version: 3, id, cwd}
  Line 2: Entry A    {type: message, id: A, parentId: null}    User: "Add auth system"
  Line 3: Entry B    {type: message, id: B, parentId: A}       Assistant: "I'll use JWT..."
  Line 4: Entry C    {type: message, id: C, parentId: B}       User: "Use OAuth instead"
  Line 5: Entry D    {type: message, id: D, parentId: B}       User: "Add rate limiting"
  Line 6: Entry E    {type: compaction, id: E, parentId: D}
  Line 7: Entry F    {type: message, id: F, parentId: E}       User: "Now add tests"
  Line 8: Entry L    {type: label, targetId: B, label: "before-oauth"}


  Tree visualization:

       Header
         |
         A  (User: "Add auth system")
         |
         B  (Assistant: "I'll use JWT...")
        / \
       /   \
      C     D  <-- Branch point
      |     |
  (OAuth  (Rate
   path)   limit)
            |
            E  (compaction)
            |
            F  (new messages after compaction)

  Label "before-oauth" points to --> B
```

**Tree operations:**

| Operation | Method | Effect |
|-----------|--------|--------|
| Branch | `branch(entryId)` | Move leaf pointer to create new branch |
| Navigate | `navigateTree(targetId)` | Switch to different branch |
| Label | `appendLabelChange(targetId, label)` | Name a checkpoint |
| Compact | `appendCompaction(...)` | Summarize older messages |
| Fork | `fork()` | Create new session file from current branch |

**Context building:** `buildSessionContext()` walks from the current leaf pointer back to root, collecting messages along the branch path, applying compaction summaries, and resolving model/thinking changes.

---

### 5.6 OutputSink and Streaming Output

For tools that produce potentially unbounded output (bash, Python, SSH), the OutputSink handles memory-safe streaming.

```
  Tool Execution                OutputSink                    UI Preview
  ==============                ==========                    ==========

  +-----------+
  | Command   |
  | running   |    stdout/stderr chunks
  | (bash,    +----------+----------+
  | python,   |          |          |
  | ssh)      |          |          |
  +-----------+          |          |
                         v          v
              +----------+---+  +---+---------+
              | Memory       |  | TailBuffer  |
              | buffer       |  | Rolling     |
              | (up to 500KB)|  | last 64KB   |
              +------+-------+  +------+------+
                     |                 |
                     v                 v
              +------+-------+  +------+------+
              | > threshold? |  | onUpdate()  |
              +--+--------+--+  | callback    |
                 |        |     +------+------+
                Yes       No           |
                 |        |            v
                 v        |     +------+------+
           +-----+-----+ |     | BashExec    |
           | Spill to   | |     | Component   |
           | artifact   | |     | (live term  |
           | file       | |     |  output)    |
           | ~/.omp/    | |     +-------------+
           | agent/     | |
           | sessions/  | |
           | .../       | |
           | artifacts/ | |
           +-----+------+ |
                 |         |
                 v         |
           +-----+------+  |
           | Keep last  |  |
           | N bytes in |  |
           | memory     |  |
           +-----+------+  |
                 |         |
                 +----+----+
                      |
                      v
              +-------+--------+
              | OutputSummary   |
              | {output,        |
              |  truncated,     |
              |  totalLines,    |
              |  totalBytes,    |
              |  artifactId}    |
              +-------+--------+
                      |
                      v
              +-------+--------+
              | ToolResult     |
              | Builder        |
              | .text(output)  |
              | .truncation    |
              | FromSummary()  |
              | .done()        |
              +----------------+
```

**Pattern used by streaming tools** (from `tools/bash.ts`, `tools/python.ts`, `tools/ssh.ts`):

```typescript
// 1. Allocate artifact path
const { artifactPath, artifactId } = await allocateOutputArtifact(session, "bash");

// 2. Create tail buffer for UI preview
const tailBuffer = createTailBuffer(DEFAULT_MAX_BYTES);

// 3. Execute with streaming callback
const result = await executeBash({
  artifactPath, artifactId,
  onChunk: (chunk) => {
    tailBuffer.append(chunk);
    onUpdate?.({
      content: [{ type: "text", text: tailBuffer.text() }],
      details: {},
    });
  },
});

// 4. Build result with truncation metadata
return toolResult<BashToolDetails>({})
  .text(result.output)
  .truncationFromSummary(result, { direction: "tail" })
  .done();
```

**Key files:**
- `packages/coding-agent/src/session/streaming-output.ts` — `OutputSink`
- `packages/coding-agent/src/tools/output-utils.ts` — `TailBuffer`, `allocateOutputArtifact()`
- `packages/coding-agent/src/tools/tool-result.ts` — `ToolResultBuilder`

---

## 6. Cross-Cutting Concerns

### Event System Architecture

The entire application is event-driven. Events flow through three layers:

```
  pi-agent-core                pi-coding-agent                  Modes
  ==============               ================                 =====

  +------------------+         +--------------------+
  | AgentEvent       |         | AgentSessionEvent  |
  |                  |  Agent  |                    |  AgentSession
  | - message_start  | .sub-   | All AgentEvents +  | .subscribe()
  | - message_update | scribe()| - auto_compaction_*|----------+------+---------+
  | - message_end    +-------->| - auto_retry_*     |          |      |         |
  | - tool_exec_*    |         | - ttsr_triggered   |          v      v         v
  | - turn_start     |         | - todo_reminder    |    +-----+--+ +-+------+ +-+------+
  | - turn_end       |         |                    |    | Event  | | Print  | | RPC    |
  | - agent_start    |         +--------------------+    | Ctrl   | | Mode   | | Mode   |
  | - agent_end      |                                   | (UI    | | (std-  | | (JSON  |
  +------------------+                                   | update)| | out)   | | proto) |
                                                         +--------+ +--------+ +--------+
```

### TTSR (Time-Traveling Streamed Rules)

Rules that inject themselves only when triggered by pattern matches in the LLM's output stream:

```
  LLM Provider          Agent Loop         TtsrManager        AgentSession
       |                     |                   |                  |
       | text_delta           |                   |                  |
       | "import lodash..."  |                   |                  |
       +-------------------->|                   |                  |
       |                     | emit(message_update)                 |
       |                     +-------------------------------------->|
       |                     |                   |                  |
       |                     |                   | check(text_delta)|
       |                     |                   |<-----------------+
       |                     |                   |                  |
       |                     |                   | Pattern match:   |
       |                     |                   | "lodash" matches |
       |                     |                   | "don't use       |
       |                     |                   |  lodash" rule    |
       |                     |                   |                  |
       |                     |                   | ttsr_triggered   |
       |                     |                   +----------------->|
       |                     |                   |                  |
       |                     |                   |   Abort current  |
       |                     |                   |   stream         |
       |                     |                   |                  |
       |                     |                   |   Inject rule as |
       |                     |                   |   system reminder|
       |                     |                   |                  |
       |                     |  Retry from same point              |
       |                     |<-------------------------------------+
       |                     |                   |                  |
       |  LLM now sees the rule and avoids lodash                  |
       |                     |                   |                  |
```

**Zero upfront cost:** TTSR rules consume no context tokens until triggered. Each rule fires at most once per session.

### Error Handling and Recovery

```
  +-------------------------------+
  | Error during agent execution  |
  +---------------+---------------+
                  |
                  v
          +-------+--------+
          | Retryable?     |
          +---+--------+---+
              |        |
         Yes  |        |  No
  (rate limit,|        |
  network err)|        v
              |  +-----+-----------+
              |  | Context overflow?|
              v  +---+--------+----+
  +-----------+--+   |        |
  | Auto-retry   |  Yes       No
  | Up to 3      |   |        |
  | attempts w/  |   v        v
  | exponential  | +-+--------+----+
  | backoff      | | Auto-compaction|
  +------+-------+ | Summarize +   |
         |         | retry          |
    Still failing  +---+--------+--+
         |             |        |
         v          Success   Still
  +------+-------+    |     failing
  | Report error |    |        |
  | to user      |    v        v
  +--------------+  (retry)  Report
                             error
```

### Configuration Priority

Settings are resolved with this precedence (highest to lowest):

```
CLI flags (--model, --thinking, etc.)
    |
    v
Environment variables (PI_SMOL_MODEL, etc.)
    |
    v
Project settings (.omp/settings.json)
    |
    v
User settings (~/.omp/agent/settings.json)
    |
    v
Built-in defaults
```

For config discovery (AGENTS.md, hooks, tools, etc.):

```
.omp/ > .pi/ > .claude/ > .codex/ > .gemini/
```

---

## Appendix: File Reference Index

| Component | Primary File | Lines |
|-----------|-------------|-------|
| CLI entry | `packages/coding-agent/src/cli.ts` | ~50 |
| Main orchestrator | `packages/coding-agent/src/main.ts` | ~500 |
| SDK factory | `packages/coding-agent/src/sdk.ts` | ~600 |
| AgentSession | `packages/coding-agent/src/session/agent-session.ts` | ~1,200 |
| System prompt builder | `packages/coding-agent/src/system-prompt.ts` | ~300 |
| Interactive mode | `packages/coding-agent/src/modes/interactive-mode.ts` | ~1,500 |
| Print mode | `packages/coding-agent/src/modes/print-mode.ts` | ~150 |
| RPC mode | `packages/coding-agent/src/modes/rpc/rpc-mode.ts` | ~800 |
| Agent class | `packages/agent/src/agent.ts` | ~400 |
| Agent loop | `packages/agent/src/agent-loop.ts` | ~500 |
| LLM stream dispatcher | `packages/ai/src/stream.ts` | ~300 |
| Anthropic provider | `packages/ai/src/providers/anthropic.ts` | ~500 |
| OpenAI provider | `packages/ai/src/providers/openai-completions.ts` | ~400 |
| Google provider | `packages/ai/src/providers/google.ts` | ~400 |
| Tool registry | `packages/coding-agent/src/tools/index.ts` | ~200 |
| Bash tool | `packages/coding-agent/src/tools/bash.ts` | ~400 |
| Read tool | `packages/coding-agent/src/tools/read.ts` | ~500 |
| Hook runner | `packages/coding-agent/src/extensibility/hooks/runner.ts` | ~300 |
| Extension runner | `packages/coding-agent/src/extensibility/extensions/runner.ts` | ~400 |
| Capability registry | `packages/coding-agent/src/capability/index.ts` | ~300 |
| Discovery orchestrator | `packages/coding-agent/src/discovery/index.ts` | ~100 |
| Session manager | `packages/coding-agent/src/session/session-manager.ts` | ~800 |
| OutputSink | `packages/coding-agent/src/session/streaming-output.ts` | ~200 |
| MCP manager | `packages/coding-agent/src/mcp/manager.ts` | ~500 |
| Task executor | `packages/coding-agent/src/task/executor.ts` | ~500 |
| TUI renderer | `packages/tui/src/tui.ts` | ~400 |
| Rust N-API addon | `crates/pi-natives/src/lib.rs` + modules | ~7,500 |
