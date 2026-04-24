---
name: commit-push
description: Commit all changes and push to remote. Checks for files that should be gitignored, splits into logical commits, and asks questions if unsure.
---

# Commit and Push

Commit all staged, unstaged, and untracked changes, then push to remote.

## Steps

### 1. Assess the current state

Run these in parallel:

- `git status` to see all changes (staged, unstaged, untracked). IMPORTANT: Never use the `-uall` flag.
- `git diff` to see unstaged changes.
- `git diff --cached` to see staged changes.
- `git log --oneline -5` to understand the recent commit message style.

### 2. Check for files that should be gitignored

Review all **untracked files**. For each, decide:

- Should it be committed? (source code, config, docs, etc.)
- Should it be gitignored? (build artifacts, secrets, local state, logs, downloaded data, `.env` files, `node_modules/`, etc.)

**If unsure about any file, ask the user before proceeding.** Use `AskUserQuestion` with a clear list of the files you're unsure about and your best guess for each.

If any files need to be gitignored, add them to `.gitignore` first and include that change in the commit.

### 3. Split into logical commits

Group related changes into separate commits when it makes sense. Common groupings:

- New feature code in one commit
- Refactors or renames in another
- Config/tooling changes separately
- Documentation separately

Don't over-split: if all changes are part of one coherent task, one commit is fine.

### 4. Create commits

For each commit:

- Stage the relevant files by name (avoid `git add -A` or `git add .`)
- Write a concise commit message (1-2 sentences) that focuses on the **why**, not the **what**
- Follow the style of recent commits in the repo
- End with the co-authored-by trailer

Use HEREDOC format for commit messages:

```
git commit -m "$(cat <<'EOF'
Commit message here.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 5. Push

```bash
git push
```

If the branch has no upstream, use `git push -u origin <branch>`.

### 6. Report

List the commits that were pushed with their short hashes and messages.

## Rules

- NEVER commit files that look like secrets (`.env`, credentials, API keys, tokens). Warn the user if they exist in the working tree and aren't gitignored.
- NEVER use `git add -A` or `git add .` - always stage specific files.
- NEVER amend existing commits - always create new ones.
- NEVER skip hooks (`--no-verify`).
- If a pre-commit hook fails, fix the issue and create a new commit.
- If there are no changes to commit, say so and don't create empty commits.
- Ask the user if anything is ambiguous - don't guess.
