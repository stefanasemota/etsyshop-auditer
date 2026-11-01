# 📐 7-Phase FDD Plan: `etsyshop-auditer` Mini-App & Antigravity Plugin

- **Feature Branch:** `feature/etsyshop-auditer-init`
- **Engine Profile:** `antigravity` (`max_patch_size: 50`, `surgical-unified-diff`, `strict` type safety, `explicit-pause-and-wait` gates at Phases 3, 4, 6)
- **Date Initialized:** `[01.11.2026]`

---

## 7-Phase FDD Checklist

- [x] **Phase 1: Discovery & FDD Decomposition**
  - Resolve Engine Profile (`profile-antigravity.md`) and isolate Git branch (`feature/etsyshop-auditer-init`).
  - Initialize `initiative.md` and `docs/feature/etsyshop-auditer/plan.md`.
  - Decompose system into standard FDD micro-features (`<action> <result> <by|for|of> <a|an> <object>`).
- [x] **Phase 2: Targeted Codebase & Reference Exploration**
  - Inspect reference Antigravity Plugin & Guardrail structure (`plugin.json`, `package.json`, `AGENTS.md`, `ai-rules.json`, `.agent/skills/`, `tests/`).
- [x] **Phase 3: Clarifying Questions & Spec Freeze (MANDATORY GATE)**
  - Confirmed: Zero-dependency Node.js (ESM, `node >= 22`) Web Dashboard + CLI + `node --test` runner.
  - Confirmed: Ship realistic sample Etsy shop/listing fixtures (`fixtures/sample-shop.json`) + offline cache alongside live Etsy OAuth 2.0 PKCE.
  - Confirmed: Strict Etsy hard-constraint validator + configurable trademark/prohibited terms ruleset (`config/trademarks.json`).
  - Confirmed: Keep workspace in `/Users/aostefan/.gemini/antigravity/scratch/etsyshop-auditer` and include `"vibe-coding-guardrail": "github:stefanasemota/vibe-coding-guardrail"` in `devDependencies`.
- [x] **Phase 4: Architecture & Trade-Offs Matrix (MANDATORY GATE)**
  - Approved Approach C (Pragmatic Balance) + 100-Point Audit Rubric + Atomic JSON Patch Schema and logged ADR in `decision.md` (`[01.11.2026]`).
- [ ] **Phase 5: Incremental FDD Implementation (`aos-vibecode`)**
  - [x] FDD-1: `Scaffold standardized metadata and plugin manifest for an etsyshop-auditer repository`
  - FDD-2: `Validate Etsy listing and shop payloads against a strict schema for an audit engine`
  - FDD-3: `Authenticate OAuth 2.0 PKCE sessions and cache batched requests for an Etsy v3 API client`
  - FDD-4: `Calculate rubric scores and constraint violations of an Etsy shop catalog`
  - FDD-5: `Generate and validate atomic JSON patches for an Etsy listing optimization`
  - FDD-6: `Render side-by-side preview diffs and approval controls for a shop owner dashboard`
  - FDD-7: `Orchestrate the 7-phase Etsy shop optimization workflow by an Antigravity skill`
- [ ] **Phase 6: Automated Quality & Security Review (`aos-verify` & `aos-check-for-security-issues` — MANDATORY GATE)**
  - Validate zero-warning lint/typecheck, unit & integration tests, secret scanning, and PKCE/API safety.
- [ ] **Phase 7: Delivery, Decision Logging & Summary**
  - Prepend final ADR to `decision.md` (`[01.11.2026]`), run `aos-audit-project` compliance check, push branch, and open Draft PR.
