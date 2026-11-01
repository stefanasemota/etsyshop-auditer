import http from 'node:http';
import { URL } from 'node:url';
import { EtsyClient, buildAuthorizationUrl, generatePkcePair } from '../api/etsy-client.mjs';
import { auditShopCatalog } from '../audit/rubric.mjs';
import { generateCatalogPatches, generateListingPatch } from '../optimizer/patch-engine.mjs';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderStepConnect(session = {}) {
  return `
  <section class="wizard-card">
    <h2>Step 1: Connect Your Etsy Shop</h2>
    <p class="muted">Sign in with Etsy OAuth 2.0 to pull your active listings, run a health audit, and get ready-to-apply SEO &amp; conversion improvements.</p>
    <form method="POST" action="/oauth/connect" class="stack-form">
      <label>
        <span>Etsy App Keystring (Client ID)</span>
        <input type="text" name="client_id" value="${escapeHtml(session.clientId || '')}" placeholder="e.g. a1b2c3d4e5f6g7h8i9j0..." required />
      </label>
      <label>
        <span>Your Etsy Shop ID (Numeric ID)</span>
        <input type="text" name="shop_id" value="${escapeHtml(session.shopId || '')}" placeholder="e.g. 48291044" required />
      </label>
      <button type="submit" class="btn-primary">Connect Your Shop with Etsy OAuth &rarr;</button>
    </form>
    <div class="divider"><span>OR TEST WITHOUT AN API KEY</span></div>
    <form method="POST" action="/oauth/demo">
      <button type="submit" class="btn-secondary">Connect Sample Etsy Shop (Demo Mode)</button>
    </form>
  </section>`;
}

function renderStepAudit({ auditReport }) {
  const rows = auditReport.listings
    .map((item) => {
      const statusLabel = item.total_score >= 85 ? 'Healthy' : item.total_score >= 70 ? 'Good' : 'Needs Optimization';
      const statusClass = item.total_score >= 85 ? 'pill-ok' : item.total_score >= 70 ? 'pill-warn' : 'pill-bad';
      const topIssues = item.findings.slice(0, 3).map((f) => `<li>${escapeHtml(f)}</li>`).join('');
      return `
      <article class="card">
        <div class="card-header">
          <div>
            <span class="pill ${statusClass}">${statusLabel} &bull; ${item.total_score}/100</span>
            <h3 style="margin:0.4rem 0 0;">${escapeHtml(item.title)}</h3>
          </div>
          <a href="/?step=3&listing=${item.listing_id}" class="btn-primary">Propose Optimizations &rarr;</a>
        </div>
        ${topIssues ? `<ul class="issue-list">${topIssues}</ul>` : '<p class="muted">All core Etsy SEO checks passed.</p>'}
      </article>`;
    })
    .join('\n');

  return `
  <section>
    <div class="banner">
      <div>
        <h2 style="margin:0;">Step 2: Shop Audit Results for ${escapeHtml(auditReport.shop_name)}</h2>
        <p class="muted" style="margin:0.25rem 0 0;">Overall Shop Health Score: <strong>${auditReport.average_score}/100</strong> across ${auditReport.listing_count} active listings.</p>
      </div>
      <a href="/?step=3" class="btn-primary">Propose Optimizations for All (${auditReport.listing_count}) &rarr;</a>
    </div>
    ${rows}
  </section>`;
}

function renderStepOptimize({ auditReport, patches, stagedPatches = {}, strategy, filterListingId }) {
  const visiblePatches = filterListingId
    ? patches.filter((p) => p.listing_id === Number(filterListingId))
    : patches;

  const cardsHtml = visiblePatches
    .map((patch) => {
      const isStaged = Boolean(stagedPatches[String(patch.listing_id)]);
      const beforeTags = patch.before.tags.map((t) => `<span class="tag tag-before">${escapeHtml(t)}</span>`).join(' ');
      const afterTags = patch.after.tags.map((t) => `<span class="tag tag-after">${escapeHtml(t)}</span>`).join(' ');
      const rationaleItems = patch.rationale.map((r) => `<li>${escapeHtml(r)}</li>`).join('');

      return `
      <article class="card" data-listing-id="${patch.listing_id}">
        <header class="card-header">
          <div>
            <span class="pill pill-ok">Score Boost: ${patch.audit_score.before} &rarr; ${patch.audit_score.after} (${escapeHtml(patch.audit_score.delta)} pts)</span>
            ${isStaged ? '<span class="badge badge-staged">Saved to Draft</span>' : ''}
          </div>
          <form method="POST" action="/api/stage" class="inline-form">
            <input type="hidden" name="listing_id" value="${patch.listing_id}" />
            <input type="hidden" name="strategy" value="${escapeHtml(strategy)}" />
            <button type="submit" class="btn-approve">Approve &amp; Stage Draft</button>
          </form>
        </header>
        <div class="diff-grid">
          <section class="diff-col">
            <h4>Current Listing</h4>
            <p><strong>Title:</strong> ${escapeHtml(patch.before.title)}</p>
            <p><strong>Tags (${patch.before.tags.length}/13):</strong></p>
            <div class="tags-wrap">${beforeTags}</div>
            <pre class="desc-box">${escapeHtml(patch.before.description)}</pre>
          </section>
          <section class="diff-col diff-after">
            <h4>Proposed Optimization</h4>
            <p><strong>New Title:</strong> ${escapeHtml(patch.after.title)}</p>
            <p><strong>New 13 Search Tags:</strong></p>
            <div class="tags-wrap">${afterTags}</div>
            <pre class="desc-box">${escapeHtml(patch.after.description)}</pre>
          </section>
        </div>
        <footer class="card-footer">
          <strong>Why this helps:</strong>
          <ul>${rationaleItems}</ul>
        </footer>
      </article>`;
    })
    .join('\n');

  return `
  <section>
    <div class="banner">
      <div>
        <h2 style="margin:0;">Step 3: Proposed Optimizations (${escapeHtml(auditReport.shop_name)})</h2>
        <p class="muted" style="margin:0.25rem 0 0;">Review each proposed update below and click <strong>Approve &amp; Stage Draft</strong> to save.</p>
      </div>
      <div>
        <a href="/?step=2" class="btn-secondary">&larr; Back to Audit Summary</a>
      </div>
    </div>
    ${cardsHtml}
  </section>`;
}

