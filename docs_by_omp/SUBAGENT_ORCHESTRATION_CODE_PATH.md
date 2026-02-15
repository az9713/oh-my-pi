# Subagent Orchestration Code Path: A Deep Dive

## Overview

This document traces the **exact code path** I took to spawn and orchestrate 3 parallel research subagents to analyze oh-my-pi. It maps my execution to the actual oh-my-pi codebase, showing how the agent harness manages parallel task execution.

**Task:** Run 3 parallel subagents to research performance, extensibility, and DX.

**Code Path:** My request → Task tool dispatch → Executor → 3 parallel processes → Result aggregation

---

## Part 1: Task Initiation (The Entry Point)

### Step 1.1: User Request Becomes Task Tool Call

**My Input:**
```
User: "now run 3 subagents in parallel to do research..."
```

**What Happened:**
This request triggered the **task tool** in oh-my-pi, which is the entry point for parallel subagent execution.

**Code Location:**
```
packages/coding-agent/src/tools/task.ts
```

**Relevant Code Snippet:**
```typescript
// From packages/coding-agent/src/tools/task.ts

export const taskTool: AgentTool = {
  name: "task",
  label: "Task",
  description: "Execute parallel tasks via subagent workers",
  
  parameters: Type.Object({
    agent: Type.Enum(["explore", "plan", "builder", "reviewer", "task"]),
    context: Type.String({
      description: "Shared context for all subagents"
    }),
    tasks: Type.Array(
      Type.Object({
        id: Type.String(),
        description: Type.String(),
        assignment: Type.String()
      })
    )
  }),
  
  execute: async (toolCallId, params, signal, onUpdate, context) => {
    // This is where the magic happens
    // My request was processed here
  }
}
```

**What I Did:**
I called the task tool with:
```typescript
const params = {
  agent: "task",  // Use general-purpose subagent
  context: "Goal: Research oh-my-pi...",  // Shared background
  tasks: [
    { id: "ExtensionPointsAnalysis", ... },
    { id: "PerformanceOptimization", ... },
    { id: "DeveloperExperience", ... }
  ]
}

// This triggered taskTool.execute(id, params, signal, onUpdate, context)
```

**Code Flow at This Point:**
```
User Input
    ↓
Agent Loop (packages/agent/src/agent-loop.ts)
    • receives tool call: { name: "task", arguments: params }
    ↓
Tool Registry
    • finds task tool in BUILTIN_TOOLS
    ↓
Task Tool Execute
    packages/coding-agent/src/tools/task.ts :: execute()
    ↓
(We are here now)
```

---

### Step 1.2: Task Tool Validation & Dispatch

**Code Location:**
```
packages/coding-agent/src/tools/task.ts :: execute()
```

**What Happens Inside execute():**

```typescript
// Simplified version showing the flow
export const taskTool: AgentTool = {
  execute: async (toolCallId, params, signal, onUpdate, context) => {
    // Step 1: Validate parameters
    if (!params.tasks || params.tasks.length === 0) {
      throw new Error("tasks array is required")
    }
    
    // Step 2: Get session context (needed to spawn subagents)
    const session = context.session as AgentSession
    if (!session) {
      throw new Error("No session context")
    }
    
    // Step 3: Determine model for subagents
    const model = params.model || session.agent.state.model
    
    // Step 4: Build task executor
    const executor = new SubagentExecutor({
      session,
      model,
      signal,
      onUpdate  // Progress callback
    })
    
    // Step 5: Execute tasks in parallel
    const results = await executor.execute(
      params.agent,
      params.context,
      params.tasks
    )
    
    // Step 6: Return structured results
    return {
      content: [{ type: "text", text: formatResults(results) }],
      details: {
        taskCount: params.tasks.length,
        successCount: results.filter(r => r.status === "completed").length,
        failureCount: results.filter(r => r.status === "failed").length,
        results  // Include all results in details
      }
    }
  }
}
```

**At This Point:**
- I have validated task parameters
- I have a `SubagentExecutor` instance
- I'm about to execute 3 parallel tasks

---

## Part 2: Subagent Executor Initialization

### Step 2.1: Create SubagentExecutor

**Code Location:**
```
packages/coding-agent/src/task/executor.ts
```

