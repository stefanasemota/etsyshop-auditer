import { loadTrademarkRules, validateListingConstraints } from '../schema/validator.mjs';

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'gift', 'nice']);

function getRootWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

export function scoreShopSection(shop = {}) {
  let score = 0;
  const findings = [];
  const title = String(shop.title || '').trim();
  if (title.length > 0 && title.length <= 55) {
    score += 5;
  } else {
    findings.push('Shop title should be between 1 and 55 characters.');
  }

  const about = shop.about || {};
  if (about.story && about.has_photos && about.has_video) {
    score += 5;
  } else {
    findings.push('Shop About section is missing story text, photos, or video booster.');
  }

  const policies = shop.policies || {};
  if (policies.has_shipping_policy && policies.has_return_policy && policies.has_faq) {
    score += 5;
  } else {
    findings.push('Shop policies (shipping, returns, or FAQ) are incomplete.');
  }

  return { score, max: 15, findings };
}

export function auditListing(listing, shop = {}, rules = loadTrademarkRules()) {
  const findings = [];
  const constraints = validateListingConstraints(listing, rules);
  const title = String(listing?.title || '').trim();
  const description = String(listing?.description || '').trim();
  const tags = Array.isArray(listing?.tags) ? listing.tags.map((t) => String(t).trim()) : [];
  const materials = Array.isArray(listing?.materials)
    ? new Set(listing.materials.map((m) => String(m).trim().toLowerCase()))
    : new Set();

  // 1. Title SEO & Mobile Lead (25 pts)
  let titleScore = 0;
  if (title.length >= 70 && title.length <= 140) {
    titleScore += 10;
  } else if (title.length >= 40 && title.length < 70) {
    titleScore += 5;
    findings.push(`Title is under-utilized (${title.length}/140 chars); expand with long-tail phrases.`);
  } else {
    findings.push(`Title length (${title.length}/140 chars) is suboptimal for search matching.`);
  }

  const mobileWords = getRootWords(title.slice(0, 40));
  if (mobileWords.length >= 3) {
    titleScore += 10;
  } else {
    findings.push('First 40 chars (mobile cutoff) lack strong multi-word descriptive keywords.');
  }

  const allTitleWords = getRootWords(title);
  const freq = {};
  for (const w of allTitleWords) freq[w] = (freq[w] || 0) + 1;
  const repeated = Object.entries(freq).filter(([, count]) => count > 2);
  if (repeated.length === 0 && /[,|\-]/.test(title)) {
    titleScore += 5;
  } else {
    findings.push('Title lacks clean phrase delimiters (, or |) or repeats root words excessively.');
  }

  // 2. 13-Tag Matrix (25 pts)
  let tagScore = Math.round((Math.min(tags.length, 13) / 13) * 10);
  if (tags.length < 13) {
    findings.push(`Using only ${tags.length}/13 tags (${13 - tags.length} search slots unused).`);
  }
  const multiWordCount = tags.filter((t) => t.trim().includes(' ')).length;
  const multiWordRatio = tags.length ? multiWordCount / tags.length : 0;
  if (multiWordRatio >= 0.7) {
    tagScore += 8;
  } else if (multiWordRatio >= 0.4) {
    tagScore += 4;
    findings.push('Replace single-word tags with multi-word long-tail phrases (<= 20 chars).');
  } else {
    findings.push('Most tags are single words; convert to 2-3 word buyer search phrases.');
  }

  const duplicateMaterialTags = tags.filter((t) => materials.has(t.toLowerCase()));
  const uniqueTags = new Set(tags.map((t) => t.toLowerCase()));
  if (duplicateMaterialTags.length === 0 && uniqueTags.size === tags.length && tags.length === 13) {
    tagScore += 7;
  } else if (duplicateMaterialTags.length > 0) {
    findings.push(`Tags duplicate exact material terms: ${duplicateMaterialTags.join(', ')}.`);
  }

  // 3. Description & Meta Lead (20 pts)
  let descriptionScore = 0;
  const metaLead = description.slice(0, 160);
  const leadWords = getRootWords(metaLead);
  const sharesTitleKeyword = mobileWords.some((w) => leadWords.includes(w));
  if (description.length >= 160 && sharesTitleKeyword) {
    descriptionScore += 10;
  } else {
    findings.push('First 160 chars (Google meta snippet) are too short or miss primary title keywords.');
  }
  if (/^[•\-*]/m.test(description)) {
    descriptionScore += 5;
  } else {
    findings.push('Description lacks skimmable bullet points for dimensions, materials, and care.');
  }
  if (description.length >= 280) {
    descriptionScore += 5;
  } else {
    findings.push('Description lacks depth (<280 chars); add sizing, care, and FAQ details.');
  }

  // 4. Media & Taxonomy Attributes (15 pts)
  let mediaScore = 0;
  const imageCount = Number(listing?.image_count || 0);
  if (imageCount >= 8) {
    mediaScore += 6;
  } else if (imageCount >= 5) {
    mediaScore += 4;
  } else {
    mediaScore += 1;
    findings.push(`Low image count (${imageCount}/10); Etsy favors listings with 5-10 photos.`);
  }
  if (listing?.has_video) {
    mediaScore += 5;
  } else {
    findings.push('Listing is missing a product video (high-impact conversion & ranking signal).');
  }
  const attrCount = Object.keys(listing?.attributes || {}).length;
  if (attrCount >= 3) {
    mediaScore += 4;
  } else {
    findings.push(`Only ${attrCount} taxonomy attribute(s) populated; fill color, style, and occasion.`);
  }

  // 5. Shop Trust & About Quality (15 pts)
  const shopAudit = scoreShopSection(shop);
  const rawTotal = titleScore + tagScore + descriptionScore + mediaScore + shopAudit.score;
  const penalty = constraints.trademark_violations.length * 25;
  const totalScore = Math.max(0, Math.min(100, rawTotal - penalty));

  return {
    listing_id: listing.listing_id,
    title: listing.title,
    total_score: totalScore,
    grade: totalScore >= 85 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 55 ? 'C' : 'D',
    breakdown: {
      title_seo: { score: titleScore, max: 25 },
      tags_matrix: { score: tagScore, max: 25 },
      description_meta: { score: descriptionScore, max: 20 },
      media_attributes: { score: mediaScore, max: 15 },
      shop_trust: { score: shopAudit.score, max: 15 }
    },
    constraints,
    findings: [...findings, ...shopAudit.findings]
  };
}

export function auditShopCatalog(payload, rules = loadTrademarkRules()) {
  const shop = payload?.shop || {};
  const listings = Array.isArray(payload?.listings) ? payload.listings : [];
  const shopSummary = scoreShopSection(shop);
  const listingAudits = listings.map((l) => auditListing(l, shop, rules));
  const avgScore = listingAudits.length
    ? Math.round(listingAudits.reduce((sum, item) => sum + item.total_score, 0) / listingAudits.length)
    : 0;

  return {
    shop_id: shop.shop_id,
    shop_name: shop.shop_name,
    average_score: avgScore,
    listing_count: listingAudits.length,
    shop_trust: shopSummary,
    listings: listingAudits
  };
}
