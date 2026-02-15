# Agent Harness Enhancements

This document describes eight enhancements to the agent harness -- the infrastructure surrounding the LLM that covers the agent loop, tool execution, context management, MCP connectivity, and subagent orchestration. Each section explains why the enhancement exists, what it adds, how it works, and how to test it.

---

## 1. Mock Stream Utilities & Extended Agent Loop Tests

### Why

Testing the agent loop requires simulating LLM responses and tool execution without real API calls. The previous test infrastructure lacked reusable mock builders for multi-turn conversations with complex scenarios like exclusive tool concurrency, steering interrupts, follow-up messages, and error handling.

### What

**Files:**
- `packages/agent/test/mock-stream.ts` -- Shared mock builder utilities
- `packages/agent/test/agent-loop-extended.test.ts` -- Advanced agent loop tests

**Key additions:**

- `MockAssistantStream` -- Extends `AssistantMessageEventStream` for test control
- `createEchoTool()` -- Creates a testable tool with custom `onExecute` callbacks and configurable concurrency mode
- `createSequentialStreamFn()` -- Returns canned LLM responses in sequence for multi-turn scenarios
- `collectEvents()` -- Filters and queries event streams by discriminated union type
- Factory helpers: `createUsage()`, `createModel()`, `createAssistantMessage()`, `createUserMessage()`, `createContext()`, `createConfig()`, `identityConverter()`

### How

Mock streams use `queueMicrotask()` to delay response delivery, simulating real streaming behavior. Tools support custom `onExecute` callbacks with `AbortSignal` for cancellation testing. The sequential response function consumes responses incrementally, enabling multi-turn test scenarios. Event collectors use discriminated union filtering to extract specific event types from the stream.

### Testing

```bash
bun --cwd=packages/agent test test/agent-loop-extended.test.ts
```

Key test cases:
- **Exclusive tool concurrency** -- Verifies serial execution via `concurrency: "exclusive"`, confirming the second tool waits for the first to complete
- **Mixed shared/exclusive tools** -- Validates that exclusive tools start only after all shared tools finish
- **interruptMode "wait"** -- Defers steering injection until the current turn completes (all tools execute)
- **Follow-up messages** -- Tests `getFollowUpMessages()` continuation after the agent would otherwise stop
- **Error handling** -- Tool execution errors, unknown tool names, abort signal handling
- **Tool result ordering** -- Ensures results emit in declaration order regardless of completion order

---

## 2. Subagent Executor Utility Tests

### Why

Subagent execution requires extensive data normalization, validation, and transformation across diverse input formats (model patterns, output schemas, tool args, usage tokens). This logic was scattered and needed extraction into testable pure functions with comprehensive coverage.

### What

**Files:**
- `packages/coding-agent/src/task/executor.ts` -- Pure utility functions
- `packages/coding-agent/test/executor-utils.test.ts` -- 55 unit tests

**Key functions:**

| Function | Purpose |
|---|---|
| `normalizeModelPatterns()` | Parse comma-separated or array model patterns, trim/filter |
| `extractToolArgsPreview()` | Extract short preview from tool args using priority key order (`command > file_path > path > pattern...`), truncated to 60 chars |
| `getUsageTokens()` | Normalize usage from different event formats, handle `snake_case`/`camelCase` variants |
| `getReportFindingKey()` | Generate unique key from finding metadata for deduplication |
| `parseStringifiedJson()` | Safely parse JSON-like strings, return non-JSON as-is |
| `normalizeOutputSchema()` | Handle JSON string or object schemas, return normalized form + error |
| `withAbortTimeout()` | Wrap promises with timeout + abort signal handling |
| `resolveFallbackCompletion()` | Extract valid JSON output when `submit_result` was not called |
| `buildOutputValidator()` | Create AJV validator from schema |

### How

The functions follow a graceful degradation pattern: missing fields return sensible defaults (0, empty string, `undefined`) rather than throwing. A `firstNumberField()` internal utility selects the first available numeric field from variant keys, handling the `snake_case`/`camelCase` differences across LLM provider response formats. Schema normalization separates validation logic for reuse in different execution contexts.