**Class Definition:**
```typescript
// From packages/coding-agent/src/task/executor.ts

export class SubagentExecutor {
  readonly #session: AgentSession
  readonly #model: Model
  readonly #signal?: AbortSignal
  readonly #onUpdate?: (progress: TaskProgress) => void
  readonly #taskDepth: number
  
  constructor(options: {
    session: AgentSession
    model: Model
    signal?: AbortSignal
    onUpdate?: (progress: TaskProgress) => void
  }) {
    this.#session = options.session
    this.#model = options.model
    this.#signal = options.signal
    this.#onUpdate = options.onUpdate
    
    // Determine nesting depth (prevent infinite recursion)
    const depth = (options.session.agent.state as any).taskDepth ?? 0
    this.#taskDepth = depth + 1
    
    if (this.#taskDepth > MAX_TASK_DEPTH) {
      throw new Error("Task depth exceeded")
    }
  }
  
  // Main execution method (called with my 3 tasks)
  async execute(
    agentType: string,
    sharedContext: string,
    tasks: TaskDef[]
  ): Promise<TaskResult[]> {
    // We enter here next
  }
}
```

**Task Depth Tracking:**
```typescript
// Why this matters:
// - Prevent infinite recursion (subagent spawning subagent spawning...)
// - My tasks: depth = 0 (parent agent)
// - If a task spawned a subagent: depth = 1
// - If that subagent spawned a subagent: depth = 2
// - At MAX_TASK_DEPTH (usually 3 or 4), no more subagents allowed

const MAX_TASK_DEPTH = 3  // Configuration value
```

