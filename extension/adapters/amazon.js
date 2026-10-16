// adapters/amazon.js — Amazon.in / Amazon.com product-page adapter
// Knows how to find product info, material specs, and price anchors on Amazon.

window.MicrofiberAdapters.register({
  name: 'amazon',
  hostPatterns: [/amazon\.(in|com|co\.uk|de|fr|es|it|ca|com\.au)/],

  // ─── Page type detection ───────────────────────────────────

  isProductPage() {
    // Amazon product pages: /dp/ASIN or /gp/product/ASIN
    return /\/(dp|gp\/product)\/[A-Z0-9]{10}/i.test(window.location.pathname);
  },

  isListingPage() {
    const path = window.location.pathname;
    const search = window.location.search;
    return path.startsWith('/s') || search.includes('k=') || path.includes('/s/');
  },

  // ─── Product page extraction ───────────────────────────────

  getProductId() {
    const match = window.location.pathname.match(/\/(dp|gp\/product)\/([A-Z0-9]{10})/i);
    return match ? match[2] : null;
  },

  getProductTitle() {
    const el = document.querySelector('#productTitle');
    return el ? el.textContent.trim() : '';
  },

  getMaterialText() {
    const sources = [];

    // 1. Technical specification table
    const techRows = document.querySelectorAll(
      '#productDetails_techSpec_section_1 tr, ' +
      '#productDetails_detailBullets_sections1 tr, ' +
      '.prodDetTable tr, ' +
      '#detailBullets_feature_div li'
    );
    for (const row of techRows) {
      const header = row.querySelector('th, .prodDetSectionEntry, .a-text-bold');
      if (header && /material|fabric|composition|fibre|fiber/i.test(header.textContent)) {
        const value = row.querySelector('td, .prodDetAttrValue, span:last-child');
        if (value) sources.push(value.textContent.trim());
      }
    }

    // 2. "About this item" feature bullets
    const bullets = document.querySelectorAll('#feature-bullets li .a-list-item');
    for (const bullet of bullets) {
      const text = bullet.textContent.trim();
      if (/cotton|polyester|nylon|acrylic|silk|wool|linen|blend|fabric|gsm|weave/i.test(text)) {
        sources.push(text);
      }
    }

    // 3. Product description section
    const descEl = document.querySelector('#productDescription');
    if (descEl) {
      const text = descEl.textContent.trim();
      // Only include if it mentions fabric keywords
      if (/cotton|polyester|nylon|acrylic|fabric|material|gsm/i.test(text)) {
        sources.push(text.slice(0, 1000));
      }
    }

    // 4. A+ content
    const aplusEl = document.querySelector('#aplus_feature_div, #aplus');
    if (aplusEl) {
      const text = aplusEl.textContent;
      const fabricMatch = text.match(
        /(?:made\s+(?:of|from|with)|material[:\s]+|fabric[:\s]+|composition[:\s]+)([^.]{3,80})/i
      );
      if (fabricMatch) sources.push(fabricMatch[1].trim());
    }

    return sources.join(' | ');
  },

  getProductDescription() {
    const el = document.querySelector(
      '#productDescription, #feature-bullets, #aplus_feature_div'
    );
    return el ? el.textContent.trim().slice(0, 2000) : '';
  },

  getBadgeAnchorElement() {
    // Price display area — try several known selectors
    return document.querySelector(
      '#corePriceDisplay_desktop_feature_div, ' +
      '#corePrice_feature_div, ' +
      '#priceblock_ourprice, ' +
      '#priceblock_dealprice, ' +
      '#price_inside_buybox, ' +
      '#apex_desktop .a-price'
    );
  },

  // ─── Listing page (search results) ────────────────────────

  getProductCards() {
    const cards = document.querySelectorAll('.s-result-item[data-asin]');
    return Array.from(cards)
      .filter(c => c.dataset.asin && c.dataset.asin.length === 10)
      .map(card => ({
        element:      card,
        id:           card.dataset.asin,
        titleText:    (card.querySelector('h2 a span, h2 span, .a-text-normal') || {}).textContent || '',
        priceElement: card.querySelector('.a-price, .a-offscreen')
      }));
  }
});