The `withAbortTimeout()` function pre-checks `signal?.aborted`, sets a timeout with a settled flag to prevent double-rejection, listens to the abort signal, and cleans up listeners on settlement.

### Testing

```bash
bun test packages/coding-agent/test/executor-utils.test.ts
```

55 tests covering:
- `normalizeModelPatterns` -- Empty/undefined inputs, comma-separated strings, arrays, whitespace, trailing commas
- `extractToolArgsPreview` -- Priority key ordering, 60-char truncation, non-string filtering
- `getUsageTokens` -- `totalTokens` vs component summation, `snake_case` variants, partial fields
- `getReportFindingKey` -- Missing required fields (null return), key composition with/without priority
- `parseStringifiedJson` -- Non-JSON preservation, JSON object/array parsing
- `normalizeOutputSchema` -- Undefined/null handling, JSON parsing, direct object passthrough
- `withAbortTimeout` -- Timeout rejection, signal-based rejection, early resolution, pre-aborted signals

---

## 3. Agent Loop Telemetry (TurnMetrics)

### Why

Agent performance observability requires per-turn metrics (latency, tool timing, token usage) for dashboards, monitoring, and debugging slow turns. The agent loop had timing logic but no unified telemetry callback system to surface this data.

### What

**Files:**
- `packages/agent/src/types.ts` -- `TurnMetrics` interface
- `packages/agent/src/agent-loop.ts` -- Metrics collection and emission
- `packages/agent/test/agent-loop-telemetry.test.ts` -- Telemetry tests

**TurnMetrics interface:**

```
TurnMetrics {
   llmLatencyMs       -- LLM response time (end - start)
   toolExecutionMs    -- Total tool execution duration in the turn
   totalTurnMs        -- Full turn wall-clock duration
   toolCallCount      -- Number of tool calls in the turn
   toolTimings        -- Per-tool millisecond breakdown (Record<string, number>)
   contextMessageCount -- Message count at time of LLM call
   usage? {
      input, output, cacheRead, cacheWrite, totalTokens
   }
}
```

**Config addition:** `onTurnMetrics?: (metrics: TurnMetrics) => void` callback in `AgentLoopConfig`.

### How

The agent loop captures `turnStartTime`, `llmStartTime`, and `llmEndTime` timestamps at each phase boundary. Per-tool timings are aggregated from `toolExecution.toolTimings`. Usage data is collected from assistant messages, skipping aborted or error messages. Metrics are emitted at `turn_end` via the callback. When no callback is configured, the emission is silently skipped.

Timing calculations:
- `llmLatencyMs = llmEndTime - llmStartTime`
- `toolExecutionMs = Date.now() - toolsStartTime`
- `totalTurnMs = Date.now() - turnStartTime`

### Testing

```bash
bun --cwd=packages/agent test test/agent-loop-telemetry.test.ts
```

Key test cases:
- **Simple text response** -- `toolCallCount` is 0, latencies >= 0, `contextMessageCount` >= 1
- **Tool timings** -- Tracks first turn with tool calls and second cleanup turn
- **Context message count** -- Verifies accurate counting of existing + new messages
- **Missing callback** -- Agent loop does not fail when `onTurnMetrics` is undefined

---

## 4. TTSR Unit Tests

### Why

Time-Traveling Streamed Rules (TTSR) let the agent inject rules mid-stream when output matches patterns, then retry with the injection. This enables dynamic behavior modification (e.g., when output contains `TODO`, inject a reminder rule). The TTSR manager needed thorough testing of pattern matching, repeat modes, buffer management, and state persistence.

### What

**Files:**
- `packages/coding-agent/src/export/ttsr.ts` -- `TtsrManager` class
- `packages/coding-agent/test/ttsr.test.ts` -- 22 unit tests

**TtsrManager key methods:**

