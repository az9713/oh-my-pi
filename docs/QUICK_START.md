# oh-my-pi Quick Start Guide

Welcome to **oh-my-pi** (omp) - your AI coding agent that lives in the terminal. This guide will get you up and running with quick wins that showcase what makes omp special.

## Getting Started in 60 Seconds

```bash
# 1. Install (requires Bun - install from bun.sh if you don't have it)
bun install -g @oh-my-pi/pi-coding-agent

# 2. Set up your API key (pick one provider)
export ANTHROPIC_API_KEY="your-key-here"   # Anthropic Claude (recommended)
# OR
export OPENAI_API_KEY="your-key-here"      # OpenAI GPT
# OR
export GOOGLE_API_KEY="your-key-here"      # Google Gemini

# 3. Navigate to any project and start
cd /path/to/your/project
omp
```

## Your First Interaction

When omp starts, you'll see a welcome screen with an input area at the bottom. Type your request in natural language and press **Enter twice** (or Enter on an empty line) to submit.

Try this first prompt:
```
What files are in this project? Give me a brief overview of the codebase structure.
```

The agent will use its file-reading tools to explore your project and give you a summary. Watch the bottom of the screen to see which tools it uses in real-time.

---

## Use Case 1: Explore an Unfamiliar Codebase
**What it demonstrates:** File reading and code comprehension

**Your prompt:**
```
Read the main entry point of this project and explain what it does.
Walk me through the code like I'm a junior developer.
```

**What happens:**
The agent will:
- Use Glob to find your main file (main.py, index.ts, App.java, etc.)
- Read the file contents
- Analyze imports, functions, and logic flow
- Explain each section in plain language
- May read related files to provide full context

This is perfect when you inherit a codebase or dive into open source projects.

---

## Use Case 2: Write a New Function
**What it demonstrates:** Code generation with best practices

**Your prompt:**
```
Create a function called calculateAverage that takes an array of numbers
and returns the average. Add it to a new file called utils.js.
Include input validation and JSDoc comments.
```

**What happens:**
The agent will:
- Create `utils.js` in your current directory
- Write the function with proper error handling
- Add comprehensive JSDoc comments
- Include input validation (null checks, type checks)
- Export the function properly

You'll see the exact code before it's written. The agent always asks permission before creating or modifying files.

---

## Use Case 3: Find and Fix a Bug
**What it demonstrates:** Code search and targeted edits

**Your prompt:**
```
I'm getting a "TypeError: Cannot read property 'length' of undefined"
in my app. Find where this might happen and fix it.
```

**What happens:**
The agent will:
- Use Grep to search for `.length` usage across your codebase
- Identify files where the error could occur
- Read the surrounding code for context
- Analyze which variables might be undefined
- Use the Edit tool to add null checks or default values
- Explain why the bug occurred

This demonstrates how omp combines search, analysis, and surgical code edits.

---

## Use Case 4: Run Tests and Fix Failures
**What it demonstrates:** Bash execution + debugging workflow

**Your prompt:**
```
Run the tests for this project. If any fail, analyze the failure
and fix the code.
```

**What happens:**
The agent will:
- Detect your test framework (Jest, pytest, Mocha, etc.)
- Run the appropriate test command
- Parse test output to identify failures
- Read both the failing test and the code being tested
- Make targeted fixes to resolve the issue
- Optionally re-run tests to verify the fix

You'll see the complete debug-fix-verify cycle in action.

---

## Use Case 5: Search the Web for Documentation
**What it demonstrates:** Web search and information synthesis

**Your prompt:**
```
Search for the latest documentation on React Server Components.
Summarize the key concepts and show me a basic example.
```

**What happens:**
The agent will:
- Search the web for current information
- Fetch and read relevant documentation pages
- Synthesize information from multiple sources
- Provide a clear summary of key concepts
- Generate a working code example

This is incredibly useful for learning new technologies or checking current best practices.

---

