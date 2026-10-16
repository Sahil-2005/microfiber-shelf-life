// content.js — Main content script for Microfiber Score extension
// Detects product pages via the adapter pattern, extracts fabric info,
// and injects a grade badge + side panel via Shadow DOM for CSS isolation.

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════

  const BADGE_HOST_ID = 'mf-score-badge-root';
  const PANEL_HOST_ID = 'mf-score-panel-root';

  const GRADE_COLORS = {
    A: { bg: '#16a34a', ring: '#bbf7d0', label: 'Excellent' },
    B: { bg: '#65a30d', ring: '#d9f99d', label: 'Good' },
    C: { bg: '#ca8a04', ring: '#fef08a', label: 'Fair' },
    D: { bg: '#ea580c', ring: '#fed7aa', label: 'Poor' },
    E: { bg: '#dc2626', ring: '#fecaca', label: 'Very Poor' }
  };

  // ═══════════════════════════════════════════════════════════
  // SHADOW DOM CSS
  // All styles live inside the shadow root so page CSS can't
  // interfere with our badge or panel.
  // ═══════════════════════════════════════════════════════════

  const SHADOW_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    :host {
      all: initial;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1e293b;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Badge ─────────────────────────────────────────────── */

    .mf-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px 8px 8px;
      margin: 10px 0;
      border-radius: 12px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1.5px solid #e2e8f0;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      user-select: none;
      position: relative;
      z-index: 9999;
    }
    .mf-badge:hover {
      border-color: #94a3b8;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transform: translateY(-1px);
    }

    .mf-grade-circle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-weight: 800;
      font-size: 20px;
      color: #fff;
      flex-shrink: 0;
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }

    .mf-badge-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .mf-badge-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }

    .mf-badge-value {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
    }

    .mf-badge-confidence {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: #94a3b8;
      font-weight: 500;
    }

    .mf-conf-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .mf-conf-high   { background: #22c55e; }
    .mf-conf-medium { background: #eab308; }
    .mf-conf-low    { background: #f97316; }

    .mf-badge-arrow {
      font-size: 10px;
      color: #94a3b8;
      margin-left: 4px;
      transition: transform 0.2s;
    }
    .mf-badge:hover .mf-badge-arrow { transform: translateX(2px); }

    /* ── Panel overlay ─────────────────────────────────────── */

    .mf-panel-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 99998;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    .mf-panel-backdrop.open {
      opacity: 1;
      pointer-events: all;
    }

    .mf-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 380px;
      max-width: 90vw;
      height: 100vh;
      background: #fff;
      z-index: 99999;
      transform: translateX(100%);
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-y: auto;
      box-shadow: -8px 0 30px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
    }
    .mf-panel.open {
      transform: translateX(0);
    }

    .mf-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 20px 16px;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    .mf-panel-header h2 {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .mf-panel-close {
      width: 32px;
      height: 32px;
      border: none;
      background: #f1f5f9;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      transition: background 0.15s;
    }
    .mf-panel-close:hover {
      background: #e2e8f0;
      color: #1e293b;
    }

    .mf-panel-body {
      padding: 20px;
      flex: 1;
      overflow-y: auto;
    }

    /* Grade card inside panel */
    .mf-grade-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      border-radius: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      margin-bottom: 20px;
    }
    .mf-grade-circle-lg {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
      color: #fff;
      flex-shrink: 0;
      text-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .mf-grade-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .mf-grade-label {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .mf-grade-sub {
      font-size: 12px;
      color: #64748b;
    }

    /* Chart area */
    .mf-section {
      margin-bottom: 20px;
    }
    .mf-section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 10px;
    }
    .mf-chart-placeholder {
      width: 100%;
      height: 180px;
      border-radius: 12px;
      background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 500;
      border: 1px dashed #cbd5e1;
    }

    /* Sliders */
    .mf-slider-group {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .mf-slider-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .mf-slider-label {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
    .mf-slider-val {
      font-weight: 500;
      color: #0f172a;
    }
    .mf-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #e2e8f0;
      outline: none;
    }
    .mf-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #3b82f6;
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }
    .mf-select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      color: #1e293b;
      background: #fff;
      outline: none;
    }
    .mf-select:focus { border-color: #3b82f6; }

    /* Reasons */
    .mf-reasons {
      list-style: none;
      padding: 0;
    }
    .mf-reasons li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 0;
      font-size: 13px;
      color: #334155;
      border-bottom: 1px solid #f1f5f9;
    }
    .mf-reasons li:last-child { border-bottom: none; }
    .mf-reason-icon {
      flex-shrink: 0;
      margin-top: 2px;
      font-size: 14px;
    }

    /* Confidence banner */
    .mf-confidence-banner {
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 16px;
    }
    .mf-conf-banner-high   { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .mf-conf-banner-medium { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
    .mf-conf-banner-low    { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }

    /* Powered by footer */
    .mf-panel-footer {
      padding: 12px 20px;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }
  `;

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  /** Wait for a DOM element to appear (with timeout). */
  function waitForElement(selectorFn, timeout = 6000) {
    return new Promise((resolve) => {
      const el = selectorFn();
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = selectorFn();
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  /** Send a message to the background service worker and get a response. */
  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, response => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // BADGE INJECTION
  // ═══════════════════════════════════════════════════════════

  /**
   * Build the badge DOM (lives inside Shadow DOM).
   * @param {Object} scoreData — { grade, cumulative_grams, confidence, grade_label }
   */
  function buildBadgeElement(scoreData) {
    const { grade, cumulative_grams, confidence, grade_label } = scoreData;
    const colors = GRADE_COLORS[grade] || GRADE_COLORS.C;

    const badge = document.createElement('div');
    badge.className = 'mf-badge';
    badge.setAttribute('role', 'button');
    badge.setAttribute('aria-label', `Microfiber Score: Grade ${grade}, ${cumulative_grams}g over 50 washes`);
    badge.setAttribute('tabindex', '0');

    badge.innerHTML = `
      <div class="mf-grade-circle" style="background:${colors.bg}; box-shadow: 0 0 0 3px ${colors.ring};">
        ${grade}
      </div>
      <div class="mf-badge-info">
        <span class="mf-badge-label">Microfiber Score</span>
        <span class="mf-badge-value">~${cumulative_grams}g over 50 washes</span>
        <span class="mf-badge-confidence">
          <span class="mf-conf-dot mf-conf-${confidence}"></span>
          ${confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
        </span>
      </div>
      <span class="mf-badge-arrow">▸</span>
    `;

    return badge;
  }

  // ═══════════════════════════════════════════════════════════
  // SIDE PANEL
  // ═══════════════════════════════════════════════════════════

  let panelOpen = false;
  let panelHost = null;

  /**
   * Build the slide-out side panel.
   * Phase 1: dummy/placeholder chart.  Phase 4 will wire the real SVG chart.
   */
  function buildPanel(scoreData) {
    const { grade, cumulative_grams, confidence, grade_label, predictions, reasons } = scoreData;
    const colors = GRADE_COLORS[grade] || GRADE_COLORS.C;

    const confBannerClass = `mf-conf-banner-${confidence}`;
    const confMessages = {
      high:   '✓ All key fabric specs were found on this page.',
      medium: '⚠ Some specs (GSM/weave) were estimated from fabric type.',
      low:    '⚠ Limited info — estimated from fabric type only.'
    };

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="mf-panel-backdrop" id="mf-backdrop"></div>
      <div class="mf-panel" id="mf-panel">
        <div class="mf-panel-header">
          <h2>🧵 Microfiber Score</h2>
          <button class="mf-panel-close" id="mf-close" aria-label="Close panel">✕</button>
        </div>
        <div class="mf-panel-body">
          <!-- Confidence banner -->
          <div class="mf-confidence-banner ${confBannerClass}">
            ${confMessages[confidence] || confMessages.medium}
          </div>

          <!-- Grade card -->
          <div class="mf-grade-card">
            <div class="mf-grade-circle-lg" style="background:${colors.bg}; box-shadow: 0 0 0 4px ${colors.ring};">
              ${grade}
            </div>
            <div class="mf-grade-meta">
              <span class="mf-grade-label">${grade_label}</span>
              <span class="mf-grade-sub">~${cumulative_grams}g cumulative microfiber over 50 washes</span>
            </div>
          </div>

          <!-- Chart -->
          <div class="mf-section">
            <div class="mf-section-title">50-Wash Lifecycle Curve</div>
            <div class="mf-chart-placeholder" id="mf-chart-area">
              Chart loads after API is connected
            </div>
          </div>

          <!-- Wash Settings (sliders) -->
          <div class="mf-section">
            <div class="mf-section-title">Your Wash Settings</div>
            <div class="mf-slider-group">
              <div class="mf-slider-row">
                <div class="mf-slider-label">
                  <span>Temperature</span>
                  <span class="mf-slider-val" id="mf-temp-val">40°C</span>
                </div>
                <input type="range" class="mf-slider" id="mf-temp" min="20" max="60" value="40" step="5">
              </div>
              <div class="mf-slider-row">
                <div class="mf-slider-label">
                  <span>Agitation</span>
                  <span class="mf-slider-val" id="mf-agit-val">1.0</span>
                </div>
                <input type="range" class="mf-slider" id="mf-agit" min="0.5" max="1.5" value="1.0" step="0.1">
              </div>
              <div class="mf-slider-row">
                <div class="mf-slider-label"><span>Detergent</span></div>
                <select class="mf-select" id="mf-detergent">
                  <option value="Standard">Standard</option>
                  <option value="Enzyme">Enzyme</option>
                  <option value="Eco">Eco</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Reasons -->
          <div class="mf-section">
            <div class="mf-section-title">Why this grade?</div>
            <ul class="mf-reasons">
              ${(reasons || []).map(r => `
                <li>
                  <span class="mf-reason-icon">${r.icon || '📊'}</span>
                  <span>${r.text}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
        <div class="mf-panel-footer">
          Powered by Microfiber Shelf-Life Predictor · LSTM Deep Learning
        </div>
      </div>
    `;

    return wrapper;
  }

  /** Toggle the side panel open/closed. */
  function togglePanel(shadow) {
    const backdrop = shadow.getElementById('mf-backdrop');
    const panel    = shadow.getElementById('mf-panel');
    if (!backdrop || !panel) return;

    panelOpen = !panelOpen;
    backdrop.classList.toggle('open', panelOpen);
    panel.classList.toggle('open', panelOpen);
  }

  /** Wire up panel interactivity (close button, backdrop click, sliders). */
  function wirePanel(shadow) {
    const backdrop = shadow.getElementById('mf-backdrop');
    const closeBtn = shadow.getElementById('mf-close');

    if (closeBtn) closeBtn.addEventListener('click', () => togglePanel(shadow));
    if (backdrop) backdrop.addEventListener('click', () => { if (panelOpen) togglePanel(shadow); });

    // Slider live-update labels
    const tempSlider = shadow.getElementById('mf-temp');
    const tempVal    = shadow.getElementById('mf-temp-val');
    if (tempSlider && tempVal) {
      tempSlider.addEventListener('input', () => { tempVal.textContent = tempSlider.value + '°C'; });
    }

    const agitSlider = shadow.getElementById('mf-agit');
    const agitVal    = shadow.getElementById('mf-agit-val');
    if (agitSlider && agitVal) {
      agitSlider.addEventListener('input', () => { agitVal.textContent = parseFloat(agitSlider.value).toFixed(1); });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PRODUCT PAGE: INJECT BADGE + PANEL
  // ═══════════════════════════════════════════════════════════

  async function injectProductBadge(adapter) {
    // Wait for the price area to appear (SPAs may load it lazily)
    const anchor = await waitForElement(() => adapter.getBadgeAnchorElement(), 8000);

    if (!anchor) {
      console.warn('[Microfiber Score] Could not find price anchor on', adapter.name);
      return;
    }

    // Don't double-inject
    if (document.getElementById(BADGE_HOST_ID)) return;

    // ── Extract fabric info ────────────────────────────────
    const materialText = adapter.getMaterialText();
    const title        = adapter.getProductTitle();
    const description  = adapter.getProductDescription();
    const allText      = [materialText, title, description].join(' ');

    const extracted = window.MicrofiberExtractors.extractFabricInfo(allText);
    console.log('[Microfiber Score] Extracted:', extracted);

    // ── Determine confidence based on how many fields we got ─
    const fieldsFound = [
      extracted.fabric_type,
      extracted.gsm,
      extracted.weave,
      extracted.yarn_count
    ].filter(Boolean).length;

    let confidence = 'low';
    if (fieldsFound >= 3) confidence = 'high';
    else if (fieldsFound >= 1) confidence = 'medium';

    // ── For Phase 1: use dummy score data ──────────────────
    // Phase 3 will replace this with a real API call to POST /score
    const dummyScore = {
      grade: fieldsFound >= 3 ? 'B' : fieldsFound >= 1 ? 'C' : 'D',
      cumulative_grams: '2.4',
      confidence,
      grade_label: GRADE_COLORS[fieldsFound >= 3 ? 'B' : fieldsFound >= 1 ? 'C' : 'D'].label,
      predictions: [],
      reasons: [
        { icon: '🧶', text: `Fabric: ${extracted.fabric_type || 'Unknown (estimated)'}` },
        { icon: '⚖️', text: `GSM: ${extracted.gsm || 'Not found (using default 150)'}` },
        { icon: '🔧', text: `Weave: ${extracted.weave || 'Not found (using Plain default)'}` }
      ]
    };

    // ── Create Shadow DOM host for badge ───────────────────
    const badgeHost = document.createElement('div');
    badgeHost.id = BADGE_HOST_ID;
    const badgeShadow = badgeHost.attachShadow({ mode: 'closed' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    badgeShadow.appendChild(style);

    // Inject badge
    const badge = buildBadgeElement(dummyScore);
    badgeShadow.appendChild(badge);

    // ── Create Shadow DOM host for panel ───────────────────
    const panelHostEl = document.createElement('div');
    panelHostEl.id = PANEL_HOST_ID;
    const panelShadow = panelHostEl.attachShadow({ mode: 'closed' });

    const panelStyle = document.createElement('style');
    panelStyle.textContent = SHADOW_CSS;
    panelShadow.appendChild(panelStyle);

    const panelContent = buildPanel(dummyScore);
    panelShadow.appendChild(panelContent);
    wirePanel(panelShadow);

    // ── Click badge → toggle panel ────────────────────────
    badge.addEventListener('click', () => togglePanel(panelShadow));
    badge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') togglePanel(panelShadow);
    });

    // ── Insert into page ──────────────────────────────────
    anchor.parentNode.insertBefore(badgeHost, anchor.nextSibling);
    document.body.appendChild(panelHostEl);

    console.log('[Microfiber Score] Badge injected on', adapter.name, '| confidence:', confidence);
  }

  // ═══════════════════════════════════════════════════════════
  // LISTING PAGE: MINI BADGES ON PRODUCT CARDS
  // ═══════════════════════════════════════════════════════════

  async function injectListingBadges(adapter) {
    // Phase 5 — placeholder for now
    const cards = adapter.getProductCards();
    console.log(`[Microfiber Score] Found ${cards.length} product cards on listing page (Phase 5 will badge them)`);
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ═══════════════════════════════════════════════════════════

  async function main() {
    const adapter = window.MicrofiberAdapters?.getAdapter();
    if (!adapter) {
      // Not a supported site — silently bail
      return;
    }

    console.log(`[Microfiber Score] Active adapter: ${adapter.name}`);

    if (adapter.isProductPage()) {
      await injectProductBadge(adapter);
    } else if (adapter.isListingPage()) {
      await injectListingBadges(adapter);
    }
  }

  // Manifest sets run_at: document_idle, so DOM is already parsed.
  // But SPAs may still be loading, so we use a small delay + observer fallback.
  main();

})();
