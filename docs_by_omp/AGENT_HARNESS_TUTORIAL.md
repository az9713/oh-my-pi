# Agent Harness Development Tutorial

A comprehensive guide to understanding and developing the agent harness infrastructure in oh-my-pi.

## Table of Contents

1. [What is Agent Harness?](#what-is-agent-harness)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [Key Abstractions](#key-abstractions)
5. [Agent Loop](#agent-loop)
6. [Session Management](#session-management)
7. [Event System](#event-system)
8. [Tool Execution](#tool-execution)
9. [Extensions & Hooks](#extensions--hooks)
10. [Subagent Execution](#subagent-execution)
11. [MCP Integration](#mcp-integration)
12. [Context Compaction](#context-compaction)
13. [Development Patterns](#development-patterns)
14. [Testing](#testing)

---

## What is Agent Harness?

The **agent harness** is the infrastructure surrounding the LLM that covers:

- **Agent loop**: Prompt → LLM → Tool calls → Results → Repeat
- **Tool execution**: How tools are discovered, invoked, and results reported back
- **Context management**: Message history, compaction, branching, persistence
- **Event system**: Streaming responses, UI updates, extension hooks
- **MCP connectivity**: Model Context Protocol server integration
- **Subagent orchestration**: Spawning independent agents for parallel work
- **Session persistence**: Append-only JSONL storage with tree navigation

It is **mode-agnostic**: the same harness powers interactive TUI, batch print mode, and RPC servers.

---

## Architecture Overview

### Layered Design

The codebase is organized in strict dependency layers:

```
┌─────────────────────────────────────────────────────────┐
│                    CLI LAYER                             │
│         cli.ts → main.ts (command routing)               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   MODE LAYER                             │
│  InteractiveMode / PrintMode / RpcServer (I/O adapters)  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  CORE LAYER                              │
│  AgentSession (central abstraction)                      │
│  SessionManager (persistence)                            │
│  SDK (factory & discovery)                               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 AGENT LAYER                              │
│  Agent (pi-agent-core)                                   │
│  agentLoop (turn management)                             │
│  streamSimple (LLM streaming)                            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│             EXTENSION LAYER                              │
│  Hooks / Extensions / Custom tools / Skills / Commands   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         INTEGRATION LAYER                                │
│  Web / LSP / SSH / MCP / Task / Python kernel            │
└─────────────────────────────────────────────────────────┘
```

### Package Structure

| Package | Purpose | Key Classes |
|---------|---------|-------------|
| `pi-utils` | Shared utilities | `logger`, `Stream`, `isEnoent()` |
| `pi-natives` | Rust N-API bridge | `grep()`, `Shell`, `visibleWidth()` |
| `pi-tui` | Terminal UI | `TUI`, `Editor`, differential rendering |
| `pi-ai` | Multi-provider LLM | `stream()`, provider implementations |
| `pi-agent-core` | Agent runtime | `Agent`, `agentLoop()` |
| `pi-coding-agent` | **Main CLI app** | `AgentSession`, modes, tools, discovery |

---

## Core Components

### 1. AgentSession (`packages/coding-agent/src/session/agent-session.ts`)

The central abstraction shared by all modes.

```typescript
export class AgentSession {
  // Core access
  readonly agent: Agent;
  readonly sessionManager: SessionManager;
  readonly settings: Settings;

  // Prompting
  prompt(text: string | PromptOptions): Promise<void>
  continue(): Promise<void>

  // Model & thinking
  setModel(model: Model): void
  setThinkingLevel(level: ThinkingLevel): void
  cycleModel(): ModelCycleResult

  // Session control
  branch(label?: string): Promise<void>
  navigateTree(nodeId: string): Promise<void>
  compact(options?: CompactOptions): Promise<void>

  // Event subscription
  subscribe(listener: AgentSessionEventListener): () => void
  on(eventType: string, listener: Function): void
}
```

**Responsibilities:**
- Wraps the core `Agent` from pi-agent-core
- Manages session persistence via `SessionManager`
- Emits events for UI consumption
- Implements compaction, branching, navigation
- Handles bash/Python execution
- Coordinates extensions and hooks

### 2. Agent (`packages/agent/src/agent.ts`)

The core LLM agent from pi-agent-core.

```typescript
export class Agent {
  prompt(...prompts: AgentMessage[]): EventStream<AgentEvent, AgentMessage[]>
  continue(): EventStream<AgentEvent, AgentMessage[]>

  state: AgentState  // current system prompt, model, tools, messages
  
  setSystemPrompt(prompt: string): void
  setModel(model: Model): void
  setTools(tools: AgentTool[]): void
  appendMessage(msg: AgentMessage): void
  
  subscribe(listener: (event: AgentEvent) => void): () => void
}
```

**Responsibilities:**
- Manages message history
- Implements agent loop (turn-based execution)
- Calls LLM and processes streaming responses
- Executes tools and handles results
- Emits granular events for each phase

### 3. SessionManager (`packages/coding-agent/src/session/session-manager.ts`)

Append-only JSONL persistence with tree navigation.

```typescript
export class SessionManager {
  // Building session context
  buildSessionContext(leafId?: string): SessionContext
  getTree(): SessionTreeNode

  // Appending entries
  appendMessage(msg: AgentMessage): Promise<void>
  appendModelChange(model: string): Promise<void>
  appendCompaction(summary: string, ...): Promise<void>

  // Navigation
  switchLeaf(entryId: string): Promise<void>
  navigateToAncestor(steps: number): Promise<void>

  // Reading
  getLatestSession(): SessionInfo | undefined
  read(leafId?: string | null): SessionEntry[]
}
```

**Responsibilities:**
- Stores messages as append-only JSONL
- Maintains tree structure with parent pointers
- Supports branching and navigation
- Loads/saves to disk atomically

---

## Key Abstractions

### AgentMessage vs Message

The codebase distinguishes two message types:

**`AgentMessage`** (pi-agent-core): Flexible, can include custom types
```typescript
type AgentMessage =
  | { role: "user" | "assistant"; content: string; timestamp: number }
  | { role: "toolResult"; content: string; toolUseId: string }
  | CustomMessage  // Extensions can add their own types
```

**`Message`** (pi-ai): LLM-compatible only
```typescript
type Message =
  | { role: "user"; content: string | ContentBlock[] }
  | { role: "assistant"; content: string | AssistantContent[] }
  | { role: "toolResult"; content: string; toolUseId: string }
```

**Conversion flow:**
```
AgentMessage[] 
  → transformContext() [optional pruning/injection]
  → convertToLlm() [filter custom types]
  → Message[]
  → streamSimple() [call LLM]
```

### Tool Execution

Tools are defined as `AgentTool<P>`:

```typescript
interface AgentTool<P = Record<string, unknown>> {
  name: string
  description: string
  parameters: Schema  // JSON Schema defining P
  
  execute(
    toolCallId: string,
    params: P,
    signal: AbortSignal,
    onUpdate?: (result: Partial<AgentToolResult>) => void,
    context?: unknown
  ): Promise<AgentToolResult>
}
```

**Flow:**
1. LLM emits `toolcall_delta` events with function name and JSON args
2. Agent validates arguments against schema
3. If validation fails, error returned to LLM
4. Otherwise, `tool.execute()` is called
5. Results accumulate as `ToolResultMessage` in context
6. Loop continues until no more tool calls

### Event System

Events flow through the system as discriminated unions:

```typescript
type AgentEvent =
  | { type: "agent_start" }
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; assistantMessageEvent: AssistantMessageEvent }
  | { type: "message_end"; message: AgentMessage }
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool_execution_update"; toolCallId: string; partialResult: AgentToolResult }
  | { type: "tool_execution_end"; toolCallId: string; result: AgentToolResult }
  | { type: "turn_end"; message: AgentMessage; toolResults: AgentToolResult[] }
  | { type: "agent_end"; messages: AgentMessage[] }
```

**Event propagation:**
```
LLM Provider
  ↓ (event stream)
Agent (buffers & emits)
  ↓
AgentSession (emits with auto-persistence)
  ↓
Mode Layer (UI rendering)
```

---

## Agent Loop

The agent loop is the heart of the harness. Located in `packages/agent/src/agent-loop.ts`.

### Turn Structure

Each turn executes these phases:

```
1. USER INPUT
   - Messages added to context

2. SYSTEM PROMPT BUILDING
   - Construct full prompt with system message + context

3. LLM CALL
   - stream(model, context, tools)
   - Collect text and tool calls

4. TOOL EXECUTION (if tool calls exist)
   - For each tool call:
     a. Validate arguments
     b. Execute tool
     c. Accumulate result message
   - Return to step 2 (continue loop)

5. DONE
   - No more tool calls
   - Emit final assistant message
```

### Message Transformations

Before each LLM call, messages are transformed:

```typescript
// 1. Optional pruning/injection
const transformed = config.transformContext(messages, signal)

// 2. Convert to LLM format
const llmMessages = config.convertToLlm(transformed)

// 3. Call LLM
const response = stream(model, llmMessages, { tools, ... })
```

### Tool Concurrency

By default, multiple tool calls execute in parallel. Override with:

```typescript
tool.concurrency = "exclusive"  // Execute serially with other exclusive tools
```

### Telemetry

Timing is captured for observability:

```typescript
interface TurnMetrics {
  llmLatencyMs: number        // LLM response time
  toolExecutionMs: number     // Total tool execution time this turn
  totalTurnMs: number         // Full turn duration
  toolCallCount: number       // Number of tool calls
  toolTimings: Record<string, number>  // Per-tool breakdown
  contextMessageCount: number // Message count at LLM call
  usage?: Usage               // Token usage if provided
}
```

Emit via callback:
```typescript
config.onTurnMetrics = (metrics) => {
  console.log(`Turn took ${metrics.totalTurnMs}ms`)
}
```

---

## Session Management

### JSONL Structure

Sessions are stored as append-only JSONL:

```
Line 1: {"type":"session","version":3,"id":"uuid","cwd":"..."}
Line 2: {"type":"message","id":"A","parentId":null,"message":{role:"user",...}}
Line 3: {"type":"message","id":"B","parentId":"A","message":{role:"assistant",...}}
Line 4: {"type":"message","id":"C","parentId":"B","message":{role:"user",...}}
Line 5: {"type":"message","id":"D","parentId":"B","message":{role:"assistant",...}}
Line 6: {"type":"compaction","id":"E","parentId":"D",...}
```

**Entry types:**
- `message` — `AgentMessage` with tree pointers
- `model_change` — Model switched
- `thinking_level_change` — Thinking level updated
- `compaction` — Summarized older messages
- `branch_summary` — Summary when rejoining after branch
- `custom_message` — Application-defined message (e.g. bash execution)
- `custom` — Arbitrary extension data
- `label` — User bookmark on an entry
- `ttsr_injection` — Which time-traveling rules were injected

### Tree Structure

Sessions form a tree with branching:

```
       A (root)
       |
       B (user prompt)
      / \
     C   D  ← Branch point (two different assistant responses)
     |   |
    ...  E (compaction of D's path)
         |
         F (continue after compaction)
```

Navigation:
```typescript
session.navigateTree("D")      // Switch to D's branch
session.branch("my-branch")    // Label the current leaf
const tree = sessionManager.getTree()  // Full tree structure
```

### Building Context

When reading a session, reconstruct the conversation from disk:

```typescript
// All entries on the path from root to leafId
const entries = sessionManager.read(leafId)

// Convert entries back to AgentMessage[]
const context = buildSessionContext(entries)
// context = { messages: [...], model: "...", thinkingLevel: "...", ... }
```

---

## Event System

### Subscription Model

Subscribe to agent events:

```typescript
const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update") {
    // Stream new text
    const delta = event.assistantMessageEvent.delta
    process.stdout.write(delta)
  }
  if (event.type === "message_end") {
    // Complete message received
    console.log("Done:", event.message)
  }
})

unsubscribe()  // Stop listening
```

### Event Listener Types

Define custom listeners:

```typescript
export type AgentSessionEventListener = (event: AgentSessionEvent) => void

export type AgentSessionEvent = 
  | AgentEvent  // Core agent events
  | { type: "auto_compaction_start"; reason: "threshold" | "overflow" }
  | { type: "auto_compaction_end"; success: boolean; result?: CompactionResult }
  | { type: "session_branch"; label: string }
  // ... more session-specific events
```

### TTSR (Time-Traveling Streamed Rules)

Rules can be injected mid-stream when output matches patterns:

```typescript
export interface TtsrRule {
  name: string
  ttsrTrigger: RegExp   // Pattern to match in output
  text: string          // Rule text to inject
  repeatMode?: "once" | "repeat-after-gap"
  repeatGap?: number    // Messages between re-triggers
}

const rules: TtsrRule[] = [
  {
    name: "todo-reminder",
    ttsrTrigger: /TODO|FIXME/i,
    text: "When you see TODO, pause and ask the user for clarification.",
    repeatMode: "once"
  }
]

ttsrManager.addRule(rule)
const matches = ttsrManager.check(streamBuffer)
if (matches.length > 0) {
  // Inject matched rules and retry
  agent.prompt("Retry with rule injection")
}
```

---

## Tool Execution

### Tool Discovery

Tools come from multiple sources:

```typescript
// Built-in tools (read, write, bash, etc)
const builtInTools = createTools(config)

// Custom tools from extensions
const customTools = extensionRunner.discoverTools()

// MCP tools from servers
const mcpTools = mcpManager.listTools()

const allTools = [...builtInTools, ...customTools, ...mcpTools]
```

### Tool Result Capture

Tools return structured results:

```typescript
interface AgentToolResult {
  content: ContentBlock[]  // Text or images returned to LLM
  details?: Record<string, unknown>  // Metadata for UI display
  isError?: boolean       // Error flag
}
```

Example:
```typescript
const readFileTool: AgentTool = {
  name: "read",
  description: "Read file contents",
  parameters: Type.Object({ path: Type.String() }),
  
  execute: async (id, params, signal, onUpdate) => {
    const content = await fs.readFile(params.path, "utf-8")
    return {
      content: [{ type: "text", text: content }],
      details: { path: params.path, size: content.length }
    }
  }
}
```

### Streaming Tool Results

Long-running tools can stream results:

```typescript
const tool: AgentTool = {
  name: "long_task",
  execute: async (id, params, signal, onUpdate) => {
    for (let i = 0; i < 10; i++) {
      onUpdate?.({
        content: [{ type: "text", text: `Step ${i}...\n` }]
      })
      await Bun.sleep(1000)
    }
    return { content: [{ type: "text", text: "Done!" }] }
  }
}
```

---

## Extensions & Hooks

### Hook System

Hooks intercept events at key points. Located in `extensibility/hooks/`:

```typescript
export interface HookContext {
  emitBeforeAgentStart(): Promise<void>
  emitInput(text: string): Promise<string>  // Transform input
  emitContext(messages: AgentMessage[]): Promise<AgentMessage[]>
  emitToolCall(event: ToolCallEvent): Promise<{ block?: boolean; reason?: string }>
  emitToolResult(event: ToolResultEvent): Promise<ModifiedToolResult>
}
```

Usage:
```typescript
hookRunner.emitToolCall({
  toolCallId: "123",
  toolName: "bash",
  args: { command: "rm -rf /" }
})
// → hook can block with reason: "destructive command"
```

### Extension System

Extensions are stateful plugins. Located in `extensibility/extensions/`:

```typescript
export interface Extension {
  name: string

  emitBeforeAgentStart?(event): Promise<void>
  emitInput?(text: string): Promise<{ text?: string; handled?: boolean }>
  emitContext?(messages: AgentMessage[]): Promise<AgentMessage[]>
  emitToolCall?(event: ToolCallEvent): Promise<{ block?: boolean; reason?: string }>
  emitToolResult?(event: ToolResultEvent): Promise<ModifiedToolResult>
  
  // Lifecycle
  onSessionStart?(): Promise<void>
  onSessionEnd?(): Promise<void>
}
```

Registration:
```typescript
const ext: Extension = {
  name: "my-extension",
  emitContext: (messages) => {
    // Inject custom instructions
    return [
      ...messages,
      { role: "custom", text: "Additional context..." }
    ]
  }
}

extensionRunner.register(ext)
```

### Custom Commands & Slash Commands

User-defined commands:

```typescript
// Slash command: /analyze
const cmd = {
  name: "analyze",
  description: "Analyze code",
  execute: async (args, session) => {
    const result = await session.prompt(`Analyze this: ${args}`)
    return result
  }
}

session.registerCommand(cmd)
```

---

## Subagent Execution

### Task Tool

The `task` tool spawns independent sub-agents:

```typescript
// Parent agent calls task tool with assignment
const result = await agentSession.prompt({
  tool: "task",
  params: {
    agent: "builder",  // Built-in agent type
    context: "...",    // Shared background
    tasks: [
      {
        id: "task1",
        description: "Implement foo",
        assignment: "..."
      }
    ]
  }
})
```

### Executor Pipeline

Subagent execution flow:

```
Parent Agent
    ↓
Task Tool (packages/coding-agent/src/tools/task.ts)
    ↓
Executor (packages/coding-agent/src/task/executor.ts)
    ├─ Validate model patterns
    ├─ Normalize tool args
    ├─ Create isolated session
    ├─ Spawn child process
    ├─ Collect progress events
    └─ Parse structured output
    ↓
Child Agent (independent LLM loop)
    ├─ Read, write, edit, bash...
    └─ submit_result (structured output)
    ↓
Parent's Tool Result
```

### Agent Types

Built-in subagent types:

```typescript
const agentTypes = {
  explore:  { tools: [read, find, grep], systemPrompt: "Scout codebase" },
  plan:     { tools: [read, grep], systemPrompt: "Create architecture plan" },
  builder:  { tools: [...all tools...], systemPrompt: "Write implementation" },
  reviewer: { tools: [read, grep], systemPrompt: "Review code" },
  task:     { tools: [...all tools...], systemPrompt: "Generic worker" },
}
```

### Output Validation

Structured output from subagents:

```typescript
// Task tool receives schema in assignment
interface OutputSchema {
  properties: {
    findings: { type: "array"; items: { type: "object" } }
    summary: { type: "string" }
  }
}

// Executor validates against schema
const result = JSON.parse(agentOutput)
const valid = validateAgainstSchema(result, outputSchema)
if (!valid) {
  throw new Error("Invalid output structure")
}
```

---

## MCP Integration

### MCP Manager

Manages Model Context Protocol servers. Located in `packages/coding-agent/src/mcp/`:

```typescript
export class MCPManager {
  // Lifecycle
  async discoverAndConnect(): Promise<MCPLoadResult>
  async disconnect(): Promise<void>

  // Tool access
  listTools(): AgentTool[]
  callTool(name: string, args: unknown): Promise<AgentToolResult>
}
```

### Connection Resilience

Robust handling of unreliable servers:

```typescript
// Constants
CONNECTION_TIMEOUT_MS = 30_000   // Per-server timeout
STARTUP_TIMEOUT_MS = 250         // Parallel startup grace period

// Flow
1. Read ~/.omp/mcp.json configs
2. Start all servers in parallel
3. Wait 250ms for connections
4. Collect errors for failed servers
5. Return tools from successful servers
```

### Transport Types

Supported protocols:

```typescript
type MCPTransport = 
  | { type: "stdio"; command: string; args: string[] }
  | { type: "http"; url: string }
  | { type: "sse"; url: string }
```

### Tool Bridging

MCP tools are wrapped as `AgentTool`:

```typescript
const mcpTool = {
  name: "sse-example",
  description: "...",
  parameters: mcpSchema.parameters,  // From MCP schema
  
  execute: async (id, params, signal) => {
    const result = await mcpManager.callTool("sse-example", params)
    return result
  }
}
```

---

## Context Compaction

### When to Compact?

Compaction triggers when context approaches the window limit:

```typescript
const contextTokens = calculateContextTokens(lastAssistantUsage)
const windowSize = model.contextWindow
const shouldCompact = contextTokens > (windowSize - reserveTokens)
```

### Compaction Flow

```
1. MEASURE
   - Calculate current context tokens
   - Check if compaction threshold exceeded

2. SELECT
   - Determine which messages to summarize
   - Keep recent messages per keepRecentTokens
   - Find safe cut point (turn boundary)

3. SUMMARIZE
   - Send selected messages to LLM
   - Request concise summary

4. PERSIST
   - Write CompactionEntry to JSONL
   - Record firstKeptEntryId (where to resume)
   - Store file operations (read/modified sets)

5. REBUILD
   - Load: [system prompt] + [summary] + [recent messages]
   - Continue agent loop
```

### File Operation Tracking

Compaction tracks which files were accessed:

```typescript
interface CompactionDetails {
  readFiles: string[]      // Files read during compacted period
  modifiedFiles: string[]  // Files written/edited during compacted period
}

// Chained across multiple compactions
const prevCompaction = getLatestCompactionEntry(entries)
const newReadFiles = [...prevCompaction.readFiles, ...currentReads]
```

### Settings

```typescript
interface CompactionSettings {
  enabled: boolean              // Master toggle
  reserveTokens: number         // Tokens to keep free (default: 16384)
  keepRecentTokens: number      // Recent messages to preserve (default: 20000)
  autoContinue?: boolean        // Auto-resume after compaction
  remoteEndpoint?: string       // Optional proxy endpoint
}
```

---

## Development Patterns

### Creating a New Tool

```typescript
// 1. Define the tool
const myTool: AgentTool = {
  name: "my_tool",
  description: "What it does",
  parameters: Type.Object({
    input: Type.String({ description: "Input parameter" })
  }),
  
  execute: async (toolCallId, params, signal, onUpdate, context) => {
    // Validate input
    if (!params.input) {
      throw new Error("input is required")
    }

    // Do work
    const result = process(params.input)

    // Optional: stream progress
    onUpdate?.({
      content: [{ type: "text", text: "Progress..." }],
      details: { step: 1 }
    })

    // Return result
    return {
      content: [{ type: "text", text: result }],
      details: { processed: true }
    }
  }
}

// 2. Register the tool
session.agent.setTools([...existingTools, myTool])
```

### Creating a Hook

```typescript
// 1. Implement hook interface
const myHook: HookContext = {
  emitToolCall: async (event) => {
    if (event.toolName === "bash" && isSuspicious(event.args)) {
      return {
        block: true,
        reason: "Suspicious bash command"
      }
    }
    // Allow execution
    return {}
  }
}

// 2. Register
hookRunner.register(myHook)
```

### Creating an Extension

```typescript
// 1. Extend Extension interface
declare global {
  namespace Extensions {
    interface MyExtension {
      myData: string
    }
  }
}

// 2. Implement extension
const ext: Extension = {
  name: "my-extension",
  
  onSessionStart: async () => {
    logger.info("Session started")
  },
  
  emitContext: async (messages) => {
    // Modify context before each LLM call
    return messages
  },
  
  onSessionEnd: async () => {
    logger.info("Session ended")
  }
}

// 3. Register
extensionRunner.register(ext)
```

### Error Handling

Errors from tools are reported back to the LLM:

```typescript
execute: async (id, params, signal) => {
  try {
    const result = await doWork(params)
    return { content: [{ type: "text", text: result }] }
  } catch (err) {
    // Throw — agent catches and reports as error
    throw new Error(`Failed: ${err.message}`)
  }
}

// LLM receives:
// {
//   type: "toolResult",
//   toolUseId: "123",
//   content: "Failed: reason",
//   isError: true
// }
```

---

## Testing

### Testing Patterns

#### 1. Mock Streams

Test the agent loop with fake LLM responses:

```typescript
import { createSequentialStreamFn, collectEvents } from "./mock-stream"

test("multi-turn conversation", async () => {
  // Setup mock responses
  const streamFn = createSequentialStreamFn([
    createAssistantMessage("First response"),
    createAssistantMessage("Second response", [
      { toolUseId: "1", name: "bash", input: { command: "echo test" } }
    ])
  ])

  const context = createContext()
  const config = createConfig({ streamFn })

  // Run loop
  const stream = agentLoop([{ role: "user", content: "Hello" }], context, config)

  // Collect and assert
  const events = await collectEvents(stream)
  expect(events.filter(e => e.type === "message_end")).toHaveLength(3)
})
```

#### 2. Tool Testing

```typescript
test("bash tool execution", async () => {
  const tool = createBashTool()
  
  const result = await tool.execute(
    "toolId",
    { command: "echo hello" },
    new AbortController().signal
  )

  expect(result.content[0].text).toContain("hello")
})
```

#### 3. Session Testing

```typescript
test("session persistence", async () => {
  const session = await createSession()
  
  await session.prompt("Hello")
  const context = await sessionManager.buildSessionContext()
  
  expect(context.messages).toHaveLength(2)  // user + assistant
  
  // Verify persistence
  const loaded = sessionManager.read()
  expect(loaded).toHaveLength(3)  // header + 2 messages
})
```

#### 4. Compaction Testing

```typescript
test("compaction triggers and preserves context", async () => {
  // Mock high token usage
  const usage = { totalTokens: 90000, ... }
  
  const shouldCompact = shouldCompact(
    usage.totalTokens,
    contextWindow,
    { enabled: true, reserveTokens: 16384 }
  )

  expect(shouldCompact).toBe(true)
})
```

### Test Utilities

Key testing utilities in `packages/coding-agent/test/`:

- `mock-stream.ts` — Fake LLM responses
- `agent-loop-extended.test.ts` — Multi-turn scenarios
- `executor-utils.test.ts` — Subagent data normalization
- `ttsr.test.ts` — Rule injection
- `compaction.test.ts` — Context summarization
- `streaming-edit-abort.test.ts` — Tool abort handling

### Running Tests

```bash
# All tests
bun test

# Specific package
bun --cwd=packages/agent test

# Specific file
bun test packages/coding-agent/test/agent-session.test.ts

# With watch
bun test --watch
```

---

## Summary

The agent harness consists of:

1. **Agent Loop** — Turns, message transformation, LLM calls, tool execution
2. **Session Management** — JSONL persistence, tree navigation, branching
3. **Event System** — Streaming updates, hook/extension interception
4. **Tool Ecosystem** — Discovery, execution, result handling, MCP integration
5. **Context Management** — Compaction, branching, file tracking
6. **Extensibility** — Hooks, extensions, custom tools, subagents

All components work together to provide a flexible, composable foundation for agentic AI applications.

---

## Joke

Why did the agent loop break up with the context window?

Because their relationship had too much baggage—and the context manager couldn't fit any more messages in!