## Use Case 6: AI-Powered Git Commits
**What it demonstrates:** The `omp commit` command

First, make some changes to your code, then run:
```bash
# From your terminal (not inside omp)
omp commit

# Or to automatically push after committing:
omp commit --push
```

**What happens:**
The agent will:
- Analyze your staged and unstaged changes
- Review the git diff to understand what changed
- Look at recent commits to match your style
- Generate a meaningful commit message
- Split unrelated changes into atomic commits if needed
- Stage and commit with a conventional commit format

The commit messages are context-aware and actually describe WHY, not just WHAT.

---

## Use Case 7: Code Review Assistant
**What it demonstrates:** The `/review` slash command

Inside omp, type:
```
/review
```

**What happens:**
An interactive menu appears asking what to review:
- Branch comparison (compare your branch to main/master)
- Uncommitted changes (review before committing)
- Specific commits or ranges

The agent then:
- Analyzes code quality, patterns, and potential issues
- Categorizes findings by priority (P0 = critical, P1 = important, P2 = nice-to-have, P3 = nit)
- Suggests improvements with specific code examples
- Provides an overall verdict

This is like having a senior developer review your code 24/7.

---

## Use Case 8: Refactor Across Multiple Files
**What it demonstrates:** Multi-file editing capabilities

**Your prompt:**
```
Rename the function getData to fetchUserProfile everywhere in this project.
Update all imports, call sites, tests, and comments.
```

**What happens:**
The agent will:
- Use Grep to find all occurrences of `getData`
- Read each file to understand context
- Distinguish between your function and other similarly-named things
- Use the Edit tool for precise, surgical changes
- Update function definitions, imports, calls, and references
- Show you a summary of all files modified

This showcases the agent's ability to make coordinated changes across your codebase safely.

---

## Use Case 9: Data Analysis with Python
**What it demonstrates:** Python REPL tool for interactive computing

First, set up Python support (one-time setup):
```bash
omp setup python
```

Then inside omp:
```
Using Python, read the CSV file sales_data.csv and analyze it:
- Show the first 5 rows
- Count total rows and columns
- Calculate basic statistics for numeric columns
- Identify any missing values
- Create a summary by category
```

**What happens:**
The agent will:
- Write Python code using pandas
- Execute it in a persistent Python kernel
- Show you the results in real-time
- Generate visualizations if requested
- Keep the data in memory for follow-up questions

You can continue the analysis: "Now create a bar chart of sales by month" and it will have context from the previous work.

---

## Use Case 10: Generate Documentation
**What it demonstrates:** Code comprehension + markdown generation

**Your prompt:**
```
Read all public functions in the src/api/ directory and generate
comprehensive API documentation in docs/API.md. Include signatures,
parameters, return types, and usage examples.
```

**What happens:**
The agent will:
- Use Glob to find all files in src/api/
- Read each file and identify public functions
- Extract parameter types, return values, and JSDoc/docstrings
- Generate clean, organized markdown documentation
- Create realistic usage examples
- Format everything consistently

The documentation will be thorough and actually useful, not just auto-generated noise.

---

## Use Case 11: Session Management and Time Travel
**What it demonstrates:** Session resume, branching, and conversation trees

Here's the workflow:
```
# Start working on a feature
omp

You: Add a new authentication system using JWT

# Work progresses... then you want to try a different approach
# Save a checkpoint with:
/branch

# Try the experimental approach
You: Actually, let's use OAuth2 instead

# If it doesn't work out, navigate back:
/tree

# Use arrow keys to select the branch point before OAuth2
# Now continue from there with a different approach

# Exit with Ctrl+D or Ctrl+C
# Later, resume where you left off:
omp --resume
```

**What happens:**
- `/branch` creates a named checkpoint in the conversation
- You can explore different approaches without losing work
- `/tree` shows a visual tree of your conversation branches
- `--resume` picks up your last session, preserving all context
- Each branch is independent - try risky changes without fear

This is like git for your AI conversations.

---

