// adapters/base.js — Site-adapter registry
// Each site adapter calls MicrofiberAdapters.register(adapterObj).
// content.js calls MicrofiberAdapters.getAdapter() to pick the right one.

window.MicrofiberAdapters = {
  /** @type {Array<Object>} registered site adapters */
  _adapters: [],

  /**
   * Register a new site adapter.
   * @param {Object} adapter — must implement the adapter interface:
   *   name            : string
   *   hostPatterns    : RegExp[]          — tested against location.hostname
   *   isProductPage() : boolean
   *   isListingPage() : boolean
   *   getProductId()  : string | null
   *   getProductTitle(): string
   *   getMaterialText(): string           — raw text containing fabric info
   *   getProductDescription(): string
   *   getBadgeAnchorElement(): Element | null  — where to inject the badge
   *   getProductCards(): Array<{element, id, titleText, priceElement}>
   */
  register(adapter) {
    this._adapters.push(adapter);
  },

  /**
   * Return the first adapter whose hostPattern matches the current hostname.
   * @returns {Object|null}
   */
  getAdapter() {
    const hostname = window.location.hostname;
    for (const adapter of this._adapters) {
      if (adapter.hostPatterns.some(pattern => pattern.test(hostname))) {
        return adapter;
      }
    }
    return null;
  }
};
