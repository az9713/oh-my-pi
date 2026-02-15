/**
 * Subagent executor utility function tests.
 *
 * Tests pure utility functions extracted from the executor module:
 * model pattern normalization, output schema handling, tool arg previews,
 * usage token extraction, report finding dedup, and abort timeout behavior.
 */
import { describe, expect, it } from "bun:test";
import type { Api, Model } from "@oh-my-pi/pi-ai";
import {
	extractCompletionData,
	extractToolArgsPreview,
	getReportFindingKey,
	getUsageTokens,
	normalizeCompleteData,
	normalizeModelPatterns,
	normalizeOutputSchema,
	parseStringifiedJson,
	tryParseJsonOutput,
	withAbortTimeout,
} from "@oh-my-pi/pi-coding-agent/task/executor";

// ============================================================================
// normalizeModelPatterns
// ============================================================================

describe("normalizeModelPatterns", () => {
	it("returns empty array for undefined", () => {
		expect(normalizeModelPatterns(undefined)).toEqual([]);
	});

	it("returns empty array for empty string", () => {
		expect(normalizeModelPatterns("")).toEqual([]);
	});

	it("splits comma-separated string", () => {
		expect(normalizeModelPatterns("gpt-4,claude-sonnet-4-5")).toEqual(["gpt-4", "claude-sonnet-4-5"]);
	});

	it("trims whitespace in comma-separated string", () => {
		expect(normalizeModelPatterns("  gpt-4 , claude-sonnet-4-5  ")).toEqual(["gpt-4", "claude-sonnet-4-5"]);
	});

	it("filters empty entries from trailing comma", () => {
		expect(normalizeModelPatterns("gpt-4,")).toEqual(["gpt-4"]);
	});

	it("passes through array directly", () => {
		expect(normalizeModelPatterns(["gpt-4", "claude-sonnet-4-5"])).toEqual(["gpt-4", "claude-sonnet-4-5"]);
	});

	it("trims entries in array", () => {
		expect(normalizeModelPatterns(["  gpt-4 ", " claude  "])).toEqual(["gpt-4", "claude"]);
	});

	it("filters empty entries in array", () => {
		expect(normalizeModelPatterns(["gpt-4", "", "  "])).toEqual(["gpt-4"]);
	});
});

// ============================================================================
// extractToolArgsPreview
// ============================================================================

describe("extractToolArgsPreview", () => {
	it("returns empty string for no matching keys", () => {
		expect(extractToolArgsPreview({ foo: "bar" })).toBe("");
	});

	it("picks command key first", () => {
		expect(extractToolArgsPreview({ command: "ls -la", path: "/tmp" })).toBe("ls -la");
	});

	it("picks file_path over path", () => {
		expect(extractToolArgsPreview({ file_path: "src/index.ts", path: "/tmp" })).toBe("src/index.ts");
	});

	it("falls back to path", () => {
		expect(extractToolArgsPreview({ path: "/tmp/test" })).toBe("/tmp/test");
	});

	it("truncates long values to 60 chars", () => {
		const longCmd = "a".repeat(100);
		const result = extractToolArgsPreview({ command: longCmd });
		expect(result.length).toBe(60);
		expect(result.endsWith("…")).toBe(true);
	});

	it("does not truncate values at 60 chars", () => {
		const cmd = "a".repeat(60);
		const result = extractToolArgsPreview({ command: cmd });
		expect(result).toBe(cmd);
	});

	it("ignores non-string values", () => {
		expect(extractToolArgsPreview({ command: 42, path: "/tmp" })).toBe("/tmp");
	});
});

// ============================================================================
// getUsageTokens
// ============================================================================

