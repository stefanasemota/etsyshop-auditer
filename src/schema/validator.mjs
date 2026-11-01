import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TRADEMARKS_PATH = path.resolve(__dirname, '../../config/trademarks.json');

export function loadTrademarkRules(customPath = DEFAULT_TRADEMARKS_PATH) {
  const raw = JSON.parse(fs.readFileSync(customPath, 'utf8'));
  return {
    trademarks: (raw.trademarks || []).map((t) => t.toLowerCase()),
    prohibitedPolicyTerms: (raw.prohibited_policy_terms || []).map((t) => t.toLowerCase())
  };
}

export function scanForbiddenTerms(text, rules = loadTrademarkRules()) {
  const lower = String(text || '').toLowerCase();
  const hits = [];
  for (const term of [...rules.trademarks, ...rules.prohibitedPolicyTerms]) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) {
      hits.push(term);
    }
  }
  return hits;
}

export function validateListingConstraints(listing, rules = loadTrademarkRules()) {
  const errors = [];
  const title = String(listing?.title || '').trim();
  const description = String(listing?.description || '').trim();
  const tags = Array.isArray(listing?.tags) ? listing.tags.map((t) => String(t).trim()) : [];

  if (!title || title.length > 140) {
    errors.push(`Title length (${title.length}) must be between 1 and 140 characters.`);
  }
  if (tags.length !== 13) {
    errors.push(`Tag count (${tags.length}) must be exactly 13.`);
  }
  const tagLengths = tags.map((t) => t.length);
  const maxTagLength = tagLengths.length ? Math.max(...tagLengths) : 0;
  for (const tag of tags) {
    if (!tag || tag.length > 20) {
      errors.push(`Tag "${tag}" exceeds 20-character limit (${tag.length}).`);
    }
    if (!/^[a-zA-Z0-9 \-'&]+$/.test(tag)) {
      errors.push(`Tag "${tag}" contains unsupported special characters.`);
    }
  }
  const uniqueTags = new Set(tags.map((t) => t.toLowerCase()));
  if (uniqueTags.size !== tags.length) {
    errors.push('Tags contain case-insensitive duplicates.');
  }
  if (description.length < 160) {
    errors.push(`Description length (${description.length}) should be at least 160 chars for meta snippet.`);
  }

  const combinedText = `${title} ${tags.join(' ')} ${description}`;
  const trademarkViolations = scanForbiddenTerms(combinedText, rules);
  if (trademarkViolations.length > 0) {
    errors.push(`Forbidden trademark/policy terms detected: ${trademarkViolations.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    title_length: title.length,
    mobile_lead_40: title.slice(0, 40),
    tag_count: tags.length,
    max_tag_length: maxTagLength,
    meta_snippet_160_length: Math.min(description.length, 160),
    trademark_violations: trademarkViolations,
    errors
  };
}

export function validateShopPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid shop payload: expected an object.');
  }
  if (!payload.shop || typeof payload.shop.shop_id !== 'number') {
    throw new Error('Invalid shop payload: missing numeric shop.shop_id.');
  }
  if (!Array.isArray(payload.listings)) {
    throw new Error('Invalid shop payload: missing listings array.');
  }
  return true;
}

export function validateListingPatch(patch, rules = loadTrademarkRules()) {
  if (!patch || patch.schema_version !== '1.0.0') {
    throw new Error('Invalid patch: schema_version must be "1.0.0".');
  }
  if (!['draft', 'active'].includes(patch.target_state)) {
    throw new Error('Invalid patch: target_state must be "draft" or "active".');
  }
  const check = validateListingConstraints(patch.after, rules);
  return {
    valid: check.valid,
    constraint_check: check
  };
}
