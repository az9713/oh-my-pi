/**
 * Swarm DAG tests.
 *
 * Tests dependency graph building, cycle detection, and execution wave computation.
 */
import { describe, expect, it } from "bun:test";
import { buildDependencyGraph, buildExecutionWaves, detectCycles } from "../src/swarm/dag";
import type { SwarmAgent, SwarmDefinition } from "../src/swarm/schema";

// ============================================================================
// Helpers
// ============================================================================

function createAgent(name: string, opts: { waitsFor?: string[]; reportsTo?: string[] } = {}): SwarmAgent {
	return {
		name,
		role: `${name} role`,
		task: `${name} task`,
		waitsFor: opts.waitsFor ?? [],
		reportsTo: opts.reportsTo ?? [],
	};
}

function createSwarmDef(
	agents: SwarmAgent[],
	mode: SwarmDefinition["mode"] = "parallel",
): SwarmDefinition {
	const agentMap = new Map<string, SwarmAgent>();
	const agentOrder: string[] = [];
	for (const agent of agents) {
		agentMap.set(agent.name, agent);
		agentOrder.push(agent.name);
	}
	return {
		name: "test-swarm",
		workspace: "/tmp/test",
		mode,
		targetCount: 1,
		agents: agentMap,
		agentOrder,
	};
}

// ============================================================================
// buildDependencyGraph
// ============================================================================

describe("buildDependencyGraph", () => {
	it("returns empty deps for agents with no relationships", () => {
		const def = createSwarmDef([createAgent("a"), createAgent("b"), createAgent("c")]);
		const deps = buildDependencyGraph(def);

		expect(deps.size).toBe(3);
		expect(deps.get("a")!.size).toBe(0);
		expect(deps.get("b")!.size).toBe(0);
		expect(deps.get("c")!.size).toBe(0);
	});

	it("handles explicit waits_for dependencies", () => {
		const def = createSwarmDef([
			createAgent("a"),
			createAgent("b", { waitsFor: ["a"] }),
			createAgent("c", { waitsFor: ["a", "b"] }),
		]);
		const deps = buildDependencyGraph(def);

		expect(deps.get("a")!.size).toBe(0);
		expect(deps.get("b")!.has("a")).toBe(true);
		expect(deps.get("c")!.has("a")).toBe(true);
		expect(deps.get("c")!.has("b")).toBe(true);
	});

	it("handles reports_to as reverse dependency", () => {
		// If A reports_to B, then B depends on A
		const def = createSwarmDef([
			createAgent("worker", { reportsTo: ["manager"] }),
			createAgent("manager"),
		]);
		const deps = buildDependencyGraph(def);

		expect(deps.get("worker")!.size).toBe(0);
		expect(deps.get("manager")!.has("worker")).toBe(true);
	});

	it("ignores references to unknown agents", () => {
		const def = createSwarmDef([
			createAgent("a", { waitsFor: ["nonexistent"] }),
		]);
		const deps = buildDependencyGraph(def);

		// "nonexistent" is not in the graph, so the dep is skipped
		expect(deps.get("a")!.size).toBe(0);
	});

	it("chains agents sequentially in pipeline mode with no explicit deps", () => {
		const def = createSwarmDef(
			[createAgent("first"), createAgent("second"), createAgent("third")],
			"pipeline",
		);
		const deps = buildDependencyGraph(def);

		expect(deps.get("first")!.size).toBe(0);
		expect(deps.get("second")!.has("first")).toBe(true);
		expect(deps.get("third")!.has("second")).toBe(true);
	});

	it("chains agents sequentially in sequential mode with no explicit deps", () => {
		const def = createSwarmDef(
			[createAgent("a"), createAgent("b"), createAgent("c")],
			"sequential",
		);
		const deps = buildDependencyGraph(def);

		expect(deps.get("a")!.size).toBe(0);
		expect(deps.get("b")!.has("a")).toBe(true);
		expect(deps.get("c")!.has("b")).toBe(true);
	});

	it("does not chain in pipeline mode if explicit deps exist", () => {
		const def = createSwarmDef(
			[createAgent("a"), createAgent("b", { waitsFor: ["a"] }), createAgent("c")],
			"pipeline",
		);
		const deps = buildDependencyGraph(def);

		// c has explicit dep from b (via chain)? No — explicit deps exist so no auto-chaining
		expect(deps.get("c")!.size).toBe(0);
	});
});

