/**
 * TTSR (Time-Traveling Streamed Rules) Manager tests.
 *
 * Tests rule registration, pattern matching, injection tracking,
 * repeat modes, buffer management, and state persistence.
 */
import { describe, expect, it } from "bun:test";
import { TtsrManager } from "@oh-my-pi/pi-coding-agent/export/ttsr";
import type { Rule } from "@oh-my-pi/pi-coding-agent/capability/rule";

// ============================================================================
// Helpers
// ============================================================================

function createRule(name: string, ttsrTrigger: string, content = "rule content"): Rule {
	return {
		name,
		content,
		source: "test",
		ttsrTrigger,
	} as Rule;
}

function createRuleWithoutTrigger(name: string, content = "rule content"): Rule {
	return {
		name,
		content,
		source: "test",
	} as Rule;
}

// ============================================================================
// Rule registration
// ============================================================================

describe("TtsrManager rule registration", () => {
	it("registers rules with valid ttsrTrigger patterns", () => {
		const manager = new TtsrManager();
		const rule = createRule("test-rule", "TODO|FIXME");

		manager.addRule(rule);

		expect(manager.hasRules()).toBe(true);
	});

	it("ignores rules without ttsrTrigger", () => {
		const manager = new TtsrManager();
		const rule = createRuleWithoutTrigger("no-trigger");

		manager.addRule(rule);

		expect(manager.hasRules()).toBe(false);
	});

	it("ignores duplicate rule names", () => {
		const manager = new TtsrManager();
		const rule1 = createRule("duplicate", "pattern1");
		const rule2 = createRule("duplicate", "pattern2");

		manager.addRule(rule1);
		manager.addRule(rule2);

		// First registration wins; check returns first pattern
		const matches = manager.check("pattern1");
		expect(matches.length).toBe(1);
		expect(matches[0].ttsrTrigger).toBe("pattern1");
	});

	it("skips rules with invalid regex patterns", () => {
		const manager = new TtsrManager();
		const rule = createRule("bad-regex", "[invalid(");

		// Should not throw
		manager.addRule(rule);

		expect(manager.hasRules()).toBe(false);
	});

	it("registers multiple rules", () => {
		const manager = new TtsrManager();
		manager.addRule(createRule("rule-a", "alpha"));
		manager.addRule(createRule("rule-b", "beta"));

		expect(manager.hasRules()).toBe(true);

		const matches = manager.check("alpha beta");
		expect(matches.length).toBe(2);
	});
});

// ============================================================================
// Pattern matching
// ============================================================================

describe("TtsrManager pattern matching", () => {
	it("matches simple string patterns", () => {
		const manager = new TtsrManager();
		manager.addRule(createRule("todo", "TODO"));

		expect(manager.check("I have a TODO item").length).toBe(1);
		expect(manager.check("Nothing here").length).toBe(0);
	});

	it("matches regex patterns", () => {
		const manager = new TtsrManager();
		manager.addRule(createRule("import", "import\\s+\\{.*\\}\\s+from"));

		expect(manager.check('import { foo } from "bar"').length).toBe(1);
		expect(manager.check("no imports here").length).toBe(0);
	});

	it("matches alternation patterns", () => {
		const manager = new TtsrManager();
		manager.addRule(createRule("keywords", "TODO|FIXME|HACK"));

		expect(manager.check("Found a FIXME").length).toBe(1);
		expect(manager.check("Found a HACK").length).toBe(1);
		expect(manager.check("All clean").length).toBe(0);
	});

	it("returns multiple matching rules", () => {
		const manager = new TtsrManager();
		manager.addRule(createRule("rule-a", "error"));
		manager.addRule(createRule("rule-b", "warning"));

		const text = "There is an error and a warning";
		const matches = manager.check(text);
		expect(matches.length).toBe(2);
		expect(matches.map(r => r.name).sort()).toEqual(["rule-a", "rule-b"]);
	});

	it("returns empty array for empty buffer", () => {
		const manager = new TtsrManager();
		manager.addRule(createRule("rule-a", "test"));

		expect(manager.check("").length).toBe(0);
	});
});

// ============================================================================
// Injection tracking — repeatMode "once"
// ============================================================================