| Method | Purpose |
|---|---|
| `addRule(rule)` | Register rule with regex compilation, skip invalid patterns |
| `check(streamBuffer)` | Test buffer against all patterns, return matching rules |
| `markInjected(rules)` | Record injection at current message count |
| `getInjectedRuleNames()` | Return names of previously injected rules (for persistence) |
| `restoreInjected(names)` | Restore injection state from saved list |
| `appendToBuffer()` / `resetBuffer()` | Manage stream accumulation |
| `incrementMessageCount()` | Advance message counter for repeat-after-gap mode |

**TtsrSettings:**
- `enabled` -- Master toggle (default: true)
- `repeatMode` -- `"once"` or `"repeat-after-gap"` (default: `"once"`)
- `repeatGap` -- Message count gap for re-trigger (default: 10)

### How

Rules registered with a `ttsrTrigger` regex pattern are stored in a `Map<name, TtsrEntry>`. On `check()`, pattern matching tests the accumulated stream buffer against all registered rules. The `canTrigger()` logic determines eligibility:
- In `"once"` mode, a rule never triggers again after its first injection
- In `"repeat-after-gap"` mode, a rule re-triggers after the configured number of messages since its last injection

The buffer resets on each new turn and accumulates text during streaming. Injection tracking persists rule names for session restore via `getInjectedRuleNames()` and `restoreInjected()`.

### Testing

```bash
bun test packages/coding-agent/test/ttsr.test.ts
```

22 tests covering:
- **Rule registration** -- Valid patterns, duplicate names, invalid regex handling, multiple rules
- **Pattern matching** -- Simple strings, regex patterns, alternation (`TODO|FIXME|HACK`), multiple simultaneous matches
- **repeatMode "once"** -- One-time triggering, persistence of injected names
- **repeatMode "repeat-after-gap"** -- Message counter gap threshold, custom gap sizes
- **Buffer management** -- Append/reset operations, stream accumulation
- **State restore** -- `restoreInjected()` for session recovery, unknown rule handling
- **Settings** -- Default values, override application

---

## 5. MCP Connection Resilience

### Why

MCP (Model Context Protocol) servers can fail, hang, or timeout during startup. Without timeout protection and abort signal support, a single unresponsive server could block the entire agent startup. The client and manager needed robust connection handling with parallel startup, per-connection timeouts, and graceful error recovery.

### What

**Files:**
- `packages/coding-agent/src/mcp/client.ts` -- Connection primitives with timeout/abort
- `packages/coding-agent/src/mcp/manager.ts` -- `MCPManager` with parallel connection handling

**Client additions:**

- `withTimeout<T>()` -- Wraps a promise with configurable timeout and abort signal support
- `createTransport()` -- Factory for stdio/HTTP/SSE transports based on server config
- `initializeConnection()` -- MCP initialize request with timeout protection (protocol version `"2025-03-26"`)

**Manager additions:**

- `TrackedPromise<T>` -- Promise wrapper with `status` (`"pending"` | `"fulfilled"` | `"rejected"`), `value`, and `reason` fields
- `trackPromise()` -- Wraps a promise and captures its result or error
- `#pendingConnections` / `#pendingToolLoads` -- Maps tracking in-flight connections and deferred tool loads
- `discoverAndConnect()` -- Loads configs and connects servers in parallel
- `connectServers()` -- Connects multiple servers with collected errors

**Timeout constants:**
- `CONNECTION_TIMEOUT_MS = 30_000` -- Per-connection timeout
- `STARTUP_TIMEOUT_MS = 250` -- Parallel connection startup window

### How

The `withTimeout()` function pre-checks `signal?.aborted` before starting, then races the wrapped promise against a timeout. A `settled` flag prevents double-rejection when both timeout and abort fire. Listeners are cleaned up on settlement.

The manager uses tracked promises to monitor connection state without blocking. `discoverAndConnect()` starts all server connections in parallel, collects errors into a `Map<serverName, errorMessage>`, and returns an `MCPLoadResult` containing connected tools, error details, and server names. This allows the agent to start working with available servers even if some fail.

