# CeView Agent Guide

This is the canonical, tool-neutral guide for agents working in this repository. Tool-specific files may add capabilities or workflows, but must not override these safety and project rules.

## Project Context

CeView is a tourism-demand intelligence and AI-assisted marketing platform for Cebu-based MSMEs.

- Frontend: React 19, TypeScript, Vite, and Tailwind in `frontend/`
- Orchestration API: Spring Boot 3.3 and Java 21 in `backend/spring-boot/`
- AI services: Python 3.12 and FastAPI in `backend/fastapi-sbert/` and `backend/fastapi-transformer/`
- Data: PostgreSQL 16, pgvector, and Flyway
- Tests: Vitest, JUnit, pytest, and Playwright

Read `README.md` for setup, `RUNNING.md` before troubleshooting local development, and the relevant `docs/module-N/README.md` before changing module logic. Treat `ARCHITECTURE.md`, `ARCHITECTURE_SPEC.md`, and `backend/CONTRACT.md` as the source of truth for architecture, formulas, and API contracts.

## Shared Rules

- Keep changes scoped to the requested task. Do not add unrelated refactors or cleanup.
- Do not add new work to `ceview/` or `ceview/old-components/`; they are frozen legacy code.
- Preserve multi-tenant isolation. Scope every data-access path to the authenticated business operator.
- Place changes within their module boundaries. For example, Module 3 UI belongs in `frontend/components/module-3/`.
- Run the relevant focused tests or validation after a change when practical, and report what ran.
- Never run destructive Git commands such as `git reset --hard`, `git clean -f`, force-push, or destructive checkout operations.
- Do not run `git commit` or `git push`. If this policy is later changed to allow commits, use an industry-standard Conventional Commit message, for example: `feat(module-3): add campaign approval status`.

## Tool-Specific Guidance

- `.claude/` contains Claude Code skills, commands, and agents. Its skill files also serve as in-place shared workflows for any agent that can read repository files.
- `.github/copilot-instructions.md`, `GEMINI.md`, and `.claude/CLAUDE.md` direct their respective tools to this shared guide.
- When tool-specific guidance conflicts with this file, follow this file unless the user gives a newer, explicit instruction.

## Shared Workflows Stored in `.claude`

Agents may use the existing workflow files below without copying, moving, or registering them in another directory. When a task matches a workflow, read that workflow's `SKILL.md` before applying it. Read only the relevant workflow, not the entire `.claude/skills/` library.

| Task | Workflow file |
|---|---|
| Clarify requirements or explore options before implementation | `.claude/skills/brainstorming/SKILL.md` |
| Write an implementation plan | `.claude/skills/writing-plans/SKILL.md` |
| Execute an approved plan | `.claude/skills/executing-plans/SKILL.md` |
| Implement a scoped feature or fix | `.claude/skills/implement-task/SKILL.md` |
| Develop using tests first | `.claude/skills/test-driven-development/SKILL.md` |
| Diagnose a defect | `.claude/skills/systematic-debugging/SKILL.md` |
| Verify work before reporting completion | `.claude/skills/verification-before-completion/SKILL.md` |
| Request or respond to a code review | `.claude/skills/requesting-code-review/SKILL.md` or `.claude/skills/receiving-code-review/SKILL.md` |
| Build or refine frontend UI | `.claude/skills/frontend-design/SKILL.md` |
| Create or use a Git worktree | `.claude/skills/using-git-worktrees/SKILL.md` |
| Coordinate parallel agent work | `.claude/skills/dispatching-parallel-agents/SKILL.md` |

These are repository workflows, not native Codex skills. They supplement Codex's built-in skills and tools. If a workflow conflicts with system instructions, this guide, or an explicit user request, follow the higher-priority instruction.