describe("TtsrManager repeatMode once", () => {
	it("does not match a rule after it has been injected", () => {
		const manager = new TtsrManager({ repeatMode: "once" });
		const rule = createRule("once-rule", "trigger");

		manager.addRule(rule);

		// First match
		const first = manager.check("trigger text");
		expect(first.length).toBe(1);

		// Mark as injected
		manager.markInjected(first);

		// Second check — should not match
		const second = manager.check("trigger text again");
		expect(second.length).toBe(0);
	});

	it("tracks injected rule names for persistence", () => {
		const manager = new TtsrManager({ repeatMode: "once" });
		const ruleA = createRule("rule-a", "alpha");
		const ruleB = createRule("rule-b", "beta");

		manager.addRule(ruleA);
		manager.addRule(ruleB);

		manager.markInjected([ruleA]);

		const names = manager.getInjectedRuleNames();
		expect(names).toEqual(["rule-a"]);
	});
});

// ============================================================================
// Injection tracking — repeatMode "repeat-after-gap"
// ============================================================================

describe("TtsrManager repeatMode repeat-after-gap", () => {
	it("allows re-triggering after sufficient message gap", () => {
		const manager = new TtsrManager({ repeatMode: "repeat-after-gap", repeatGap: 3 });
		const rule = createRule("gap-rule", "trigger");

		manager.addRule(rule);

		// First match and inject
		const first = manager.check("trigger");
		expect(first.length).toBe(1);
		manager.markInjected(first);

		// Immediately after — should not match (gap = 0)
		expect(manager.check("trigger").length).toBe(0);

		// Increment message count past the gap
		manager.incrementMessageCount();
		manager.incrementMessageCount();
		manager.incrementMessageCount();

		// Now should match again
		expect(manager.check("trigger").length).toBe(1);
	});

	it("respects custom gap size", () => {
		const manager = new TtsrManager({ repeatMode: "repeat-after-gap", repeatGap: 5 });
		const rule = createRule("gap-5", "match");

		manager.addRule(rule);
		manager.markInjected([rule]);

		// Only 4 messages — not enough
		for (let i = 0; i < 4; i++) manager.incrementMessageCount();
		expect(manager.check("match").length).toBe(0);

		// 5th message — now enough
		manager.incrementMessageCount();
		expect(manager.check("match").length).toBe(1);
	});
});

// ============================================================================
// Buffer management
// ============================================================================

describe("TtsrManager buffer", () => {
	it("appends to and reads the stream buffer", () => {
		const manager = new TtsrManager();

		manager.appendToBuffer("hello ");
		manager.appendToBuffer("world");

		expect(manager.getBuffer()).toBe("hello world");
	});

	it("resets the buffer", () => {
		const manager = new TtsrManager();

		manager.appendToBuffer("content");
		expect(manager.getBuffer()).toBe("content");

		manager.resetBuffer();
		expect(manager.getBuffer()).toBe("");
	});

	it("starts with empty buffer", () => {
		const manager = new TtsrManager();
		expect(manager.getBuffer()).toBe("");
	});
});

// ============================================================================
// State restore
// ============================================================================

describe("TtsrManager state restore", () => {
	it("restores injected state from rule names", () => {
		const manager = new TtsrManager({ repeatMode: "once" });
		const rule = createRule("restored-rule", "trigger");

		manager.addRule(rule);
		manager.restoreInjected(["restored-rule"]);

		// Should not match since it's been restored as injected
		expect(manager.check("trigger").length).toBe(0);
	});

	it("ignores unknown rule names during restore", () => {
		const manager = new TtsrManager();
		// Should not throw
		manager.restoreInjected(["unknown-rule"]);
		expect(manager.getInjectedRuleNames()).toEqual(["unknown-rule"]);
	});
});

// ============================================================================
// Settings
// ============================================================================

describe("TtsrManager settings", () => {
	it("has sensible defaults", () => {
		const manager = new TtsrManager();
		const settings = manager.getSettings();

		expect(settings.enabled).toBe(true);
		expect(settings.contextMode).toBe("discard");
		expect(settings.repeatMode).toBe("once");
		expect(settings.repeatGap).toBe(10);
	});

	it("applies overrides", () => {
		const manager = new TtsrManager({
			enabled: false,
			contextMode: "discard",
			repeatMode: "repeat-after-gap",
			repeatGap: 20,
		});
		const settings = manager.getSettings();

		expect(settings.enabled).toBe(false);
		expect(settings.repeatMode).toBe("repeat-after-gap");
		expect(settings.repeatGap).toBe(20);
	});

	it("tracks message count", () => {
		const manager = new TtsrManager();

		expect(manager.getMessageCount()).toBe(0);
		manager.incrementMessageCount();
		manager.incrementMessageCount();
		expect(manager.getMessageCount()).toBe(2);
	});
});