// ============================================================================
// detectCycles
// ============================================================================

describe("detectCycles", () => {
	it("returns null for acyclic graph", () => {
		const deps = new Map<string, Set<string>>([
			["a", new Set()],
			["b", new Set(["a"])],
			["c", new Set(["b"])],
		]);

		expect(detectCycles(deps)).toBeNull();
	});

	it("detects simple two-node cycle", () => {
		const deps = new Map<string, Set<string>>([
			["a", new Set(["b"])],
			["b", new Set(["a"])],
		]);

		const cycles = detectCycles(deps);
		expect(cycles).not.toBeNull();
		expect(cycles!.sort()).toEqual(["a", "b"]);
	});

	it("detects three-node cycle", () => {
		const deps = new Map<string, Set<string>>([
			["a", new Set(["c"])],
			["b", new Set(["a"])],
			["c", new Set(["b"])],
		]);

		const cycles = detectCycles(deps);
		expect(cycles).not.toBeNull();
		expect(cycles!.sort()).toEqual(["a", "b", "c"]);
	});

	it("returns null for empty graph", () => {
		expect(detectCycles(new Map())).toBeNull();
	});

	it("returns null for single node with no deps", () => {
		const deps = new Map<string, Set<string>>([["a", new Set()]]);
		expect(detectCycles(deps)).toBeNull();
	});

	it("detects self-referencing node", () => {
		const deps = new Map<string, Set<string>>([["a", new Set(["a"])]]);
		const cycles = detectCycles(deps);
		expect(cycles).not.toBeNull();
		expect(cycles).toEqual(["a"]);
	});

	it("detects cycle in subgraph while other nodes are acyclic", () => {
		const deps = new Map<string, Set<string>>([
			["a", new Set()],
			["b", new Set(["a"])],
			["c", new Set(["d"])], // cycle: c -> d -> c
			["d", new Set(["c"])],
		]);

		const cycles = detectCycles(deps);
		expect(cycles).not.toBeNull();
		expect(cycles!.sort()).toEqual(["c", "d"]);
	});
});

// ============================================================================
// buildExecutionWaves
// ============================================================================

describe("buildExecutionWaves", () => {
	it("puts all independent nodes in first wave", () => {
		const deps = new Map<string, Set<string>>([
			["a", new Set()],
			["b", new Set()],
			["c", new Set()],
		]);

		const waves = buildExecutionWaves(deps);
		expect(waves.length).toBe(1);
		expect(waves[0].sort()).toEqual(["a", "b", "c"]);
	});

	it("produces correct waves for linear chain", () => {
		const deps = new Map<string, Set<string>>([
			["a", new Set()],
			["b", new Set(["a"])],
			["c", new Set(["b"])],
		]);

		const waves = buildExecutionWaves(deps);
		expect(waves).toEqual([["a"], ["b"], ["c"]]);
	});

	it("produces correct waves for diamond graph", () => {
		// a -> b, a -> c, b -> d, c -> d
		const deps = new Map<string, Set<string>>([
			["a", new Set()],
			["b", new Set(["a"])],
			["c", new Set(["a"])],
			["d", new Set(["b", "c"])],
		]);

		const waves = buildExecutionWaves(deps);
		expect(waves.length).toBe(3);
		expect(waves[0]).toEqual(["a"]);
		expect(waves[1].sort()).toEqual(["b", "c"]);
		expect(waves[2]).toEqual(["d"]);
	});

	it("handles empty graph", () => {
		const waves = buildExecutionWaves(new Map());
		expect(waves).toEqual([]);
	});

	it("handles single node", () => {
		const deps = new Map<string, Set<string>>([["solo", new Set()]]);
		const waves = buildExecutionWaves(deps);
		expect(waves).toEqual([["solo"]]);
	});

	it("sorts agents within each wave for determinism", () => {
		const deps = new Map<string, Set<string>>([
			["zebra", new Set()],
			["apple", new Set()],
			["mango", new Set()],
		]);

		const waves = buildExecutionWaves(deps);
		expect(waves[0]).toEqual(["apple", "mango", "zebra"]);
	});

	it("throws on deadlock (cycle)", () => {
		const deps = new Map<string, Set<string>>([
			["a", new Set(["b"])],
			["b", new Set(["a"])],
		]);

		expect(() => buildExecutionWaves(deps)).toThrow("Deadlock");
	});
});
