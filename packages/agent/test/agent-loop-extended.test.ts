/**
 * Extended agent loop tests covering:
 * - Exclusive tool concurrency (serial execution)
 * - interruptMode "wait" (defer steering until turn ends)
 * - Follow-up messages (getFollowUpMessages)
 * - Error and abort handling
 * - Mixed shared/exclusive tool batches
 */
import { describe, expect, it } from "bun:test";
import { agentLoop } from "@oh-my-pi/pi-agent-core/agent-loop";
import type { AgentEvent, AgentLoopConfig, AgentMessage, AgentTool } from "@oh-my-pi/pi-agent-core/types";
import type { ToolResultMessage } from "@oh-my-pi/pi-ai";
import { Type } from "@sinclair/typebox";
import {
	collectEvents,
	createAssistantMessage,
	createConfig,
	createContext,
	createEchoTool,
	createSequentialStreamFn,
	createUserMessage,
	MockAssistantStream,
} from "./mock-stream";

// ============================================================================
// Exclusive tool concurrency
// ============================================================================

describe("exclusive tool concurrency", () => {
	it("runs exclusive tools serially", async () => {
		const executionOrder: string[] = [];
		const { promise: firstStarted, resolve: firstStartedResolve } = Promise.withResolvers<void>();
		const { promise: firstContinue, resolve: firstContinueResolve } = Promise.withResolvers<void>();

		const exclusiveTool = createEchoTool({
			name: "exclusive_echo",
			concurrency: "exclusive",
			onExecute: async params => {
				executionOrder.push(`start:${params.value}`);
				if (params.value === "first") {
					firstStartedResolve();
					await firstContinue;
				}
				executionOrder.push(`end:${params.value}`);
			},
		});

		const context = createContext([exclusiveTool]);
		const userPrompt = createUserMessage("start");

		let callIndex = 0;
		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					const message = createAssistantMessage(
						[
							{ type: "toolCall", id: "t1", name: "exclusive_echo", arguments: { value: "first" } },
							{ type: "toolCall", id: "t2", name: "exclusive_echo", arguments: { value: "second" } },
						],
						"toolUse",
					);
					stream.push({ type: "done", reason: "toolUse", message });
				} else {
					stream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage([{ type: "text", text: "done" }]),
					});
				}
				callIndex++;
			});
			return stream;
		};

		const events: AgentEvent[] = [];
		const eventStream = agentLoop([userPrompt], context, createConfig(), undefined, streamFn);

		const task = (async () => {
			for await (const event of eventStream) {
				events.push(event);
			}
		})();

		// Wait for first tool to start, then allow it to finish
		await firstStarted;
		// At this point, second tool should NOT have started (exclusive = serial)
		expect(executionOrder).toEqual(["start:first"]);

		firstContinueResolve();
		await task;

		// Both should have run, first fully before second starts
		expect(executionOrder).toEqual(["start:first", "end:first", "start:second", "end:second"]);
	});

	it("runs mixed shared + exclusive tools with correct ordering", async () => {
		const executionOrder: string[] = [];
		const { promise: sharedSlowStarted, resolve: sharedSlowStartedResolve } = Promise.withResolvers<void>();
		const { promise: sharedSlowContinue, resolve: sharedSlowContinueResolve } = Promise.withResolvers<void>();

		const sharedTool = createEchoTool({
			name: "shared_echo",
			concurrency: "shared",
			onExecute: async params => {
				executionOrder.push(`start:shared:${params.value}`);
				if (params.value === "slow") {
					sharedSlowStartedResolve();
					await sharedSlowContinue;
				}
				executionOrder.push(`end:shared:${params.value}`);
			},
		});

		const exclusiveTool = createEchoTool({
			name: "exclusive_echo",
			concurrency: "exclusive",
			onExecute: async params => {
				executionOrder.push(`start:exclusive:${params.value}`);
				executionOrder.push(`end:exclusive:${params.value}`);
			},
		});

		const context = createContext([sharedTool, exclusiveTool]);
		const userPrompt = createUserMessage("start");

		let callIndex = 0;
		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					// shared(slow), shared(fast), exclusive(ex1)
					const message = createAssistantMessage(
						[
							{ type: "toolCall", id: "t1", name: "shared_echo", arguments: { value: "slow" } },
							{ type: "toolCall", id: "t2", name: "shared_echo", arguments: { value: "fast" } },
							{ type: "toolCall", id: "t3", name: "exclusive_echo", arguments: { value: "ex1" } },
						],
						"toolUse",
					);
					stream.push({ type: "done", reason: "toolUse", message });
				} else {
					stream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage([{ type: "text", text: "done" }]),
					});
				}
				callIndex++;
			});
			return stream;
		};

		const events: AgentEvent[] = [];
		const eventStream = agentLoop([userPrompt], context, createConfig(), undefined, streamFn);

		const task = (async () => {
			for await (const event of eventStream) {
				events.push(event);
			}
		})();

		// Let shared slow tool start
		await sharedSlowStarted;
		sharedSlowContinueResolve();
		await task;

		// Exclusive tool must start only after ALL shared tools finish
		const exclusiveStartIdx = executionOrder.indexOf("start:exclusive:ex1");
		const sharedSlowEndIdx = executionOrder.indexOf("end:shared:slow");
		const sharedFastEndIdx = executionOrder.indexOf("end:shared:fast");

		expect(exclusiveStartIdx).toBeGreaterThan(sharedSlowEndIdx);
		expect(exclusiveStartIdx).toBeGreaterThan(sharedFastEndIdx);
	});
});