## Use Case 12: Parallel Task Execution
**What it demonstrates:** Task/subagent system for concurrent work

**Your prompt:**
```
I need to do three things simultaneously:
1. Find all TODO comments in the codebase and create a task list
2. Audit package.json for outdated or vulnerable dependencies
3. Generate a summary of git commits from the past month

Use parallel sub-agents to speed this up.
```

**What happens:**
The agent will:
- Spawn three independent sub-agents
- Each explores the codebase in parallel
- Sub-agents report progress in real-time
- Results are aggregated when all complete
- You get all three answers much faster than sequential execution

Watch the bottom of the screen to see multiple tasks running simultaneously.

---

## Use Case 13: Customize Your Experience
**What it demonstrates:** Theme system and personalization

Inside omp, type:
```
/theme
```

**What happens:**
A beautiful theme picker appears with 65+ themes:
- Catppuccin (Mocha, Macchiato, Frappe, Latte)
- Dracula
- Nord
- Gruvbox (Dark & Light)
- Tokyo Night
- Solarized
- One Dark/Light
- And many more...

Use arrow keys to preview each theme in real-time. Press Enter to select. Your choice persists across sessions.

---

## Use Case 14: Non-Interactive Mode for Scripting
**What it demonstrates:** Using omp in scripts and automation

```bash
# Quick one-off question
omp -p "What does the main function in src/index.ts do?"

# Pipe output to files
omp -p "List all exported functions in src/utils.ts" > functions.txt

# Use in shell scripts
#!/bin/bash
COMMIT_MSG=$(omp -p "Generate a changelog entry for: $(git log -1 --oneline)")
echo "$COMMIT_MSG" >> CHANGELOG.md

# Integrate with CI/CD
omp -p "Review the changes in this PR and identify security concerns" --json
```

**What happens:**
- The agent processes your prompt non-interactively
- Prints the response to stdout
- Exits immediately (no interactive session)
- Perfect for automation, scripts, and CI/CD pipelines
- Use `--json` flag for machine-readable output

This makes omp a powerful tool in your automation toolkit.

---

## Use Case 15: Include Files as Context
**What it demonstrates:** The @file mention system

**Your prompt:**
```
@src/config.ts @src/database.ts

These two files have inconsistent error handling. Standardize them
to use the same pattern, and add proper logging.
```

**What happens:**
- The `@` symbol followed by a file path includes that file's contents
- The agent reads both files automatically
- It has full context without needing to ask
- Makes targeted changes to both files
- Ensures consistency across the changes

You can also use wildcards: `@src/**/*.test.js` includes all test files.

---

## Use Case 16: Run Shell Commands
**What it demonstrates:** The `!` command prefix

Inside omp, type:
```
!git status
```

**What happens:**
- The command runs immediately without AI interpretation
- Output is displayed but NOT sent to the AI (saves tokens)
- Useful for quick checks during your workflow

Or use `!!` to include output as context:
```
!!npm test

The tests failed with the errors shown above. Fix them.
```

Now the test output is part of the conversation context, and the agent can analyze failures.

---

## Advanced Tips for Power Users

### 1. Be Specific and Direct
- ✅ "Add error handling to the login function in auth.ts using try-catch"
- ❌ "make the code better"

### 2. Monitor Context Usage
- Watch the context % in the footer (bottom right)
- When it gets above 80%, use `/compact` to summarize and compress
- Or use `/clear` to start fresh while keeping the session

### 3. Switch Models Strategically
- Type `/model` to see available models
- Use smaller/faster models (GPT-4o, Gemini) for simple tasks
- Use larger models (Claude Opus) for complex refactoring
- The agent remembers your choice per project

### 4. Use Tab Completion
- Start typing a file path and press Tab
- Works for both `@file` mentions and in regular prompts
- Saves time and prevents typos

### 5. Set Up Project Rules
Create `.omp/SYSTEM.md` in your project root:
```markdown
# Project Conventions

- Use TypeScript strict mode
- Prefer functional components with hooks
- All functions must have JSDoc comments
- Use Zod for runtime validation
- Follow conventional commits format
```

