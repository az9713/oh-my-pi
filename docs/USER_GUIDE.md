# oh-my-pi User Guide

A comprehensive guide to using oh-my-pi (omp) - your AI-powered coding assistant for the terminal. This guide covers everything from installation to advanced features, with detailed explanations for every step.

## Table of Contents

1. [What is oh-my-pi?](#what-is-oh-my-pi)
2. [Installation](#installation)
3. [First Run and API Keys](#first-run-and-api-keys)
4. [The Interface](#the-interface)
5. [Basic Usage](#basic-usage)
6. [Working with Files](#working-with-files)
7. [Running Shell Commands](#running-shell-commands)
8. [Web Search and Fetch](#web-search-and-fetch)
9. [Code Review](#code-review)
10. [AI-Powered Git Commits](#ai-powered-git-commits)
11. [Session Management](#session-management)
12. [Slash Commands Reference](#slash-commands-reference)
13. [Keyboard Shortcuts](#keyboard-shortcuts)
14. [Model Selection and Roles](#model-selection-and-roles)
15. [The Python Tool](#the-python-tool)
16. [LSP Integration](#lsp-integration)
17. [The Task Tool (Subagents)](#the-task-tool-subagents)
18. [Browser Automation](#browser-automation)
19. [SSH Remote Execution](#ssh-remote-execution)
20. [Themes and Customization](#themes-and-customization)
21. [Project Configuration](#project-configuration)
22. [Extensions and Hooks](#extensions-and-hooks)
23. [Skills](#skills)
24. [MCP Servers and Plugins](#mcp-servers-and-plugins)
25. [Custom Model Providers](#custom-model-providers)
26. [Non-Interactive (Print) Mode](#non-interactive-print-mode)
27. [The Stats Dashboard](#the-stats-dashboard)
28. [Environment Variables Reference](#environment-variables-reference)
29. [Troubleshooting](#troubleshooting)
30. [Tips and Best Practices](#tips-and-best-practices)

---

## What is oh-my-pi?

oh-my-pi (omp) is an AI-powered coding assistant that runs in your terminal. Think of it as having an experienced developer sitting next to you who can:

- **Read and understand** your entire codebase
- **Write and edit** code across multiple files
- **Run commands** in your terminal
- **Search the web** for documentation and solutions
- **Review your code** and suggest improvements
- **Generate git commits** with meaningful messages
- **Execute Python** code with a persistent kernel
- **Automate browsers** for testing and scraping
- **Connect to remote servers** via SSH

Unlike web-based AI chat tools, omp works directly in your terminal with full access to your project files and development tools. It understands the context of your project and can take real actions (read files, write code, run tests) - not just give you text to copy-paste.

---

## Installation

### Prerequisites

You need **Bun** (a JavaScript runtime) installed. If you are familiar with Java, think of Bun as the "JVM" that runs omp.

**Install Bun:**

macOS / Linux:
```bash
curl -fsSL https://bun.sh/install | bash
```

Windows (PowerShell):
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify it works:
```bash
bun --version
```

### Install oh-my-pi

**Option 1: Via Bun (recommended)**
```bash
bun install -g @oh-my-pi/pi-coding-agent
```

**Option 2: Via installer script**

Linux / macOS:
```bash
curl -fsSL https://raw.githubusercontent.com/can1357/oh-my-pi/main/scripts/install.sh | sh
```

Windows (PowerShell):
```powershell
irm https://raw.githubusercontent.com/can1357/oh-my-pi/main/scripts/install.ps1 | iex
```

**Option 3: Download binary**

Download from [GitHub Releases](https://github.com/can1357/oh-my-pi/releases/latest).

### Verify Installation

```bash
omp --version
```

If you see "command not found", add Bun's bin directory to your PATH:
```bash
export PATH="$HOME/.bun/bin:$PATH"
```
Add this line to your `~/.bashrc` or `~/.zshrc` to make it permanent.

---

## First Run and API Keys

omp needs an API key from at least one AI provider to work. Here are your options:

### Option A: Anthropic Claude (Recommended)

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Go to API Keys and create a new key
4. Set the environment variable:
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

### Option B: OpenAI GPT

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Go to API Keys and create a new key
4. Set the environment variable:
```bash
export OPENAI_API_KEY="sk-..."
```

### Option C: Google Gemini

1. Go to https://aistudio.google.com/apikey
2. Create a new API key
3. Set the environment variable:
```bash
export GOOGLE_API_KEY="AI..."
```

### Making the API Key Permanent

Add the export line to your shell profile so it persists across terminal sessions:

**bash users** (most Linux systems):
```bash
echo 'export ANTHROPIC_API_KEY="your-key-here"' >> ~/.bashrc
source ~/.bashrc
```

**zsh users** (macOS default):
```bash
echo 'export ANTHROPIC_API_KEY="your-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### Using .env Files

Instead of shell profiles, you can store API keys in `.env` files. omp loads them automatically from these locations (highest priority first):

| Location | Scope |
|---|---|
| `.omp/.env` | Project omp config (highest `.env` priority) |
| `~/.omp/agent/.env` | User omp config |
| `.env` (cwd) | Project dotenv |
| `~/.env` | User dotenv (lowest priority) |

Process environment variables always take precedence over `.env` files. Within `.env` files, the first file to define a key wins.

Example `~/.omp/agent/.env`:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
```

This is convenient because it keeps secrets out of shell history and works across all shells.

### First Launch

Navigate to any project directory and start omp:
```bash
cd /path/to/your/project
omp
```

You will see a welcome screen with the omp logo, recent sessions (if any), and an input area at the bottom.

---

## The Interface

When omp starts, the screen is divided into sections:

```
+------------------------------------------+
|  Welcome / Messages area                  |
|  (conversation history appears here)      |
|                                           |
|  Agent responses, tool outputs, and       |
|  your messages are displayed here.        |
|                                           |
+------------------------------------------+
|  [Todo panel - when active]               |
+------------------------------------------+
|  > Your input area                        |
|  (type here, press Enter twice to send)   |
+------------------------------------------+
|  Footer: model | cwd | git | tokens | %  |
+------------------------------------------+
```

### The Footer Bar

The footer at the bottom shows:
- **Model** - Currently selected AI model (e.g., "claude-sonnet-4")
- **cwd** - Current working directory
- **Git** - Current branch and status (if in a git repo)
- **Tokens** - Token usage for this session (input/output)
- **%** - Context window usage percentage (when this gets high, use `/compact`)

### Submitting Prompts

Type your request and press **Enter twice** (or press Enter on an empty line) to submit. This two-enter system lets you write multi-line prompts.

For example:
```
Read the main.ts file and explain what it does.
Focus on the error handling.
[press Enter on empty line to submit]
```

---

## Basic Usage

### Asking Questions About Your Code

```
What does the function handleAuth in src/auth.ts do?
```

The agent will read the file and explain the function in detail.

### Writing Code

```
Create a new file src/utils/validators.ts with a function
that validates email addresses using a regex pattern.
Include TypeScript types and JSDoc documentation.
```

The agent will create the file. You will see the code before it is written and can approve or deny the file creation.

### Editing Existing Code

```
In src/api/routes.ts, add rate limiting to the /login endpoint.
Use a simple in-memory counter that resets every minute.
```

The agent will read the file, understand the context, and make precise edits.

### Getting Explanations

```
Explain the architecture of this project. What are the main components
and how do they interact?
```

The agent will explore your project structure and provide a high-level overview.

---

## Working with Files

### Reading Files

The agent can read any file in your project. Just ask:
```
Read the package.json file
```

Or reference files directly with `@`:
```
@src/config.ts What configuration options are available?
```

The `@` syntax injects the file contents into your prompt, giving the agent immediate access.

You can also use wildcards:
```
@src/**/*.test.ts How many test files are there and what do they test?
```

### Writing Files

```
Create a new file called src/helpers/date-utils.ts with functions
for formatting dates, calculating differences, and parsing ISO strings.
```

The agent asks for your approval before creating or modifying any file.

### Editing Files

The agent uses precise, surgical edits. It does not rewrite entire files - it changes only what needs to change:

```
In src/database.ts, change the connection timeout from 5000 to 10000
```

### Searching Files

```
Find all files that import from the 'lodash' package
```

```
Search for all TODO comments in the codebase
```

The agent uses its built-in Grep and Glob tools for fast searching.

---

## Running Shell Commands

### Through the Agent

Ask the agent to run commands:
```
Run the tests and tell me if any fail
```

```
Show me the git log for the last 5 commits
```

The agent will use its Bash tool to execute commands and analyze the output.

### Quick Commands with `!`

Type `!` followed by a command to run it directly (output is shown but NOT sent to the AI):
```
!git status
!ls -la
!npm test
```

### Commands with AI Context using `!!`

Type `!!` to run a command AND include its output in the conversation:
```
!!npm test
The tests above failed. Please fix the issues.
```

This is powerful because the agent can see the command output and act on it.

---

## Web Search and Fetch

omp can search the web and read web pages:

### Searching

```
Search for best practices for React error boundaries in 2024
```

The agent uses multiple search providers (Anthropic, Perplexity, Exa) with automatic fallback.

### Reading Web Pages

```
Read the documentation at https://docs.example.com/api and summarize it
```

omp has 80+ specialized scrapers for popular sites including GitHub, Stack Overflow, npm, PyPI, arXiv, Wikipedia, and many more.

---

## Code Review

### The /review Command

Type `/review` inside omp for an interactive code review. You will be asked what to review:

1. **Branch comparison** - Compare your current branch to main/master
2. **Uncommitted changes** - Review changes before committing
3. **Specific commits** - Review one or more specific commits

### Review Output

The review produces structured findings with priority levels:

| Priority | Meaning |
|---|---|
| **P0** | Critical - Must fix before merging (bugs, security issues) |
| **P1** | Important - Should fix (code quality, performance) |
| **P2** | Nice to have - Consider fixing (readability, minor improvements) |
| **P3** | Nit - Optional style suggestions |

The review ends with an overall verdict: Approve, Request Changes, or Comment.

---

## AI-Powered Git Commits

### The omp commit Command

From your terminal (not inside omp):
```bash
omp commit
```

This will:
1. Analyze all your staged and unstaged changes
2. Review the git diff
3. Match your commit message style (from recent history)
4. Split unrelated changes into separate atomic commits if needed
5. Stage and commit with a meaningful message

### Options

```bash
omp commit --push        # Commit and push
omp commit --dry-run     # See what it would do without doing it
omp commit --no-changelog # Skip changelog generation
omp commit --legacy      # Use simpler, deterministic pipeline
```

---

## Session Management

### What is a Session?

Every time you use omp, your conversation is saved as a "session." Sessions preserve the full conversation history, including tool calls and results.

### Resuming Sessions

```bash
omp --resume            # Resume the most recent session
omp --resume abc123     # Resume a specific session by ID prefix
```

### Branching

Inside omp, create a checkpoint before trying something risky:
```
/branch trying-new-approach
```

If it does not work out:
```
/tree
```

This shows a visual tree of your conversation branches. Navigate with arrow keys and press Enter to go back to an earlier state.

### Compacting

When the context gets too long (watch the `%` in the footer):
```
/compact
```

This summarizes older messages to free up context space while preserving the important information.

### Starting Fresh

```
/clear          # Clear context but keep the session
```

Or press `Ctrl+D` or `Ctrl+C` to exit completely.

---

## Slash Commands Reference

Type these inside omp:

| Command | Description |
|---|---|
| `/help` | Show available commands and help |
| `/review` | Start interactive code review |
| `/model` | Open model selector (change AI model) |
| `/theme` | Open theme selector (65+ themes) |
| `/thinking` | Set thinking level (none/low/medium/high/xhigh) |
| `/compact` | Compress conversation to save context |
| `/clear` | Clear conversation context |
| `/branch [name]` | Create a conversation checkpoint |
| `/tree` | Show conversation branch tree |
| `/config` | Open configuration settings |
| `/background` | Detach UI and continue agent execution |
| `/browser` | Toggle browser headless/visible mode |
| `/export` | Export session to HTML |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+D` or `Ctrl+C` | Exit omp |
| `Enter` (on empty line) | Submit prompt |
| `Ctrl+R` | Search command history |
| `Up/Down` | Navigate command history |
| `Tab` | Autocomplete file paths |
| `Ctrl+L` | Clear screen (visual only) |
| `Ctrl+T` | Toggle todo panel |
| `Ctrl+G` | Open external editor |
| `?` | Show shortcuts (when editor is empty) |

---

## Model Selection and Roles

### Changing Models

Type `/model` to open the model selector. Use arrow keys and Enter to select.

You can also start omp with a specific model role:
```bash
omp --smol     # Use the fast/cheap model
omp --slow     # Use the comprehensive reasoning model
```

### Model Roles

omp has three model roles:

| Role | Purpose | Examples |
|---|---|---|
| **default** | Main model for general use | Claude Sonnet, GPT-4o |
| **smol** | Fast/cheap for simple tasks | Claude Haiku, Gemini Flash |
| **slow** | Thorough for complex analysis | Claude Opus, GPT-o1 |

The Task tool (subagents) can specify which role to use:
- `model: pi/smol` - Use the fast model for quick exploration
- `model: pi/slow` - Use the reasoning model for complex tasks

### Environment Variables

Override roles via environment variables:
```bash
export PI_SMOL_MODEL="claude-haiku"
export PI_SLOW_MODEL="claude-opus"
```

---

## The Python Tool

omp includes a persistent Python/IPython kernel for running Python code.

### Setup (One-Time)

```bash
omp setup python
```

This installs the required Python packages (Jupyter kernel, pandas, matplotlib, etc.).

### Usage

Inside omp, ask for Python code execution:
```
Using Python, read the CSV file data.csv and show me basic statistics
```

The Python kernel persists between requests, so you can build on previous work:
```
Now create a bar chart of the top 10 values
```

### Built-in Helpers

The Python tool comes with 30+ shell-like helpers:
- `cat()`, `sed()`, `find()`, `grep()` - File operations
- `git_status()`, `git_diff()`, `git_log()` - Git operations
- `extract_lines()`, `delete_lines()`, `insert_lines()` - Line operations
- `sh()`, `run()`, `batch()` - Shell execution

### Custom Python Modules

Add Python modules to `.omp/modules/` or `~/.omp/agent/modules/` and they will be automatically available in the Python kernel.

---

## LSP Integration

omp integrates with Language Server Protocol (LSP) servers for IDE-like intelligence.

### What it Provides

- **Auto-format on write** - Code is formatted when the agent writes files
- **Diagnostics on edit** - Immediate feedback on syntax errors and type issues
- **Hover documentation** - Look up symbol documentation
- **Symbol search** - Find definitions and references across the workspace
- **Code actions** - Quick fixes and refactoring suggestions

### Supported Languages

Over 40 languages are supported out of the box, including: Rust, Go, Python, TypeScript, JavaScript, Java, Kotlin, Scala, C, C++, C#, Ruby, PHP, Swift, Haskell, OCaml, Elixir, Lua, and many more.

### How it Works

LSP servers are auto-discovered from your project. For example:
- `node_modules/.bin/typescript-language-server` for TypeScript
- `rust-analyzer` for Rust
- `gopls` for Go
- `.venv/bin/pylsp` for Python

You can also configure custom LSP servers in `.omp/lsp.json`.

---

## The Task Tool (Subagents)

The Task tool lets the main agent spawn sub-agents that work in parallel.

### How it Works

When you ask for something complex, the agent might spawn sub-agents:
```
I need three things done:
1. Find all TODO comments and create a task list
2. Audit dependencies for security vulnerabilities
3. Generate a summary of recent git activity
```

The agent spawns three independent sub-agents that work simultaneously. You can see their progress at the bottom of the screen.

### Built-in Agent Types

| Agent | Purpose |
|---|---|
| **explore** | Fast codebase exploration and research |
| **plan** | Design implementation approaches |
| **browser** | Web browsing and automation |
| **task** | General-purpose implementation |
| **reviewer** | Code review with structured findings |

### Isolated Tasks

Tasks can run in git worktrees (isolated copies) for safe experimentation:
```
Run this refactoring in isolation so it doesn't affect my working tree
```

---

## Browser Automation

omp includes a headless browser for web automation.

### What it Can Do

- Navigate to URLs
- Click buttons and links
- Fill forms
- Take screenshots
- Extract page content
- Execute JavaScript
- Use accessibility snapshots for reliable targeting

### Usage

```
Open the browser and navigate to https://example.com
Take a screenshot of the page
```

### Toggle Visibility

Use `/browser` to switch between headless (invisible) and visible (you can watch) modes.

---

## SSH Remote Execution

omp can execute commands on remote servers.

### Configuration

Create `.omp/ssh.json` (or `ssh.json`) in your project:
```json
{
   "hosts": [
      {
         "name": "production",
         "host": "prod.example.com",
         "user": "deploy"
      }
   ]
}
```

### Usage

```
Connect to the production server and check disk usage
```

Features:
- Persistent connections (reuses SSH sessions)
- OS/shell auto-detection
- Optional SSHFS mounting for file access

---

## Themes and Customization

### Changing Themes

Type `/theme` to browse 65+ built-in themes:
- Catppuccin (Mocha, Macchiato, Frappe, Latte)
- Dracula, Nord, Gruvbox, Tokyo Night, Solarized
- One Dark/Light, Material variants
- And many more

Preview themes in real-time with arrow keys, press Enter to select.

### Custom Themes

Create custom themes in `~/.omp/agent/themes/`. Your theme persists across sessions.

---

## Project Configuration

### Project-Level Settings

Create a `.omp/` directory in your project root:

```
your-project/
  .omp/
    SYSTEM.md           # Project-specific system prompt
    settings.json       # Project settings
    extensions/         # Project extensions
    hooks/              # Project hooks
    agents/             # Custom task agents
    mcp.json            # MCP server config
    lsp.json            # LSP server config
```

### SYSTEM.md (Project Rules)

Create `.omp/SYSTEM.md` to set project-specific rules:

```markdown
# Project Conventions

- Use TypeScript strict mode
- All functions must have JSDoc comments
- Use conventional commit format
- Never modify files in the vendor/ directory
- Tests must be in __tests__/ directories
```

The agent reads this file automatically and follows the rules.

### settings.json

```json
{
   "theme": "catppuccin-mocha",
   "model": "claude-sonnet-4",
   "edit.fuzzyMatch": true,
   "python.sharedGateway": true,
   "todoCompletion": true
}
```

### Universal Config Discovery

omp discovers configuration from 8 AI coding tools:
- oh-my-pi (`.omp/`)
- Claude Code (`.claude/`)
- Cursor (`.cursor/`, `.cursorrules`)
- Windsurf (`.windsurfrules`)
- Gemini (`.gemini/`)
- Codex (`.codex/`)
- Cline (`.clinerules`)
- GitHub Copilot (`.github/copilot-instructions.md`)

Priority order: `.omp` > `.pi` > `.claude` > `.codex` > `.gemini`

This means if you already have configuration for other AI tools, omp will use it automatically.

---

## Extensions and Hooks

### What are Extensions?

Extensions are TypeScript modules that extend omp's behavior. They can:
- Subscribe to lifecycle events (session start, tool calls, etc.)
- Register custom tools the AI can use
- Add slash commands
- Modify tool call behavior (block, modify, log)
- Provide custom UI components

### Creating a Simple Extension

Create `~/.omp/agent/extensions/my-extension.ts`:

```typescript
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function (pi: ExtensionAPI) {
   pi.on("session_start", async (_event, ctx) => {
      ctx.ui.notify("Extension loaded!", "info");
   });
}
```

### What are Hooks?

Hooks are similar to extensions but focused on event interception. Create them in `~/.omp/agent/hooks/pre/` or `~/.omp/agent/hooks/post/`:

```typescript
import type { HookAPI } from "@oh-my-pi/pi-coding-agent/hooks";

export default function (pi: HookAPI) {
   pi.on("tool_call", async (event, ctx) => {
      if (event.toolName === "bash" && event.input.command?.includes("rm")) {
         const ok = await ctx.ui.confirm("Warning", "Allow delete command?");
         if (!ok) return { block: true, reason: "Blocked by user" };
      }
   });
}
```

### Testing Extensions/Hooks

```bash
omp -e ./my-extension.ts    # Test an extension
omp --hook ./my-hook.ts     # Test a hook
```

---

## Skills

Skills are on-demand capability packages that the agent loads when it needs them.

### What They Are

A skill is a directory with a `SKILL.md` file containing instructions, plus optional scripts and reference materials:

```
my-skill/
  SKILL.md              # Instructions (YAML frontmatter + markdown)
  scripts/              # Helper scripts
  references/           # Detailed documentation
  assets/               # Templates, configs
```

### Skill Locations

- User-level: `~/.omp/agent/skills/`
- Project-level: `.omp/skills/`

### When Skills Load

Skills load automatically when the agent determines the task matches a skill's description, or when you explicitly mention a skill:
```
Use the pdf skill to extract tables from document.pdf
```

---

## MCP Servers and Plugins

### What is MCP?

MCP (Model Context Protocol) is a standard for connecting AI agents to external tools and data sources. omp supports MCP servers for extending its capabilities.

### Configuring MCP Servers

Create `.omp/mcp.json`:
```json
{
   "servers": {
      "my-server": {
         "command": "npx",
         "args": ["-y", "my-mcp-server"],
         "env": {
            "API_KEY": "your-key"
         }
      }
   }
}
```

### Plugin System

Install plugins from npm:
```bash
omp plugin install my-plugin
omp plugin enable my-plugin
omp plugin configure my-plugin
```

Check plugin health:
```bash
omp plugin doctor
```

---

## Custom Model Providers

### models.yml

Configure custom model providers in `~/.omp/agent/models.yml`:

```yaml
providers:
  my-local-llm:
    baseUrl: http://localhost:11434/v1
    api: openai-completions
    auth: none
    discovery:
      type: ollama
```

### Common Integrations

**Ollama (local models):**
```yaml
providers:
  ollama:
    baseUrl: http://localhost:11434/v1
    api: openai-completions
    auth: none
    discovery:
      type: ollama
```

**OpenAI-compatible servers:**
```yaml
providers:
  my-server:
    baseUrl: https://api.myserver.com/v1
    apiKey: MY_API_KEY
    api: openai-responses
    models:
      - id: my-model
        name: My Custom Model
        contextWindow: 128000
        maxTokens: 16384
```

### Supported API Adapters

- `openai-completions` - Standard OpenAI completions
- `openai-responses` - OpenAI responses API
- `anthropic-messages` - Anthropic Claude API
- `google-generative-ai` - Google Gemini API
- `google-vertex` - Google Vertex AI
- `azure-openai-responses` - Azure OpenAI

---

## Non-Interactive (Print) Mode

Use omp in scripts and automation:

```bash
# Quick question
omp -p "What does main.ts do?"

# Pipe output
omp -p "List all exported functions" > functions.txt

# JSON output for scripting
omp -p "Review this code" --json

# Use in shell scripts
SUMMARY=$(omp -p "Summarize the last 5 commits")
```

### CLI Flags

| Flag | Description |
|---|---|
| `-p "prompt"` | Non-interactive mode with given prompt |
| `--resume` | Resume last session |
| `--session <id>` | Resume specific session |
| `--model <model>` | Use specific model |
| `--smol` | Use fast/cheap model |
| `--slow` | Use reasoning model |
| `--json` | Output JSON format |
| `--no-tools` | Disable all tools |
| `--no-extensions` | Disable extensions |
| `-e <path>` | Load specific extension |
| `--hook <path>` | Load specific hook |
| `--help` | Show all options |

---

## The Stats Dashboard

Track your AI usage with the built-in stats dashboard:

```bash
omp stats
```

This shows:
- Total requests and token usage
- Cost estimates per provider
- Cache hit rates
- Tokens per second
- Usage over time

---

## Environment Variables Reference

### Essential Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google Gemini API key |

### Model Overrides

| Variable | Description |
|---|---|
| `PI_SMOL_MODEL` | Override the fast/cheap model |
| `PI_SLOW_MODEL` | Override the reasoning model |
| `PI_PLAN_MODEL` | Override the planning model |

### Agent Configuration

| Variable | Description | Default |
|---|---|---|
| `PI_CODING_AGENT_DIR` | Agent data directory | `~/.omp/agent` |
| `PI_NOTIFICATIONS` | Desktop notifications | Enabled |
| `VIRTUAL_ENV` | Python virtual environment path | Auto-detected |

### Debugging

| Variable | Description |
|---|---|
| `DEBUG` | Enable debug logging |
| `PI_DEV` | Development mode |
| `PI_TIMING` | Log operation timings |
| `PI_DEBUG_STARTUP` | Print startup timings |

For the complete list, see `packages/coding-agent/docs/environment-variables.md`.

---

## Troubleshooting

### "Command not found: omp"

Make sure Bun's global bin directory is in your PATH:
```bash
export PATH="$HOME/.bun/bin:$PATH"
```
Add to your shell profile for permanence.

### "API key not found"

Set your API key as an environment variable:
```bash
export ANTHROPIC_API_KEY="your-key"
```
Add to `~/.bashrc` or `~/.zshrc`, or place it in `~/.omp/agent/.env` (see [Using .env Files](#using-env-files)).

### "Context limit exceeded"

Your conversation is too long. Options:
- Use `/compact` to compress older messages
- Use `/clear` to start fresh (keeps the session)
- Start a new session

### Python tool not working

Run the one-time setup:
```bash
omp setup python
```

### Terminal looks corrupted after crash

Run the `reset` command:
```bash
reset
```

### Native addon errors

The Rust native addon may need rebuilding:
```bash
bun --cwd=packages/natives run build:native
```

### Slow startup

On first run, omp may download required tools (like `fd` and `rg`). This is normal and only happens once.

### Agent seems confused or stuck

- Be more specific in your prompts
- Use `/compact` to reduce context noise
- Use `/clear` to start with a clean slate
- Try a different model with `/model`

---

## Tips and Best Practices

### 1. Be Specific
Instead of "fix the code", say:
```
Fix the null pointer error in src/auth.ts line 42 by adding a null check
before accessing user.email
```

### 2. Use @file References
Include relevant files in your prompt:
```
@src/types.ts @src/api.ts
The types don't match the API response. Fix the type definitions.
```

### 3. Set Up Project Rules
Create `.omp/SYSTEM.md` with your project conventions. The agent will follow them automatically.

### 4. Use /compact Before Context Runs Out
Watch the `%` in the footer. When it gets above 80%, use `/compact`.

### 5. Branch Before Risky Changes
```
/branch before-refactoring
```
If things go wrong, use `/tree` to go back.

### 6. Use the Right Model for the Job
- Simple questions: `/model` and pick a fast model (Haiku, Flash)
- Complex refactoring: Use `--slow` for reasoning models

### 7. Combine Tools Naturally
```
Search the web for React 19 migration guide, then update my React
components in src/components/ to use the new patterns
```

### 8. Use Print Mode for Quick Tasks
```bash
omp -p "What version of React is in package.json?"
```

### 9. Leverage Session Resume
If you are working on a long task across multiple days:
```bash
omp --resume
```

### 10. Learn the Slash Commands
The most useful ones to remember:
- `/review` - Code review
- `/compact` - Compress context
- `/model` - Change model
- `/theme` - Change visual theme
- `/tree` - Navigate conversation history
