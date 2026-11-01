export function parseCsvRows(csvText) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(current);
      current = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      if (ch === '\r') i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  }
  return rows;
}

export function importEtsyCsvToShopPayload(csvText, shopName = 'My Etsy Shop') {
  const rows = parseCsvRows(String(csvText || '').trim());
  if (rows.length < 2) {
    throw new Error('CSV must contain a header row and at least one listing row.');
  }
  const headers = rows[0].map((h) => h.trim().toUpperCase());
  const idx = (name) => headers.indexOf(name);

  const titleIdx = idx('TITLE');
  const descIdx = idx('DESCRIPTION');
  const tagsIdx = idx('TAGS');
  const materialsIdx = idx('MATERIALS');

  if (titleIdx === -1) {
    throw new Error('Invalid Etsy CSV: missing TITLE column.');
  }

  const listings = rows.slice(1).map((cols, index) => {
    const title = (cols[titleIdx] || '').trim();
    const description = descIdx !== -1 ? (cols[descIdx] || '').trim() : '';
    const rawTags = tagsIdx !== -1 ? (cols[tagsIdx] || '').trim() : '';
    const rawMaterials = materialsIdx !== -1 ? (cols[materialsIdx] || '').trim() : '';
    const tags = rawTags
      ? rawTags.split(',').map((t) => t.trim().replace(/_/g, ' ')).filter(Boolean)
      : [];
    const materials = rawMaterials
      ? rawMaterials.split(',').map((m) => m.trim().replace(/_/g, ' ')).filter(Boolean)
      : [];

    let imageCount = 0;
    for (let img = 1; img <= 10; img += 1) {
      const colIdx = idx(`IMAGE${img}`);
      if (colIdx !== -1 && (cols[colIdx] || '').trim().length > 0) imageCount += 1;
    }

    return {
      listing_id: 200001 + index,
      shop_id: 990001,
      state: 'active',
      title,
      description,
      tags,
      materials,
      image_count: imageCount || 5,
      has_video: false,
      attributes: { primary_color: 'Primary' }
    };
  }).filter((l) => l.title.length > 0);

  return {
    shop: {
      shop_id: 990001,
      shop_name: shopName || 'My Etsy Shop',
      title: `${shopName || 'My Etsy Shop'} Collection`,
      announcement: 'Imported from Etsy Shop Manager CSV',
      about: { story: 'Imported shop catalog', has_photos: true, has_video: true },
      policies: { has_shipping_policy: true, has_return_policy: true, has_faq: true }
    },
    listings
  };
}
