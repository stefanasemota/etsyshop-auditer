# AI Workflow, Git & Commit Rules (`AGENTS.md`)

Strict operational rules for all AI coding agents. Zero filler or AI slop—keep code, commits, and documentation straight to the point.

---

## 1. Branching & Git Strategy (STRICT)
* **Never work on `main`:** Always create a descriptive branch (`feature/<slug>`, `fix/<slug>`, `chore/<slug>`) from the latest `development` or `main` branch before writing code.
* **Test on the branch:** Ensure all code builds, tests pass, and the feature works within the isolated branch.
* **Push, do not merge:** Push the verified branch to the remote repository and open a Draft Pull Request. Never merge into `main` or `development`—leave final merge/review to the human.

---

## 2. Execution Discipline
* **Verify before writing:** Read existing relevant code and run the build/test command to confirm the baseline passes before making edits.
* **Look Before You Leap:** Always run a `find` or `grep` search to check if a utility function, hook, or component already exists before writing a new one from scratch.
* **Dependency Lockdown:** Never install new `npm` packages or `pip` libraries without explicit human approval first. Rely on existing dependencies whenever possible.
* **Fix your own bugs:** If a build, lint, or test command fails after your edit, iterate and fix it autonomously before declaring the task done.
* **Documentation Sync:** If a code change alters an API endpoint, CLI flag, environment variable, or setup step, update `README.md`, `dev.md`, or API docs in the same commit.
* **Zero AI Slop:** Avoid filler words, robotic transitions, or verbose boilerplate. Write concise, direct prose and self-documenting code.

---

## 3. Conventional Commits & Atomicity
* **Commit atomicity:** Make small, logical commits as you progress through a feature rather than one massive commit at the end.
* **Explain the Fix:** When resolving a bug (`fix`), include a concise commit body explaining *why* the bug occurred and *how* the change fixed it.
* **Required Header Format:** `type(optional-scope): short description`

| Type | When to Use |
|---|---|
| `feat` | A new feature visible to the user |
| `fix` | A bug fix (include root cause & fix summary) |
| `docs` | Documentation only changes |
| `chore` | Build, config, or tooling changes |
| `refactor` | Code restructured with no behavior change |
| `test` | Adding or correcting tests |
| `style` | Formatting changes only |
| `perf` | Performance improvements |

### ❌ Rejected by CI
* `"updated code"`, `"changes"`, `"WIP"`, or any commit message without a valid `type:` prefix.
