/**
 * Swarm schema parsing and validation tests.
 */
import { describe, expect, it } from "bun:test";
import { parseSwarmYaml, validateSwarmDefinition } from "../src/swarm/schema";

// ============================================================================
// parseSwarmYaml
// ============================================================================

describe("parseSwarmYaml", () => {
	it("parses a minimal valid swarm YAML", () => {
		const yaml = `
swarm:
  name: test-swarm
  workspace: /tmp/test
  agents:
    worker:
      role: developer
      task: write code
`;
		const def = parseSwarmYaml(yaml);

		expect(def.name).toBe("test-swarm");
		expect(def.workspace).toBe("/tmp/test");
		expect(def.mode).toBe("sequential"); // default
		expect(def.targetCount).toBe(1); // default
		expect(def.agents.size).toBe(1);
		expect(def.agents.get("worker")!.role).toBe("developer");
		expect(def.agents.get("worker")!.task).toBe("write code");
		expect(def.agentOrder).toEqual(["worker"]);
	});

	it("parses all optional fields", () => {
		const yaml = `
swarm:
  name: full-swarm
  workspace: /project
  mode: parallel
  target_count: 3
  model: gpt-4
  agents:
    planner:
      role: architect
      task: plan the system
      extra_context: focus on scalability
    worker:
      role: developer
      task: implement features
      waits_for:
        - planner
      reports_to:
        - planner
`;
		const def = parseSwarmYaml(yaml);

		expect(def.mode).toBe("parallel");
		expect(def.targetCount).toBe(3);
		expect(def.model).toBe("gpt-4");
		expect(def.agents.size).toBe(2);

		const planner = def.agents.get("planner")!;
		expect(planner.extraContext).toBe("focus on scalability");
		expect(planner.waitsFor).toEqual([]);
		expect(planner.reportsTo).toEqual([]);

		const worker = def.agents.get("worker")!;
		expect(worker.waitsFor).toEqual(["planner"]);
		expect(worker.reportsTo).toEqual(["planner"]);

		expect(def.agentOrder).toEqual(["planner", "worker"]);
	});

	it("throws if top-level swarm key is missing", () => {
		const yaml = `
name: test
workspace: /tmp
`;
		expect(() => parseSwarmYaml(yaml)).toThrow("top-level 'swarm' key");
	});

	it("throws if swarm.name is missing", () => {
		const yaml = `
swarm:
  workspace: /tmp
  agents:
    a:
      role: r
      task: t
`;
		expect(() => parseSwarmYaml(yaml)).toThrow("swarm.name");
	});

	it("throws if swarm.name contains invalid characters", () => {
		const yaml = `
swarm:
  name: "invalid name with spaces"
  workspace: /tmp
  agents:
    a:
      role: r
      task: t
`;
		expect(() => parseSwarmYaml(yaml)).toThrow("swarm.name may only contain");
	});

	it("throws if workspace is missing", () => {
		const yaml = `
swarm:
  name: test
  agents:
    a:
      role: r
      task: t
`;
		expect(() => parseSwarmYaml(yaml)).toThrow("swarm.workspace");
	});

	it("throws if agents is empty", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  agents: {}
`;
		expect(() => parseSwarmYaml(yaml)).toThrow("at least one agent");
	});

	it("throws if mode is invalid", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  mode: unknown
  agents:
    a:
      role: r
      task: t
`;
		expect(() => parseSwarmYaml(yaml)).toThrow("Invalid mode");
	});

	it("throws if agent role is missing", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  agents:
    a:
      task: do stuff
`;
		expect(() => parseSwarmYaml(yaml)).toThrow("'role' is required");
	});

	it("throws if agent task is missing", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  agents:
    a:
      role: developer
`;
		expect(() => parseSwarmYaml(yaml)).toThrow("'task' is required");
	});

	it("trims task and extra_context whitespace", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  agents:
    a:
      role: developer
      task: "  spaced task  "
      extra_context: "  extra  "
`;
		const def = parseSwarmYaml(yaml);
		expect(def.agents.get("a")!.task).toBe("spaced task");
		expect(def.agents.get("a")!.extraContext).toBe("extra");
	});

	it("accepts valid name patterns", () => {
		const validNames = ["my-swarm", "my_swarm", "my.swarm", "MySwarm123", "a"];
		for (const name of validNames) {
			const yaml = `
swarm:
  name: ${name}
  workspace: /tmp
  agents:
    a:
      role: r
      task: t
`;
			const def = parseSwarmYaml(yaml);
			expect(def.name).toBe(name);
		}
	});
});

// ============================================================================
// validateSwarmDefinition
// ============================================================================

describe("validateSwarmDefinition", () => {
	it("returns empty errors for valid definition", () => {
		const yaml = `
swarm:
  name: valid
  workspace: /tmp
  agents:
    a:
      role: r
      task: t
    b:
      role: r
      task: t
      waits_for:
        - a
`;
		const def = parseSwarmYaml(yaml);
		const errors = validateSwarmDefinition(def);
		expect(errors).toEqual([]);
	});

	it("detects waits_for referencing unknown agent", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  agents:
    a:
      role: r
      task: t
      waits_for:
        - nonexistent
`;
		const def = parseSwarmYaml(yaml);
		const errors = validateSwarmDefinition(def);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("unknown agent 'nonexistent'");
	});

	it("detects reports_to referencing unknown agent", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  agents:
    a:
      role: r
      task: t
      reports_to:
        - ghost
`;
		const def = parseSwarmYaml(yaml);
		const errors = validateSwarmDefinition(def);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("unknown agent 'ghost'");
	});

	it("detects self-referencing waits_for", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  agents:
    a:
      role: r
      task: t
      waits_for:
        - a
`;
		const def = parseSwarmYaml(yaml);
		const errors = validateSwarmDefinition(def);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("cannot wait for itself");
	});

	it("detects self-referencing reports_to", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  agents:
    a:
      role: r
      task: t
      reports_to:
        - a
`;
		const def = parseSwarmYaml(yaml);
		const errors = validateSwarmDefinition(def);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("cannot report to itself");
	});

	it("detects target_count in non-pipeline mode", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  mode: parallel
  target_count: 3
  agents:
    a:
      role: r
      task: t
`;
		const def = parseSwarmYaml(yaml);
		const errors = validateSwarmDefinition(def);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("target_count is only supported in pipeline mode");
	});

	it("allows target_count in pipeline mode", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  mode: pipeline
  target_count: 5
  agents:
    a:
      role: r
      task: t
`;
		const def = parseSwarmYaml(yaml);
		const errors = validateSwarmDefinition(def);
		expect(errors).toEqual([]);
	});

	it("collects multiple errors", () => {
		const yaml = `
swarm:
  name: test
  workspace: /tmp
  mode: parallel
  target_count: 2
  agents:
    a:
      role: r
      task: t
      waits_for:
        - a
        - unknown
      reports_to:
        - a
`;
		const def = parseSwarmYaml(yaml);
		const errors = validateSwarmDefinition(def);
		// self-wait, unknown dep, self-report, target_count in non-pipeline
		expect(errors.length).toBe(4);
	});
});
