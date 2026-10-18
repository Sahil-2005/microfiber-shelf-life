// adapters/myntra.js — Myntra.com product-page adapter
// Knows how to find product info, material specs, and price anchors on Myntra.

window.MicrofiberAdapters.register({
  name: 'myntra',
  hostPatterns: [/myntra\.com/],

  // ─── Page type detection ───────────────────────────────────

  isProductPage() {
    // Myntra product pages end with a numeric ID: /brand/product-name/12345678/buy
    return /\/\d{5,}/.test(window.location.pathname);
  },

  isListingPage() {
    return window.location.pathname.includes('/shop/')
      || window.location.search.includes('query=')
      || window.location.pathname.match(/^\/[a-z-]+$/i) !== null;
  },

  // ─── Product page extraction ───────────────────────────────

  getProductId() {
    const match = window.location.pathname.match(/\/(\d{5,})/);
    return match ? `myntra-${match[1]}` : null;
  },

  getProductTitle() {
    // Myntra shows brand + product name
    const brand = document.querySelector('.pdp-title, [class*="Title"], .pdp-name .pdp-title');
    const name  = document.querySelector('.pdp-name, [class*="Name"], .pdp-name h1');
    const parts = [brand, name].filter(Boolean).map(el => el.textContent.trim());
    return parts.join(' ') || '';
  },

  getMaterialText() {
    const sources = [];

    // 1. Size & fit / material specification lists
    const specItems = document.querySelectorAll(
      '.pdp-sizeFitDescContent li, ' +
      '.pdp-product-description-content li, ' +
      '[class*="specificationList"] li, ' +
      '[class*="specification"] li'
    );
    for (const item of specItems) {
      const text = item.textContent.trim();
      if (/material|fabric|composition|cotton|polyester|nylon|acrylic|gsm|weave/i.test(text)) {
        sources.push(text);
      }
    }

    // 2. Product description block
    const descEl = document.querySelector(
      '.pdp-product-description-content, ' +
      '.pdp-sizeFitDescContent, ' +
      '[class*="description"]'
    );
    if (descEl && sources.length === 0) {
      sources.push(descEl.textContent.trim().slice(0, 1000));
    }

    return sources.join(' | ');
  },

  getProductDescription() {
    const el = document.querySelector(
      '.pdp-product-description-content, .pdp-sizeFitDescContent'
    );
    return el ? el.textContent.trim().slice(0, 2000) : '';
  },

  getBadgeAnchorElement() {
    return document.querySelector(
      '.pdp-price, ' +
      '[class*="price"], ' +
      '.pdp-discount-container, ' +
      '[class*="Price"]'
    );
  },

  // ─── Listing page (search results) ────────────────────────

  getProductCards() {
    const cards = document.querySelectorAll(
      '.product-base, [class*="product-productMetaInfo"], [class*="productCard"]'
    );
    return Array.from(cards).map((card, index) => {
      const link = card.closest('a') || card.querySelector('a');
      const idMatch = link?.href?.match(/\/(\d{5,})/);
      return {
        element:      card,
        id:           idMatch ? `myntra-${idMatch[1]}` : `myntra-idx-${index}`,
        titleText:    (card.querySelector('.product-brand, .product-product, [class*="brand"]') || {}).textContent || '',
        priceElement: card.querySelector('.product-discountedPrice, [class*="price"]')
      };
    });
  }
});