// ============================================================================
// interruptMode "wait"
// ============================================================================

describe("interruptMode wait", () => {
	it("defers steering until all tools in the turn complete", async () => {
		const executed: string[] = [];
		const { promise: firstDone, resolve: firstDoneResolve } = Promise.withResolvers<void>();

		const tool = createEchoTool({
			onExecute: async params => {
				executed.push(params.value);
				if (params.value === "first") {
					firstDoneResolve();
				}
			},
		});

		const context = createContext([tool]);
		const userPrompt = createUserMessage("start");

		let steeringDelivered = false;
		let callIndex = 0;
		const config = createConfig({
			interruptMode: "wait",
			getSteeringMessages: async () => {
				// Queue a steering message after the first tool runs
				if (executed.length >= 1 && !steeringDelivered) {
					steeringDelivered = true;
					return [createUserMessage("interrupt")];
				}
				return [];
			},
		});

		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					stream.push({
						type: "done",
						reason: "toolUse",
						message: createAssistantMessage(
							[
								{ type: "toolCall", id: "t1", name: "echo", arguments: { value: "first" } },
								{ type: "toolCall", id: "t2", name: "echo", arguments: { value: "second" } },
							],
							"toolUse",
						),
					});
				} else {
					stream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage([{ type: "text", text: "done" }]),
					});
				}
				callIndex++;
			});
			return stream;
		};

		const events: AgentEvent[] = [];
		const eventStream = agentLoop([userPrompt], context, config, undefined, streamFn);
		for await (const event of eventStream) {
			events.push(event);
		}

		// With "wait" mode, BOTH tools should execute (steering deferred)
		expect(executed).toEqual(["first", "second"]);

		// Steering message should still appear in events
		const col = collectEvents(events);
		const steeringEvents = col
			.ofType("message_start")
			.filter(
				e =>
					e.message.role === "user" &&
					typeof e.message.content === "string" &&
					e.message.content === "interrupt",
			);
		expect(steeringEvents.length).toBe(1);
	});
});

// ============================================================================
// Follow-up messages
// ============================================================================

describe("follow-up messages", () => {
	it("processes follow-up messages after agent would stop", async () => {
		const followUpDelivered = { count: 0 };

		const config = createConfig({
			getFollowUpMessages: async () => {
				if (followUpDelivered.count === 0) {
					followUpDelivered.count++;
					return [createUserMessage("follow-up question")];
				}
				return [];
			},
		});

		const streamFn = createSequentialStreamFn([
			{ content: [{ type: "text", text: "First response" }] },
			{ content: [{ type: "text", text: "Follow-up response" }] },
		]);

		const context = createContext();
		const userPrompt = createUserMessage("initial question");

		const events: AgentEvent[] = [];
		const eventStream = agentLoop([userPrompt], context, config, undefined, streamFn);
		for await (const event of eventStream) {
			events.push(event);
		}

		const messages = await eventStream.result();

		// Should have: user prompt + first response + follow-up question + follow-up response
		expect(messages.length).toBe(4);
		expect(messages[0].role).toBe("user");
		expect(messages[1].role).toBe("assistant");
		expect(messages[2].role).toBe("user");
		expect(messages[3].role).toBe("assistant");

		// Verify follow-up message content
		const followUpMsg = messages[2];
		expect(followUpMsg.role).toBe("user");
		expect(typeof followUpMsg.content === "string" && followUpMsg.content).toBe("follow-up question");
	});

	it("stops when no follow-up messages returned", async () => {
		const config = createConfig({
			getFollowUpMessages: async () => [],
		});

		const streamFn = createSequentialStreamFn([
			{ content: [{ type: "text", text: "Only response" }] },
		]);

		const context = createContext();
		const userPrompt = createUserMessage("question");

		const eventStream = agentLoop([userPrompt], context, config, undefined, streamFn);
		for await (const _ of eventStream) {
			// consume
		}

		const messages = await eventStream.result();
		expect(messages.length).toBe(2); // user + assistant
	});
});

