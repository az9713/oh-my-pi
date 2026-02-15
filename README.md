<p align="center">
  <img src="https://github.com/can1357/oh-my-pi/blob/main/assets/hero.png?raw=true" alt="Oh My Pi">
</p>

<p align="center">
  <strong>AI coding agent for the terminal</strong>
</p>

<p align="center">
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&colorA=222222&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://www.rust-lang.org"><img src="https://img.shields.io/badge/Rust-DEA584?style=flat&colorA=222222&logo=rust&logoColor=white" alt="Rust"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f472b6?style=flat&colorA=222222" alt="Bun"></a>
  <a href="https://github.com/can1357/oh-my-pi/blob/main/LICENSE"><img src="https://img.shields.io/github/license/can1357/oh-my-pi?style=flat&colorA=222222&colorB=58A6FF" alt="License"></a>
</p>

> **This is a fork of [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)** (itself a fork of [badlogic/pi-mono](https://github.com/badlogic/pi-mono) by [@mariozechner](https://github.com/mariozechner)).
>
> This fork focuses on **agent harness enhancements** -- strengthening the infrastructure around the LLM that covers the agent loop, tool execution, context management, MCP connectivity, and subagent orchestration.

---

## What This Fork Adds

This fork adds 8 targeted enhancements to the agent harness with full test coverage and documentation. These changes do not modify the user-facing CLI or TUI -- they strengthen the internal infrastructure that makes the agent reliable and observable.

### 1. Mock Stream Utilities & Extended Agent Loop Tests
Reusable test infrastructure for simulating multi-turn LLM conversations. Enables testing of exclusive tool concurrency, steering interrupts, follow-up message queuing, and error handling without real API calls.

### 2. Subagent Executor Utility Tests
55 unit tests for the pure utility functions that normalize model patterns, extract tool argument previews, handle usage token variants across providers, deduplicate report findings, and manage abort timeouts.

### 3. Agent Loop Telemetry (TurnMetrics)
A per-turn metrics callback (`onTurnMetrics`) that surfaces LLM latency, tool execution timing, per-tool breakdowns, context message counts, and token usage. Enables dashboards and performance monitoring.

### 4. TTSR (Time-Traveling Streamed Rules) Unit Tests
22 tests covering the pattern-matching rule injection system. Validates regex compilation, once vs repeat-after-gap triggering, buffer management, and state persistence across sessions.

### 5. MCP Connection Resilience
Timeout protection and abort signal support for MCP server connections. The manager starts servers in parallel with tracked promises, isolates failures, and returns partial results so the agent can work with available servers even if some fail.

### 6. Swarm Extension Tests
Tests for the DAG dependency graph algorithms (cycle detection, execution wave computation) and YAML schema validation used by the swarm orchestration system.

### 7. Compaction Quality Metrics
Token estimation, file operation tracking, and compaction trigger logic for long-running sessions. Chains file access metadata across compaction cycles so context-critical files are preserved.

### 8. Extended Streaming Edit Abort Tests
Integration tests for abort handling during streaming tool calls. Validates that partial diff state is captured for error reporting when users cancel mid-stream.

For full details on each enhancement, see [docs/ENHANCEMENTS.md](docs/ENHANCEMENTS.md).

---

## Relationship to Upstream

| | Upstream ([can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)) | This Fork |
|---|---|---|
| **Focus** | Full-featured AI coding agent | Agent harness reliability & observability |
| **Changes** | CLI, TUI, tools, providers, extensions | Agent loop, test infrastructure, metrics, resilience |
| **User-facing** | Yes (new features, UI changes) | No (internal infrastructure only) |
| **Test coverage** | Baseline | +8 enhancement test suites |
| **Documentation** | User guides, developer guides | Added ENHANCEMENTS.md with why/how/what |

This fork is intended to stay compatible with upstream. The enhancements are additive and do not break existing functionality.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Commands](#cli-commands)
- [Slash Commands (Interactive TUI)](#slash-commands-interactive-tui)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Configuration](#configuration)
- [Feature Deep Dive](#feature-deep-dive)
- [Packages](#packages)
- [License](#license)

---

## Project Overview

**oh-my-pi** is an AI-powered coding assistant that runs directly in your terminal. Think of it as having an expert programmer sitting next to you, ready to help with any coding task, right from your command line.

### What is an AI coding assistant?

If you're coming from C/C++/Java and are new to the world of AI-powered development tools, here's what you need to know:

An AI coding assistant is a program that uses large language models (LLMs) — the same technology behind ChatGPT — to help you write code, debug problems, refactor projects, and understand codebases. Instead of searching Stack Overflow or reading documentation for hours, you can ask the AI directly, and it can:

- **Read your code files** and understand what they do
- **Write new code** based on your requirements
- **Edit existing files** to fix bugs or add features
- **Run terminal commands** to test, build, or deploy your project
- **Search your codebase** to find patterns or problematic code
- **Explain complex code** in plain English
- **Generate git commits** with meaningful messages

### Why oh-my-pi?

oh-my-pi is designed for developers who live in the terminal. Instead of copying code back and forth between a web browser and your editor, the AI works directly in your development environment. It can:

- Access your files without you manually copying them
- Run commands and see the output immediately
- Make edits to multiple files in one go
- Remember the context of your entire conversation
- Work with any programming language or framework

This project is built with **Bun** (a modern JavaScript runtime, like Node.js but faster) and uses **Rust** (a systems programming language known for speed and safety) for performance-critical operations. Don't worry if you're not familiar with these technologies — as a user, you don't need to understand them to use oh-my-pi effectively.

### What makes oh-my-pi special?

- **Multi-provider support**: Works with Claude (Anthropic), GPT (OpenAI), Gemini (Google), and many others
- **Built-in tools**: File operations, terminal commands, code search, web browsing, Python execution, and more
- **Native performance**: Critical operations are implemented in Rust for speed
- **Extensible**: Plugin system, custom slash commands, hooks, and extensions
- **Session management**: Resume conversations, branch off into new contexts, view conversation history
- **Beautiful TUI**: Modern terminal interface with syntax highlighting, themes, and smart rendering

---

## Key Features

### AI-Powered Coding Assistant in Your Terminal

Talk to the AI directly from your command line. Ask questions, request code changes, debug issues — all without leaving your terminal.

### Multi-Provider LLM Support

Choose from multiple AI providers based on your needs and budget:

- **Anthropic Claude**: Industry-leading reasoning and code generation (Claude Opus, Sonnet, Haiku)
- **OpenAI GPT**: Including GPT-4o, o1, o3-mini
- **Google Gemini**: Cost-effective with large context windows (Gemini 2.0, Flash, Pro)
- **AWS Bedrock**: Enterprise-grade AI with various models
- **Mistral**: European AI provider with strong multilingual support
- **Groq**: Ultra-fast inference for supported models
- **Ollama**: Run AI models locally on your own hardware (no API key required)
- **Cursor**: Use your Cursor Pro subscription
- **GitHub Copilot**: Leverage your existing Copilot license

### Comprehensive Built-In Tools

The AI can use these tools automatically as it works:

- **File operations**: Read, write, edit files with fuzzy matching for reliable edits
- **Bash commands**: Execute any terminal command and see the results
- **Grep/Find**: Search your codebase using powerful regex patterns (powered by ripgrep)
- **Web search**: Look up documentation, packages, security vulnerabilities
- **Web fetch**: Scrape content from 80+ sites (GitHub, npm, Stack Overflow, arXiv, etc.)
- **Python REPL**: Execute Python code with a persistent IPython kernel
- **LSP integration**: Get IDE-like features (diagnostics, formatting, symbol lookup) for 40+ languages
- **Browser automation**: Control a headless browser for web scraping and testing
- **SSH**: Execute commands on remote servers
- **AST analysis**: Understand code structure at a deep level
- **Replace**: Find and replace across multiple files
- **Git operations**: View diffs, inspect commits, analyze changes

### AI-Powered Git Commits

Run `omp commit` to automatically generate meaningful commit messages:

- Analyzes your changes intelligently (file-by-file, hunk-by-hunk)
- Splits unrelated changes into separate atomic commits
- Follows conventional commit format (feat:, fix:, refactor:, etc.)
- Generates and applies changelog entries
- Validates commit messages to avoid filler words and meta phrases

### Session Management

Never lose your context:

- **Resume**: Pick up where you left off (`omp --resume` or `/resume` command)
- **Branch**: Create a new conversation branch from any point (`/branch`)
- **Tree navigation**: View and navigate your conversation history (`/tree`)
- **Auto-titling**: Sessions are automatically named based on your first message

### Extension/Plugin/Hook System

Extend oh-my-pi with custom functionality:

- **Plugins**: Install MCP (Model Context Protocol) servers for external tools
- **Extensions**: Write TypeScript modules that add new capabilities
- **Hooks**: Inject custom behavior at key points in the agent lifecycle
- **Custom slash commands**: Create your own TUI commands with full API access

### 65+ Built-In Themes

Customize your terminal experience with themes like Catppuccin, Dracula, Nord, Gruvbox, Tokyo Night, and many more. Switch themes on-the-fly with `/theme`.

### Native Performance via Rust N-API Addons

Performance-critical operations are implemented in Rust (compiled to native machine code) for maximum speed:

- **Grep**: ~1,300 lines of Rust using ripgrep internals
- **Shell**: ~1,025 lines embedding a bash interpreter (no subprocess spawning)
- **Text processing**: ANSI-aware width calculations, wrapping, truncation
- **Syntax highlighting**: Fast code highlighting for 30+ languages
- **Image processing**: Encode/decode/resize images without external tools
- **And more**: Keyboard parsing, glob matching, clipboard access, process management

### Task/Subagent System

Parallelize complex work with specialized agents:

- **5 bundled agents**: explore, plan, browser, task, reviewer
- **Parallel execution**: Run multiple tasks simultaneously with progress tracking
- **Isolated execution**: Run tasks in separate git worktrees to avoid conflicts
- **Real-time streaming**: See agent outputs as they're generated

---

## Prerequisites

Before installing oh-my-pi, you'll need a few things set up on your system. Don't worry — we'll walk through each one.

### 1. Bun Runtime (version 1.3.7 or higher)

**What is Bun?**

Bun is a JavaScript runtime — a program that runs JavaScript code. If you've heard of Node.js, Bun is similar but newer and faster. It can run JavaScript and TypeScript directly without needing a separate build step.

**Why do I need it?**

oh-my-pi is written in TypeScript (a type-safe version of JavaScript), and Bun is what executes that code.

**How to install:**

Visit [https://bun.sh](https://bun.sh) and follow the installation instructions for your operating system:

- **macOS/Linux**: Run `curl -fsSL https://bun.sh/install | bash` in your terminal
- **Windows**: Run `powershell -c "irm bun.sh/install.ps1|iex"` in PowerShell

After installation, verify it works by running:

```bash
bun --version
```

You should see version 1.3.7 or higher.

### 2. Git

**What is Git?**

Git is version control software that tracks changes to your code. Most software projects use Git.

**Why do I need it?**

oh-my-pi needs Git to track your project's history and generate intelligent commit messages.

**How to install:**

- **macOS**: Install Xcode Command Line Tools by running `xcode-select --install`, or use Homebrew: `brew install git`
- **Linux**: Use your package manager (e.g., `sudo apt install git` on Ubuntu/Debian, `sudo dnf install git` on Fedora)
- **Windows**: Download from [https://git-scm.com](https://git-scm.com)

Verify installation:

```bash
git --version
```

### 3. An API Key from an LLM Provider

**What is an API key?**

An API key is like a password that lets oh-my-pi access AI services on your behalf. When the AI generates code or answers questions, it's actually sending your request to a cloud service (like OpenAI or Anthropic) that runs the large language model.

**Why do I need it?**

oh-my-pi doesn't run the AI models itself — they're too large. Instead, it sends your requests to a provider's servers, which requires authentication via an API key.

**Which provider should I choose?**

Popular options for beginners:

1. **Anthropic Claude** (recommended for coding)
   - Sign up at [https://console.anthropic.com](https://console.anthropic.com)
   - Navigate to "API Keys" and create a new key
   - Claude Sonnet is excellent for coding tasks
   - Pricing: Pay-as-you-go (usually a few cents per conversation)

2. **OpenAI GPT**
   - Sign up at [https://platform.openai.com](https://platform.openai.com)
   - Go to "API keys" and generate a new key
   - GPT-4o is a good all-around model
   - Pricing: Pay-as-you-go

3. **Google Gemini**
   - Get a key at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Free tier available with generous limits
   - Good for larger context windows

You only need **one** provider to get started. You can add more later.

### 4. Rust Nightly Toolchain (Optional)

**What is Rust?**

Rust is a programming language known for safety and performance. oh-my-pi uses Rust for speed-critical operations.

**Why do I need it?**

You only need Rust if you plan to build oh-my-pi from source or develop native addons. If you're installing via the prebuilt binary or Bun package, you can skip this.

**How to install:**

If you do need Rust:

```bash
# Install rustup (the Rust installer)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install nightly toolchain (required for this project)
rustup toolchain install nightly
rustup default nightly
```

Verify installation:

```bash
rustc --version
```

---

## Installation

Choose the method that works best for you. We recommend the Bun method for most users.

### Method 1: Via Bun (Recommended)

This is the easiest method and ensures you always get the latest version.

**Prerequisites**: Bun must be installed (see [Prerequisites](#prerequisites) above).

```bash
bun install -g @oh-my-pi/pi-coding-agent
```

The `-g` flag means "global" — it installs the `omp` command system-wide so you can run it from any directory.

After installation, verify it works:

```bash
omp --version
```

### Method 2: Via Installer Script

These installer scripts automatically download the appropriate version for your system.

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/can1357/oh-my-pi/main/scripts/install.sh | sh
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/can1357/oh-my-pi/main/scripts/install.ps1 | iex
```

**What does the installer do?**

By default, it checks if you have Bun installed:
- If yes: Uses Bun to install oh-my-pi (Method 1 above)
- If no: Downloads a prebuilt binary for your platform

**Advanced installer options:**

Force Bun installation (installs Bun first if needed):

```bash
curl -fsSL https://raw.githubusercontent.com/can1357/oh-my-pi/main/scripts/install.sh | sh -s -- --source
```

Force prebuilt binary:

```bash
curl -fsSL https://raw.githubusercontent.com/can1357/oh-my-pi/main/scripts/install.sh | sh -s -- --binary
```

Install a specific version:

```bash
# Install version 3.20.1 as a binary
curl -fsSL https://raw.githubusercontent.com/can1357/oh-my-pi/main/scripts/install.sh | sh -s -- --binary --ref v3.20.1

# Install from the main branch (source install)
curl -fsSL https://raw.githubusercontent.com/can1357/oh-my-pi/main/scripts/install.sh | sh -s -- --source --ref main
```

**Windows PowerShell advanced options:**

```powershell
# Install a specific version
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/can1357/oh-my-pi/main/scripts/install.ps1))) -Binary -Ref v3.20.1

# Install from main branch
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/can1357/oh-my-pi/main/scripts/install.ps1))) -Source -Ref main
```

### Method 3: Manual Download from GitHub Releases

If you prefer to download the binary yourself:

1. Go to [https://github.com/can1357/oh-my-pi/releases/latest](https://github.com/can1357/oh-my-pi/releases/latest)
2. Download the appropriate file for your system:
   - **macOS Intel**: `omp-darwin-x64`
   - **macOS Apple Silicon**: `omp-darwin-arm64`
   - **Linux x64**: `omp-linux-x64`
   - **Linux ARM64**: `omp-linux-arm64`
   - **Windows x64**: `omp-win32-x64.exe`
3. Make it executable (macOS/Linux):
   ```bash
   chmod +x omp-*
   ```
4. Move it to a directory in your PATH:
   ```bash
   # macOS/Linux
   sudo mv omp-* /usr/local/bin/omp

   # Windows: Move to C:\Windows\System32\ or add to PATH
   ```

### Method 4: From Source (For Developers)

If you want to contribute to oh-my-pi or customize it heavily:

**Prerequisites**: Bun and Rust nightly toolchain (see [Prerequisites](#prerequisites)).

```bash
# Clone the repository
git clone https://github.com/can1357/oh-my-pi.git
cd oh-my-pi

# Install dependencies
bun install

# Build the Rust native addons
bun --cwd=packages/natives run build:native

# Link the omp command globally
bun --cwd=packages/coding-agent link

# Run from source
bun run dev
```

Now you can run `omp` from anywhere, and it will use your local development version.

---

## Quick Start

Congratulations on installing oh-my-pi! Let's get you up and running in 5 minutes.

### Step 1: Set Up Your API Key

oh-my-pi needs an API key to communicate with the AI provider. You can set this as an environment variable.

**For Anthropic Claude (recommended):**

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, or ~/.bash_profile)
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

**For OpenAI GPT:**

```bash
export OPENAI_API_KEY="sk-..."
```

**For Google Gemini:**

```bash
export GOOGLE_API_KEY="AIza..."
```

After adding the line to your shell profile, either restart your terminal or run:

```bash
source ~/.bashrc   # or ~/.zshrc, depending on your shell
```

**Alternatively**, you can set the API key just for the current terminal session:

```bash
export ANTHROPIC_API_KEY="your-key-here"
omp
```

### Step 2: Run oh-my-pi for the First Time

Simply type:

```bash
omp
```

You'll see a welcome screen with the oh-my-pi logo and some tips. The interface is called a TUI (Terminal User Interface) — think of it as a graphical interface built with text characters.

At the bottom, you'll see a prompt where you can type. This is where you talk to the AI.

### Step 3: Try Some Basic Interactions

Here are some example prompts to get you started:

**Example 1: Ask a question**

```
You: What is the difference between a mutex and a semaphore in C++?
```

The AI will read your question and provide a detailed explanation.

**Example 2: Generate code**

```
You: Write a Python function that calculates the Fibonacci sequence up to n terms
```

The AI will generate the code and display it in the terminal.

**Example 3: Work with your files**

Navigate to a directory with some code, then run `omp`:

```
You: Read main.cpp and explain what it does
```

The AI will use its `read` tool to open the file and provide an explanation.

**Example 4: Make changes to a file**

```
You: Add error handling to the readFile function in utils.js
```

The AI will read the file, make the appropriate edits, and show you what changed.

**Example 5: Run a command**

```
You: Show me all TODO comments in this project
```

The AI might use the `grep` tool to search for "TODO" in your files.

### Step 4: Understanding the Interface

Here's what you see in the TUI:

- **Top section**: The AI's responses and tool calls appear here
- **Bottom section**: The input area where you type your messages
- **Footer bar**: Shows your current model, directory, git branch, and token usage

**Keyboard shortcuts to remember:**

- `Ctrl+C`: Cancel the current AI response
- `Ctrl+D`: Exit oh-my-pi
- `Enter`: Send your message
- `?`: Show help (when input is empty)

### Step 5: Exit oh-my-pi

When you're done, press `Ctrl+D` to exit. Your conversation is automatically saved, and you can resume it later with:

```bash
omp --resume
```

**Congratulations!** You're now ready to use oh-my-pi for real work.

---

## CLI Commands

oh-my-pi provides several commands you can run from your terminal.

### `omp`

**Interactive mode** — starts the TUI where you can have a conversation with the AI.

```bash
omp
```

**Common flags:**

- `--resume`: Resume the most recent session
  ```bash
  omp --resume
  ```

- `-p "prompt"` or `--prompt "prompt"`: Send a single prompt without entering interactive mode (prints output and exits)
  ```bash
  omp -p "List all .rs files in this directory"
  ```

- `--model <model>`: Use a specific AI model
  ```bash
  omp --model claude-opus-4
  ```

- `--smol`: Use a small/fast/cheap model (automatically selects haiku, flash, or mini)
  ```bash
  omp --smol
  ```

- `--slow`: Use a reasoning model (automatically selects o1, o3, opus, or pro)
  ```bash
  omp --slow
  ```

- `--session <id>`: Resume a specific session by ID
  ```bash
  omp --session abc123
  ```

- `--no-tools`: Disable all tools (AI can only respond with text)
  ```bash
  omp --no-tools
  ```

- `--no-extensions`: Disable extensions and plugins
  ```bash
  omp --no-extensions
  ```

- `-e <extension>` or `--extension <extension>`: Enable a specific extension
  ```bash
  omp -e task-agent
  ```

- `--hook <hook>`: Enable a specific hook
  ```bash
  omp --hook pre-commit
  ```

### `omp commit`

**AI-powered git commit generation** — analyzes your staged changes and generates meaningful commit messages following the conventional commit format.

```bash
omp commit
```

**What it does:**

1. Analyzes all staged changes (or all uncommitted changes if nothing is staged)
2. Inspects changes file-by-file and hunk-by-hunk
3. Detects unrelated changes and suggests splitting into multiple commits
4. Generates commit messages in conventional format (e.g., `feat: add user authentication`)
5. Optionally generates and applies changelog entries
6. Validates messages to avoid filler words and vague descriptions

**Flags:**

- `--push`: Automatically push to remote after committing
  ```bash
  omp commit --push
  ```

- `--dry-run`: Show what would be committed without actually committing
  ```bash
  omp commit --dry-run
  ```

- `--no-changelog`: Skip changelog generation
  ```bash
  omp commit --no-changelog
  ```

- `--context <message>`: Provide additional context to help the AI understand the changes
  ```bash
  omp commit --context "This fixes issue #42"
  ```

- `--legacy`: Use the deterministic pipeline instead of the agentic mode
  ```bash
  omp commit --legacy
  ```

**Example workflow:**

```bash
# Make some changes to your code
git add .

# Let the AI generate a commit message
omp commit

# Review the proposed commit message, approve or edit
# The commit is created automatically
```

### `omp config`

**Manage configuration** — view and modify oh-my-pi settings from the command line.

**Subcommands:**

- `omp config list`: Show all configuration options and their current values
  ```bash
  omp config list
  ```

- `omp config get <key>`: Get the value of a specific setting
  ```bash
  omp config get theme
  ```

- `omp config set <key> <value>`: Set a configuration value
  ```bash
  omp config set theme dracula
  omp config set thinkingLevel extended
  ```

- `omp config reset <key>`: Reset a setting to its default value
  ```bash
  omp config reset theme
  ```

- `omp config path`: Show the path to the configuration file
  ```bash
  omp config path
  ```

**Common settings to configure:**

- `theme`: Change the color scheme
- `thinkingLevel`: Control how much the AI "thinks" before responding (`low`, `normal`, `high`, `xhigh`)
- `browser.headless`: Run browser automation in headless mode (true/false)
- `python.sharedGateway`: Share Python kernel across sessions (true/false)
- `edit.fuzzyMatch`: Enable fuzzy matching for edit operations (true/false)

### `omp setup python`

**Install Python dependencies** — sets up the IPython kernel and helper modules needed for the Python REPL tool.

```bash
omp setup python
```

This installs:
- IPython kernel with Jupyter gateway
- Helper functions for file operations (cat, sed, grep, etc.)
- Git utilities
- Rich output rendering support

You only need to run this once. The AI can then execute Python code in a persistent environment.

### `omp stats`

**View usage statistics** — opens a local dashboard showing your AI usage metrics.

```bash
omp stats
```

**What you'll see:**

- Total requests and costs across all providers
- Token usage (input, output, cache hits)
- Average tokens per second
- Cache hit rate
- Breakdown by model and provider
- Usage over time

This helps you track how much you're spending on API calls and optimize your usage.

### `omp plugin`

**Manage MCP plugins** — install and configure Model Context Protocol servers to add external tools.

**Subcommands:**

- `omp plugin install <name>`: Install a plugin
  ```bash
  omp plugin install @modelcontextprotocol/server-github
  ```

- `omp plugin enable <name>`: Enable an installed plugin
  ```bash
  omp plugin enable server-github
  ```

- `omp plugin configure <name>`: Configure plugin settings
  ```bash
  omp plugin configure server-github
  ```

- `omp plugin doctor`: Diagnose plugin issues
  ```bash
  omp plugin doctor
  ```

**What are MCP plugins?**

MCP (Model Context Protocol) is a standard way to connect external tools to AI assistants. Plugins can add new capabilities like:
- GitHub repository access
- Database queries
- Cloud service integration
- Custom APIs

---

## Slash Commands (Interactive TUI)

While in the interactive TUI, you can use slash commands to control the interface and session. Just type `/` followed by the command name.

### Session Management

- `/new`: Start a new session (discards current conversation)
- `/resume`: Open a menu to resume a previous session
- `/branch`: Create a new conversation branch from the current point
- `/tree`: View the conversation tree and navigate through history

### Interface Controls

- `/theme`: Open theme selector (65+ themes available)
- `/model`: Change the AI model
  - Press `Enter` to select default model
  - Press `S` to select smol (fast/cheap) model
  - Press `L` to select slow (reasoning) model
- `/compact`: Toggle compact mode (less whitespace)
- `/clear`: Clear the screen
- `/help`: Show available commands

### Features

- `/thinking`: Toggle AI thinking visibility (show/hide internal reasoning)
- `/config`: Open interactive configuration menu
- `/review`: Start an interactive code review
  - Review branch comparison
  - Review uncommitted changes
  - Review specific commits
- `/background`: Detach UI and let the agent continue working in the background
- `/browser`: Toggle browser headless mode
- `/reload`: Reload configuration, extensions, and plugins

### Output

- `/export`: Export the current conversation to a file

---

## Keyboard Shortcuts

These shortcuts work in the interactive TUI:

### Essential Shortcuts

- `Ctrl+C`: Cancel the current AI response (stop generation)
- `Ctrl+D`: Exit oh-my-pi
- `Enter`: Send your message
- `?`: Show keyboard shortcuts help (only when input is empty)

### Navigation and History

- `Ctrl+R`: Search through command history (like in bash)
- `Up/Down arrows`: Navigate through recent prompts
- `Ctrl+O`: Expand/collapse tool call outputs in the UI

### Editing

- `Ctrl+G`: Open the current input in your external editor (uses `$EDITOR` or `$VISUAL`)
- `Ctrl+A`: Move cursor to beginning of line
- `Ctrl+E`: Move cursor to end of line
- `Ctrl+K`: Delete from cursor to end of line
- `Ctrl+U`: Delete from cursor to beginning of line

### Task Management

- `Ctrl+T`: Toggle todo panel visibility (show/hide task list)

---

## Configuration

oh-my-pi stores its configuration and data in the `~/.omp/` directory.

### Configuration Directory Structure

```
~/.omp/
├── agent/                    # Agent configuration
│   ├── config.json          # Main configuration file
│   ├── models.yml           # Custom model definitions
│   ├── commands/            # Custom slash commands
│   ├── agents/              # Custom task agents
│   ├── extensions/          # Custom extensions
│   └── hooks/               # Custom hooks
├── plugins/                  # Installed MCP plugins
├── sessions/                 # Saved conversation sessions
├── logs/                     # Debug logs (daily rotation)
├── modules/                  # Custom Python modules for REPL
├── auth/                     # API credentials storage
└── stats/                    # Usage statistics database
```

**Project-level configuration:**

You can also create `.omp/` directories in your project root. Settings there will override global settings when working in that project.

### Using `omp config` CLI

The easiest way to configure oh-my-pi is through the CLI:

```bash
# List all settings
omp config list

# Get a specific setting
omp config get theme

# Change a setting
omp config set theme "catppuccin-mocha"

# Reset to default
omp config reset theme

# Find the config file location
omp config path
```

### Environment Variables for API Keys

Set API keys as environment variables in your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
# Anthropic Claude
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# OpenAI
export OPENAI_API_KEY="sk-..."

# Google Gemini
export GOOGLE_API_KEY="AIza..."

# AWS Bedrock (requires AWS credentials)
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-east-1"

# Groq
export GROQ_API_KEY="gsk_..."

# Mistral
export MISTRAL_API_KEY="..."

# OpenRouter (unified API for multiple providers)
export OPENROUTER_API_KEY="sk-or-..."

# Perplexity (for web search)
export PERPLEXITY_API_KEY="pplx-..."

# Exa (for web search)
export EXA_API_KEY="..."
```

**Multiple credentials:**

You can provide multiple API keys for the same provider (separated by commas) to distribute load:

```bash
export ANTHROPIC_API_KEY="key1,key2,key3"
```

oh-my-pi will automatically rotate between them using round-robin distribution.

### Custom Model Providers via `models.yml`

You can define custom models or override defaults by creating `~/.omp/agent/models.yml`:

```yaml
models:
  - name: my-custom-model
    provider: openai
    apiKey: ${CUSTOM_API_KEY}
    baseURL: https://api.custom-provider.com/v1
    maxTokens: 8192
    contextWindow: 128000
```

### Interactive Configuration via `/config`

In the TUI, type `/config` to open an interactive configuration menu where you can:

- Enable/disable discovery providers (Claude Code, Cursor, Windsurf, etc.)
- Adjust thinking levels
- Configure browser settings
- Change Python REPL behavior
- And more

### Common Settings

Here are some frequently adjusted settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `theme` | Color scheme | `default` |
| `thinkingLevel` | How much AI shows its reasoning | `normal` |
| `browser.headless` | Run browser in headless mode | `true` |
| `python.sharedGateway` | Reuse Python kernel across sessions | `false` |
| `edit.fuzzyMatch` | Fuzzy matching for edit operations | `true` |
| `todoCompletion` | Warn when stopping with incomplete todos | `true` |
| `completionBell` | Ring terminal bell when agent finishes | `false` |

---

## Feature Deep Dive

This section provides more detail on oh-my-pi's advanced features.

### AI-Powered Git Commits

The `omp commit` command uses an agentic approach to generate meaningful commit messages:

1. **Tool-based inspection**: The AI uses `git-overview`, `git-file-diff`, and `git-hunk` tools to analyze changes at multiple levels of granularity
2. **Change detection**: Identifies unrelated changes that should be split into separate commits
3. **Hunk-level staging**: Can stage individual hunks when a file contains multiple unrelated changes
4. **Conventional commits**: Generates messages following the [Conventional Commits](https://www.conventionalcommits.org/) format
5. **Validation**: Checks for filler words, vague descriptions, and meta phrases
6. **Changelog generation**: Optionally updates `CHANGELOG.md` files with appropriate entries

Example output:

```
feat: add user authentication with JWT

Implements login and registration endpoints with JWT token generation.
Includes bcrypt password hashing and token expiration.

- Add /api/login and /api/register routes
- Implement JWT middleware for protected routes
- Add password hashing utility
```

### Python Tool (IPython Kernel)

Execute Python code with a persistent IPython kernel:

```
You: Use Python to analyze the CSV file and show me the top 10 rows
```

The AI will execute Python code like:

```python
import pandas as pd
df = pd.read_csv('data.csv')
display(df.head(10))
```

**30+ built-in helpers:**

- `cat(path)`: Read file contents
- `sed(pattern, replacement, path)`: Regex replace in file
- `grep(pattern, path)`: Search for pattern in file
- `find(pattern)`: Find files matching pattern
- `git_status()`, `git_diff()`, `git_log()`: Git operations
- `extract_lines(path, start, end)`: Extract line range
- `delete_lines(path, start, end)`: Delete line range
- `sh(command)`: Execute shell command
- And more...

**Rich output:**

The kernel supports:
- HTML rendering
- Markdown formatting
- Image display (PNG, JPEG)
- JSON trees
- Mermaid diagrams (in iTerm2/Kitty terminals)

**Custom modules:**

Drop Python files into `~/.omp/modules/` or `.omp/modules/` and they'll be automatically imported:

```python
# ~/.omp/modules/mytools.py
def analyze_logs(path):
    # Your custom utility
    pass
```

Then use in the REPL:

```python
import mytools
mytools.analyze_logs('/var/log/app.log')
```

### LSP Integration (Language Server Protocol)

Get IDE-like features without leaving the terminal:

**Format-on-write:**

When the AI writes or edits a file, it's automatically formatted using the appropriate language server (rustfmt for Rust, prettier for JavaScript, gofmt for Go, etc.).

**Diagnostics:**

After every file change, the LSP checks for errors and warnings:

```
[LSP] src/main.rs:
  Line 42: unused variable `x` [warning]
  Line 58: cannot find value `foo` in this scope [error]
```

**Workspace diagnostics:**

Check your entire project for issues:

```
You: Check the whole project for errors
```

The AI will use `lsp action=workspace_diagnostics` to scan all files.

**40+ languages supported out-of-the-box:**

Rust, Go, Python, TypeScript, JavaScript, Java, Kotlin, Scala, Haskell, OCaml, Elixir, Ruby, PHP, C#, C++, Lua, Nix, Zig, and many more.

**Local binary resolution:**

oh-my-pi automatically finds language servers in:
- `node_modules/.bin/` (for JavaScript projects)
- `.venv/bin/` (for Python projects)
- `vendor/bin/` (for PHP projects)
- System PATH

### Time Traveling Streamed Rules (TTSR)

A unique feature that saves context by only injecting rules when they're needed:

**How it works:**

1. You define a rule with a regex trigger pattern
2. As the AI generates its response, oh-my-pi watches the output stream
3. If the pattern matches, the stream is aborted
4. The rule content is injected as a system reminder
5. The request is retried with the new context

**Example:**

```yaml
# .omp/rules/no-deprecated-api.md
---
ttsrTrigger: "deprecatedFunction\\("
---

# Don't use deprecated API

The `deprecatedFunction` has been deprecated. Use `newFunction` instead.
```

If the AI starts writing `deprecatedFunction(...)`, the stream stops, the rule is injected, and the AI retries with this guidance — but only for this session. Future sessions won't waste context on this rule unless they also trigger it.

**Benefits:**

- Zero upfront context cost
- Rules only activate when relevant
- Prevents the most common mistakes without bloating the system prompt

### Interactive Code Review

The `/review` command provides structured code review with prioritized findings:

**Review modes:**

1. **Branch comparison**: Compare current branch to main/master
2. **Uncommitted changes**: Review unstaged/staged changes
3. **Commit review**: Review a specific commit

**Priority levels:**

- `P0`: Critical issues (security, data loss, crashes)
- `P1`: Important issues (bugs, performance problems)
- `P2`: Suggestions (code quality, readability)
- `P3`: Nits (style, formatting)

**Verdict:**

After analysis, the AI provides a verdict:
- **Approve**: Code is ready to merge
- **Request changes**: Issues must be fixed
- **Comment**: Suggestions provided but not blocking

**Example:**

```
You: /review
> Select: Review uncommitted changes

[Analyzing...]

Verdict: Request Changes

Findings:
[P0] Possible SQL injection in user input handling (line 42)
[P1] Missing error handling for file operations (line 67)
[P2] Consider extracting this logic into a separate function (line 103)
```

### Task Tool (Subagent System)

Parallelize complex work with specialized agents:

**5 bundled agents:**

1. **explore**: Search and understand codebase structure
2. **plan**: Break down complex tasks into steps
3. **browser**: Web scraping and research
4. **task**: General-purpose execution
5. **reviewer**: Code review with multi-file analysis

**Example usage:**

```
You: Create a task to explore the authentication module and another to review the API endpoints
```

The AI will spawn two agents that run in parallel:

```
[Task 1: explore] Analyzing auth module...
[Task 2: reviewer] Reviewing API endpoints...
```

**Isolated execution:**

Tasks can run in isolated git worktrees to avoid conflicts:

```yaml
# Custom agent with isolation
isolated: true
```

This creates a separate working directory, lets the agent make changes, generates a patch, and applies it cleanly to your working tree.

**Custom agents:**

Create your own agents in `~/.omp/agent/agents/` or `.omp/agents/`:

```typescript
// ~/.omp/agent/agents/my-agent/index.ts
export default {
  name: "my-agent",
  description: "Custom task agent",
  systemPrompt: "You are a specialized agent for...",
  tools: ["read", "grep", "bash"],
  model: "pi/smol",  // Use small model for cost efficiency
};
```

### Model Roles

Configure different models for different purposes:

**Three roles:**

1. **default**: Your main model (e.g., Claude Sonnet, GPT-4o)
2. **smol**: Fast/cheap model for simple tasks (e.g., Haiku, Flash, GPT-4o-mini)
3. **slow**: Reasoning model for complex problems (e.g., o1, o3-mini, Opus)

**Auto-discovery:**

oh-my-pi automatically finds appropriate models based on what's available:
- Smol: Looks for haiku → flash → mini
- Slow: Looks for o1 → o3 → opus → pro

**Usage:**

From CLI:

```bash
omp --smol   # Use fast model
omp --slow   # Use reasoning model
```

In TUI:

```
/model
> Press S for smol
> Press L for slow
> Press Enter for default
```

In task agents:

```yaml
model: pi/smol  # Use the smol role
```

Environment variables:

```bash
export PI_SMOL_MODEL="claude-haiku-4"
export PI_SLOW_MODEL="o1-2024-12-17"
```

### Todo Tool (Task Tracking)

The AI can create and manage task lists during your session:

**Creating todos:**

```
You: Refactor the user module

AI: I'll break this down into tasks:
[Using todo_write]

- [pending] Extract user validation logic
- [pending] Move database queries to repository
- [pending] Add unit tests
- [pending] Update documentation
```

A todo panel appears above the editor showing progress.

**Automatic status updates:**

As the AI completes each task, the status updates:

```
✓ Extract user validation logic
⋯ Move database queries to repository
☐ Add unit tests
☐ Update documentation
```

**Toggle visibility:**

Press `Ctrl+T` to expand/collapse the todo panel.

**Completion reminders:**

If you try to exit with incomplete todos, the AI is warned and may remind you:

```
AI: There are still 2 incomplete tasks. Would you like me to finish them, or should we save this for later?
```

### MCP & Plugin System

MCP (Model Context Protocol) lets you integrate external tools:

**Installing a plugin:**

```bash
omp plugin install @modelcontextprotocol/server-github
```

**What can plugins do?**

- Access external APIs (GitHub, Slack, databases)
- Provide specialized tools (image generation, code analysis)
- Integrate with services (cloud providers, monitoring tools)

**Example plugins:**

- `@modelcontextprotocol/server-github`: GitHub repository access
- `@modelcontextprotocol/server-postgres`: PostgreSQL database queries
- `@modelcontextprotocol/server-filesystem`: Extended file operations

**Configuration:**

After installing, configure the plugin:

```bash
omp plugin configure server-github
```

Then enable it:

```bash
omp plugin enable server-github
```

**Automatic filtering:**

Some plugins (like Exa MCP) are automatically filtered to extract API keys and configure them properly.

### Web Search & Fetch

Access the web from the AI:

**Multi-provider search:**

The AI can search the web using:
1. Anthropic's built-in search (if available)
2. Perplexity API (if `PERPLEXITY_API_KEY` is set)
3. Exa API (if `EXA_API_KEY` is set)

Automatic fallback chain ensures search always works if any provider is available.

**80+ specialized scrapers:**

oh-my-pi can fetch and parse content from:

- **Code hosting**: GitHub, GitLab, Bitbucket
- **Package registries**: npm, PyPI, crates.io, Maven, NuGet, Hex, Hackage, RubyGems, Packagist, pub.dev, Go packages
- **Documentation**: Stack Overflow, MDN, DevDocs
- **Academic**: arXiv, PubMed, Google Scholar
- **Social**: Hacker News, Reddit, Twitter/X
- **Media**: YouTube (with transcripts), Wikipedia
- **Security**: NVD, OSV, CISA KEV (vulnerability databases)

**Example:**

```
You: What are the latest vulnerabilities for OpenSSL?
```

The AI will fetch from NVD or OSV and summarize the findings.

**HTML-to-Markdown:**

Web content is automatically converted to clean Markdown with link preservation, making it easy for the AI to understand.

### SSH Tool

Execute commands on remote servers:

**Configuration:**

Create `ssh.json` or `.ssh.json` in your project:

```json
{
  "hosts": [
    {
      "name": "production",
      "host": "prod.example.com",
      "user": "deploy",
      "port": 22
    }
  ]
}
```

**Usage:**

```
You: Check disk usage on the production server
```

The AI will:
1. Connect to the host
2. Execute `df -h`
3. Return the results

**Persistent connections:**

SSH connections are reused across commands for faster execution.

**OS/shell detection:**

Automatically detects remote OS and shell type to run appropriate commands.

**SSHFS mounts (optional):**

Mount remote directories locally for easier file access:

```json
{
  "hosts": [
    {
      "name": "production",
      "host": "prod.example.com",
      "user": "deploy",
      "mount": "/remote/path"
    }
  ]
}
```

### Browser Tool (Puppeteer with Stealth)

Automate web browsers with bot detection evasion:

**25+ actions:**

- Navigate to URLs
- Click elements
- Type text
- Fill forms
- Scroll pages
- Take screenshots
- Evaluate JavaScript
- Extract readable content (reader mode)
- Observe accessibility tree
- Drag and drop
- And more...

**Stealth features:**

14 stealth scripts to evade bot detection:
- Removes `HeadlessChrome` from user agent
- Spoofs WebGL fingerprinting
- Mocks plugin and MIME types
- Fakes audio context
- Spoofs screen dimensions
- Prevents iframe detection
- And more...

**Selector flexibility:**

Target elements using:
- CSS selectors: `button.submit`
- ARIA: `aria/Submit Button`
- Text: `text/Click here`
- XPath: `xpath=//button[@type="submit"]`
- Shadow DOM piercing: `pierce/.shadow-root button`

**Accessibility snapshots:**

Extract interactive elements as a numbered list for reliable targeting:

```
You: Go to example.com and click the login button
```

The AI will:
1. Navigate to the site
2. Take an accessibility snapshot
3. Find "login" button with ID 42
4. Click element #42

**Reader mode:**

Extract clean article content using Mozilla Readability:

```
You: Fetch the main content from this blog post
```

The AI uses the `extract_readable` action to get just the article text without ads, navigation, etc.

**Headless/visible toggle:**

Switch modes at runtime:

```
/browser   # Toggle between headless and visible
```

Or configure via settings:

```bash
omp config set browser.headless false
```

### Native Engine (Rust N-API)

Performance-critical operations are implemented in Rust and compiled to native machine code:

**Benefits:**

- **Speed**: 10-100x faster than JavaScript for text processing, search, and parsing
- **No subprocesses**: Embedded bash interpreter, grep engine, etc. run in-process
- **Lower latency**: No overhead from spawning external commands
- **Cross-platform**: Single codebase compiles to Linux, macOS, and Windows

**Modules:**

| Module | Lines of Rust | Purpose |
|--------|---------------|---------|
| grep | ~1,300 | Regex search powered by ripgrep internals |
| shell | ~1,025 | Embedded bash interpreter (no subprocess) |
| text | ~1,280 | ANSI-aware text processing optimized for UTF-16 |
| keys | ~1,300 | Kitty keyboard protocol parser with xterm fallback |
| highlight | ~475 | Syntax highlighting for 30+ languages |
| glob | ~340 | File discovery with gitignore support |
| task | ~350 | Work scheduler on libuv thread pool |
| ps | ~290 | Process tree kill (cross-platform) |
| prof | ~250 | Always-on profiler with flamegraph output |
| system_info | ~170 | OS, CPU, disk info without shelling out |
| image | ~150 | PNG/JPEG/WebP encode/decode/resize |
| clipboard | ~95 | System clipboard access (text and images) |
| html | ~50 | HTML-to-Markdown conversion |

**Supported platforms:**

- `linux-x64`
- `linux-arm64`
- `darwin-x64` (macOS Intel)
- `darwin-arm64` (macOS Apple Silicon)
- `win32-x64` (Windows)

### Universal Config Discovery

oh-my-pi can discover and use configuration from 8 different AI coding tools:

**Supported tools:**

1. **Claude Code**: Commands, prompts, context files
2. **Cursor**: MDC frontmatter rules, `.cursorrules`
3. **Windsurf**: `.windsurfrules`, cascade files
4. **Gemini**: `system.md`
5. **Codex**: `AGENTS.md`, `CODEX.md`
6. **Cline**: `.clinerules`
7. **GitHub Copilot**: Instructions with `applyTo` globs
8. **VS Code**: General editor configuration

**What gets discovered:**

- MCP servers
- Rules and instructions
- Skills and capabilities
- Hooks and lifecycle events
- Tools and functions
- Slash commands
- Prompts
- Context files

**Native format support:**

oh-my-pi understands each tool's native format:
- Cursor's MDC frontmatter for metadata
- Windsurf's cascade configuration
- Cline's `.clinerules` format
- Copilot's `applyTo` glob patterns
- And more...

**Provider attribution:**

In the UI, you can see which tool contributed each configuration item.

**Discovery settings:**

Enable/disable individual providers via `/config` interactive tab:

```
/config
> Discovery tab
> Toggle Cursor discovery
> Toggle Windsurf discovery
```

**Priority ordering:**

Configuration is loaded from multiple directories in priority order:
1. Project-level: `.omp/`, `.pi/`, `.claude/`
2. User-level: `~/.omp/`, `~/.pi/`, `~/.claude/`

Project-level settings override user-level settings.

---

## Packages

oh-my-pi is built as a monorepo with multiple packages:

| Package | Description |
|---------|-------------|
| **[@oh-my-pi/pi-ai](packages/ai)** | Multi-provider LLM client (Anthropic, OpenAI, Gemini, Bedrock, Cursor, Codex, Copilot) |
| **[@oh-my-pi/pi-agent-core](packages/agent)** | Agent runtime with tool calling and state management |
| **[@oh-my-pi/pi-coding-agent](packages/coding-agent)** | Interactive coding agent CLI (main application) |
| **[@oh-my-pi/pi-tui](packages/tui)** | Terminal UI library with differential rendering |
| **[@oh-my-pi/pi-natives](packages/natives)** | N-API bindings for grep, shell, image, text, syntax highlighting, and more |
| **[@oh-my-pi/pi-utils](packages/utils)** | Shared utilities (logger, streams, temp files) |
| **[@oh-my-pi/omp-stats](packages/stats)** | Local observability dashboard for AI usage statistics |

### Rust Crates

| Crate | Description |
|-------|-------------|
| **[pi-natives](crates/pi-natives)** | N-API native addon — 13 modules, ~7,500 lines of Rust |
| **[brush-core-vendored](crates/brush-core-vendored)** | Vendored fork of brush-shell for embedded bash execution |
| **[brush-builtins-vendored](crates/brush-builtins-vendored)** | Vendored bash builtins (cd, echo, test, printf, read, export, etc.) |

**Dependency flow:**

```
utils → natives → tui → ai → agent → coding-agent
                                   ↘ stats
```

---

## License

MIT License

Original work copyright Mario Zechner
Fork copyright Can Bölük

See [LICENSE](LICENSE) for full details.

---

## Getting Help

- **Documentation**: [https://github.com/can1357/oh-my-pi/tree/main/docs](https://github.com/can1357/oh-my-pi/tree/main/docs)
- **Issues**: [https://github.com/can1357/oh-my-pi/issues](https://github.com/can1357/oh-my-pi/issues)
- **Discord**: [https://discord.gg/4NMW9cdXZa](https://discord.gg/4NMW9cdXZa)
- **Changelog**: [packages/coding-agent/CHANGELOG.md](packages/coding-agent/CHANGELOG.md)

If you encounter issues:

1. Run `omp --version` to check your version
2. Check the logs at `~/.omp/logs/` for error messages
3. Try `omp config reset` to reset settings to defaults
4. Search existing GitHub issues or create a new one

## Contributing

Contributions are welcome! This project follows standard open-source practices:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `bun test`
5. Run linting: `bun check`
6. Submit a pull request

See [docs/](docs/) for development guides.

---

**Happy coding with oh-my-pi!**
