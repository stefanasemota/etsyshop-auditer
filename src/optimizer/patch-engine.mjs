import { auditListing } from '../audit/rubric.mjs';
import { loadTrademarkRules, scanForbiddenTerms, validateListingConstraints } from '../schema/validator.mjs';

const FALLBACK_LONG_TAIL_TAGS = [
  'custom walnut gift',
  'handmade wood decor',
  'housewarming gift',
  'anniversary present',
  'artisan home goods',
  'heirloom woodcraft',
  'kitchen countertop',
  'rustic home accent',
  'engraved keepsake',
  'minimalist organizer',
  'wedding gift couple',
  'chef kitchen tool',
  'sustainable hardwood'
];

function sanitizeText(text, rules) {
  let cleaned = String(text || '');
  for (const term of [...rules.trademarks, ...rules.prohibitedPolicyTerms]) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), 'artisan');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function optimizeTitle(listing, strategy, rules) {
  const rawTitle = sanitizeText(listing.title || 'Handcrafted Walnut Home Accessory', rules);
  if (rawTitle.length >= 80 && rawTitle.length <= 140 && /[,|\-]/.test(rawTitle)) {
    return rawTitle;
  }
  const baseLead = rawTitle.replace(/\b(wood|gift|nice)\b/gi, '').replace(/\s+/g, ' ').trim() || 'Walnut Cutting Board';
  const primaryPhrase = baseLead.length <= 28 ? `Personalized ${baseLead}` : baseLead.slice(0, 38).trim();

  const suffixByStrategy = {
    'seo-focus': 'Engraved Hardwood Serving Tray, Custom Kitchen & Housewarming Gift Idea',
    'storytelling-conversion': 'Small-Batch Heirloom Woodcraft, Custom Engraved Keepsake for Modern Homes',
    'pragmatic-balance': 'Engraved Charcuterie & Serving Board, Custom Wedding or Housewarming Gift'
  };
  const suffix = suffixByStrategy[strategy] || suffixByStrategy['pragmatic-balance'];
  const candidate = `${primaryPhrase}, ${suffix}`;
  return candidate.length <= 140 ? candidate : candidate.slice(0, 140).replace(/[, ]+$/, '');
}

function optimizeTags(listing, rules) {
  const materials = new Set(
    (listing.materials || []).map((m) => String(m).trim().toLowerCase())
  );
  const existing = Array.isArray(listing.tags) ? listing.tags : [];
  const selected = [];
  const seen = new Set();

  const tryAdd = (rawTag) => {
    const tag = sanitizeText(rawTag, rules)
      .toLowerCase()
      .replace(/[^a-z0-9 \-'&]/g, '')
      .trim()
      .slice(0, 20)
      .trim();
    if (!tag || tag.length < 4 || !tag.includes(' ')) return;
    if (materials.has(tag) || seen.has(tag)) return;
    if (scanForbiddenTerms(tag, rules).length > 0) return;
    seen.add(tag);
    selected.push(tag);
  };

  for (const tag of existing) {
    if (tag.trim().includes(' ')) {
      tryAdd(tag);
    } else if (tag.trim().length > 0 && tag.trim().length <= 12) {
      tryAdd(`custom ${tag.trim()} gift`);
    }
  }

  for (const fallback of FALLBACK_LONG_TAIL_TAGS) {
    if (selected.length >= 13) break;
    tryAdd(fallback);
  }

  return selected.slice(0, 13);
}

function optimizeDescription(listing, optimizedTitle, strategy, rules) {
  const existing = sanitizeText(listing.description || '', rules);
  if (existing.length >= 280 && /^[•\-*]/m.test(listing.description || '')) {
    return listing.description;
  }
  const leadClause = optimizedTitle.split(',')[0].trim();
  const leadHook =
    strategy === 'storytelling-conversion'
      ? `${leadClause} handcrafted in small batches from sustainably harvested American black walnut—designed to elevate daily rituals and last for generations.`
      : `${leadClause} handcrafted from solid American black walnut—an ergonomic, food-safe kitchen centerpiece and custom engraved gift for weddings or housewarmings.`;

  const materialList = (listing.materials || ['American black walnut', 'Organic beeswax']).join(', ');
  return [
    leadHook,
    '',
    `• MATERIALS: ${materialList}`,
    '• CRAFTSMANSHIP: Hand-sanded to a satin 400-grit finish and conditioned with food-safe oil',
    '• PERSONALIZATION: Optional custom laser engraving included at no extra cost',
    '• CARE & FAQ: Wipe clean with a damp cloth; ships within 2 business days in plastic-free packaging.'
  ].join('\n');
}

export function generateListingPatch(
  listing,
  shop = {},
  { strategy = 'pragmatic-balance', targetState = 'draft', rules = loadTrademarkRules() } = {}
) {
  const beforeAudit = auditListing(listing, shop, rules);
  const afterTitle = optimizeTitle(listing, strategy, rules);
  const afterTags = optimizeTags(listing, rules);
  const afterDescription = optimizeDescription(listing, afterTitle, strategy, rules);

  const after = {
    title: afterTitle,
    tags: afterTags,
    description: afterDescription
  };

  const updatedListing = { ...listing, ...after };
  const afterAudit = auditListing(updatedListing, shop, rules);
  const constraintCheck = validateListingConstraints(after, rules);
  const delta = afterAudit.total_score - beforeAudit.total_score;

  const rationale = [];
  if (after.title !== listing.title) {
    rationale.push(`Front-loaded primary search phrase in first 40 chars ("${after.title.slice(0, 40)}").`);
  }
  if ((listing.tags || []).length !== 13 || after.tags.join('|') !== (listing.tags || []).join('|')) {
    rationale.push(`Populated all 13/13 multi-word long-tail tag slots (max ${constraintCheck.max_tag_length}/20 chars).`);
  }
  if (after.description !== listing.description) {
    rationale.push('Structured first 160 chars for Google meta snippet and added skimmable specification bullets.');
  }

  const mediaRecommendations = [];
  if ((listing.image_count || 0) < 5) {
    mediaRecommendations.push(`Upload ${5 - (listing.image_count || 0)}+ additional photos (scale, packaging, lifestyle angle).`);
  }
  if (!listing.has_video) {
    mediaRecommendations.push('Add a 5–15s natural-light product video to boost Etsy search quality score.');
  }

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    schema_version: '1.0.0',
    shop_id: listing.shop_id || shop.shop_id || 0,
    listing_id: listing.listing_id,
    strategy,
    target_state: targetState,
    audit_score: {
      before: beforeAudit.total_score,
      after: afterAudit.total_score,
      delta: `${delta >= 0 ? '+' : ''}${delta}`
    },
    constraint_check: constraintCheck,
    before: {
      title: listing.title,
      tags: listing.tags || [],
      description: listing.description
    },
    after,
    rationale,
    media_recommendations: mediaRecommendations
  };
}

export function generateCatalogPatches(payload, options = {}) {
  const shop = payload?.shop || {};
  const listings = Array.isArray(payload?.listings) ? payload.listings : [];
  return listings.map((listing) => generateListingPatch(listing, shop, options));
}
