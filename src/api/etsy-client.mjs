import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateListingPatch, validateShopPayload } from '../schema/validator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = path.resolve(__dirname, '../../fixtures/sample-shop.json');
const DEFAULT_CACHE_DIR = path.resolve(__dirname, '../../.cache');
const ETSY_API_BASE = 'https://openapi.etsy.com/v3/application';
const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';

export function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');
  return { codeVerifier, codeChallenge, state };
}

export function buildAuthorizationUrl({
  clientId,
  redirectUri = 'http://localhost:4321/oauth/callback',
  scopes = ['listings_r', 'shops_r', 'listings_w', 'shops_w'],
  state,
  codeChallenge
}) {
  if (!clientId) throw new Error('ETSY_API_KEYSTRING (clientId) is required.');
  if (!codeChallenge || !state) throw new Error('PKCE codeChallenge and state are required.');
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    client_id: clientId,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  return `https://www.etsy.com/oauth/connect?${params.toString()}`;
}

export class EtsyClient {
  constructor({
    clientId = process.env.ETSY_API_KEYSTRING || '',
    accessToken = process.env.ETSY_ACCESS_TOKEN || '',
    cacheDir = DEFAULT_CACHE_DIR,
    fixturePath = DEFAULT_FIXTURE_PATH,
    fetchImpl = globalThis.fetch
  } = {}) {
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.cacheDir = cacheDir;
    this.fixturePath = fixturePath;
    this.fetchImpl = fetchImpl;
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  getSession() {
    const sessionFile = path.join(this.cacheDir, 'oauth-session.json');
    if (!fs.existsSync(sessionFile)) {
      return { connected: false, mode: null, clientId: this.clientId || '' };
    }
    return JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  }

  saveSession(sessionUpdate) {
    this.ensureCacheDir();
    const sessionFile = path.join(this.cacheDir, 'oauth-session.json');
    const merged = { ...this.getSession(), ...sessionUpdate, updatedAt: new Date().toISOString() };
    fs.writeFileSync(sessionFile, JSON.stringify(merged, null, 2), 'utf8');
    if (merged.clientId) this.clientId = merged.clientId;
    if (merged.accessToken) this.accessToken = merged.accessToken;
    return merged;
  }

  clearSession() {
    const sessionFile = path.join(this.cacheDir, 'oauth-session.json');
    if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
  }

  async exchangeOAuthCode({ code, codeVerifier, clientId = this.clientId, redirectUri = 'http://localhost:4321/oauth/callback' }) {
    const res = await this.fetchImpl(ETSY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier
      }).toString()
    });
    if (!res.ok) {
      throw new Error(`Etsy OAuth token exchange failed (${res.status})`);
    }
    const tokenData = await res.json();
    const userId = String(tokenData.access_token || '').split('.')[0];
    this.saveSession({
      connected: true,
      mode: 'live',
      clientId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      userId
    });
    return tokenData;
  }

  async syncLiveShop(shopId) {
    const listings = await this.fetchActiveListingsBatched(shopId);
    const normalized = {
      shop: {
        shop_id: Number(shopId),
        shop_name: `EtsyShop-${shopId}`,
        title: 'Connected Etsy Shop',
        announcement: 'Synced via Etsy REST API v3',
        about: { story: 'Connected live shop', has_photos: true, has_video: true },
        policies: { has_shipping_policy: true, has_return_policy: true, has_faq: true }
      },
      listings: listings.map((l) => ({
        listing_id: l.listing_id,
        shop_id: Number(shopId),
        state: l.state || 'active',
        title: l.title || '',
        description: l.description || '',
        tags: Array.isArray(l.tags) ? l.tags : [],
        materials: Array.isArray(l.materials) ? l.materials : [],
        image_count: Array.isArray(l.images) ? l.images.length : Number(l.image_count || 5),
        has_video: Boolean(l.has_video),
        attributes: l.attributes || { primary_color: 'Primary' }
      }))
    };
    this.saveShopCache(normalized);
    this.saveSession({ connected: true, mode: 'live', shopId: Number(shopId), shopName: normalized.shop.shop_name });
    return normalized;
  }

  loadShopData({ shopId, preferCache = true } = {}) {
    this.ensureCacheDir();
    const session = this.getSession();
    const resolvedShopId = shopId || session.shopId || 48291044;
    const cacheFile = path.join(this.cacheDir, `shop-${resolvedShopId}.json`);
    if (preferCache && fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      validateShopPayload(cached);
      return { source: 'cache', data: cached };
    }
    const fixture = JSON.parse(fs.readFileSync(this.fixturePath, 'utf8'));
    validateShopPayload(fixture);
    return { source: 'fixture', data: fixture };
  }

  saveShopCache(shopPayload) {
    validateShopPayload(shopPayload);
    this.ensureCacheDir();
    const shopId = shopPayload.shop.shop_id;
    const cacheFile = path.join(this.cacheDir, `shop-${shopId}.json`);
    fs.writeFileSync(cacheFile, JSON.stringify(shopPayload, null, 2), 'utf8');
    return cacheFile;
  }

  async fetchActiveListingsBatched(shopId, { batchLimit = 100, maxPages = 10 } = {}) {
    if (!this.clientId || !this.accessToken) {
      throw new Error('Live Etsy API requires clientId and accessToken.');
    }
    const allListings = [];
    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * batchLimit;
      const url = `${ETSY_API_BASE}/shops/${shopId}/listings/active?limit=${batchLimit}&offset=${offset}`;
      const res = await this.fetchImpl(url, {
        headers: {
          'x-api-key': this.clientId,
          Authorization: `Bearer ${this.accessToken}`
        }
      });
      if (!res.ok) {
        throw new Error(`Etsy API GET failed (${res.status})`);
      }
      const body = await res.json();
      const results = Array.isArray(body.results) ? body.results : [];
      allListings.push(...results);
      if (results.length < batchLimit) break;
    }
    return allListings;
  }

  stageListingPatch(patch) {
    const check = validateListingPatch(patch);
    if (!check.valid) {
      throw new Error(`Cannot stage invalid patch: ${check.constraint_check.errors.join('; ')}`);
    }
    this.ensureCacheDir();
    const stagedFile = path.join(this.cacheDir, 'staged-patches.json');
    const existing = fs.existsSync(stagedFile)
      ? JSON.parse(fs.readFileSync(stagedFile, 'utf8'))
      : {};
    existing[String(patch.listing_id)] = {
      ...patch,
      staged_at: new Date().toISOString()
    };
    fs.writeFileSync(stagedFile, JSON.stringify(existing, null, 2), 'utf8');
    return { staged: true, listing_id: patch.listing_id, file: stagedFile };
  }

  getStagedPatches() {
    const stagedFile = path.join(this.cacheDir, 'staged-patches.json');
    if (!fs.existsSync(stagedFile)) return {};
    return JSON.parse(fs.readFileSync(stagedFile, 'utf8'));
  }

  async pushListingPatchLive(patch) {
    const check = validateListingPatch(patch);
    if (!check.valid) {
      throw new Error(`Refusing live push for invalid patch: ${check.constraint_check.errors.join('; ')}`);
    }
    if (!this.clientId || !this.accessToken) {
      throw new Error('Live push requires ETSY_API_KEYSTRING and ETSY_ACCESS_TOKEN.');
    }
    const url = `${ETSY_API_BASE}/shops/${patch.shop_id}/listings/${patch.listing_id}`;
    const payload = {
      title: patch.after.title,
      description: patch.after.description,
      tags: patch.after.tags,
      state: patch.target_state
    };
    const res = await this.fetchImpl(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.clientId,
        Authorization: `Bearer ${this.accessToken}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`Etsy API PUT failed (${res.status})`);
    }
    return res.json();
  }
}
