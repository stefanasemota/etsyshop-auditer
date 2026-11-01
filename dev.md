# 🛠️ Developer Guide (`dev.md`)

Local setup, environment variables, Etsy Developer API v3 configuration, and test execution for **`etsyshop-auditer`**.

---

## 1. Prerequisites

- **Node.js:** `>= 22.0.0` (see [`.nvmrc`](.nvmrc))
- **Zero External Runtime Dependencies:** Uses native Node.js ESM (`node:http`, `node:crypto`, `node:fs`, `node:test`).

---

## 2. Environment Variables (Optional for Offline/Fixture Mode)

By default, `etsyshop-auditer` runs offline using [`fixtures/sample-shop.json`](fixtures/sample-shop.json) and caches staged patches in `.cache/`. To connect to a live Etsy shop via Etsy REST API v3:

1. Register an app in the [Etsy Developer Portal](https://www.etsy.com/developers/your-apps) and configure your callback URL (`http://localhost:4321/oauth/callback`).
2. Create a local `.env` file (gitignored):

```ini
ETSY_API_KEYSTRING=your_etsy_v3_client_id_keystring
ETSY_ACCESS_TOKEN=your_oauth2_pkce_bearer_token
ETSY_SHOP_ID=48291044
PORT=4321
```

### OAuth 2.0 PKCE Scopes
- **Read-Only Auditing:** `listings_r shops_r`
- **Draft Staging / Live Updates:** `listings_r shops_r listings_w shops_w`

---

## 3. NPM Scripts & CLI Usage

| Script / Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the interactive Preview Diff Dashboard at `http://localhost:4321`. |
| `npm test` / `npm run test:unit` | Runs the automated test suite (`tests/etsyshop-auditer.test.mjs`). |
| `npm run lint` / `npm run build` | Checks syntax across CLI/modules and executes the full test suite. |
| `node ./bin/etsyshop-auditer.mjs audit` | Outputs the 100-point rubric JSON report for the active shop. |
| `node ./bin/etsyshop-auditer.mjs optimize --strategy=seo-focus` | Outputs atomic JSON patches for all listings using the chosen strategy. |
| `node ./bin/etsyshop-auditer.mjs stage-all` | Validates and stages all patches to `.cache/staged-patches.json`. |

---

## 4. Customizing Trademark & Policy Rules

Edit [`config/trademarks.json`](config/trademarks.json) to add brand names, trademarked phrases, or prohibited policy terms for your niche. Any listing or generated patch containing a blocked term will automatically fail `validateListingConstraints()` and refuse live push.
