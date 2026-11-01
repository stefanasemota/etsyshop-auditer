# 🛍️ Initiative: Etsy Shop Auditer & Optimizer (`etsyshop-auditer`)

## 1. Vision & Overview
**`etsyshop-auditer`** is a public GitHub mini-app and Antigravity Plugin (`plugin.json` + `.agent/skills/etsy-optimizer/SKILL.md` + Etsy REST API v3 adapter & preview diff UI/CLI) that treats an Etsy shop's live catalog the same way `vibe-coder` treats a codebase:
1. Fetch the raw shop and listing state via Etsy REST API v3 (OAuth 2.0 PKCE) with offline local caching.
2. Run automated audits against a strict algorithmic rubric (140-char front-loaded titles, 13 multi-word tags <= 20 chars, 160-char meta-snippet descriptions, shop summary/about completeness, and media/attribute coverage).
3. Propose atomic micro-improvements via a structured JSON patch diff.
4. Preview diffs and require an explicit human approval gate before pushing changes to Draft or Active listings.

---

## 2. Core Components
1. **The Host Mini-App (`etsyshop-auditer`)**:
   - Handles Etsy OAuth 2.0 PKCE handshake (`listings_r`, `shops_r` for read-only; `listings_w`, `shops_w` for write).
   - Fetches and caches shop & active listing payloads in batches (`limit=100`, respecting 10 QPS / 10,000 QPD rate limits).
   - Evaluates deterministic rubric scores and renders an interactive preview diff before pushing updates (`PUT /v3/application/shops/{shop_id}/listings/{listing_id}`).
2. **The Vibecoder Skill & Plugin (`plugin.json` + `.agent/skills/etsy-optimizer/SKILL.md`)**:
   - Packaged as an installable Antigravity Plugin (`plugin.json`, `rules/AGENTS.md`, `skills/etsy-optimizer/SKILL.md`, `assets/logo.svg`).
   - Executes a 7-phase FDD optimization loop for Etsy shops (Discovery -> Exploration -> Clarifying Questions -> Strategy Selection -> Atomic Patch Generation -> Constraint Verification -> Draft/API Delivery).

---

## 3. Target Audit & Optimization Rubric
| Target Area | Hard Constraints & Algorithmic Rules | Optimization Goal |
| :--- | :--- | :--- |
| **Listing Titles** | Up to 140 chars; front-loaded keywords matter most | Strongest 2–3 phrase matches in first 40 chars (mobile cutoff); avoid repetitive keyword stuffing. |
| **Tags** | Exactly 13 tags; max 20 chars per tag; multi-word allowed | Flag missing (<13), single-word, or duplicate material tags; replace with long-tail phrases. |
| **Listing Descriptions** | First 160 chars drive Google meta snippets & search index | Top 2 sentences optimized for high-intent search, followed by skimmable specs, sizing, materials, FAQs. |
| **Shop Summary & About** | Shop title (55 chars), announcement, story, member bios | Align shop title with primary category; verify About section includes photos/video and story. |
| **Listing Attributes & Media** | Max 10 images, 1 video, core taxonomy attributes | Flag listings with <5 images, missing video, or incomplete taxonomy attributes. |
