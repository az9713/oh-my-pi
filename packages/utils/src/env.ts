import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Parses a .env file synchronously and extracts key-value string pairs.
 * Ignores lines that are empty or start with '#'. Trims whitespace.
 * Allows values to be quoted with single or double quotes.
 * Returns an object of key-value pairs.
 */
function parseEnvFile(filePath: string): Record<string, string> {
	const result: Record<string, string> = {};
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			// Skip comments and blank lines
			if (!trimmed || trimmed.startsWith("#")) continue;

			const eqIndex = trimmed.indexOf("=");
			if (eqIndex === -1) continue;

			const key = trimmed.slice(0, eqIndex).trim();
			let value = trimmed.slice(eqIndex + 1).trim();

			// Remove surrounding quotes (" or ')
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}

			result[key] = value;
		}
	} catch {
		// File doesn't exist or can't be read - return empty result
	}

	// OMP_ overrides PI_
	for (const k in result) {
		if (k.startsWith("OMP_")) {
			result[`PI_${k.slice(4)}`] = result[k];
		}
	}

	return result;
}

// Eagerly parse the user's $HOME/.env and the current project's .env (from cwd)
const homeEnv = parseEnvFile(path.join(os.homedir(), ".env"));
const projectEnv = parseEnvFile(path.join(process.cwd(), ".env"));

// omp config directory .env files (higher priority than generic .env).
// PI_CONFIG_DIR may itself come from a .env file, so resolve it after parsing the standard ones.
const configDirName = process.env.PI_CONFIG_DIR || projectEnv.PI_CONFIG_DIR || homeEnv.PI_CONFIG_DIR || ".omp";
const ompUserEnv = parseEnvFile(path.join(os.homedir(), configDirName, "agent", ".env"));
const ompProjectEnv = parseEnvFile(path.join(process.cwd(), configDirName, ".env"));

for (const file of [ompProjectEnv, ompUserEnv, projectEnv, homeEnv]) {
	for (const [key, value] of Object.entries(file)) {
		if (!Bun.env[key]) {
			Bun.env[key] = value;
		}
	}
}

/**
 * Intentional re-export of Bun.env.
 *
 * All users should import this env module (import { $env } from "@oh-my-pi/pi-utils")
 * before using environment variables. This ensures that .env files have been loaded and
 * overrides (project, home) have been applied, so $env always reflects the correct values.
 */
export const $env: Record<string, string> = Bun.env as Record<string, string>;
