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

export function renderDashboardHtml({ auditReport, patches, stagedPatches = {}, strategy = 'pragmatic-balance' }) {
  const cardsHtml = patches
    .map((patch) => {
      const isStaged = Boolean(stagedPatches[String(patch.listing_id)]);
      const mobileLead = escapeHtml(patch.after.title.slice(0, 40));
      const restTitle = escapeHtml(patch.after.title.slice(40));
      const beforeTags = patch.before.tags
        .map((t) => `<span class="tag tag-before">${escapeHtml(t)} (${t.length})</span>`)
        .join(' ');
      const afterTags = patch.after.tags
        .map((t) => `<span class="tag tag-after">${escapeHtml(t)} (${t.length})</span>`)
        .join(' ');
      const rationaleItems = patch.rationale.map((r) => `<li>${escapeHtml(r)}</li>`).join('');

      return `
      <article class="card" data-listing-id="${patch.listing_id}">
        <header class="card-header">
          <div>
            <span class="badge">#${patch.listing_id}</span>
            <strong>Score: ${patch.audit_score.before} &rarr; ${patch.audit_score.after} (${escapeHtml(patch.audit_score.delta)})</strong>
            ${isStaged ? '<span class="badge badge-staged">Staged in Draft</span>' : '<span class="badge">Pending Review</span>'}
          </div>
          <form method="POST" action="/api/stage" class="inline-form">
            <input type="hidden" name="listing_id" value="${patch.listing_id}" />
            <input type="hidden" name="strategy" value="${escapeHtml(strategy)}" />
            <button type="submit" class="btn-approve">Approve &amp; Stage Draft</button>
          </form>
        </header>
        <div class="diff-grid">
          <section class="diff-col diff-before">
            <h4>Before (${patch.before.title.length}/140 chars, ${patch.before.tags.length}/13 tags)</h4>
            <p class="title-box">${escapeHtml(patch.before.title)}</p>
            <div class="tags-wrap">${beforeTags}</div>
            <pre class="desc-box">${escapeHtml(patch.before.description)}</pre>
          </section>
          <section class="diff-col diff-after">
            <h4>After (${patch.after.title.length}/140 chars, ${patch.after.tags.length}/13 tags)</h4>
            <p class="title-box"><mark title="First 40 chars (mobile cutoff)">${mobileLead}</mark>${restTitle}</p>
            <div class="tags-wrap">${afterTags}</div>
            <pre class="desc-box">${escapeHtml(patch.after.description)}</pre>
          </section>
        </div>
        <footer class="card-footer">
          <ul>${rationaleItems}</ul>
        </footer>
      </article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>etsyshop-auditer — Preview Diff &amp; Rubric Dashboard</title>
  <style>
    :root { color-scheme: light dark; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #f1641e; --ok: #10b981; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 1rem; background: var(--bg); color: var(--text); line-height: 1.5; }
    .container { max-width: 1120px; margin: 0 auto; }
    .topbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: var(--card); border-radius: 12px; }
    .card { background: var(--card); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; border: 1px solid rgba(255,255,255,0.1); }
    .card-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .diff-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
    .diff-col { padding: 0.85rem; border-radius: 8px; background: rgba(0,0,0,0.2); }
    .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.8rem; background: rgba(255,255,255,0.12); margin-right: 0.4rem; }
    .badge-staged { background: var(--ok); color: #052e16; font-weight: 700; }
    .tag { display: inline-block; padding: 0.15rem 0.5rem; margin: 0.15rem; border-radius: 6px; font-size: 0.78rem; }
    .tag-before { background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4); }
    .tag-after { background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4); }
    .desc-box { white-space: pre-wrap; font-size: 0.82rem; background: rgba(0,0,0,0.25); padding: 0.6rem; border-radius: 6px; }
    .btn-approve { background: var(--accent); color: #fff; border: none; padding: 0.55rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer; min-height: 40px; }
    mark { background: rgba(241,100,30,0.35); color: inherit; padding: 0 2px; border-radius: 3px; }
  </style>
</head>
<body>
  <main class="container">
    <header class="topbar">
      <div>
        <h1 style="margin:0;font-size:1.35rem;">🛍️ etsyshop-auditer: ${escapeHtml(auditReport.shop_name)}</h1>
        <small>Catalog Average: <strong>${auditReport.average_score}/100</strong> &bull; Listings: ${auditReport.listing_count} &bull; Strategy: <code>${escapeHtml(strategy)}</code></small>
      </div>
      <nav>
        <a href="/?strategy=pragmatic-balance" class="badge">Pragmatic Balance</a>
        <a href="/?strategy=seo-focus" class="badge">Pure SEO</a>
        <a href="/?strategy=storytelling-conversion" class="badge">Storytelling</a>
      </nav>
    </header>
    ${cardsHtml}
  </main>
</body>
</html>`;
}

export function createDashboardServer({ client = new EtsyClient(), defaultStrategy = 'pragmatic-balance' } = {}) {
  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://localhost');
    const strategy = reqUrl.searchParams.get('strategy') || defaultStrategy;
    const { data } = client.loadShopData();

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
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const params = rawBody.trim().startsWith('{')
        ? JSON.parse(rawBody)
        : Object.fromEntries(new URLSearchParams(rawBody));
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
        res.writeHead(303, { Location: `/?strategy=${encodeURIComponent(patch.strategy)}` });
        res.end();
      }
      return;
    }

    const auditReport = auditShopCatalog(data);
    const patches = generateCatalogPatches(data, { strategy });
    const stagedPatches = client.getStagedPatches();
    const html = renderDashboardHtml({ auditReport, patches, stagedPatches, strategy });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
}