export function renderDashboardHtml({
  auditReport,
  patches,
  stagedPatches = {},
  strategy = 'pragmatic-balance',
  step = 3,
  session = { connected: true },
  filterListingId = null
}) {
  const activeStep = !session.connected ? 1 : Number(step || 2);
  const bodyHtml =
    activeStep === 1
      ? renderStepConnect(session)
      : activeStep === 2
        ? renderStepAudit({ auditReport })
        : renderStepOptimize({ auditReport, patches, stagedPatches, strategy, filterListingId });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>etsyshop-auditer: ${escapeHtml(auditReport.shop_name)}</title>
  <style>
    :root { color-scheme: light dark; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --muted: #94a3b8; --accent: #f1641e; --ok: #10b981; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 1.25rem; background: var(--bg); color: var(--text); line-height: 1.5; }
    .container { max-width: 1040px; margin: 0 auto; }
    .topbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem 1.25rem; background: var(--card); border-radius: 12px; }
    .steps { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
    .step-link { text-decoration: none; color: var(--muted); padding: 0.35rem 0.75rem; border-radius: 99px; font-size: 0.85rem; font-weight: 600; background: rgba(255,255,255,0.06); }
    .step-active { background: var(--accent); color: #fff; }
    .wizard-card { max-width: 520px; margin: 2rem auto; background: var(--card); padding: 2rem; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); }
    .stack-form { display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; }
    .stack-form label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 600; }
    .stack-form input { padding: 0.65rem 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.25); color: inherit; font-size: 0.95rem; }
    .divider { text-align: center; margin: 1.25rem 0; font-size: 0.75rem; color: var(--muted); letter-spacing: 0.05em; }
    .banner { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.25rem; padding: 1.1rem 1.25rem; background: var(--card); border-radius: 12px; }
    .card { background: var(--card); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.08); }
    .card-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
    .diff-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
    .diff-col { padding: 1rem; border-radius: 8px; background: rgba(0,0,0,0.2); }
    .diff-after { border: 1px solid rgba(16,185,129,0.35); }
    .pill { display: inline-block; padding: 0.2rem 0.65rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; }
    .pill-ok { background: rgba(16,185,129,0.2); color: #34d399; }
    .pill-warn { background: rgba(245,158,11,0.2); color: #fbbf24; }
    .pill-bad { background: rgba(239,68,68,0.2); color: #f87171; }
    .badge-staged { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem; background: var(--ok); color: #052e16; font-weight: 700; margin-left: 0.5rem; }
    .tag { display: inline-block; padding: 0.2rem 0.55rem; margin: 0.15rem; border-radius: 6px; font-size: 0.8rem; }
    .tag-before { background: rgba(255,255,255,0.08); }
    .tag-after { background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4); }
    .desc-box { white-space: pre-wrap; font-size: 0.82rem; background: rgba(0,0,0,0.25); padding: 0.65rem; border-radius: 6px; }
    .btn-primary, .btn-approve { display: inline-block; text-decoration: none; text-align: center; background: var(--accent); color: #fff; border: none; padding: 0.6rem 1.1rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
    .btn-secondary { display: inline-block; width: 100%; box-sizing: border-box; text-decoration: none; text-align: center; background: rgba(255,255,255,0.1); color: var(--text); border: 1px solid rgba(255,255,255,0.2); padding: 0.6rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
    .muted { color: var(--muted); }
    .issue-list { margin: 0.5rem 0 0; padding-left: 1.2rem; color: #cbd5e1; }
  </style>
</head>
<body>
  <main class="container">
    <header class="topbar">
      <div>
        <strong style="font-size:1.15rem;">🛍️ etsyshop-auditer</strong>
        ${session.connected ? `<span class="muted"> &bull; Connected: ${escapeHtml(auditReport.shop_name)}</span>` : ''}
      </div>
      <nav class="steps">
        <a href="/?step=1" class="step-link ${activeStep === 1 ? 'step-active' : ''}">1. Connect Shop</a>
        <a href="/?step=2" class="step-link ${activeStep === 2 ? 'step-active' : ''}">2. Audit Shop</a>
        <a href="/?step=3" class="step-link ${activeStep === 3 ? 'step-active' : ''}">3. Optimizations</a>
        ${session.connected ? '<form method="POST" action="/oauth/disconnect" style="display:inline;"><button type="submit" class="step-link" style="border:none;cursor:pointer;">Disconnect</button></form>' : ''}
      </nav>
    </header>
    ${bodyHtml}
  </main>
</body>
</html>`;
}

async function parseFormBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody.trim().startsWith('{')
    ? JSON.parse(rawBody)
    : Object.fromEntries(new URLSearchParams(rawBody));
}

export function createDashboardServer({ client = new EtsyClient(), defaultStrategy = 'pragmatic-balance' } = {}) {
  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://localhost:4321');
    const strategy = reqUrl.searchParams.get('strategy') || defaultStrategy;
    const { data } = client.loadShopData();

    if (req.method === 'POST' && reqUrl.pathname === '/oauth/demo') {
      client.saveSession({ connected: true, mode: 'demo', shopId: data.shop.shop_id, shopName: data.shop.shop_name });
      res.writeHead(303, { Location: '/?step=2' });
      res.end();
      return;
    }

    if (req.method === 'POST' && reqUrl.pathname === '/oauth/disconnect') {
      client.clearSession();
      res.writeHead(303, { Location: '/?step=1' });
      res.end();
      return;
    }

    if (req.method === 'POST' && reqUrl.pathname === '/oauth/connect') {
      const body = await parseFormBody(req);
      const clientId = String(body.client_id || client.clientId || '').trim();
      const shopId = Number(body.shop_id || 48291044);
      const pkce = generatePkcePair();
      client.saveSession({ connected: false, mode: 'live', clientId, shopId, pkce });
      const authUrl = buildAuthorizationUrl({
        clientId,
        state: pkce.state,
        codeChallenge: pkce.codeChallenge
      });
      res.writeHead(303, { Location: authUrl });
      res.end();
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/oauth/callback') {
      const code = reqUrl.searchParams.get('code');
      const session = client.getSession();
      if (code && session.pkce?.codeVerifier) {
        await client.exchangeOAuthCode({
          code,
          codeVerifier: session.pkce.codeVerifier,
          clientId: session.clientId
        });
        await client.syncLiveShop(session.shopId || 48291044);
      }
      res.writeHead(303, { Location: '/?step=2' });
      res.end();
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/audit') {
      const auditReport = auditShopCatalog(data);
      const patches = generateCatalogPatches(data, { strategy });
      const stagedPatches = client.getStagedPatches();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ auditReport, patches, stagedPatches }, null, 2));
      return;
    }

    if (req.method === 'GET' && reqUrl.pathname === '/api/oauth/authorize') {
      const pkce = generatePkcePair();
      const clientId = client.clientId || 'DEMO_ETSY_KEYSTRING';
      const authUrl = buildAuthorizationUrl({
        clientId,
        state: pkce.state,
        codeChallenge: pkce.codeChallenge
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ authUrl, state: pkce.state, codeChallenge: pkce.codeChallenge }, null, 2));
      return;
    }

    if (req.method === 'POST' && reqUrl.pathname === '/api/stage') {
      const params = await parseFormBody(req);
      const listingId = Number(params.listing_id);
      const listing = data.listings.find((l) => l.listing_id === listingId);
      if (!listing) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Listing not found' }));
        return;
      }
      const patch = generateListingPatch(listing, data.shop, {
        strategy: params.strategy || defaultStrategy
      });
      const staged = client.stageListingPatch(patch);
      if ((req.headers.accept || '').includes('application/json')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, staged, patch }));
      } else {
        res.writeHead(303, { Location: `/?step=3&strategy=${encodeURIComponent(patch.strategy)}` });
        res.end();
      }
      return;
    }

    const session = client.getSession();
    const stepParam = reqUrl.searchParams.get('step');
    const step = stepParam ? Number(stepParam) : session.connected ? 2 : 1;
    const filterListingId = reqUrl.searchParams.get('listing') || null;
    const auditReport = auditShopCatalog(data);
    const patches = generateCatalogPatches(data, { strategy });
    const stagedPatches = client.getStagedPatches();
    const html = renderDashboardHtml({
      auditReport,
      patches,
      stagedPatches,
      strategy,
      step,
      session,
      filterListingId
    });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
}