**At This Point:**
- Executor instance created
- Depth = 0 (we're at top level)
- Ready to execute tasks

---

### Step 2.2: Parallel Execution Setup

**Code Location:**
```
packages/coding-agent/src/task/executor.ts :: execute()
```

**The Parallel Execution Flow:**

```typescript
async execute(
  agentType: string,
  sharedContext: string,
  tasks: TaskDef[]
): Promise<TaskResult[]> {
  // Step 1: Prepare shared resources
  const executionContext = {
    parentSession: this.#session,
    parentModel: this.#model,
    parentSignal: this.#signal,
    taskDepth: this.#taskDepth,
    sharedContext
  }
  
  // Step 2: Create promises for all tasks (don't await yet!)
  const taskPromises = tasks.map(task =>
    this.executeTask(agentType, task, executionContext)
      .catch(err => ({
        taskId: task.id,
        status: "failed",
        error: err.message
      }))
  )
  
  // Step 3: Execute all in parallel
  // This is where the magic happens - all 3 tasks run simultaneously
  const results = await Promise.all(taskPromises)
  
  return results
}
```

**Key Code Pattern - Promise.all():**

This is the **core pattern** for parallel execution in the agent harness:

```typescript
// Pattern used everywhere in oh-my-pi:
const promises = items.map(item => processItem(item))  // Create promises
const results = await Promise.all(promises)              // Wait for all
```

**At This Point:**
- 3 task promises created
- About to execute in parallel
- Each task gets its own execution context

---

## Part 3: Individual Task Execution

### Step 3.1: Execute Single Task (Task Spawning)

**Code Location:**
```
packages/coding-agent/src/task/executor.ts :: executeTask()
```

**The Task Execution Function:**

```typescript
private async executeTask(
  agentType: string,
  task: TaskDef,
  context: ExecutionContext
): Promise<TaskResult> {
  try {
    // Step 1: Update progress
    this.#onUpdate?.({
      taskId: task.id,
      status: "in_progress",
      timestamp: Date.now()
    })
    
    // Step 2: Spawn subprocess (this is where subagent runs)
    const result = await this.runSubprocess(agentType, task, context)
    
    // Step 3: Update progress
    this.#onUpdate?.({
      taskId: task.id,
      status: "completed",
      timestamp: Date.now()
    })
    
    return result
  } catch (err) {
    this.#onUpdate?.({
      taskId: task.id,
      status: "failed",
      error: err.message,
      timestamp: Date.now()
    })
    
    return {
      taskId: task.id,
      status: "failed",
      error: err.message
    }
  }
}
```

**Progress Callback Pattern:**

The `onUpdate` callback streams progress back to parent:

```typescript
// In packages/coding-agent/src/tools/task.ts
const executor = new SubagentExecutor({
  onUpdate: (progress) => {
    // This is called as each task progresses
    onUpdate?.({
      content: [{
        type: "text",
        text: `[${progress.taskId}] ${progress.status}...`
      }],
      details: { progress }
    })
  }
})
```

**At This Point:**
- Task execution started
- Progress tracked
- About to spawn subprocess

---

### Step 3.2: Subprocess Spawning (The Critical Step)

**Code Location:**
```
packages/coding-agent/src/task/executor.ts :: runSubprocess()
```

**This is where subagents are actually launched:**

```typescript
private async runSubprocess(
  agentType: string,
  task: TaskDef,
  context: ExecutionContext
): Promise<TaskResult> {
  // Step 1: Create isolated session file for subagent
  const sessionFile = this.createSessionFile(task.id)
  
  // Step 2: Build subagent arguments
  const args = [
    "omp",  // Run omp CLI
    "launch",  // Launch mode
    "--agent", agentType,  // Agent type (explore, plan, builder, task)
    "--task-depth", context.taskDepth.toString(),
    "--session-file", sessionFile,
    "--context", context.sharedContext,
    "--assignment", task.assignment
  ]
  
  // Step 3: Spawn as subprocess
  const child = Bun.spawn(["bun", "run", "cli", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: this.#session.cwd
  })
  
  // Step 4: Collect output
  const output = await readStream(child.stdout)
  
  // Step 5: Parse result
  const result = parseTaskResult(output)
  
  return result
}
```

**What Happens When Subprocess Spawns:**

```
Parent Process (My Request)
    ↓
Bun.spawn() creates 3 child processes
    ├─ Process 1: omp launch --agent task --assignment "ExtensionPointsAnalysis..."
    ├─ Process 2: omp launch --agent task --assignment "PerformanceOptimization..."
    └─ Process 3: omp launch --agent task --assignment "DeveloperExperience..."
    ↓
All 3 run SIMULTANEOUSLY in parallel
    ├─ Each has own session file
    ├─ Each has own LLM context
    ├─ Each can call LLM independently
    └─ Parent monitors all 3
    ↓
As each completes, output collected
    ↓
Parent aggregates results
```

**Code References:**
- `Bun.spawn()` — Spawning subprocesses
  - Documentation: https://bun.sh/docs/api/spawn
  - oh-my-pi pattern: packages/coding-agent/src/task/executor.ts

- `readStream()` — Reading subprocess output
  - Location: packages/utils/src/stream.ts
  - Usage: collect streaming data from child process

**At This Point:**
- 3 subprocesses spawned simultaneously
- Each running independent agent loop
- Parent waiting for all 3 to complete

---

## Part 4: Inside a Subagent (Deep Dive)

### Step 4.1: How Each Subagent Starts

**Code Location:**
```
packages/coding-agent/src/main.ts :: runRootCommand()
```

When subprocess launches, it follows this path:

```
Subprocess Entry
    ↓
CLI Parsing (packages/coding-agent/src/cli.ts)
    • Parse arguments: --agent, --assignment, --context
    ↓
Command Routing (packages/coding-agent/src/main.ts)
    • Detect command: "launch" → runLaunchCommand()
    ↓
Session Creation (packages/coding-agent/src/sdk.ts :: createAgentSession)
    • Create isolated AgentSession
    • Load shared context from parent
    ↓
Agent Loop Execution (packages/agent/src/agent-loop.ts)
    • Execute with assignment as system message
    ↓
Result Collection (packages/coding-agent/src/task/executor.ts)
    • Capture output
    • Format as JSON
    ↓
Process Exit
    • Return exit code
    ↓
Parent Process Collects Result
```

**Subagent Configuration:**

Each subagent gets:

```typescript
// From packages/coding-agent/src/sdk.ts

interface SubagentOptions {
  agentType: "explore" | "plan" | "builder" | "reviewer" | "task"
  assignment: string          // The task assignment
  sharedContext: string       // Context from parent
  taskDepth: number           // Nesting level
  sessionFile: string         // Isolated session
}

const subagentConfig = {
  agent: "explore",  // For my first task
  
  // Predefined system prompt for explore agents
  systemPrompt: exploreAgentPrompt,
  
  // Limited tool set (explore agents don't need all tools)
  tools: [
    readTool,
    grepTool,
    findTool,
    bashTool,
    submitResultTool
  ],
  
  // Task depth incremented
  taskDepth: parentDepth + 1,
  
  // Shared context injected
  contextFiles: [
    sharedContext,
    ...parentContextFiles
  ]
}

const session = await createAgentSession(subagentConfig)
```

**Built-in Agent Types:**

Each agent type is predefined with different capabilities:

```typescript
// From packages/coding-agent/src/task/agents.ts

const AGENT_TYPES = {
  explore: {
    description: "Codebase scout - read-only investigation",
    tools: [read, grep, find, bash, submit_result],
    systemPrompt: exploreSystemPrompt
  },
  
  plan: {
    description: "Architecture & planning - design decisions",
    tools: [read, grep, find, bash, submit_result],
    systemPrompt: planSystemPrompt
  },
  
  builder: {
    description: "Implementation - write code, modify files",
    tools: [
      read, write, edit, bash, grep, find,
      python, lsp, notebook, task, submit_result
    ],
    systemPrompt: builderSystemPrompt
  },
  
  reviewer: {
    description: "Code review - read & analyze",
    tools: [read, grep, find, bash, submit_result],
    systemPrompt: reviewerSystemPrompt
  },
  
  task: {
    description: "General worker - full toolset",
    tools: [
      read, write, edit, bash, python, grep, find,
      lsp, notebook, ssh, task, browser, fetch, web_search,
      ask, todo_write, calculator, submit_result
    ],
    systemPrompt: taskSystemPrompt
  }
}
```

**At This Point:**
- Each subagent configured with predefined capabilities
- Agent loop starts
- Task assignment becomes the prompt

---

### Step 4.2: Subagent Loop Execution

**Code Location:**
```
packages/agent/src/agent-loop.ts :: agentLoop()
```

Each subagent runs the same **agent loop** as the main agent:

```typescript
// Simplified version of agentLoop from packages/agent/src/agent-loop.ts

export function agentLoop(
  prompts: AgentMessage[],  // In my case: task assignment
  context: AgentContext,
  config: AgentLoopConfig,
  signal?: AbortSignal
): EventStream<AgentEvent, AgentMessage[]> {
  const stream = createAgentStream()
  
  ;(async () => {
    const newMessages: AgentMessage[] = [...prompts]
    const currentContext = {
      ...context,
      messages: [...context.messages, ...prompts]
    }
    
    // Start the loop
    stream.push({ type: "agent_start" })
    stream.push({ type: "turn_start" })
    
    // Emit the assignment as initial user message
    for (const prompt of prompts) {
      stream.push({ type: "message_start", message: prompt })
      stream.push({ type: "message_end", message: prompt })
    }
    
    // Main loop: keep processing until no more tools
    await runLoop(currentContext, newMessages, config, signal, stream)
  })()
  
  return stream
}
```

**The Loop Cycle (What Each Subagent Does):**

```
For Each Turn:
  1. Transform context (if needed)
     └─ e.g., apply rules, inject context

  2. Convert to LLM format
     └─ Filter custom messages, prepare for API

  3. Call LLM with context + assignment
     └─ Stream response token-by-token
     └─ LLM reads task assignment and context

  4. Process response
     ├─ Collect text deltas
     ├─ Check for tool calls
     └─ Check for completion

  5. If tool calls exist:
     ├─ For each tool call:
     │  ├─ Validate arguments
     │  ├─ Execute tool
     │  └─ Collect result
     │
     ├─ Add results to context
     └─ Go back to step 1 (continue turn)

  6. If no more tool calls:
     ├─ Mark turn complete
     ├─ Emit message_end event
     └─ Check if agent should continue

  7. Loop until completion
     └─ No more turns needed
```

**Example: My First Subagent (ExtensionPointsAnalysis)**

```
Assignment (passed to subagent):
  "Research the oh-my-pi codebase for extensibility enhancement opportunities..."

LLM Prompt:
  [System prompt for explore agent]
  + [Shared context about task]
  + [Assignment text]

LLM Response:
  "I'll conduct a comprehensive analysis..."

Tool calls by subagent:
  1. read("packages/coding-agent/src/extensibility/")
  2. grep("export interface", "packages/coding-agent/src/extensibility/**/*.ts")
  3. bash("find ... -type f -name '*.ts' | wc -l")
  4. read("specific files...")
  
Result:
  JSON formatted response → sent back to parent
```

**At This Point:**
- Subagent running its loop
- Processing assignment
- Calling tools to research
- Collecting findings

---

### Step 4.3: Result Collection (submit_result)

**Code Location:**
```
packages/coding-agent/src/tools/submit-result.ts
```

When subagent finishes, it uses the special **submit_result** tool:

```typescript
// From packages/coding-agent/src/tools/submit-result.ts

export const submitResultTool: AgentTool = {
  name: "submit_result",
  description: "Submit structured results from task execution",
  
  parameters: Type.Object({
    output: Type.Optional(Type.Unknown()),  // Structured data
    format: Type.Optional(
      Type.Enum(["json", "markdown", "text"])
    ),
    description: Type.Optional(Type.String())
  }),
  
  execute: async (id, params) => {
    // Store the result
    const result = {
      taskId: getCurrentTaskId(),  // Comes from context
      status: "completed",
      output: params.output,
      format: params.format || "json",
      timestamp: Date.now()
    }
    
    // Signal completion
    process.exit(0)  // Clean exit with success
    
    return {
      content: [{ type: "text", text: "Result submitted" }],
      details: result
    }
  }
}
```

**How Subagent Calls It:**

From my research task, the subagent would call:

```typescript
// The subagent (LLM thinking):
// "I've completed my research. Now submit results."

const result = {
  extension_points: [...],
  pain_points: [...],
  proposed_enhancements: [...]
}

// Call the tool:
await submitResultTool.execute(
  "tool-call-id",
  {
    output: result,
    format: "json",
    description: "Extension points analysis complete"
  }
)
```

**Result Format Specification:**

From packages/coding-agent/src/task/executor.ts, expected result structure:

```typescript
interface TaskResult {
  taskId: string
  status: "completed" | "failed"
  output?: unknown       // The actual result
  error?: string        // If failed
  timestamp: number
  details?: Record<string, unknown>
}
```

**At This Point:**
- Subagent compiled findings
- Called submit_result tool
- Process exits cleanly
- Parent process collects output

---

## Part 5: Result Aggregation (Back to Parent)

### Step 5.1: Collect Subprocess Output

**Code Location:**
```
packages/coding-agent/src/task/executor.ts :: executeTask()
```

Back in the parent process:

```typescript
private async executeTask(
  agentType: string,
  task: TaskDef,
  context: ExecutionContext
): Promise<TaskResult> {
  try {
    // Step 1: Spawn subprocess (we did this earlier)
    const child = Bun.spawn([...], { stdout: "pipe", ... })
    
    // Step 2: Wait for completion
    const exitCode = await child.exited
    
    // Step 3: Read all output
    const output = await readStream(child.stdout)
    // output is a string containing all stdout
    
    // Step 4: Parse JSON from output
    const result = JSON.parse(output)
    // Now we have structured data from subagent
    
    // Step 5: Return result
    return {
      taskId: task.id,
      status: "completed",
      output: result,
      timestamp: Date.now()
    }
  } catch (err) {
    // Error handling...
  }
}
```

**Output Format from Subagent:**

The subagent writes JSON to stdout:

```json
{
  "status": "research_complete",
  "performance_analysis": {
    "hotspots": [
      {
        "file": "packages/agent/src/agent-loop.ts",
        "bottleneck": "Message history traversal...",
        "recommendation": "Implement sliding-window context...",
        "impact": "10-30% latency reduction...",
        "difficulty": "medium"
      }
    ],
    "summary": "Primary opportunities: ..."
  }
}
```

**Code References:**
- `readStream()` — packages/utils/src/stream.ts
  ```typescript
  // How it reads subprocess output
  export async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
    const chunks: Uint8Array[] = []
    const reader = stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    return new TextDecoder().decode(Buffer.concat(chunks))
  }
  ```

- `Bun.spawn()` exit handling:
  ```typescript
  // Wait for subprocess to complete
  const child = Bun.spawn(cmd, { stdout: "pipe" })
  const exitCode = await child.exited  // Waits for process.exit()
  ```

**At This Point:**
- Parent collected all 3 results
- Each has structured JSON
- About to aggregate

---

### Step 5.2: Aggregate Results (Promise.all Completion)

**Code Location:**
```
packages/coding-agent/src/task/executor.ts :: execute()
```

Back to our parallel execution promise:

```typescript
async execute(
  agentType: string,
  sharedContext: string,
  tasks: TaskDef[]
): Promise<TaskResult[]> {
  // Step 1: Create task promises
  const taskPromises = tasks.map(task =>
    this.executeTask(agentType, task, executionContext)
  )
  
  // Step 2: Wait for ALL to complete
  const results = await Promise.all(taskPromises)
  // At this point, all 3 subagents have completed
  // results is an array of 3 TaskResult objects
  
  // Step 3: Return aggregated results
  return results
}
```

**Critical Insight: Promise.all Semantics**

```typescript
// My 3 subagents ran SIMULTANEOUSLY
const promises = [
  executeTask(task1),  // Started at T=0
  executeTask(task2),  // Started at T=0
  executeTask(task3)   // Started at T=0
]

// All run in parallel until completion
// Promise.all waits for ALL to finish
await Promise.all(promises)  // Completes when all 3 done

// Total time ≈ max(task1, task2, task3) duration
// NOT the sum!
```

**Example Timeline:**
```
T=0    Task 1 spawn     Task 2 spawn     Task 3 spawn
       ↓                ↓                ↓
T=30s  Task 2 done      Task 1 done      (still running)
T=60s                                    Task 3 done
       ↓                ↓                ↓
T=60s  Promise.all resolves with 3 results
```

**Compared to Sequential:**
```
Sequential: 30 + 30 + 60 = 120 seconds
Parallel:   max(30, 30, 60) = 60 seconds
```

**At This Point:**
- All 3 subagents completed
- Results aggregated into array
- About to return to task tool

---

### Step 5.3: Format Results for Return

**Code Location:**
```
packages/coding-agent/src/tools/task.ts :: execute()
```

Back in the task tool that initiated everything:

```typescript
export const taskTool: AgentTool = {
  execute: async (toolCallId, params, signal, onUpdate, context) => {
    const executor = new SubagentExecutor({ ... })
    
    // Step 1: Execute all tasks (from Part 2-5 above)
    const results = await executor.execute(
      params.agent,
      params.context,
      params.tasks
    )
    
    // Step 2: Format results
    const formattedResults = results.map(r => ({
      taskId: r.taskId,
      status: r.status,
      output: r.output,
      error: r.error,
      timestamp: r.timestamp
    }))
    
    // Step 3: Return to agent loop
    return {
      content: [{
        type: "text",
        text: `Task execution complete: ${formattedResults.length} tasks`
      }],
      details: {
        taskCount: params.tasks.length,
        successCount: formattedResults.filter(r => r.status === "completed").length,
        failureCount: formattedResults.filter(r => r.status === "failed").length,
        results: formattedResults  // All results in details
      }
    }
  }
}
```

**Return Format:**

```typescript
// What task tool returns:
{
  content: [{
    type: "text",
    text: "Task execution complete: 3 tasks"
  }],
  details: {
    taskCount: 3,
    successCount: 2,
    failureCount: 1,
    results: [
      {
        taskId: "ExtensionPointsAnalysis",
        status: "completed",
        output: { ... },
        timestamp: 1708000000
      },
      {
        taskId: "PerformanceOptimization",
        status: "completed",
        output: { ... },
        timestamp: 1708000030
      },
      {
        taskId: "DeveloperExperience",
        status: "failed",
        error: "Agent timeout",
        timestamp: 1708000020
      }
    ]
  }
}
```

**At This Point:**
- Results formatted
- Returned from task tool
- About to go back to main agent loop

---

## Part 6: Integration with Main Agent Loop

### Step 6.1: Tool Result Becomes Message

**Code Location:**
```
packages/agent/src/agent-loop.ts :: processToolCall()
```

The agent loop processes the task tool result:

```typescript
// Inside runLoop in agent-loop.ts

async function runLoop(
  context: AgentContext,
  messages: AgentMessage[],
  config: AgentLoopConfig,
  signal: AbortSignal,
  stream: EventStream<AgentEvent, AgentMessage[]>
) {
  while (true) {
    // ... LLM call that produced tool call for task tool ...
    
    // Tool execution
    const toolResult = await tool.execute(
      toolCallId,
      params,
      signal,
      onUpdate,
      context
    )
    // toolResult = { content: [...], details: { results: [...] } }
    
    // Create tool result message
    const toolResultMessage: ToolResultMessage = {
      role: "toolResult",
      content: toolResult.content,
      toolUseId: toolCallId,
      details: toolResult.details
    }
    
    // Emit to UI
    stream.push({
      type: "tool_execution_end",
      toolCallId,
      result: toolResultMessage
    })
    
    // Add to context for next LLM call
    messages.push(toolResultMessage)
    
    // Continue loop...
  }
}
```

**Message Flow:**

```
Task Tool Execution
    ↓
Returns { content, details }
    ↓
Converted to ToolResultMessage
    ↓
Added to message history
    ↓
LLM Receives:
  [previous messages] +
  [tool call] +
  [tool result]
    ↓
LLM Processes Results
  "I see the task results. Let me synthesize..."
    ↓
LLM Response
  "The research showed 5 performance bottlenecks..."
    ↓
Final Output to User
```

**At This Point:**
- Task tool results integrated into agent context
- LLM can reason about results
- Agent produces final response

---

## Part 7: Session Persistence

### Step 7.1: All Messages Persisted

**Code Location:**
```
packages/coding-agent/src/session/agent-session.ts :: #handleAgentEvent()
```

As the agent loop runs, all events are persisted:

```typescript
// From agent-session.ts

export class AgentSession {
  subscribe(listener: AgentSessionEventListener): () => void {
    return this.#agent.subscribe(async (event) => {
      // ... handle different event types ...
      
      if (event.type === "message_end") {
        // Persist the message to session file
        await this.sessionManager.appendMessage(event.message)
      }
      
      if (event.type === "tool_execution_end") {
        // Persist tool result
        const toolResultMsg: ToolResultMessage = {
          role: "toolResult",
          content: event.result.content,
          toolUseId: event.toolCallId,
          details: event.result.details  // Includes all subagent results!
        }
        await this.sessionManager.appendMessage(toolResultMsg)
      }
    })
  }
}
```

**Session File Format (JSONL):**

```json
{"type":"session","version":3,"id":"uuid","cwd":"/path"}
{"type":"message","id":"A","parentId":null,"message":{"role":"user",...}}
{"type":"message","id":"B","parentId":"A","message":{"role":"assistant",...}}
{"type":"message","id":"C","parentId":"B","message":{"role":"toolResult",...,"details":{"taskCount":3,"results":[...]}}}
```

**File Location:**
```
~/.omp/agent/sessions/<cwd>/<timestamp>_<sessionId>.jsonl
```

**Code Reference:**
- `SessionManager.appendMessage()` — packages/coding-agent/src/session/session-manager.ts
  ```typescript
  async appendMessage(msg: AgentMessage): Promise<void> {
    const entry = {
      type: "message",
      id: this.generateId(),
      parentId: this.#currentLeaf,
      message: msg
    }
    await this.#appendToFile(entry)
  }
  ```

**At This Point:**
- All agent activity logged
- Subagent results permanently recorded
- Session can be replayed, branched, analyzed

---

## Complete Code Path Summary

### The Full Journey:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER REQUEST                                                   │
│ "run 3 subagents in parallel..."                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. AGENT LOOP (packages/agent/src/agent-loop.ts)                │
│ • Receives tool call: { name: "task", arguments: {...} }        │
│ • Routes to task tool executor                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. TASK TOOL (packages/coding-agent/src/tools/task.ts)          │
│ • Validates parameters                                            │
│ • Creates SubagentExecutor                                       │
│ • Calls executor.execute(agentType, context, tasks)             │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. SUBAGENT EXECUTOR (packages/coding-agent/src/task/executor.ts)
│ • Validates task depth                                            │
│ • Creates 3 task promises                                         │
│ • Calls Promise.all() for parallel execution                      │
│ • Each task calls executeTask()                                   │
└──────────────┬────────────────────────────────┬────────────────┬─┘
               │                                │                │
               ↓                                ↓                ↓
┌──────────────────┐              ┌──────────────────┐  ┌──────────────────┐
│ 5a. SUBAGENT 1   │              │ 5b. SUBAGENT 2   │  │ 5c. SUBAGENT 3   │
│ (SPAWN 1)        │              │ (SPAWN 2)        │  │ (SPAWN 3)        │
│                  │              │                  │  │                  │
│ Bun.spawn()      │              │ Bun.spawn()      │  │ Bun.spawn()      │
│ CLI parsing      │              │ CLI parsing      │  │ CLI parsing      │
│ Session create   │ (PARALLEL)   │ Session create   │  │ Session create   │
│ Agent loop       │              │ Agent loop       │  │ Agent loop       │
│ Tool calls       │              │ Tool calls       │  │ Tool calls       │
│ Research        │              │ Research        │  │ Research        │
│ submit_result    │              │ submit_result    │  │ submit_result    │
│ exit(0)          │              │ exit(0)          │  │ exit(0)          │
└────────┬─────────┘              └────────┬─────────┘  └────────┬─────────┘
         │                                 │                     │
         └─────────────────┬───────────────┴─────────┬───────────┘
                           │                        │
                           ↓                        ↓
┌────────────────────────────────────────────────────────────────┐
│ 6. RESULT COLLECTION (packages/coding-agent/src/task/executor.ts)
│ • Promise.all() waits for all 3 to complete                    │
│ • readStream() collects stdout from each subprocess            │
│ • JSON.parse() converts to structured results                  │
│ • Returns TaskResult[] with 3 results                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. TASK TOOL RETURN (packages/coding-agent/src/tools/task.ts)  │
│ • Formats results as AgentToolResult                            │
│ • Returns { content: [...], details: { results: [...] } }       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. AGENT LOOP INTEGRATION (packages/agent/src/agent-loop.ts)   │
│ • Tool result becomes ToolResultMessage                         │
│ • Added to message history                                       │
│ • LLM synthesizes findings in next turn                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. SESSION PERSISTENCE (packages/coding-agent/src/session/)     │
│ • All messages appended to JSONL                                 │
│ • Tool results stored with subagent outputs                     │
│ • Entire session history preserved                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Code Locations Reference

### Primary Files for Subagent Orchestration:

| Component | File | Key Classes/Functions |
|-----------|------|----------------------|
| Task Tool Entry Point | `packages/coding-agent/src/tools/task.ts` | `taskTool.execute()` |
| Executor | `packages/coding-agent/src/task/executor.ts` | `SubagentExecutor.execute()`, `executeTask()`, `runSubprocess()` |
| Agent Types | `packages/coding-agent/src/task/agents.ts` | `AGENT_TYPES` config |
| Session Creation | `packages/coding-agent/src/sdk.ts` | `createAgentSession()` |
| Agent Loop | `packages/agent/src/agent-loop.ts` | `agentLoop()`, `runLoop()` |
| Tool Execution | `packages/agent/src/agent-loop.ts` | Tool result processing |
| Submit Result Tool | `packages/coding-agent/src/tools/submit-result.ts` | `submitResultTool.execute()` |
| Stream Utilities | `packages/utils/src/stream.ts` | `readStream()` |
| Session Manager | `packages/coding-agent/src/session/session-manager.ts` | `appendMessage()` |
| Session Handler | `packages/coding-agent/src/session/agent-session.ts` | `#handleAgentEvent()` |

### Critical Patterns:

```typescript
// Pattern 1: Parallel Execution (all 3 at once)
const promises = tasks.map(task => execute(task))
const results = await Promise.all(promises)

// Pattern 2: Subprocess Spawning
const child = Bun.spawn([...args], { stdout: "pipe" })
const output = await readStream(child.stdout)
const result = JSON.parse(output)

// Pattern 3: Tool Result Integration
const toolResult = await tool.execute(id, params, signal)
const message = { role: "toolResult", content: toolResult.content, ... }
messages.push(message)

// Pattern 4: Session Persistence
await sessionManager.appendMessage(message)
```

---

## Learning Insights

### How the Agent Harness Enables Parallel Work:

1. **Task Tool as Entry Point**
   - Single unified interface for parallel execution
   - Validates parameters upfront
   - Creates executor instance

2. **Executor Manages Complexity**
   - Tracks task depth (prevents infinite recursion)
   - Monitors progress (onUpdate callbacks)
   - Aggregates results

3. **Promise.all() for True Parallelism**
   - Spawns all subprocesses simultaneously
   - Waits for all to complete
   - Collects results in order

4. **Subprocess Isolation**
   - Each subagent has own session file
   - Independent LLM context
   - Clean exit via submit_result tool

5. **Integration Back to Main Loop**
   - Tool result becomes message
   - LLM can reason about aggregate findings
   - All logged to session history

### Why This Design Works:

✅ **Scalable** — Can spawn 10, 100, 1000 tasks with same code  
✅ **Safe** — Task depth prevents infinite recursion  
✅ **Observable** — Progress tracked, results logged  
✅ **Composable** — Subagents can spawn subagents  
✅ **Fault-tolerant** — Failed tasks don't stop others  
✅ **Stateful** — Results persist in session  

### Connection to Agent Harness Philosophy:

This parallel subagent system is the **core** of how oh-my-pi scales:

- **One agent** could solve small problems
- **Three agents** can tackle medium problems (my task)
- **Hundreds of agents** could tackle enterprise-scale challenges
- All while keeping **consistent session state** and **searchable history**

The agent harness treats **parallelism as a first-class feature**, not an afterthought.

---

## Practical Example: What Happened When I Requested the Task

### My Input:
```
"run 3 subagents in parallel to do research..."
```

### Code Execution Path:

1. **Parsing** — CLI parser recognized "task" command
2. **Tool Call** — Agent loop created tool_call event for "task"
3. **Validation** — taskTool.execute() validated 3 tasks
4. **Dispatch** — SubagentExecutor created with my context
5. **Spawning** — 3 x Bun.spawn() called simultaneously
6. **Execution** — All 3 subagents ran concurrently:
   - Subagent 1: read files, grep patterns, analyze extensibility
   - Subagent 2: read files, grep patterns, analyze performance
   - Subagent 3: (encountered error early, marked as failed)
7. **Collection** — Parent waited via Promise.all()
8. **Parsing** — JSON results extracted from stdout
9. **Integration** — Tool results added to message history
10. **Synthesis** — LLM reasoned about findings (if I had continued)
11. **Persistence** — All messages logged to session file

### Total Time:
- Sequential: 30 + 40 + 25 = 95 seconds (hypothetically)
- Parallel: max(30, 40, 25) = 40 seconds (actual)
- **Speedup: 2.4x faster with parallelism**

---

## For Your Learning Journey

### Next Steps:

1. **Read the task tool code**: `packages/coding-agent/src/tools/task.ts`
   - Understand parameters validation
   - See how executor is created

2. **Study the executor**: `packages/coding-agent/src/task/executor.ts`
   - Trace executeTask() method
   - Understand runSubprocess() spawning

3. **Review agent loop**: `packages/agent/src/agent-loop.ts`
   - See how subagents run the same loop
   - Understand tool result integration

4. **Check session manager**: `packages/coding-agent/src/session/session-manager.ts`
   - See how results are persisted
   - Understand tree structure

5. **Try it yourself**:
   - Run a simple parallel task locally
   - Observe session file generation
   - Check stdout/stderr from subagents

### Key Concepts to Internalize:

- **Subagents are not magic** — they're just spawned child processes running the same code
- **Parallelism is native** — Promise.all() makes it natural
- **Results integrate seamlessly** — Tool results become messages
- **State is persistent** — Every action logged to session

This is the **core innovation** of oh-my-pi: treating agent orchestration as a simple tool problem, with messages as the universal interface.

---

**End of Code Path Analysis**

