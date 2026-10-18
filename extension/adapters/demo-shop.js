// adapters/demo-shop.js — Adapter for the local demo shop (/demo-shop)
// Uses clean data-* attributes that we control, so extraction is trivial.

window.MicrofiberAdapters.register({
  name: 'demo-shop',
  hostPatterns: [/localhost/, /127\.0\.0\.1/],

  // ─── Page type detection ───────────────────────────────────

  isProductPage() {
    return document.querySelector('[data-mf-product]') !== null;
  },

  isListingPage() {
    return document.querySelectorAll('[data-mf-product-card]').length > 0;
  },

  // ─── Product page extraction ───────────────────────────────

  getProductId() {
    const el = document.querySelector('[data-mf-product]');
    return el ? el.dataset.mfProduct : null;
  },

  getProductTitle() {
    const el = document.querySelector('[data-mf-title]');
    return el ? el.textContent.trim() : '';
  },

  getMaterialText() {
    const el = document.querySelector('[data-mf-material]');
    return el ? el.textContent.trim() : '';
  },

  getProductDescription() {
    const el = document.querySelector('[data-mf-description]');
    return el ? el.textContent.trim() : '';
  },

  getBadgeAnchorElement() {
    return document.querySelector('[data-mf-price]');
  },

  // ─── Listing page (product grid) ──────────────────────────

  getProductCards() {
    return Array.from(document.querySelectorAll('[data-mf-product-card]')).map(card => ({
      element:      card,
      id:           card.dataset.mfProductCard,
      titleText:    (card.querySelector('[data-mf-card-title]') || {}).textContent || '',
      materialText: (card.querySelector('[data-mf-card-material]') || {}).textContent || '',
      priceElement: card.querySelector('[data-mf-card-price]')
    }));
  }
});