### Testing

The MCP resilience features are validated through integration with the agent startup flow. Key behaviors to verify:
- Connections that exceed `CONNECTION_TIMEOUT_MS` are rejected with a timeout error
- Abort signals propagate through the connection chain and cancel pending connections
- Failed connections are isolated -- other servers continue to connect
- `MCPLoadResult` accurately reports which servers succeeded and which failed

---

## 6. Swarm Extension Tests

### Why

Swarm coordination requires dependency graph analysis (cycle detection, execution wave computation) and YAML schema validation for multi-agent task definitions. These algorithms needed dedicated tests to validate correctness across graph topologies and schema edge cases.

### What

**Files:**
- `packages/swarm-extension/test/dag.test.ts` -- DAG algorithm tests
- `packages/swarm-extension/test/schema.test.ts` -- YAML schema validation tests

**DAG functions tested:**

| Function | Purpose |
|---|---|
| `buildDependencyGraph(swarmDef)` | Build `Map<agentName, Set<dependencies>>` from `waitsFor`/`reportsTo` relationships |
| `detectCycles(deps)` | DFS-based cycle detection, returns null (acyclic) or names in cycle |
| `buildExecutionWaves(deps)` | Group independent agents into parallel waves for scheduling |

**Schema functions tested:**

| Function | Purpose |
|---|---|
| `parseSwarmYaml(yaml)` | Parse YAML into `SwarmDefinition` with defaults |
| `validateSwarmDefinition(def)` | Validate required fields, name format, agent roles |

### How

**Dependency graph:** `buildDependencyGraph()` handles three dependency sources:
- `waitsFor` -- Explicit forward dependencies
- `reportsTo` -- Reverse dependencies (if A reports to B, then B depends on A)
- Auto-chaining in pipeline/sequential modes (agents chain `a -> b -> c` when no explicit deps exist)

**Cycle detection:** Uses DFS with a visited/in-stack tracking pattern. Handles self-references and subgraph cycles.

**Execution waves:** Groups agents with no unmet dependencies into the same wave, then removes them as satisfied dependencies for the next wave. A diamond pattern (`a -> b,c -> d`) produces three waves: `[a]`, `[b,c]`, `[d]`.

**Schema validation:** Requires top-level `swarm` key, `name` (alphanumeric + hyphens), `workspace`, and non-empty `agents` map. Optional fields include `mode` (`parallel`/`sequential`/`pipeline`, default `"sequential"`), `target_count` (default 1), and `model`. Per-agent fields require `role` and `task`, with optional `extra_context`, `waits_for`, and `reports_to`.

### Testing

```bash
bun test packages/swarm-extension/test/dag.test.ts packages/swarm-extension/test/schema.test.ts
```

**DAG tests:**
- Empty/independent graphs (single wave)
- Linear chains (N waves)
- Diamond graphs (3 waves with parallel middle)
- Cycle detection: 2-node, 3-node, self-reference, subgraph cycles
- Pipeline auto-chaining disabled when explicit deps exist
- Unknown agent reference handling

**Schema tests:**
- Minimal YAML (defaults applied)
- Full YAML with all fields
- Missing required fields (swarm key, name, workspace, agents)
- Invalid name format (spaces, special chars)
- Empty agents map, invalid mode values
- Missing agent role/task, relationship parsing

---

## 7. Compaction Quality Metrics

### Why

Long-running sessions accumulate conversation histories that exceed LLM context windows. Compaction needs to track which files were accessed (for context preservation), estimate token usage, detect compaction triggers, and determine safe cut points in message history. Without quality metrics, compaction operates blindly and may discard critical context.

### What

**Files:**
- `packages/coding-agent/src/session/compaction/compaction.ts` -- Compaction logic with metrics

**Key types:**

```
CompactionDetails { readFiles, modifiedFiles }
CompactionResult  { summary, shortSummary?, firstKeptEntryId, tokensBefore, details?, preserveData? }
CompactionSettings { enabled, reserveTokens (16384), keepRecentTokens (20000), autoContinue?, remoteEndpoint? }
```

