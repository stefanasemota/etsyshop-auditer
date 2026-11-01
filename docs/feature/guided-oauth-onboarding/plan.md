# 📐 7-Phase FDD Plan: Guided Etsy OAuth Onboarding & Step-by-Step Audit UX

- **Feature Branch:** `feature/etsyshop-auditer-init`
- **Engine Profile:** `antigravity`
- **Date Initialized:** `[01.11.2026]`

---

## 7-Phase FDD Checklist

- [x] **Phase 1: Discovery & FDD Decomposition**
  - FDD-1: `Authenticate and persist Etsy OAuth 2.0 PKCE sessions from the browser callback`
  - FDD-2: `Fetch live connected shop profile and active listings after OAuth login`
  - FDD-3: `Render a 3-step guided wizard UI (1. Connect Shop -> 2. Audit Summary -> 3. Propose Optimizations)`
- [x] **Phase 2: Targeted Codebase Exploration**
  - Inspected `src/server/dashboard.mjs`, `src/api/etsy-client.mjs`, and `bin/etsyshop-auditer.mjs`.
- [x] **Phase 3: Clarifying Questions & Spec Freeze**
  - Confirmed: 3-Step Guided Wizard (`Step 1: Connect Shop` -> `Step 2: Run Shop Audit` -> `Step 3: Propose & Apply Optimizations`).
  - Confirmed: In-UI Etsy Keystring input on Step 1 (persisted in `.cache/oauth-session.json`) + `Try Demo Shop` button.
- [x] **Phase 4: Architecture & Trade-Offs Matrix (MANDATORY GATE)**
  - Approved Approach C (Server-Driven 3-Step Wizard + Full PKCE Callback) and logged ADR in `decision.md` (`[01.11.2026]`).
- [x] **Phase 5: Incremental FDD Implementation (`aos-vibecode`)**
- [x] **Phase 6: Automated Quality & Security Review (`aos-verify` & `aos-check-for-security-issues`)**
- [x] **Phase 7: Delivery, Decision Logging & Summary**
