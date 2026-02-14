# Agent Harness: Zero to Hero Study Plan

A systematic curriculum for understanding how AI coding agents work, using oh-my-pi (omp) as the reference implementation. Each module pairs theory with implementation, building progressively from first principles to mastery.

## How to Use This Plan

- **Read theory first**, then read the referenced source files
- **Each module has checkpoints** — don't proceed until you can answer them
- **Exercises are not optional** — they cement understanding through doing
- **Files are referenced as** `package/path:lines` — read the full function/class, not just the lines
- **Cross-references** link related modules — revisit earlier modules as understanding deepens

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Module 1: What Is an Agent Harness?](#module-1-what-is-an-agent-harness)
- [Module 2: The LLM Communication Layer](#module-2-the-llm-communication-layer)
- [Module 3: The Tool System](#module-3-the-tool-system)
- [Module 4: The Agent Loop](#module-4-the-agent-loop)
- [Module 5: The Harness Core — AgentSession](#module-5-the-harness-core--agentsession)
- [Module 6: Context Management and Compaction](#module-6-context-management-and-compaction)
- [Module 7: Session Persistence and Branching](#module-7-session-persistence-and-branching)
- [Module 8: The Extension System](#module-8-the-extension-system)
- [Module 9: Discovery and Configuration](#module-9-discovery-and-configuration)
- [Module 10: Terminal UI and Modes](#module-10-terminal-ui-and-modes)
- [Module 11: Streaming and Output Management](#module-11-streaming-and-output-management)
- [Module 12: Subagents and Parallel Execution](#module-12-subagents-and-parallel-execution)
- [Module 13: Advanced Patterns — TTSR, MCP, LSP](#module-13-advanced-patterns--ttsr-mcp-lsp)
- [Module 14: Capstone — Build Your Own Mini-Harness](#module-14-capstone--build-your-own-mini-harness)

---

## Prerequisites

Before starting, you should be comfortable with:

| Topic | What You Need | How to Verify |
|-------|---------------|---------------|
| TypeScript | Classes, generics, `async/await`, iterators | Can you write an async generator? |
| Promises | `Promise.all`, `Promise.race`, `Promise.withResolvers` | Can you implement a timeout race? |
| Event-driven patterns | EventEmitter, pub/sub, callbacks | Can you build a simple event bus? |
| JSON and serialization | JSONL (newline-delimited JSON), streaming parse | Can you read a JSONL file line by line? |
| HTTP streaming | Server-Sent Events (SSE), chunked transfer | Can you consume an SSE endpoint? |
| Terminal basics | ANSI escape codes, stdin/stdout, TTY vs pipe | Do you know what `\x1b[2J` does? |

**Not required:** Rust, Bun internals, or LLM API experience (covered in the modules).

---

## Module 1: What Is an Agent Harness?

### Theory

An **agent harness** is the infrastructure layer that turns an LLM from a simple text-completion engine into an autonomous agent that can take actions in the real world. It is not the LLM itself — it is everything *around* the LLM.

The harness solves five fundamental problems:

```
  1. COMMUNICATION        How do we talk to the LLM?
     (streaming, multi-provider, error recovery)

  2. TOOL EXECUTION       How does the LLM take actions?
     (tool definitions, execution, result formatting)

  3. THE LOOP             How do we cycle between LLM and tools?
     (prompt -> response -> tool calls -> results -> prompt)

  4. CONTEXT MANAGEMENT   How do we handle limited memory?
     (token windows, compaction, summarization)

  5. ORCHESTRATION        How do we coordinate everything?
     (session state, persistence, extensions, UI)
```

Think of it like an operating system for an AI agent. The LLM is the CPU. The harness provides the scheduler (agent loop), memory management (context window), I/O (tools), filesystem (session persistence), and device drivers (provider abstraction).

### omp's Architecture at a Glance

```
  Package              Harness Role            Analogy
  ========             ============            =======
  pi-ai                LLM communication       Device drivers
  pi-agent-core        Agent loop              Scheduler + syscalls
  pi-coding-agent      Full harness            Operating system
  pi-tui               Terminal rendering      Display driver
  pi-natives           Performance layer       Kernel modules
  pi-utils             Shared utilities        Standard library
```

### Reading

1. `CLAUDE.md` (root) — Project overview, package architecture section
2. `docs/ARCHITECTURE.md` — Sections 1 and 2 (System Context + Package Architecture)
3. `packages/coding-agent/DEVELOPMENT.md` — "Key Abstractions" section

### Checkpoint

Before proceeding, you should be able to:

- [ ] Draw the dependency chain: `utils -> natives -> tui -> ai -> agent -> coding-agent`
- [ ] Explain why the LLM alone is not an agent
- [ ] Name the five problems an agent harness solves
- [ ] Identify which omp package handles each problem

---

## Module 2: The LLM Communication Layer

### Theory

The first problem: how do we talk to LLMs? Every provider (Anthropic, OpenAI, Google, etc.) has a different API, different message formats, different streaming protocols, and different feature sets. The harness needs a **unified abstraction** that hides these differences.

Key concepts:

**Streaming** — LLMs generate tokens one at a time. Waiting for the full response wastes time. Instead, we consume an **event stream** — an async iterator that yields events as they arrive.

**EventStream<T, R>** — omp's core streaming primitive. It wraps a provider's HTTP/SSE response into a standardized async iterator. Each event has a type (`text_delta`, `toolcall_start`, `toolcall_delta`, `toolcall_end`, `done`, etc.) and carries incremental data.

**Provider dispatch** — A single `stream()` function that reads `model.api` to select the right provider implementation. All providers return the same `EventStream` type.

**Message types** — The unified message format: `UserMessage`, `AssistantMessage`, `ToolResult`. Each provider's format is different, but `convertToLlm()` normalizes them.

### Reading

Read these files in order:

1. **`packages/ai/src/utils/event-stream.ts`** — The `EventStream` class. Study how it wraps an async generator into a standardized iterator with `.toArray()`, `.map()`, and abort support.

2. **`packages/ai/src/stream.ts`** — The `stream()` dispatcher and `streamSimple()` wrapper. Focus on:
   - How `stream()` selects a provider based on `model.api`
   - How `streamSimple()` adds thinking mode and option normalization
   - The `mapOptionsForApi()` function that translates generic options to provider-specific ones

3. **`packages/ai/src/providers/anthropic.ts`** (first 200 lines) — One concrete provider. See how raw SSE events are transformed into the unified `EventStream` format.

4. **`packages/ai/src/types.ts`** or equivalent — The shared types: `Model`, `Message`, `ToolDefinition`, `AssistantMessage`.

### Key Insight

The provider abstraction is the **seam** where the harness meets the outside world. Everything above it speaks a uniform language. Everything below it handles provider-specific quirks.

### Exercise

Trace a single text completion through the system:
1. `streamSimple(model, messages, options)` is called
2. `mapOptionsForApi()` normalizes options
3. `stream()` dispatches to `streamAnthropic()`
4. Anthropic returns SSE events
5. Events are yielded as `EventStream<AssistantMessageEvent>`

Write pseudocode for each step.

### Checkpoint

- [ ] Explain what `EventStream<T, R>` is and why async iteration matters
- [ ] Describe how `stream()` selects the right provider
- [ ] Name three differences between Anthropic and OpenAI APIs that the abstraction hides
- [ ] Explain thinking/reasoning mode differences across providers

---

## Module 3: The Tool System

### Theory

Tools are how the LLM takes actions. A **tool** is a function with:
1. A **name** (e.g., `"bash"`, `"read"`, `"edit"`)
2. A **JSON Schema** describing its parameters
3. A **description** (natural language, tells the LLM when/how to use it)
4. An **execute** function that runs the action and returns a result

The LLM doesn't call tools directly. It returns a **tool call** in its response — a structured request saying "I want to call tool X with arguments Y." The harness then executes the tool and feeds the result back.

Key patterns in omp:

**Factory pattern** — Tools aren't classes instantiated directly. They're created by factory functions that receive a `ToolSession` context:

```typescript
// Every tool follows this pattern
function createReadTool(session: ToolSession): AgentTool { ... }
```

**ToolResultBuilder** — A fluent API for constructing results with metadata:

```typescript
return toolResult<ReadToolDetails>({ filePath, lineCount })
  .text(fileContent)
  .truncationFromSummary(summary, { direction: "head" })
  .done();
```

**Streaming vs. non-streaming tools** — Simple tools (read, edit) return a result when done. Streaming tools (bash, python, ssh) emit incremental updates via `onUpdate` callback while running.

### Reading

Read in this order:

1. **`packages/coding-agent/src/tools/index.ts`** — The `BUILTIN_TOOLS` registry. Note how it maps names to factories, and how `createTools()` instantiates them with settings-based filtering.

2. **`packages/coding-agent/src/tools/read.ts`** — A **non-streaming** tool. Study:
   - The JSON Schema definition (input parameters)
   - The `execute()` method structure
   - How `ToolResultBuilder` constructs the response
   - Error handling (file not found, fuzzy matching suggestions)

3. **`packages/coding-agent/src/tools/bash.ts`** — A **streaming** tool. Study:
   - The `onUpdate` callback pattern for real-time progress
   - `TailBuffer` for keeping the last N bytes of output
   - `allocateOutputArtifact()` for spilling large output to disk
   - How the final result captures exit code, truncation info

4. **`packages/coding-agent/src/tools/tool-result.ts`** — The `ToolResultBuilder`. Study the fluent API: `.text()`, `.image()`, `.truncationFromSummary()`, `.sourceUrl()`, `.done()`.

5. **`packages/coding-agent/src/tools/output-utils.ts`** — `TailBuffer` (ring buffer for streaming output) and `allocateOutputArtifact()` (disk spill for large outputs).

### Key Insight

Tools are the **effectors** of the agent. The quality of tool definitions (descriptions, schemas, error messages) directly impacts how well the LLM uses them. A vague description leads to misuse. A good description is like a well-designed API.

### Exercise

Write a tool from scratch (pseudocode or real TypeScript):
- Name: `"word_count"`
- Input: `{ file_path: string }`
- Output: word count, line count, character count
- Include: error handling for missing files, `ToolResultBuilder` usage

### Checkpoint

- [ ] Explain the factory pattern for tool creation
- [ ] Describe the difference between streaming and non-streaming tools
- [ ] Trace the lifecycle of a tool call: LLM returns it -> harness executes -> result fed back
- [ ] Explain what `TailBuffer` does and why it exists

---

## Module 4: The Agent Loop

### Theory

The agent loop is the beating heart of the harness. It implements the cycle:

```
  +---> Prepare context (messages + system prompt)
  |          |
  |          v
  |     Send to LLM (streaming)
  |          |
  |          v
  |     Receive response (text + tool calls)
  |          |
  |          v
  |     Has tool calls?
  |      /        \
  |   Yes          No
  |    |            |
  |    v            v
  |  Execute      Return
  |  tools        (done)
  |    |
  |    v
  |  Append tool results to context
  +----+
```

This is deceptively simple. The complexity lives in:

**Steering** — Mid-turn injection of new instructions. When the user types while the agent is working, the steering message is queued and delivered after the current tool batch completes.

**Follow-up** — Messages delivered after the agent would normally stop (no more tool calls). This extends the agent's work without requiring a new user prompt.

**Tool concurrency** — Tools in a batch can run in parallel (`"shared"` mode) or serially (`"exclusive"` mode). The harness manages this.

**Context transformation** — Before each LLM call, the message array can be modified by extensions (via `transformContext`). This enables features like context injection and message rewriting.

### Reading

1. **`packages/agent/src/agent-loop.ts`** — The core loop. This is the most important file in the entire harness. Study:
   - The main `while` loop structure
   - How tool calls are extracted from the response
   - How tool results are appended to the context
   - How steering messages interrupt the loop
   - The `transformContext` and `convertToLlm` hooks

2. **`packages/agent/src/agent.ts`** — The `Agent` class. Study:
   - `prompt()`, `steer()`, `followUp()` — the three ways to send messages
   - Message queuing (steering queue vs. follow-up queue)
   - Event emission to subscribers
   - State management (`AgentState` with model, tools, system prompt)

3. **`docs/ARCHITECTURE.md`** — Section 4.2 (Prompt-Response Cycle) and Section 5.2 (Agent Loop state diagram)

### Key Insight

The agent loop is a **state machine**, not just a while loop. It transitions between states (waiting for LLM, executing tools, checking for steering, checking for follow-ups) and each transition has specific rules. Understanding these transitions is key to understanding the harness.

### Exercise

Draw the complete state machine of the agent loop, including:
- Normal flow (prompt -> LLM -> tools -> LLM -> done)
- Steering interruption (mid-turn message injection)
- Follow-up continuation (extending past natural stopping point)
- Error recovery (retryable errors, context overflow)

### Checkpoint

- [ ] Explain the difference between steering and follow-up messages
- [ ] Describe what happens when two tools run in `"shared"` mode
- [ ] Trace a complete agent turn: user prompt -> 2 tool calls -> final response
- [ ] Explain what `transformContext` does and when it runs

---

## Module 5: The Harness Core — AgentSession

### Theory

`AgentSession` is the central orchestrator — the thing that makes an agent loop into a full harness. It wraps the `Agent` class (Module 4) and adds everything an agent needs to be useful:

```
  AgentSession wraps Agent and adds:

  +-- Session persistence (JSONL tree storage)
  +-- Model management (cycling, scoped models)
  +-- Extension/hook integration (event interception)
  +-- Context compaction (summarization when context is full)
  +-- TTSR (Time-Traveling Streamed Rules)
  +-- Bash/Python execution (convenience methods)
  +-- Event publishing (to UI, extensions, persistence)
  +-- Auto-retry (rate limits, network errors)
  +-- Auto-compaction (context overflow recovery)
```

Think of `Agent` as a simple engine and `AgentSession` as the full car — engine + transmission + suspension + dashboard.

### How Events Flow

Every event from the agent loop passes through `AgentSession.#handleAgentEvent()`:

```
  Agent emits event
       |
       v
  1. Emit to extensions (emitExtensionEvent)
  2. Emit to all subscribed listeners (UI, persistence)
  3. On message_end: persist to SessionManager
  4. On retryable error: auto-retry with backoff
  5. On context overflow: auto-compact and retry
  6. On text_delta: check TTSR patterns
  7. On tool completion: check todo reminders
```

### Reading

1. **`packages/coding-agent/src/session/agent-session.ts`** — This is ~1,200 lines. Read it in sections:
   - **Constructor** (first 100 lines) — What configuration does it take?
   - **`prompt()` method** — How does it delegate to `Agent.prompt()`?
   - **`#handleAgentEvent()`** — The central event handler. This is the most important method.
   - **`compact()`** — How does compaction integrate?
   - **`branch()` and `navigateTree()`** — Session tree navigation
   - **Model management** — `setModel()`, `cycleModel()`, scoped models

2. **`packages/coding-agent/src/sdk.ts`** — The `createAgentSession()` factory. This ~700-line function wires everything together:
   - Authentication discovery
   - Model resolution (settings -> session -> fallback)
   - Tool creation and registry building
   - Extension and hook loading
   - MCP tool discovery
   - System prompt construction

3. **`docs/ARCHITECTURE.md`** — Section 5.1 (AgentSession class diagram)

### Key Insight

`createAgentSession()` in `sdk.ts` is the **wiring diagram** of the entire harness. It shows how every piece connects. If you understand this function, you understand the harness architecture.

### Exercise

Read `createAgentSession()` and list every subsystem it initializes, in order:
1. Auth storage (SQLite)
2. Model registry
3. Settings
4. Session manager
5. ...continue for all ~20 subsystems

For each, note: what it depends on and what depends on it.

### Checkpoint

- [ ] Explain the difference between `Agent` and `AgentSession`
- [ ] List five things `#handleAgentEvent()` does when it receives an event
- [ ] Describe the complete initialization sequence in `createAgentSession()`
- [ ] Explain why `AgentSession` is called "the central abstraction"

---

## Module 6: Context Management and Compaction

### Theory

LLMs have a finite **context window** — the maximum number of tokens they can process at once (128K-1M tokens typically). As conversations grow, they eventually exceed this limit. The harness must manage this.

**Context usage tracking** — After each LLM response, the usage data (input tokens, output tokens, cache hits) tells us how full the context is.

**Compaction** — When context approaches the limit, older messages are summarized into a shorter form. This loses detail but preserves the essential conversation history.

**The compaction algorithm:**

```
  1. Calculate: Are we within reserveTokens of the window limit?
  2. Find the cut point: Keep the last keepRecentTokens worth of messages
  3. Serialize everything before the cut point into text
  4. Send to LLM: "Summarize this conversation..."
  5. Replace old messages with the summary
  6. Persist the compaction entry to the session tree
```

**File operation tracking** — During compaction, the system extracts which files were read and modified. This context survives compaction so the agent remembers what it was working on.

### Reading

1. **`packages/coding-agent/src/session/compaction/index.ts`** — The compaction entry point. Study:
   - `shouldCompact()` — When to trigger
   - `compact()` — The main algorithm
   - `estimateTokens()` — Heuristic token counting (chars/4)

2. **`packages/coding-agent/src/session/compaction/utils.ts`** — File operation extraction. Study:
   - `extractFileOpsFromMessage()` — Parsing tool calls for file paths
   - `serializeConversation()` — Converting messages to text for summarization

3. **`packages/coding-agent/src/session/agent-session.ts`** — The `compact()` method and auto-compaction trigger in `#handleAgentEvent()`.

4. **`packages/coding-agent/src/prompts/compaction/`** — The prompt templates used for summarization. These are Handlebars `.md` files.

### Key Insight

Compaction is a **lossy compression** of the conversation. The art is in what to preserve and what to discard. omp's approach: keep recent messages verbatim, summarize older ones, and always track file operations (reads/writes) so the agent knows what it was working on.

### Exercise

Design a compaction strategy for a hypothetical agent that:
- Works with databases instead of files
- Needs to remember table schemas and query results
- Has a 128K token window

What would you preserve? What would you summarize? How would you handle the cut point?

### Checkpoint

- [ ] Explain when auto-compaction triggers and what `reserveTokens` means
- [ ] Describe the complete compaction flow from trigger to persisted entry
- [ ] Explain why file operation tracking matters during compaction
- [ ] Calculate: if `keepRecentTokens` is 20,000 and window is 128,000, how many tokens of history get summarized?

---

## Module 7: Session Persistence and Branching

### Theory

An agent session isn't just a conversation — it's a **tree** of conversations. The harness persists this tree as append-only JSONL, enabling:

**Resume** — Pick up where you left off. All messages, tool results, and model changes are preserved.

**Branching** — Try a different approach without losing the current one. Branch from any point in the conversation.

**Time travel** — Navigate between branches, viewing the tree of all paths explored.

**The JSONL tree structure:**

```
  Each line in the JSONL file is an entry:

  {type: "session", version: 3, id, cwd}           <- Header
  {type: "message", id: "A", parentId: null, ...}   <- Root message
  {type: "message", id: "B", parentId: "A", ...}    <- Child of A
  {type: "message", id: "C", parentId: "B", ...}    <- Child of B
  {type: "message", id: "D", parentId: "B", ...}    <- BRANCH from B
  {type: "compaction", id: "E", parentId: "D", ...} <- Compaction on D's branch
  {type: "label", targetId: "B", label: "checkpoint"}<- Named checkpoint

  The tree is implicit: parentId links define the structure.
  Walking from any leaf to root gives you the conversation for that branch.
```

**Append-only** — Entries are never modified or deleted. Branching creates new entries with different parentIds. This makes the format crash-safe and concurrent-read-safe.

### Reading

1. **`packages/coding-agent/src/session/session-manager.ts`** — The `SessionManager` class. Study:
   - `appendMessage()` — How messages are written
   - `buildSessionContext()` — Walking from leaf to root to rebuild the conversation
   - `getTree()` — Building the full tree structure
   - `branch()` — How branching works (just moving the leaf pointer)
   - The entry types: `message`, `compaction`, `model_change`, `thinking_level_change`, `label`, `branch_summary`

2. **`docs/ARCHITECTURE.md`** — Section 4.6 (Session Persistence) and Section 5.5 (Session Tree Structure)

### Key Insight

The append-only JSONL tree is a brilliant design. It's essentially a **git-like data structure** for conversations:
- Each entry has an ID and a parent ID (like git commits)
- Branches are just entries with the same parent (like git branches)
- Walking from leaf to root gives you the current branch (like `git log`)
- Labels are like git tags

### Exercise

Given this JSONL file, draw the tree and answer the questions:

```jsonl
{"type":"session","id":"s1","version":3}
{"type":"message","id":"1","parentId":null,"message":{"role":"user","content":"Add auth"}}
{"type":"message","id":"2","parentId":"1","message":{"role":"assistant","content":"Using JWT..."}}
{"type":"message","id":"3","parentId":"2","message":{"role":"user","content":"Use OAuth instead"}}
{"type":"message","id":"4","parentId":"2","message":{"role":"user","content":"Add tests for JWT"}}
{"type":"message","id":"5","parentId":"4","message":{"role":"assistant","content":"Here are tests..."}}
{"type":"compaction","id":"6","parentId":"5","summary":"User asked for JWT auth, tests added."}
{"type":"message","id":"7","parentId":"6","message":{"role":"user","content":"Now add rate limiting"}}
```

Questions:
1. How many branches exist?
2. If the leaf pointer is at "7", what messages does `buildSessionContext()` return?
3. If you branch from "2", what's the new entry's parentId?

### Checkpoint

- [ ] Explain the append-only JSONL tree structure
- [ ] Describe how `buildSessionContext()` reconstructs a conversation from the tree
- [ ] Explain what happens when the user types `/branch`
- [ ] Compare this design to git's commit graph

---

## Module 8: The Extension System

### Theory

A harness without extensibility is a closed box. omp has a **layered extension system** with three mechanisms at increasing power levels:

```
  Mechanism         Power Level    Use Case
  =========         ===========    ========
  Hooks             Low            Intercept specific events (shell scripts or TS)
  Extensions        Medium         Full lifecycle integration (TypeScript modules)
  Plugins           High           Installable packages (npm modules with tools + extensions)
```

**Hooks** — Simple event handlers. Can block tool calls, modify context, inject messages. Defined as shell scripts or TypeScript files in `.omp/hooks/` or `~/.omp/agent/hooks/`. Think of them as git hooks.

**Extensions** — Full TypeScript modules with access to the `ExtensionContext` API. Can register tools, modify UI, access session state. More powerful than hooks but heavier weight.

**The event interception chain:**

```
  Every tool call flows through:

  LLM returns tool_call
       |
       v
  Extension.emitToolCall()  --- can BLOCK (return {block: true, reason: "..."})
       |
       v
  Hook.emitToolCall()       --- can BLOCK
       |
       v
  Tool.execute()
       |
       v
  Extension.emitToolResult() --- can MODIFY result
       |
       v
  Hook.emitToolResult()      --- can MODIFY result
       |
       v
  Final result back to LLM
```

### Reading

1. **`packages/coding-agent/src/extensibility/hooks/runner.ts`** — `HookRunner`. Study:
   - `emit()` — How events propagate through hooks
   - `emitToolCall()` — Blocking semantics
   - `emitContext()` — Message array transformation (chained)
   - Error isolation — how one failing hook doesn't crash the agent

2. **`packages/coding-agent/src/extensibility/extensions/runner.ts`** — `ExtensionRunner`. Study:
   - The three context levels: `HookContext` < `ExtensionContext` < `ExtensionCommandContext`
   - `emitToolResult()` — Accumulating modifications from multiple extensions
   - Tool registration — how extensions add tools dynamically

3. **`packages/coding-agent/src/extensibility/custom-tools/loader.ts`** — How user-defined tools are loaded via `import()` with dependency injection.

4. **`docs/ARCHITECTURE.md`** — Section 4.3 (Tool Execution Pipeline) and Section 4.5 (Hook and Extension Interception)

### Key Insight

The extension system is designed around **interception points**, not inheritance or composition. Every event passes through a chain of handlers, each of which can observe, modify, or block. This is the **middleware pattern** applied to agent events.

### Exercise

Design a hook that:
- Blocks the `bash` tool if the command contains `rm -rf /`
- Logs all tool calls to a file
- Adds a "Reviewed by security hook" notice to tool results

Write the TypeScript hook file.

### Checkpoint

- [ ] Explain the difference between hooks and extensions
- [ ] Describe the event chain for a tool call (extension -> hook -> execute -> hook -> extension)
- [ ] Explain what "chained modifications" means for `emitContext()`
- [ ] List three things an extension can do that a hook cannot

---

## Module 9: Discovery and Configuration

### Theory

omp supports configuration from **8 different AI coding tools** (Claude, Cursor, Windsurf, Gemini, Codex, Cline, Copilot, VS Code). Each tool stores config in different locations and formats. The **capability discovery system** unifies this.

**Capability** — A type of configuration (e.g., "hook", "tool", "rule", "MCP server"). Defined once with a name, validation function, and deduplication key.

**Provider** — A source of configuration (e.g., "claude" reads from `.claude/` directories). Each provider has a priority. Higher priority providers shadow lower ones.

**Discovery flow:**

```
  loadCapability("hook")
       |
       v
  For each registered provider (in priority order):
    provider.load() --- returns { items: Hook[], warnings: string[] }
       |
       v
  Merge all items
       |
       v
  Deduplicate by capability.key() (first wins = highest priority)
       |
       v
  Validate each item via capability.validate()
       |
       v
  Return { items, all, warnings, providers }
```

### Reading

1. **`packages/coding-agent/src/capability/index.ts`** — The capability registry. Study:
   - `defineCapability()` — How capabilities are declared
   - `registerProvider()` — How providers are added (priority-sorted)
   - `loadCapability()` — The parallel load + deduplicate algorithm

2. **`packages/coding-agent/src/discovery/index.ts`** — Where all providers are imported and registered.

3. **Pick one discovery module** (e.g., `packages/coding-agent/src/discovery/claude.ts`) — See how a specific provider loads config from the filesystem.

4. **`docs/ARCHITECTURE.md`** — Section 5.4 (Capability Discovery System)

### Key Insight

The capability system is a **plugin architecture for configuration sources**. Adding support for a new AI tool (say, "Aider") means writing a new discovery module and registering it. No core code changes needed. This is the **open/closed principle** in action.

### Exercise

Design a discovery provider for a hypothetical AI tool called "Nova" that stores:
- Rules in `.nova/rules/*.md`
- Hooks in `.nova/hooks/*.ts`
- MCP config in `.nova/mcp.json`

Write the provider registration and load function.

### Checkpoint

- [ ] Explain the difference between a "capability" and a "provider"
- [ ] Describe the priority order: `.omp` > `.pi` > `.claude` > `.codex` > `.gemini`
- [ ] Explain how deduplication works (first wins by key)
- [ ] Describe what happens when two providers both define a hook named "security-check"

---

## Module 10: Terminal UI and Modes

### Theory

The harness needs to present its work to the user. omp supports three **modes**:

```
  Mode            Input           Output          Use Case
  ====            =====           ======          ========
  Interactive     TUI (keyboard)  Differential    Normal usage
  Print           stdin/args      stdout          Scripting, CI/CD
  RPC             JSON stdin      JSON stdout     IDE integration
```

**Differential rendering** — The interactive mode doesn't redraw the entire screen. It compares the current render with the previous one and only updates changed lines. This is critical for smooth streaming output.

**Component tree** — The TUI is built from components (containers, editors, markdown renderers, select lists) arranged in a tree. Each component produces `string[]` lines. The root TUI composites them.

**The render pipeline:**

```
  1. requestRender()       --- Debounced, batches rapid updates
  2. component.render()    --- Each component produces string[]
  3. Overlay compositing   --- Merge floating elements (overlays)
  4. Line-by-line diff     --- Compare with previous frame
  5. Synchronized output   --- Write only changed lines to terminal
```

### Reading

1. **`packages/tui/src/tui.ts`** — The `TUI` class. Focus on:
   - `#doRender()` — The differential rendering algorithm
   - How `previousLines[]` stores the last frame for comparison
   - Synchronized output with `ESC[?2026h` / `ESC[?2026l`

2. **`packages/coding-agent/src/modes/interactive-mode.ts`** (first 200 lines) — How the interactive mode sets up components, subscribes to agent events, and manages the input loop.

3. **`packages/coding-agent/src/modes/print-mode.ts`** — The simpler print mode. Compare its event handling to interactive mode.

4. **`docs/ARCHITECTURE.md`** — Section 4.10 (TUI Differential Rendering)

### Key Insight

The three modes share `AgentSession` but differ in how they present events. This separation means the same agent logic works in a terminal, a script, or an IDE. The **mode layer is a view** in MVC terms — it presents the same model differently.

### Exercise

Explain what happens visually when:
1. The LLM starts streaming text (50 `text_delta` events arrive)
2. The LLM makes a bash tool call (streaming output for 5 seconds)
3. The user types while the agent is working (editor updates + agent streaming)

For each scenario, describe which components update and how differential rendering handles it.

### Checkpoint

- [ ] Explain differential rendering and why it matters for streaming
- [ ] Describe the three modes and when each is used
- [ ] Explain how the component tree produces the final terminal output
- [ ] Compare how `message_update` events are handled in interactive vs. print mode

---

## Module 11: Streaming and Output Management

### Theory

Streaming is not just about LLM responses. Tools like `bash`, `python`, and `ssh` can produce unlimited output. The harness needs **output management** to handle this without running out of memory.

**OutputSink** — A memory buffer that spills to disk when output exceeds a threshold (~500KB). Keeps the last N bytes in memory for the LLM, writes full output to an artifact file.

**TailBuffer** — A ring buffer that keeps only the last N bytes. Used for UI preview during streaming. UTF-8 safe (won't split a multi-byte character).

**The streaming tool pattern:**

```
  1. Allocate artifact path  (disk location for full output)
  2. Create TailBuffer       (rolling preview for UI)
  3. Execute with onChunk     (callback for each output chunk)
     - Append to TailBuffer
     - Call onUpdate for UI refresh
  4. Build result with truncation metadata
     - Include OutputSummary (total lines, bytes, whether truncated)
     - Reference artifact ID if output was spilled to disk
```

**Artifact system** — Large outputs are stored as files in `~/.omp/agent/sessions/<session>/artifacts/`. The LLM can later read these artifacts using the `read` tool with `agent://artifact/<id>` URLs.

### Reading

1. **`packages/coding-agent/src/session/streaming-output.ts`** — The `OutputSink` class.
2. **`packages/coding-agent/src/tools/output-utils.ts`** — `TailBuffer` and `allocateOutputArtifact()`.
3. **`packages/coding-agent/src/tools/bash.ts`** — See the complete streaming pattern in action.
4. **`docs/ARCHITECTURE.md`** — Section 5.6 (OutputSink and Streaming Output)

### Checkpoint

- [ ] Explain the OutputSink spill-to-disk mechanism
- [ ] Describe what happens when a bash command produces 10MB of output
- [ ] Explain why TailBuffer needs to be UTF-8 safe
- [ ] Trace the data flow: command output -> TailBuffer -> UI + OutputSink -> ToolResult

---

## Module 12: Subagents and Parallel Execution

### Theory

Complex tasks benefit from **parallel execution**. The harness can spawn **subagents** — independent agent sessions that run concurrently, each with their own context and tools.

**Task spawning:**

```
  Parent agent calls Task tool
       |
       v
  task/executor.ts:runSubprocess()
       |
       v
  Create child AgentSession
  (own tools, own context, shared auth + MCP)
       |
       v
  Child executes independently
       |
       v
  Progress events coalesced (150ms) back to parent
       |
       v
  Child calls submit_result tool
       |
       v
  Result returned to parent as tool result
```

**Depth control** — Subagents can spawn sub-subagents, but `taskDepth` tracks nesting. At max depth, the Task tool is removed to prevent infinite recursion.

**Shared resources** — Subagents share authentication, model registry, and MCP connections with the parent. They do NOT share context or message history.

### Reading

1. **`packages/coding-agent/src/task/executor.ts`** — `runSubprocess()`. Study how child sessions are created and how progress is tracked.
2. **`packages/coding-agent/src/task/agents.ts`** — Built-in agent types (explore, plan, browser, etc.) with tailored prompts and tool sets.
3. **`docs/ARCHITECTURE.md`** — Section 4.8 (Subagent Task Execution)

### Checkpoint

- [ ] Explain how a subagent is created and what it shares with the parent
- [ ] Describe the depth control mechanism
- [ ] Explain why progress events are coalesced at 150ms intervals
- [ ] Compare subagent isolation to thread isolation in traditional programming

---

## Module 13: Advanced Patterns — TTSR, MCP, LSP

### Theory: TTSR (Time-Traveling Streamed Rules)

TTSR is one of omp's most innovative features. Rules that inject themselves into the context **only when triggered** by patterns in the LLM's output.

**The problem:** You want to tell the LLM "don't use lodash" but don't want to waste tokens on this rule in every request. TTSR monitors the output stream for patterns (e.g., `"lodash"`, `"import lodash"`) and, upon match, aborts the current generation, injects the rule into the system prompt, and retries from the same point.

**Zero upfront cost** — TTSR rules consume no context tokens until triggered. Each rule fires at most once per session.

### Theory: MCP (Model Context Protocol)

MCP is a standard for connecting external tools to AI agents. The harness acts as an MCP **client**, connecting to external MCP **servers** that provide additional tools.

**Key mechanics:**
- Servers are configured in `.omp/mcp.json`
- All servers connect in parallel at startup
- 250ms grace period, then use cached definitions
- MCP tools appear alongside built-in tools in the LLM's tool list
- Subagents proxy through parent MCP connections

### Reading

1. **`packages/coding-agent/src/session/agent-session.ts`** — Search for `ttsr` to find the TTSR handling in `#handleAgentEvent()`.
2. **`packages/coding-agent/src/mcp/manager.ts`** — `MCPManager` class.
3. **`packages/coding-agent/src/mcp/tool-bridge.ts`** — How MCP tools are wrapped as native tools.
4. **`docs/ARCHITECTURE.md`** — Section 4.9 (MCP) and the TTSR section in Cross-Cutting Concerns.

### Checkpoint

- [ ] Explain the TTSR trigger-abort-inject-retry cycle
- [ ] Describe why TTSR is "zero cost" until triggered
- [ ] Explain how MCP servers are discovered and connected
- [ ] Describe how MCP tools are bridged into the native tool registry

---

## Module 14: Capstone — Build Your Own Mini-Harness

You now understand all the pieces. Time to build a minimal agent harness from scratch.

### Requirements

Build a CLI tool that:

1. **Talks to an LLM** — Use any provider's API directly (Anthropic recommended for simplicity)
2. **Has two tools** — `read_file` and `write_file`
3. **Implements the agent loop** — prompt -> LLM -> tool calls -> execute -> loop
4. **Streams responses** — Show LLM text as it arrives
5. **Handles context limits** — Basic compaction when context gets large
6. **Persists sessions** — Save/resume conversations as JSONL

### Architecture

```
  your-harness/
    src/
      llm.ts          Module 2: LLM communication (streaming)
      tools.ts         Module 3: Tool definitions and execution
      loop.ts          Module 4: The agent loop
      session.ts       Module 7: JSONL persistence
      compaction.ts    Module 6: Basic summarization
      main.ts          Entry point: wire it all together
```

### Step by Step

1. **Start with `llm.ts`** — Implement streaming LLM communication. Use the Anthropic API directly. Return an async iterator of events.

2. **Add `tools.ts`** — Define `read_file` and `write_file` with JSON schemas. Implement their execute functions.

3. **Build `loop.ts`** — The agent loop. Send messages to LLM, check for tool calls, execute, loop.

4. **Add `session.ts`** — JSONL persistence. Append messages, rebuild context from file.

5. **Add `compaction.ts`** — When context exceeds a threshold, summarize older messages.

6. **Wire it in `main.ts`** — CLI that accepts user input and runs the loop.

### Stretch Goals

- Add a third tool (bash execution with streaming output)
- Add hook support (intercept tool calls)
- Add branching (multiple paths from one point)
- Add a TUI with differential rendering
- Add MCP client support

### Success Criteria

You've completed this curriculum when you can:

- [ ] Explain every layer of the omp architecture from memory
- [ ] Build a working agent harness from scratch
- [ ] Debug issues in the omp codebase by tracing event flow
- [ ] Design extensions that intercept and modify agent behavior
- [ ] Evaluate trade-offs in harness design decisions

---

## Recommended Reading Order (Quick Reference)

For readers who want a linear path through the source code:

```
  Phase 1: Foundation (Modules 1-2)
  ─────────────────────────────────
  CLAUDE.md
  docs/ARCHITECTURE.md (Sections 1-2)
  packages/ai/src/utils/event-stream.ts
  packages/ai/src/stream.ts
  packages/ai/src/providers/anthropic.ts (first 200 lines)

  Phase 2: Core Loop (Modules 3-4)
  ─────────────────────────────────
  packages/coding-agent/src/tools/index.ts
  packages/coding-agent/src/tools/read.ts
  packages/coding-agent/src/tools/bash.ts
  packages/coding-agent/src/tools/tool-result.ts
  packages/agent/src/agent-loop.ts
  packages/agent/src/agent.ts

  Phase 3: The Harness (Modules 5-7)
  ───────────────────────────────────
  packages/coding-agent/src/sdk.ts
  packages/coding-agent/src/session/agent-session.ts
  packages/coding-agent/src/session/compaction/index.ts
  packages/coding-agent/src/session/session-manager.ts

  Phase 4: Extensions (Modules 8-9)
  ──────────────────────────────────
  packages/coding-agent/src/extensibility/hooks/runner.ts
  packages/coding-agent/src/extensibility/extensions/runner.ts
  packages/coding-agent/src/capability/index.ts
  packages/coding-agent/src/discovery/index.ts

  Phase 5: Presentation (Module 10-11)
  ─────────────────────────────────────
  packages/tui/src/tui.ts
  packages/coding-agent/src/modes/interactive-mode.ts (first 200 lines)
  packages/coding-agent/src/modes/print-mode.ts
  packages/coding-agent/src/session/streaming-output.ts
  packages/coding-agent/src/tools/output-utils.ts

  Phase 6: Advanced (Modules 12-13)
  ──────────────────────────────────
  packages/coding-agent/src/task/executor.ts
  packages/coding-agent/src/mcp/manager.ts
  packages/coding-agent/src/system-prompt.ts
```

---

## Glossary

| Term | Definition |
|------|-----------|
| **Agent** | An LLM + tools + a loop that cycles between them |
| **Agent loop** | The core cycle: prompt -> LLM -> tool calls -> execute -> loop |
| **AgentSession** | The central harness object wrapping Agent with persistence, extensions, etc. |
| **Compaction** | Summarizing older messages to fit within the context window |
| **Context window** | Maximum tokens an LLM can process (e.g., 128K, 200K, 1M) |
| **Capability** | A type of discoverable configuration (hook, tool, rule, etc.) |
| **EventStream** | Async iterator wrapping an LLM's streaming response |
| **Extension** | TypeScript module with lifecycle hooks and tool registration |
| **Hook** | Simple event handler that can block/modify tool calls |
| **MCP** | Model Context Protocol — standard for connecting external tools |
| **OutputSink** | Memory buffer that spills large output to disk |
| **Provider** | (1) LLM API provider (Anthropic, OpenAI) or (2) Config source in discovery system |
| **Steering** | Mid-turn message injection that interrupts the current agent turn |
| **TailBuffer** | Ring buffer keeping the last N bytes of streaming output |
| **ToolResultBuilder** | Fluent API for constructing tool results with metadata |
| **TTSR** | Time-Traveling Streamed Rules — pattern-triggered rule injection |
| **JSONL** | Newline-delimited JSON — one JSON object per line |