// ============================================================================
// Error and abort handling
// ============================================================================

describe("error and abort handling", () => {
	it("handles tool execution errors gracefully", async () => {
		const failSchema = Type.Object({ value: Type.String() });
		const failTool: AgentTool<typeof failSchema, any> = {
			name: "fail",
			label: "Fail",
			description: "Always fails",
			parameters: failSchema,
			async execute() {
				throw new Error("Tool execution failed");
			},
		};

		const context = createContext([failTool]);
		const userPrompt = createUserMessage("run failing tool");

		let callIndex = 0;
		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					stream.push({
						type: "done",
						reason: "toolUse",
						message: createAssistantMessage(
							[{ type: "toolCall", id: "t1", name: "fail", arguments: { value: "x" } }],
							"toolUse",
						),
					});
				} else {
					stream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage([{ type: "text", text: "handled" }]),
					});
				}
				callIndex++;
			});
			return stream;
		};

		const events: AgentEvent[] = [];
		const eventStream = agentLoop([userPrompt], context, createConfig(), undefined, streamFn);
		for await (const event of eventStream) {
			events.push(event);
		}

		// Tool error should be captured in tool_execution_end
		const col = collectEvents(events);
		const toolEnds = col.ofType("tool_execution_end");
		expect(toolEnds.length).toBe(1);
		expect(toolEnds[0].isError).toBe(true);

		// The error message should be in the tool result content
		const toolResult = toolEnds[0].result;
		expect(toolResult.content[0].type).toBe("text");
		if (toolResult.content[0].type === "text") {
			expect(toolResult.content[0].text).toContain("Tool execution failed");
		}
	});

	it("aborts mid-stream when signal is triggered", async () => {
		const abortController = new AbortController();

		const context = createContext();
		const userPrompt = createUserMessage("hello");

		const streamFn = () => {
			const stream = new MockAssistantStream();
			// Don't push any events - simulate a slow stream
			// The abort should cause the loop to handle it
			queueMicrotask(() => {
				abortController.abort();
				// After abort, push done to let stream settle
				const message = createAssistantMessage([{ type: "text", text: "" }], "aborted");
				stream.push({ type: "error", reason: "aborted", error: message });
			});
			return stream;
		};

		const events: AgentEvent[] = [];
		const eventStream = agentLoop([userPrompt], context, createConfig(), abortController.signal, streamFn);
		for await (const event of eventStream) {
			events.push(event);
		}

		const messages = await eventStream.result();
		// Should have user message + aborted assistant message
		expect(messages.length).toBe(2);
		expect(messages[0].role).toBe("user");
		expect(messages[1].role).toBe("assistant");
	});

	it("creates placeholder tool results for aborted messages with pending tool calls", async () => {
		const abortController = new AbortController();
		let aborted = false;

		const context = createContext([createEchoTool()]);
		const userPrompt = createUserMessage("hello");

		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (!aborted) {
					aborted = true;
					// Return message with tool calls, then immediately abort
					const message = createAssistantMessage(
						[{ type: "toolCall", id: "t1", name: "echo", arguments: { value: "x" } }],
						"aborted",
					);
					message.stopReason = "aborted";
					message.errorMessage = "Request was aborted";
					stream.push({ type: "error", reason: "aborted", error: message });
					abortController.abort();
				} else {
					stream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage([{ type: "text", text: "done" }]),
					});
				}
			});
			return stream;
		};

		const events: AgentEvent[] = [];
		const eventStream = agentLoop(
			[userPrompt],
			context,
			createConfig(),
			abortController.signal,
			streamFn,
		);
		for await (const event of eventStream) {
			events.push(event);
		}

		// Should have tool_execution_end events for the aborted tool calls
		const col = collectEvents(events);
		const toolEnds = col.ofType("tool_execution_end");
		// Tool calls in aborted messages get placeholder results
		for (const toolEnd of toolEnds) {
			expect(toolEnd.isError).toBe(true);
		}
	});

	it("handles unknown tool names gracefully", async () => {
		const context = createContext([]); // No tools registered
		const userPrompt = createUserMessage("call unknown");

		let callIndex = 0;
		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					stream.push({
						type: "done",
						reason: "toolUse",
						message: createAssistantMessage(
							[{ type: "toolCall", id: "t1", name: "nonexistent", arguments: {} }],
							"toolUse",
						),
					});
				} else {
					stream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage([{ type: "text", text: "ok" }]),
					});
				}
				callIndex++;
			});
			return stream;
		};

		const events: AgentEvent[] = [];
		const eventStream = agentLoop([userPrompt], context, createConfig(), undefined, streamFn);
		for await (const event of eventStream) {
			events.push(event);
		}

		// Should have a tool error for the unknown tool
		const col = collectEvents(events);
		const toolEnds = col.ofType("tool_execution_end");
		expect(toolEnds.length).toBe(1);
		expect(toolEnds[0].isError).toBe(true);
		if (toolEnds[0].result.content[0]?.type === "text") {
			expect(toolEnds[0].result.content[0].text).toContain("not found");
		}
	});
});