**Key functions:**

| Function | Purpose |
|---|---|
| `calculateContextTokens(usage)` | `totalTokens` or sum of `input+output+cacheRead+cacheWrite` |
| `calculatePromptTokens(usage)` | `input+cacheRead+cacheWrite` or fallback to total |
| `getAssistantUsage(msg)` | Extract usage from non-aborted assistant messages |
| `getLastAssistantUsage(entries)` | Find last valid usage from session entries |
| `shouldCompact(contextTokens, window, settings)` | Trigger when `contextTokens > (window - reserveTokens)` |
| `estimateTokens(message)` | Conservative `chars/4` heuristic across message types |
| `extractFileOperations(messages, entries, prevIndex)` | Collect read/modified file sets from tool calls, chain from previous compaction |

### How

Token estimation uses a conservative `chars/4` heuristic that intentionally overestimates. User messages sum text blocks; assistant messages sum text, thinking, and tool call JSON; hook messages and tool results are processed similarly.

The compaction workflow:
1. Calculate total context tokens from the last assistant usage
2. Check `shouldCompact()` -- triggers when tokens exceed `(contextWindow - reserveTokens)`
3. Extract file operations from messages and tool calls
4. Determine a safe cut point in message history (preserving recent context per `keepRecentTokens`)
5. Summarize the truncated portion
6. Return `CompactionResult` with file metadata for the next compaction cycle to chain from

File operation tracking chains across compactions: each compaction inherits the file sets from the previous one and adds any new reads/modifications since the last cut point.

### Testing

```bash
bun test packages/coding-agent/test/compaction.test.ts
```

19+ tests covering:
- Token estimation accuracy for different message types
- `shouldCompact()` trigger threshold
- Cut point determination with `keepRecentTokens`
- Session context building and file operation extraction
- Chaining file operations across multiple compactions

---

## 8. Extended Streaming Edit Abort Tests

### Why

Streaming tool calls (especially the edit tool with large diffs) can take a long time to stream. If the user aborts mid-stream, partial tool call data must be captured for error reporting and debugging. The abort handling path needed dedicated tests to validate that partial state is preserved correctly.

### What

**Files:**
- `packages/coding-agent/test/streaming-edit-abort.test.ts` -- 5 integration tests

**Test infrastructure:**

| Component | Purpose |
|---|---|
| `createSession()` | Build `AgentSession` with mock streams, in-memory `SessionManager`, and `edit.streamingAbort: true` |
| `buildEditTool()` | Create edit tool with `path`/`diff`/`op`/`rename` schema |
| `createStreamForDiff()` | Produce streaming edit tool calls with random chunking |
| `createRng(seed)` | Deterministic RNG for reproducible test behavior |
| `chunkStringRandomly(text, seed)` | Split text into random-sized pieces (1-8 chars) |

### How

The streaming abort flow works as follows:

1. A stream initiates and captures the `AbortSignal` from options
2. Diff text is chunked randomly and emitted as `toolcall_delta` events
3. An abort is triggered externally (simulating user cancellation)
4. The accumulated `diffSoFar` captures the partial diff at the point of interruption
5. A partial tool call is emitted in an error event with `reason: "aborted"`
6. The session captures the partial state for debugging and error reporting

Deterministic chunking via `createRng(seed)` ensures tests are reproducible. The `chunkStringRandomly()` function splits text into 1-8 character pieces controlled by the seeded RNG, simulating realistic streaming behavior.

### Testing

```bash
bun test packages/coding-agent/test/streaming-edit-abort.test.ts
```

5 tests covering:
- Successful patch streaming and application
- Failing patch handling
- Missing file scenarios
- Multi-line diff streaming
- Abort during streaming with partial state capture

**Windows note:** The `afterEach` cleanup may report `EBUSY: resource busy or locked` errors on Windows due to lingering SQLite file handles. Tests still pass; these are cleanup warnings only.