The agent will automatically read this file and follow your rules.

### 6. Search Your History
- Press `Ctrl+R` to search across all your previous prompts
- Press `Up/Down` arrows to navigate recent prompts
- History persists across sessions

### 7. Branch Before Risky Changes
Before major refactoring or experimental changes:
```
/branch trying-new-architecture
```

If it doesn't work, `/tree` back to safety.

### 8. Use omp commit Religiously
Stop writing commit messages manually. Just:
```bash
omp commit
```

The AI understands your changes better than you think. Add `--push` when you're confident.

### 9. Combine Tools in Prompts
```
Search the web for best practices on PostgreSQL connection pooling,
then update my src/db/connection.ts file to implement those practices.
```

The agent will search, learn, and apply - all in one go.

### 10. Ask for Explanations
```
Before you make any changes, explain your plan and the tradeoffs involved.
```

This helps you learn and catches mistakes before they happen.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+D` or `Ctrl+C` | Exit omp |
| `Enter` twice | Submit prompt |
| `Ctrl+R` | Search command history |
| `Up/Down` | Navigate command history |
| `Tab` | Autocomplete file paths |
| `Ctrl+L` | Clear screen (visual only) |

---

## Common Workflows

### Debugging Workflow
```
1. "Run the tests and show me any failures"
2. Agent runs tests, identifies failures
3. "Read the failing test and the code it tests"
4. Agent shows you both
5. "What's causing this to fail?"
6. Agent explains the issue
7. "Fix it"
8. Agent makes the changes
9. "Run the tests again"
10. All green ✅
```

### Feature Development Workflow
```
1. "/branch new-feature-name"
2. "Read the existing authentication code in src/auth/"
3. "Add support for two-factor authentication using TOTP"
4. Agent implements the feature
5. "Generate tests for the new 2FA functionality"
6. Agent creates comprehensive tests
7. "Update the README with documentation for 2FA setup"
8. Exit and commit:
   omp commit --push
```

### Code Review Workflow
```
1. Make your changes in your editor
2. omp
3. "/review"
4. Select "Uncommitted changes"
5. Agent reviews your work with detailed feedback
6. Address any P0/P1 issues
7. "/review" again to verify
8. omp commit when clean
```

---

## What's Next?

You've seen what omp can do. Here's how to go deeper:

- **Read the [User Guide](USER_GUIDE.md)** - Comprehensive documentation on every feature
- **Read the [Developer Guide](DEVELOPER_GUIDE.md)** - If you want to contribute or customize
- **Explore [extensions](../packages/coding-agent/docs/extensions.md)** - Extend omp with custom tools
- **Check `omp --help`** - See all CLI options and flags
- **Try `/help` inside omp** - Interactive help system with examples
- **Join the community** - Share workflows and learn from other users

---

## Troubleshooting

### "Command not found: omp"
Make sure Bun's global bin directory is in your PATH:
```bash
export PATH="$HOME/.bun/bin:$PATH"
```

### "API key not found"
Set your API key in your shell profile (~/.bashrc or ~/.zshrc):
```bash
export ANTHROPIC_API_KEY="your-key-here"
```

### "Context limit exceeded"
The conversation got too long. Use `/compact` to compress or `/clear` to start fresh.

### Python tools not working
Run the one-time setup:
```bash
omp setup python
```

### Agent seems confused
Try being more specific, or use `/clear` to start with a clean context.

---

## Final Thoughts

oh-my-pi is not just a code generator - it's a pair programming partner that:
- Understands your entire codebase
- Learns your project conventions
- Executes complex multi-step workflows
- Searches the web for current information
- Manages its own context and memory
- Never judges your 3am spaghetti code

The best way to learn is to use it. Start with simple tasks, build confidence, then tackle complex refactoring. You'll wonder how you ever coded without it.

Happy coding! 🚀
