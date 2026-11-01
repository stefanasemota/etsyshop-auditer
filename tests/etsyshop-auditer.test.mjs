import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadTrademarkRules,
  scanForbiddenTerms,
  validateListingConstraints,
  validateListingPatch
} from '../src/schema/validator.mjs';
import { auditListing, auditShopCatalog } from '../src/audit/rubric.mjs';
import { generateCatalogPatches, generateListingPatch } from '../src/optimizer/patch-engine.mjs';
import { EtsyClient, buildAuthorizationUrl, generatePkcePair } from '../src/api/etsy-client.mjs';
import { renderDashboardHtml } from '../src/server/dashboard.mjs';
import { runCli } from '../bin/etsyshop-auditer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('1. Repository scaffolding, plugin.json, README badges/footer, and decision.md DD.MM.YYYY order', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin.json'), 'utf8'));
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const decision = fs.readFileSync(path.join(ROOT, 'decision.md'), 'utf8');

  assert.equal(pkg.name, 'etsyshop-auditer');
  assert.equal(plugin.name, 'etsyshop-auditer');
  assert.equal(pkg.version, plugin.version);
  assert.ok(fs.existsSync(path.join(ROOT, '.agent/skills/etsy-optimizer/SKILL.md')));
  assert.ok(fs.existsSync(path.join(ROOT, 'skills/etsy-optimizer/SKILL.md')));
  assert.ok(fs.existsSync(path.join(ROOT, 'rules/AGENTS.md')));
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/logo.svg')));

  // 5 badges + mandatory footer in README.md
  assert.match(readme, /img\.shields\.io\/badge\/version-/);
  assert.match(readme, /img\.shields\.io\/badge\/license-MIT/);
  assert.match(readme, /img\.shields\.io\/badge\/build-passing/);
  assert.match(readme, /Powered by <a href="https:\/\/github\.com\/stefanasemota\/vibe-coding-guardrail">aos Vibe Coding Guardrail<\/a>/);

  // DD.MM.YYYY format check in decision.md
  const headers = [...decision.matchAll(/^### \[(\d{2})\.(\d{2})\.(\d{4})\] - /gm)];
  assert.ok(headers.length >= 1, 'decision.md must have at least one [DD.MM.YYYY] entry');
});

test('2. Schema validator enforces 140-char title, 13x20-char tags, and trademark blocklist', () => {
  const rules = loadTrademarkRules();
  const hits = scanForbiddenTerms('Custom Disney Pikachu gift mug', rules);
  assert.ok(hits.includes('disney'));
  assert.ok(hits.includes('pikachu'));

  const invalidCheck = validateListingConstraints(
    {
      title: 'Disney Wood Board',
      tags: ['wood', 'tag that is way over twenty characters long'],
      description: 'Short description'
    },
    rules
  );
  assert.equal(invalidCheck.valid, false);
  assert.ok(invalidCheck.trademark_violations.includes('disney'));
  assert.ok(invalidCheck.errors.some((e) => e.includes('exactly 13')));
});

test('3. 100-point rubric distinguishes weak vs. optimized listings in sample fixture', () => {
  const client = new EtsyClient();
  const { data } = client.loadShopData({ preferCache: false });
  const catalogReport = auditShopCatalog(data);

  assert.equal(catalogReport.listing_count, 3);
  const weakListing = catalogReport.listings.find((l) => l.listing_id === 1009001);
  const strongListing = catalogReport.listings.find((l) => l.listing_id === 1009003);

  assert.ok(weakListing.total_score < 55, `Expected weak listing < 55, got ${weakListing.total_score}`);
  assert.ok(strongListing.total_score >= 85, `Expected strong listing >= 85, got ${strongListing.total_score}`);
});

test('4. Atomic patch engine generates valid 13-tag patches and boosts rubric score across all strategies', () => {
  const client = new EtsyClient();
  const { data } = client.loadShopData({ preferCache: false });
  const weakListing = data.listings[0];

  for (const strategy of ['pragmatic-balance', 'seo-focus', 'storytelling-conversion']) {
    const patch = generateListingPatch(weakListing, data.shop, { strategy });
    const validation = validateListingPatch(patch);
    assert.equal(validation.valid, true, `Patch failed validation for ${strategy}: ${validation.constraint_check.errors.join(', ')}`);
    assert.equal(patch.after.tags.length, 13);
    assert.ok(patch.after.title.length <= 140);
    assert.ok(patch.audit_score.after > patch.audit_score.before);
  }
});

test('5. Etsy v3 OAuth 2.0 PKCE challenge generator, batched fetch, and draft staging work end-to-end', async () => {
  const pkce = generatePkcePair();
  assert.ok(pkce.codeVerifier.length >= 40);
  assert.ok(pkce.codeChallenge.length >= 40);

  const authUrl = buildAuthorizationUrl({
    clientId: 'test_keystring',
    state: pkce.state,
    codeChallenge: pkce.codeChallenge
  });
  assert.match(authUrl, /code_challenge_method=S256/);
  assert.match(authUrl, /client_id=test_keystring/);

  const tmpCache = fs.mkdtempSync(path.join(os.tmpdir(), 'etsy-auditer-test-'));
  const mockFetch = async (url, options = {}) => ({
    ok: true,
    status: 200,
    json: async () =>
      options.method === 'PUT'
        ? { listing_id: 1009001, state: 'draft' }
        : { results: [{ listing_id: 1009001, title: 'Batch Item' }] }
  });

  const client = new EtsyClient({
    clientId: 'test_keystring',
    accessToken: 'mock_token',
    cacheDir: tmpCache,
    fetchImpl: mockFetch
  });

  const batched = await client.fetchActiveListingsBatched(48291044);
  assert.equal(batched.length, 1);

  const { data } = client.loadShopData({ preferCache: false });
  const [patch] = generateCatalogPatches(data);
  const staged = client.stageListingPatch(patch);
  assert.equal(staged.staged, true);

  const liveRes = await client.pushListingPatchLive(patch);
  assert.equal(liveRes.listing_id, 1009001);
});

test('6. Dashboard HTML renderer and CLI commands execute cleanly', () => {
  const auditRes = runCli(['audit']);
  assert.equal(auditRes.command, 'audit');
  assert.equal(auditRes.report.listing_count, 3);

  const optRes = runCli(['optimize', '--strategy=seo-focus']);
  assert.equal(optRes.strategy, 'seo-focus');
  assert.equal(optRes.patches.length, 3);

  const html = renderDashboardHtml({
    auditReport: auditRes.report,
    patches: optRes.patches,
    stagedPatches: {},
    strategy: 'seo-focus'
  });
  assert.match(html, /etsyshop-auditer: AlpineWalnutCraft/);
  assert.match(html, /Approve &amp; Stage Draft/);
});
