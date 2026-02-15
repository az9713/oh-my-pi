/**
 * Shared mock stream utilities for agent tests.
 *
 * Provides reusable helpers for creating mock LLM responses,
 * configuring multi-turn conversations, and building tool fixtures.
 */
import type {
	AgentContext,
	AgentEvent,
	AgentLoopConfig,
	AgentMessage,
	AgentTool,
	AgentToolContext,
	StreamFn,
	ToolCallContext,
} from "@oh-my-pi/pi-agent-core/types";
import type { AssistantMessage, Message, Model, ToolResultMessage, Usage } from "@oh-my-pi/pi-ai";
import { AssistantMessageEventStream } from "@oh-my-pi/pi-ai/utils/event-stream";
import { Type, type TSchema } from "@sinclair/typebox";

// ============================================================================
// Mock stream
// ============================================================================

export class MockAssistantStream extends AssistantMessageEventStream {}

// ============================================================================
// Factory helpers
// ============================================================================

export function createUsage(overrides?: Partial<Usage>): Usage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		...overrides,
	};
}

export function createModel(overrides?: Partial<Model>): Model<"openai-responses"> {
	return {
		id: "mock",
		name: "mock",
		api: "openai-responses",
		provider: "openai",
		baseUrl: "https://example.invalid",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 8192,
		maxTokens: 2048,
		...overrides,
	} as Model<"openai-responses">;
}

export function createAssistantMessage(
	content: AssistantMessage["content"],
	stopReason: AssistantMessage["stopReason"] = "stop",
): AssistantMessage {
	return {
		role: "assistant",
		content,
		api: "openai-responses",
		provider: "openai",
		model: "mock",
		usage: createUsage(),
		stopReason,
		timestamp: Date.now(),
	};
}

export function createUserMessage(text: string): AgentMessage {
	return {
		role: "user",
		content: text,
		timestamp: Date.now(),
	};
}

// ============================================================================
// Converter
// ============================================================================

export function identityConverter(messages: AgentMessage[]): Message[] {
	return messages.filter(m => m.role === "user" || m.role === "assistant" || m.role === "toolResult") as Message[];
}

// ============================================================================
// Tool builders
// ============================================================================

const echoSchema = Type.Object({ value: Type.String() });

export interface MockToolOptions {
	name?: string;
	concurrency?: "shared" | "exclusive";
	nonAbortable?: boolean;
	/** Called during execute with (params, signal) */
	onExecute?: (params: { value: string }, signal?: AbortSignal) => Promise<void> | void;
}

export function createEchoTool(opts: MockToolOptions = {}): AgentTool<typeof echoSchema, { value: string }> {
	return {
		name: opts.name ?? "echo",
		label: opts.name ?? "Echo",
		description: "Echo tool",
		parameters: echoSchema,
		concurrency: opts.concurrency,
		nonAbortable: opts.nonAbortable,
		async execute(_toolCallId, params, signal) {
			if (opts.onExecute) {
				await opts.onExecute(params, signal);
			}
			return {
				content: [{ type: "text", text: `echoed: ${params.value}` }],
				details: { value: params.value },
			};
		},
	};
}

// ============================================================================
// Stream builders
// ============================================================================

export interface MockResponse {
	content: AssistantMessage["content"];
	stopReason?: AssistantMessage["stopReason"];
}

/**
 * Create a streamFn that returns canned responses in sequence.
 * Each call to the streamFn returns the next response from the array.
 * After all responses are consumed, returns a "done" text response.
 */
export function createSequentialStreamFn(responses: MockResponse[]): StreamFn {
	let callIndex = 0;
	return () => {
		const stream = new MockAssistantStream();
		const responseIndex = callIndex++;
		queueMicrotask(() => {
			if (responseIndex < responses.length) {
				const resp = responses[responseIndex];
				const message = createAssistantMessage(resp.content, resp.stopReason ?? "stop");
				stream.push({ type: "done", reason: resp.stopReason ?? "stop", message });
			} else {
				const message = createAssistantMessage([{ type: "text", text: "done" }]);
				stream.push({ type: "done", reason: "stop", message });
			}
		});
		return stream;
	};
}

// ============================================================================
// Context builders
// ============================================================================

export function createContext(tools: AgentTool<any>[] = []): AgentContext {
	return {
		systemPrompt: "",
		messages: [],
		tools,
	};
}

export function createConfig(overrides?: Partial<AgentLoopConfig>): AgentLoopConfig {
	return {
		model: createModel(),
		convertToLlm: identityConverter,
		...overrides,
	};
}

// ============================================================================
// Event collectors
// ============================================================================

export function collectEvents(events: AgentEvent[]): {
	ofType: <T extends AgentEvent["type"]>(type: T) => Extract<AgentEvent, { type: T }>[];
	types: () => AgentEvent["type"][];
} {
	return {
		ofType: <T extends AgentEvent["type"]>(type: T) =>
			events.filter((e): e is Extract<AgentEvent, { type: T }> => e.type === type),
		types: () => events.map(e => e.type),
	};
}