// ============================================================================
// Tool result ordering
// ============================================================================

describe("tool result ordering", () => {
	it("emits tool results in declaration order regardless of completion order", async () => {
		const { promise: slowDone, resolve: slowResolve } = Promise.withResolvers<void>();
		const { promise: slowStarted, resolve: slowStartedResolve } = Promise.withResolvers<void>();

		const tool = createEchoTool({
			onExecute: async params => {
				if (params.value === "slow") {
					slowStartedResolve();
					await slowDone;
				}
			},
		});

		const context = createContext([tool]);
		const userPrompt = createUserMessage("go");

		let callIndex = 0;
		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					stream.push({
						type: "done",
						reason: "toolUse",
						message: createAssistantMessage(
							[
								{ type: "toolCall", id: "slow-1", name: "echo", arguments: { value: "slow" } },
								{ type: "toolCall", id: "fast-2", name: "echo", arguments: { value: "fast" } },
							],
							"toolUse",
						),
					});
				} else {
					stream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage([{ type: "text", text: "done" }]),
					});
				}
				callIndex++;
			});
			return stream;
		};

		const events: AgentEvent[] = [];
		const eventStream = agentLoop([userPrompt], context, createConfig(), undefined, streamFn);
		const task = (async () => {
			for await (const event of eventStream) {
				events.push(event);
			}
		})();

		await slowStarted;
		// Fast tool completes first, but results should be in order
		slowResolve();
		await task;

		const col = collectEvents(events);
		const toolResultStarts = col
			.ofType("message_start")
			.filter(e => e.message.role === "toolResult");

		expect(toolResultStarts.length).toBe(2);
		expect((toolResultStarts[0].message as ToolResultMessage).toolCallId).toBe("slow-1");
		expect((toolResultStarts[1].message as ToolResultMessage).toolCallId).toBe("fast-2");
	});
});

// ============================================================================
// Steering at start
// ============================================================================

describe("initial steering", () => {
	it("checks for steering messages at the very start of the loop", async () => {
		let steeringChecked = false;

		const config = createConfig({
			getSteeringMessages: async () => {
				if (!steeringChecked) {
					steeringChecked = true;
					return [createUserMessage("pre-typed while loading")];
				}
				return [];
			},
		});

		const streamFn = createSequentialStreamFn([
			{ content: [{ type: "text", text: "Response to pre-typed" }] },
		]);

		const context = createContext();
		const userPrompt = createUserMessage("initial");

		const events: AgentEvent[] = [];
		const eventStream = agentLoop([userPrompt], context, config, undefined, streamFn);
		for await (const event of eventStream) {
			events.push(event);
		}

		// The pre-typed steering message should appear
		const col = collectEvents(events);
		const userMessages = col
			.ofType("message_start")
			.filter(e => e.message.role === "user");

		// Should have: initial prompt + steering message
		expect(userMessages.length).toBe(2);
	});
});
