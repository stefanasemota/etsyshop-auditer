# 📋 Architectural & Implementation Decision Log (`decision.md`)

Reverse-chronological ledger (newest at top, oldest at bottom) of all architectural, UX, and implementation choices governed by the `vibe-coder` protocol. Date format: `[DD.MM.YYYY]`.

---

### [01.11.2026] - Approve Approach C (Pragmatic Balance) Architecture, 100-Point Audit Rubric & Atomic JSON Patch Schema
- **Origin:** Human Request | Agent Proposal
- **Context:** `etsyshop-auditer` requires both a standalone host mini-app (Etsy REST API v3 OAuth 2.0 PKCE client, offline caching, sample fixtures, 100-point rubric evaluator, atomic JSON patch generator, and interactive preview-diff web UI/CLI) and an installable Antigravity Plugin (`plugin.json` + `.agent/skills/etsy-optimizer/SKILL.md`).
- **Decision:** Selected Approach C (Pragmatic Balance): zero-dependency Node.js (`>=22`, ESM) modular architecture with strict schema/trademark validation (`src/schema/validator.mjs`), 100-point rubric engine (`src/audit/rubric.mjs`), multi-strategy patch generator (`src/optimizer/patch-engine.mjs`), OAuth 2.0 PKCE + cached Etsy v3 adapter (`src/api/etsy-client.mjs`), interactive preview-diff HTTP server (`src/server/dashboard.mjs`), CLI (`bin/etsyshop-auditer.mjs`), sample fixtures (`fixtures/sample-shop.json`), and Antigravity Plugin bundle (`plugin.json`, `.agent/skills/etsy-optimizer/SKILL.md`, `rules/AGENTS.md`, `assets/logo.svg`).
- **Impact:** `decision.md`, `docs/feature/etsyshop-auditer/plan.md`, `package.json`, `plugin.json`, `.gitignore`, `AGENTS.md`, `ai-rules.json`, `README.md`, `dev.md`, `src/**`, `bin/etsyshop-auditer.mjs`, `.agent/skills/etsy-optimizer/SKILL.md`, `tests/etsyshop-auditer.test.mjs`.
