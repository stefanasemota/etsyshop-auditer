---
name: etsy-optimizer
description: "Executes a 7-Phase FDD Etsy shop & listing audit and optimization loop. Pulls shop policies, about section, and active listings via Etsy REST API v3 (OAuth 2.0 PKCE) or offline cache, scores listings against the 100-point algorithmic rubric (140-char front-loaded title, 40-char mobile lead, 13 multi-word tags <= 20 chars, 160-char meta snippet description, media/attributes), checks trademark safety, and generates atomic JSON patches for preview diff approval."
---

# `etsy-optimizer` — 7-Phase FDD Etsy Shop Audit & Optimization Skill

The **shop owner is the driver** and **AI + `etsyshop-auditer` is the engine**. Treat Etsy shop & listing state with the same rigor as a production codebase: inspect raw state, score deterministically, ask clarifying questions before rewriting brand voice, propose strategy trade-offs, emit atomic JSON patches, verify hard constraints, and require human approval before modifying active revenue-generating listings.

---

## 1. Algorithmic Rubric & Hard Constraints (100 Points)

| Target Area | Weight | Hard Constraints | Optimization Goal |
| :--- | :--- | :--- | :--- |
| **Listing Titles** | **25 pts** | `1..140` chars; zero trademark hits | Front-load strongest 2–3 buyer phrases in first `40` chars (mobile preview cutoff); avoid root-word spam (`<= 2x`). |
| **13-Tag Matrix** | **25 pts** | Exactly `13` tags; each `<= 20` chars | Fill all `13/13` slots; `>= 70%` multi-word long-tail phrases; zero duplicates or single-word `materials` overlap. |
| **Descriptions** | **20 pts** | `>= 160` char lead; no external policy-violating links | Optimize first `160` chars for Google meta snippet indexing + skimmable bullet specs, dimensions, care, and FAQ. |
| **Media & Taxonomy** | **15 pts** | Max `10` images, `1` video | Flag listings with `< 5` photos, missing product video (`has_video: false`), or `< 3` taxonomy attributes. |
| **Shop Summary & About** | **15 pts** | Shop title `<= 55` chars | Align shop title with primary product category; verify About story + photos/video + complete shipping/return policies. |

---

## 2. The 7-Phase Etsy Optimization Loop

### Phase 1: Discovery (State Ingestion)
1. Load shop policies, About section, and active listings from local cache (`.cache/shop-<id>.json`), fixture (`fixtures/sample-shop.json`), or Etsy v3 API (`GET /v3/application/shops/{shop_id}/listings/active?limit=100`):
   ```bash
   node ./bin/etsyshop-auditer.mjs audit
   ```

### Phase 2: Exploration (Bottleneck & Search-Intent Analysis)
1. Analyze rubric scores (`src/audit/rubric.mjs`) across all listings.
2. Identify conversion bottlenecks: missing 40-char mobile hooks, unused tag slots (`< 13`), single-word generic tags, weak 160-char meta snippets, missing listing videos, or incomplete taxonomy attributes.

### Phase 3: Clarifying Questions (Mandatory Human Gate)
**Pause and ask the shop owner before generating final patches:**
1. **Target Audience & Occasion Focus:** Who is the primary buyer (e.g., gift shoppers, weddings/anniversaries, everyday personal use)?
2. **Brand Voice & Pricing Boundaries:** Should copy read warm/artisan-storytelling, minimalist/technical, or gift-ready luxury?
3. **Material / Customization Constraints:** Which personalization options or materials must be highlighted or excluded?

### Phase 4: Strategy Selection (Mandatory Human Gate)
Present 3 optimization paths and compare their trade-offs:
- **`seo-focus` (Pure Search-Intent Focus):** Maximizes exact-match long-tail keyword density across title clauses and all 13 tags.
- **`storytelling-conversion` (Craft & Conversion Focus):** Emphasizes studio origin, heirloom quality, and buyer trust hooks while preserving core search phrases.
- **`pragmatic-balance` (Recommended Default):** Front-loads top search phrases in the 40-char mobile lead and 160-char meta snippet while structuring skimmable conversion bullets.

### Phase 5: Atomic Implementation (`generateListingPatch`)
Generate atomic JSON patches (`schema_version: "1.0.0"`) per listing:
```bash
node ./bin/etsyshop-auditer.mjs optimize --strategy=pragmatic-balance
```

### Phase 6: Quality & Constraint Verification (Mandatory Gate)
Validate every generated patch via `validateListingPatch` (`src/schema/validator.mjs`):
- Confirm `title.length <= 140` and inspect `mobile_lead_40`.
- Confirm `tags.length === 13` and every tag is `<= 20` chars with zero duplicates.
- Confirm `trademark_violations` is empty (`[]`) against `config/trademarks.json`.

### Phase 7: Delivery & Draft Staging
1. Stage verified patches into `.cache/staged-patches.json` (`target_state: "draft"` by default):
   ```bash
   node ./bin/etsyshop-auditer.mjs stage-all --strategy=pragmatic-balance
   ```
2. Launch the interactive Preview Diff Dashboard (`node ./bin/etsyshop-auditer.mjs serve` at `http://localhost:4321`) so the shop owner can review Before/After diffs side-by-side before pushing via `PUT /v3/application/shops/{shop_id}/listings/{listing_id}`.
