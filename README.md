# 🛍️ Etsy Shop Auditer & Optimizer (`etsyshop-auditer`)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/stefanasemota/etsyshop-auditer)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/stefanasemota/etsyshop-auditer)
[![Etsy API v3](https://img.shields.io/badge/Etsy%20API-v3%20OAuth%202.0%20PKCE-F1641E?logo=etsy&logoColor=white)]()
[![Gemini](https://img.shields.io/badge/Gemini-AI%20Powered-8E75B2?logo=google-gemini&logoColor=white)]()

**`etsyshop-auditer`** is a lightweight Node.js mini-app and public **Antigravity Plugin** ([`plugin.json`](plugin.json)) that treats your Etsy shop catalog like a codebase in the `vibe-coder` 7-Phase Feature-Driven Development (FDD) workflow: fetch raw shop & listing state via Etsy REST API v3 (OAuth 2.0 PKCE) or offline cache, score listings against a deterministic 100-point algorithmic rubric, generate atomic JSON patches, verify hard constraints & trademark safety, and preview side-by-side diffs before staging to Draft or pushing live.

---

## ⚡ Install as an Antigravity Plugin (`plugin.json`)

Install `etsyshop-auditer` globally in Antigravity so the [`etsy-optimizer`](.agent/skills/etsy-optimizer/SKILL.md) skill and [`rules/AGENTS.md`](rules/AGENTS.md) are available across your workspace:

```bash
mkdir -p ~/.gemini/config/plugins ~/.gemini/antigravity/skills ~/.gemini/config/skills
ln -sfn "$(pwd)" ~/.gemini/config/plugins/etsyshop-auditer
ln -sfn "$(pwd)/.agent/skills/etsy-optimizer" ~/.gemini/antigravity/skills/etsy-optimizer
ln -sfn "$(pwd)/.agent/skills/etsy-optimizer" ~/.gemini/config/skills/etsy-optimizer
```

---

## 🏗️ Architectural Summary

```
[Etsy Shop Owner]
       │ (1. OAuth 2.0 PKCE Login or Offline Fixture/Cache)
       ▼
[etsyshop-auditer Adapter (src/api/etsy-client.mjs)]
       │ ├── GET /v3/application/shops/{shop_id}/listings/active (limit=100)
       ▼
[100-Point Rubric Engine (src/audit/rubric.mjs)]
       │ ├── Audits Titles (140c / 40c mobile lead), 13 Tags (<=20c), Descriptions (160c meta), Media & Shop Trust
       ▼
[Atomic Patch Engine & Validator (src/optimizer/patch-engine.mjs + src/schema/validator.mjs)]
       │ ├── Generates Before -> After JSON Patch + checks config/trademarks.json
       ▼
[Preview Diff UI & Human Approval Gate (src/server/dashboard.mjs)]
       │ ├── Stage in Draft (.cache/staged-patches.json) or Push Live
       ▼
[PUT /v3/application/shops/{shop_id}/listings/{listing_id}]
```

### Core Modules

| Module | Path | Responsibility |
| :--- | :--- | :--- |
| **Plugin Manifest** | [`plugin.json`](plugin.json) | Antigravity Plugin bundle exposing `etsy-optimizer`, `rules/AGENTS.md`, `assets/logo.svg`, and starter prompts. |
| **7-Phase Skill** | [`.agent/skills/etsy-optimizer/SKILL.md`](.agent/skills/etsy-optimizer/SKILL.md) | Guides the 7-phase Etsy shop discovery, bottleneck analysis, strategy selection, and atomic patch generation. |
| **Schema & Trademark Validator** | [`src/schema/validator.mjs`](src/schema/validator.mjs) | Enforces 140-char titles, 40-char mobile lead, 13x20-char unique tags, 160-char meta snippets, and [`config/trademarks.json`](config/trademarks.json). |
| **100-Point Audit Rubric** | [`src/audit/rubric.mjs`](src/audit/rubric.mjs) | Evaluates listings across 5 weighted dimensions (Title 25, Tags 25, Description 20, Media 15, Shop Trust 15). |
| **Atomic Patch Engine** | [`src/optimizer/patch-engine.mjs`](src/optimizer/patch-engine.mjs) | Produces verified `EtsyListingPatch` diffs across 3 strategies (`pragmatic-balance`, `seo-focus`, `storytelling-conversion`). |
| **Etsy v3 PKCE Client** | [`src/api/etsy-client.mjs`](src/api/etsy-client.mjs) | OAuth 2.0 PKCE S256 challenge generator, batched active-listing fetcher (`limit=100`), offline `.cache/`, and safe draft staging. |
| **Preview Diff UI & CLI** | [`src/server/dashboard.mjs`](src/server/dashboard.mjs) / [`bin/etsyshop-auditer.mjs`](bin/etsyshop-auditer.mjs) | Side-by-side Before/After web dashboard (`http://localhost:4321`) and CLI commands (`audit`, `optimize`, `stage-all`, `serve`). |

---

## 🚀 Quick-Start Commands

```bash
# 1. Run the 100-point rubric audit on cached or sample shop fixtures
node ./bin/etsyshop-auditer.mjs audit

# 2. Generate atomic JSON patches (strategies: pragmatic-balance | seo-focus | storytelling-conversion)
node ./bin/etsyshop-auditer.mjs optimize --strategy=pragmatic-balance

# 3. Stage verified patches into local Draft cache (.cache/staged-patches.json)
node ./bin/etsyshop-auditer.mjs stage-all --strategy=pragmatic-balance

# 4. Launch the interactive Preview Diff Web Dashboard (http://localhost:4321)
npm run dev

# 5. Run zero-warning lint and automated unit & integration tests
npm test
```

---

Powered by <a href="https://github.com/stefanasemota/vibe-coding-guardrail">aos Vibe Coding Guardrail</a> | Fuel the Project - Buy me a coffee: <a href="https://buymeacoffee.com/stephanasex">https://buymeacoffee.com/stephanasex</a>
