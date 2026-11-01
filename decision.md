# 📋 Architectural & Implementation Decision Log (`decision.md`)

Reverse-chronological ledger (newest at top, oldest at bottom) of all architectural, UX, and implementation choices governed by the `vibe-coder` protocol. Date format: `[DD.MM.YYYY]`.

---

### [01.11.2026] - Rename Project & GitHub Repository to `shoplistingauditer` and Add File Picker CSV Importer
- **Origin:** Human Request
- **Context:** Etsy's Developer Portal rejects application names containing the restricted trademark `"etsy"`, and new Etsy API keys require manual approval before OAuth is active.
- **Decision:** Renamed the project, CLI (`bin/shoplistingauditer.mjs`), package/plugin manifests, local directory (`/Users/aostefan/Developer/shoplistingauditer`), and GitHub repository (`stefanasemota/shoplistingauditer`) to `shoplistingauditer`, and added a file-picker + text CSV importer on Step 1 (`src/api/csv-importer.mjs`) so shop owners can audit real listings without waiting on API key approval.
- **Impact:** `package.json`, `plugin.json`, `bin/shoplistingauditer.mjs`, `src/api/csv-importer.mjs`, `src/server/dashboard.mjs`, `tests/shoplistingauditer.test.mjs`, `README.md`, `decision.md`.

### [01.11.2026] - Implement 3-Step Guided OAuth Wizard UX & Move Repository to `/Users/aostefan/Developer/etsyshop-auditer`
- **Origin:** Human Request | Agent Proposal
- **Context:** Opening the dashboard directly to a dense wall of technical diffs was overwhelming; the user requested a clear 3-step guided flow (`1. Connect Your Shop` via Etsy OAuth 2.0 or Demo Mode &rarr; `2. Audit Shop Overview` &rarr; `3. Propose & Apply Optimizations`) and moved the project to `/Users/aostefan/Developer/etsyshop-auditer`.
- **Decision:** Adopted Approach C (Server-Driven 3-Step Wizard + Full PKCE Session & Callback Handler in `src/api/etsy-client.mjs` and `src/server/dashboard.mjs`), allowing users to paste their Etsy Keystring or connect via Etsy OAuth 2.0 (`POST /oauth/connect`, `GET /oauth/callback`), inspect a plain-English Shop Audit Summary (`?step=2`), and review clean Proposed Optimizations (`?step=3`).
- **Impact:** `src/api/etsy-client.mjs`, `src/server/dashboard.mjs`, `tests/etsyshop-auditer.test.mjs`, `README.md`, `dev.md`, `decision.md`, `docs/feature/guided-oauth-onboarding/plan.md`.

### [01.11.2026] - Complete 7-Phase FDD Delivery, Quality/Security Gate & `v1.0.0` Antigravity Plugin Bundle
- **Origin:** Human Request | Agent Proposal
- **Context:** Completed all 7 FDD units (`FDD-1` through `FDD-7`) for `etsyshop-auditer` and executed `aos-verify` (`6/6` tests passing, zero lint warnings) and `aos-check-for-security-issues` (`0` critical findings).
- **Decision:** Approved Phase 6 gate, logged future enhancements (`M-1` OAuth refresh token rotation and `M-2` 10 QPS pagination backoff for `>1,000` listing catalogs), generated `aos-audit.md` compliance report, and finalized `v1.0.0` for public GitHub delivery and Antigravity Plugin installation.
- **Impact:** `decision.md`, `docs/feature/etsyshop-auditer/plan.md`, `aos-audit.md`.

### [01.11.2026] - Approve Approach C (Pragmatic Balance) Architecture, 100-Point Audit Rubric & Atomic JSON Patch Schema
- **Origin:** Human Request | Agent Proposal
- **Context:** `etsyshop-auditer` requires both a standalone host mini-app (Etsy REST API v3 OAuth 2.0 PKCE client, offline caching, sample fixtures, 100-point rubric evaluator, atomic JSON patch generator, and interactive preview-diff web UI/CLI) and an installable Antigravity Plugin (`plugin.json` + `.agent/skills/etsy-optimizer/SKILL.md`).
- **Decision:** Selected Approach C (Pragmatic Balance): zero-dependency Node.js (`>=22`, ESM) modular architecture with strict schema/trademark validation (`src/schema/validator.mjs`), 100-point rubric engine (`src/audit/rubric.mjs`), multi-strategy patch generator (`src/optimizer/patch-engine.mjs`), OAuth 2.0 PKCE + cached Etsy v3 adapter (`src/api/etsy-client.mjs`), interactive preview-diff HTTP server (`src/server/dashboard.mjs`), CLI (`bin/etsyshop-auditer.mjs`), sample fixtures (`fixtures/sample-shop.json`), and Antigravity Plugin bundle (`plugin.json`, `.agent/skills/etsy-optimizer/SKILL.md`, `rules/AGENTS.md`, `assets/logo.svg`).
- **Impact:** `decision.md`, `docs/feature/etsyshop-auditer/plan.md`, `package.json`, `plugin.json`, `.gitignore`, `AGENTS.md`, `ai-rules.json`, `README.md`, `dev.md`, `src/**`, `bin/etsyshop-auditer.mjs`, `.agent/skills/etsy-optimizer/SKILL.md`, `tests/etsyshop-auditer.test.mjs`.