describe("getUsageTokens", () => {
	it("returns 0 for null/undefined", () => {
		expect(getUsageTokens(null)).toBe(0);
		expect(getUsageTokens(undefined)).toBe(0);
	});

	it("returns 0 for non-object", () => {
		expect(getUsageTokens("foo")).toBe(0);
		expect(getUsageTokens(42)).toBe(0);
	});

	it("uses totalTokens when available", () => {
		expect(getUsageTokens({ totalTokens: 1500 })).toBe(1500);
	});

	it("uses total_tokens (snake_case) when available", () => {
		expect(getUsageTokens({ total_tokens: 2000 })).toBe(2000);
	});

	it("sums components when totalTokens is 0", () => {
		expect(getUsageTokens({ totalTokens: 0, input: 100, output: 50, cacheRead: 20, cacheWrite: 10 })).toBe(180);
	});

	it("sums snake_case components", () => {
		expect(getUsageTokens({ input_tokens: 100, output_tokens: 50 })).toBe(150);
	});

	it("handles partial components", () => {
		expect(getUsageTokens({ input: 100 })).toBe(100);
	});

	it("returns 0 for empty object", () => {
		expect(getUsageTokens({})).toBe(0);
	});
});

// ============================================================================
// getReportFindingKey
// ============================================================================

describe("getReportFindingKey", () => {
	it("returns null for null/undefined", () => {
		expect(getReportFindingKey(null)).toBeNull();
		expect(getReportFindingKey(undefined)).toBeNull();
	});

	it("returns null for non-object", () => {
		expect(getReportFindingKey("foo")).toBeNull();
	});

	it("returns null when required fields are missing", () => {
		expect(getReportFindingKey({ title: "bug" })).toBeNull();
		expect(getReportFindingKey({ title: "bug", file_path: "a.ts" })).toBeNull();
		expect(getReportFindingKey({ title: "bug", file_path: "a.ts", line_start: 1 })).toBeNull();
	});

	it("builds key from required fields", () => {
		const key = getReportFindingKey({
			title: "Missing null check",
			file_path: "src/foo.ts",
			line_start: 10,
			line_end: 15,
		});
		expect(key).toBe("src/foo.ts:10:15::Missing null check");
	});

	it("includes priority in key when present", () => {
		const key = getReportFindingKey({
			title: "Bug",
			file_path: "src/foo.ts",
			line_start: 1,
			line_end: 5,
			priority: "high",
		});
		expect(key).toBe("src/foo.ts:1:5:high:Bug");
	});
});

// ============================================================================
// parseStringifiedJson
// ============================================================================

describe("parseStringifiedJson", () => {
	it("returns non-strings as-is", () => {
		expect(parseStringifiedJson(42)).toBe(42);
		expect(parseStringifiedJson(null)).toBeNull();
		expect(parseStringifiedJson({ a: 1 })).toEqual({ a: 1 });
	});

	it("returns non-JSON strings as-is", () => {
		expect(parseStringifiedJson("hello")).toBe("hello");
		expect(parseStringifiedJson("")).toBe("");
	});

	it("parses JSON object strings", () => {
		expect(parseStringifiedJson('{"a": 1}')).toEqual({ a: 1 });
	});

	it("parses JSON array strings", () => {
		expect(parseStringifiedJson("[1, 2, 3]")).toEqual([1, 2, 3]);
	});

	it("returns invalid JSON-like strings as-is", () => {
		expect(parseStringifiedJson("{invalid}")).toBe("{invalid}");
	});
});

// ============================================================================
// normalizeOutputSchema
// ============================================================================

describe("normalizeOutputSchema", () => {
	it("returns empty for undefined/null", () => {
		expect(normalizeOutputSchema(undefined)).toEqual({});
		expect(normalizeOutputSchema(null)).toEqual({});
	});

	it("parses JSON string", () => {
		const result = normalizeOutputSchema('{"type": "object"}');
		expect(result.normalized).toEqual({ type: "object" });
		expect(result.error).toBeUndefined();
	});

	it("returns error for invalid JSON string", () => {
		const result = normalizeOutputSchema("{not json}");
		expect(result.error).toBeDefined();
		expect(result.normalized).toBeUndefined();
	});

	it("passes through objects directly", () => {
		const schema = { type: "object", properties: {} };
		const result = normalizeOutputSchema(schema);
		expect(result.normalized).toEqual(schema);
	});
});

// ============================================================================
// tryParseJsonOutput
// ============================================================================

