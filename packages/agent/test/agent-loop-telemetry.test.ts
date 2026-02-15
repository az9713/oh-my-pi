/**
 * Agent loop telemetry tests.
 *
 * Tests that TurnMetrics are emitted correctly via onTurnMetrics callback.
 */
import { describe, expect, it } from "bun:test";
import { agentLoop } from "@oh-my-pi/pi-agent-core/agent-loop";
import type { AgentEvent, TurnMetrics } from "@oh-my-pi/pi-agent-core/types";
import {
	createAssistantMessage,
	createConfig,
	createContext,
	createEchoTool,
	createUserMessage,
	MockAssistantStream,
} from "./mock-stream";

describe("onTurnMetrics", () => {
	it("emits metrics for a simple text response turn", async () => {
		const metrics: TurnMetrics[] = [];

		const config = createConfig({
			onTurnMetrics: m => metrics.push(m),
		});

		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				stream.push({
					type: "done",
					reason: "stop",
					message: createAssistantMessage([{ type: "text", text: "hello" }]),
				});
			});
			return stream;
		};

		const context = createContext();
		const eventStream = agentLoop([createUserMessage("hi")], context, config, undefined, streamFn);
		for await (const _ of eventStream) {
			// consume
		}

		expect(metrics.length).toBe(1);
		expect(metrics[0].toolCallCount).toBe(0);
		expect(metrics[0].toolExecutionMs).toBe(0);
		expect(metrics[0].llmLatencyMs).toBeGreaterThanOrEqual(0);
		expect(metrics[0].totalTurnMs).toBeGreaterThanOrEqual(0);
		expect(metrics[0].contextMessageCount).toBeGreaterThanOrEqual(1);
		expect(metrics[0].toolTimings).toEqual({});
	});

	it("emits metrics with tool timings for tool call turns", async () => {
		const metrics: TurnMetrics[] = [];
		const tool = createEchoTool({
			onExecute: async () => {
				await Bun.sleep(5);
			},
		});

		const config = createConfig({
			onTurnMetrics: m => metrics.push(m),
		});

		let callIndex = 0;
		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				if (callIndex === 0) {
					stream.push({
						type: "done",
						reason: "toolUse",
						message: createAssistantMessage(
							[{ type: "toolCall", id: "t1", name: "echo", arguments: { value: "x" } }],
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

		const context = createContext([tool]);
		const eventStream = agentLoop([createUserMessage("go")], context, config, undefined, streamFn);
		for await (const _ of eventStream) {
			// consume
		}

		// Should have 2 turns: one with tool call, one with text response
		expect(metrics.length).toBe(2);

		// First turn should have tool metrics
		expect(metrics[0].toolCallCount).toBe(1);
		expect(metrics[0].toolExecutionMs).toBeGreaterThanOrEqual(5);
		expect(metrics[0].toolTimings.echo).toBeGreaterThanOrEqual(5);

		// Second turn should have no tools
		expect(metrics[1].toolCallCount).toBe(0);
		expect(metrics[1].toolTimings).toEqual({});
	});

	it("tracks context message count accurately", async () => {
		const metrics: TurnMetrics[] = [];

		const config = createConfig({
			onTurnMetrics: m => metrics.push(m),
		});

		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				stream.push({
					type: "done",
					reason: "stop",
					message: createAssistantMessage([{ type: "text", text: "ok" }]),
				});
			});
			return stream;
		};

		// Create context with existing messages
		const context = createContext();
		context.messages = [
			createUserMessage("old1"),
			createAssistantMessage([{ type: "text", text: "old2" }]),
		];

		const eventStream = agentLoop([createUserMessage("new")], context, config, undefined, streamFn);
		for await (const _ of eventStream) {
			// consume
		}

		// Context should include 2 existing + 1 new user message = 3
		expect(metrics[0].contextMessageCount).toBe(3);
	});

	it("does not fail when onTurnMetrics is not configured", async () => {
		const config = createConfig(); // No onTurnMetrics

		const streamFn = () => {
			const stream = new MockAssistantStream();
			queueMicrotask(() => {
				stream.push({
					type: "done",
					reason: "stop",
					message: createAssistantMessage([{ type: "text", text: "ok" }]),
				});
			});
			return stream;
		};

		const context = createContext();
		const eventStream = agentLoop([createUserMessage("hi")], context, config, undefined, streamFn);
		for await (const _ of eventStream) {
			// consume
		}

		// Should complete without errors
		const messages = await eventStream.result();
		expect(messages.length).toBe(2);
	});
});