describe("tryParseJsonOutput", () => {
	it("returns undefined for empty string", () => {
		expect(tryParseJsonOutput("")).toBeUndefined();
		expect(tryParseJsonOutput("   ")).toBeUndefined();
	});

	it("parses valid JSON", () => {
		expect(tryParseJsonOutput('{"status": "ok"}')).toEqual({ status: "ok" });
	});

	it("returns undefined for non-JSON", () => {
		expect(tryParseJsonOutput("hello world")).toBeUndefined();
	});
});

// ============================================================================
// extractCompletionData
// ============================================================================

describe("extractCompletionData", () => {
	it("returns primitives as-is", () => {
		expect(extractCompletionData(null)).toBeNull();
		expect(extractCompletionData("text")).toBe("text");
		expect(extractCompletionData(42)).toBe(42);
	});

	it("extracts data field when present", () => {
		expect(extractCompletionData({ data: { result: "ok" } })).toEqual({ result: "ok" });
	});

	it("returns object as-is when no data field", () => {
		const obj = { result: "ok" };
		expect(extractCompletionData(obj)).toEqual(obj);
	});
});

// ============================================================================
// normalizeCompleteData
// ============================================================================

describe("normalizeCompleteData", () => {
	it("handles null data", () => {
		expect(normalizeCompleteData(null)).toBeNull();
		expect(normalizeCompleteData(undefined)).toBeNull();
	});

	it("passes through object data", () => {
		expect(normalizeCompleteData({ result: "ok" })).toEqual({ result: "ok" });
	});

	it("parses stringified JSON data", () => {
		expect(normalizeCompleteData('{"result": "ok"}')).toEqual({ result: "ok" });
	});

	it("adds findings to object without findings field", () => {
		const findings = [{ title: "Bug", file_path: "a.ts", line_start: 1, line_end: 5 }];
		const result = normalizeCompleteData({ status: "done" }, findings as any);
		expect(result).toEqual({ status: "done", findings });
	});

	it("does not overwrite existing findings field", () => {
		const existing = [{ title: "Old" }];
		const newFindings = [{ title: "New" }];
		const result = normalizeCompleteData({ findings: existing }, newFindings as any);
		expect((result as any).findings).toEqual(existing);
	});

	it("does not add findings to arrays", () => {
		const result = normalizeCompleteData([1, 2], [{ title: "Bug" }] as any);
		expect(result).toEqual([1, 2]);
	});

	it("does not add empty findings array", () => {
		const result = normalizeCompleteData({ status: "ok" }, []);
		expect(result).toEqual({ status: "ok" });
	});
});

// ============================================================================
// withAbortTimeout
// ============================================================================

describe("withAbortTimeout", () => {
	it("resolves when promise resolves before timeout", async () => {
		const result = await withAbortTimeout(Promise.resolve("ok"), 1000);
		expect(result).toBe("ok");
	});

	it("rejects when promise rejects before timeout", async () => {
		try {
			await withAbortTimeout(Promise.reject(new Error("fail")), 1000);
			expect(true).toBe(false); // should not reach
		} catch (err) {
			expect((err as Error).message).toBe("fail");
		}
	});

	it("rejects with timeout error when promise takes too long", async () => {
		const slow = new Promise(resolve => setTimeout(resolve, 5000));
		try {
			await withAbortTimeout(slow, 10);
			expect(true).toBe(false);
		} catch (err) {
			expect((err as Error).message).toContain("timed out");
		}
	});

	it("rejects immediately when signal is already aborted", async () => {
		const controller = new AbortController();
		controller.abort();

		try {
			await withAbortTimeout(Promise.resolve("ok"), 1000, controller.signal);
			expect(true).toBe(false);
		} catch {
			// Expected - ToolAbortError
		}
	});

	it("rejects when signal is aborted during wait", async () => {
		const controller = new AbortController();
		const slow = new Promise(resolve => setTimeout(resolve, 5000));

		setTimeout(() => controller.abort(), 10);

		try {
			await withAbortTimeout(slow, 5000, controller.signal);
			expect(true).toBe(false);
		} catch {
			// Expected - ToolAbortError
		}
	});
});
