// content.js — Main content script for Microfiber Score extension
// Detects product pages via site adapters, extracts fabric properties,
// calls the LSTM backend for real physics-grounded scoring,
// and injects an isolated Shadow DOM badge + interactive 50-wash side panel.
// Also badges search result listing cards and calculates cart totals.

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // CONSTANTS & PALETTE
  // ═══════════════════════════════════════════════════════════

  const BADGE_HOST_ID = 'mf-score-badge-root';
  const PANEL_HOST_ID = 'mf-score-panel-root';
  const CART_HOST_ID  = 'mf-cart-summary-root';

  const GRADE_COLORS = {
    A: { bg: '#16a34a', ring: '#bbf7d0', label: 'Excellent', text: '#fff' },
    B: { bg: '#65a30d', ring: '#d9f99d', label: 'Good',      text: '#fff' },
    C: { bg: '#ca8a04', ring: '#fef08a', label: 'Fair',      text: '#fff' },
    D: { bg: '#ea580c', ring: '#fed7aa', label: 'Poor',      text: '#fff' },
    E: { bg: '#dc2626', ring: '#fecaca', label: 'Very Poor', text: '#fff' }
  };

  // In-memory cache for listing card predictions
  const cardScoreCache = new Map();

  // ═══════════════════════════════════════════════════════════
  // SHADOW DOM CSS
  // Strict CSS isolation ensures zero host-page leakage or interference
  // ═══════════════════════════════════════════════════════════

  const SHADOW_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    :host {
      all: initial;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1e293b;
      display: block;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Main Product Badge ─────────────────────────────────── */
    .mf-badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px 10px 10px;
      margin: 12px 0;
      border-radius: 14px;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border: 1.5px solid #e2e8f0;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
      user-select: none;
      position: relative;
    }
    .mf-badge:hover {
      border-color: #0d9488;
      box-shadow: 0 6px 20px rgba(13, 148, 136, 0.15), 0 2px 6px rgba(0, 0, 0, 0.04);
      transform: translateY(-2px);
    }
    .mf-badge:active {
      transform: translateY(0);
    }

    .mf-grade-circle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      font-weight: 800;
      font-size: 22px;
      color: #fff;
      flex-shrink: 0;
      text-shadow: 0 1px 2px rgba(0,0,0,0.25);
      transition: transform 0.2s ease;
    }
    .mf-badge:hover .mf-grade-circle {
      transform: scale(1.05);
    }

    .mf-badge-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .mf-badge-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #0d9488;
    }

    .mf-badge-value {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
    }

    .mf-badge-sub {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }

    .mf-conf-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
    }
    .mf-conf-high   { background: #22c55e; box-shadow: 0 0 0 2px #bbf7d0; }
    .mf-conf-medium { background: #eab308; box-shadow: 0 0 0 2px #fef08a; }
    .mf-conf-low    { background: #f97316; box-shadow: 0 0 0 2px #fed7aa; }

    .mf-badge-arrow {
      font-size: 14px;
      color: #94a3b8;
      margin-left: 6px;
      transition: transform 0.2s ease, color 0.2s ease;
    }
    .mf-badge:hover .mf-badge-arrow {
      color: #0d9488;
      transform: translateX(3px);
    }

    /* ── Mini Listing Card Badge ────────────────────────────── */
    .mf-mini-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      margin: 4px 0;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .mf-mini-badge:hover {
      border-color: #0d9488;
      background: #f0fdfa;
      transform: translateY(-1px);
    }
    .mf-mini-grade {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
    }

    /* ── Slide-Out Panel ───────────────────────────────────── */
    .mf-panel-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(2px);
      z-index: 2147483646;
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
      width: 420px;
      max-width: 92vw;
      height: 100vh;
      background: #ffffff;
      z-index: 2147483647;
      transform: translateX(100%);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: -10px 0 40px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .mf-panel.open {
      transform: translateX(0);
    }

    .mf-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 22px;
      border-bottom: 1px solid #e2e8f0;
      background: #ffffff;
      flex-shrink: 0;
    }
    .mf-panel-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .mf-panel-logo {
      font-size: 20px;
    }
    .mf-panel-header h2 {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
    }
    .mf-panel-header p {
      font-size: 11px;
      color: #64748b;
      margin-top: 1px;
    }
    .mf-panel-close {
      width: 34px;
      height: 34px;
      border: none;
      background: #f1f5f9;
      border-radius: 10px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      transition: all 0.15s ease;
    }
    .mf-panel-close:hover {
      background: #e2e8f0;
      color: #0f172a;
      transform: scale(1.05);
    }

    .mf-panel-body {
      padding: 22px;
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Confidence Banner */
    .mf-confidence-banner {
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .mf-conf-banner-high   { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .mf-conf-banner-medium { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
    .mf-conf-banner-low    { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
    .mf-uncertainty-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.7);
      white-space: nowrap;
    }

    /* Big Grade Card */
    .mf-grade-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 18px;
      border-radius: 14px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0;
    }
    .mf-grade-circle-lg {
      width: 62px;
      height: 62px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: 800;
      color: #fff;
      flex-shrink: 0;
      text-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .mf-grade-meta {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .mf-grade-status {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .mf-grade-label {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .mf-grade-sub {
      font-size: 12px;
      color: #475569;
    }
    .mf-synthetic-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      background: #fee2e2;
      color: #991b1b;
      display: inline-block;
      margin-top: 2px;
    }

    /* Section Styles */
    .mf-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .mf-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .mf-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748b;
    }
    .mf-shelf-life-badge {
      font-size: 11px;
      font-weight: 600;
      color: #0d9488;
      background: #ccfbf1;
      padding: 2px 8px;
      border-radius: 6px;
    }

    /* Interactive SVG Chart */
    .mf-chart-box {
      width: 100%;
      height: 180px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mf-chart-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .mf-chart-tooltip {
      position: absolute;
      top: 8px;
      right: 12px;
      font-size: 11px;
      font-weight: 600;
      color: #0f172a;
      background: rgba(255, 255, 255, 0.9);
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      pointer-events: none;
    }

    /* Wash Habit Sliders */
    .mf-sliders-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .mf-slider-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .mf-slider-label {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
    }
    .mf-slider-val {
      font-weight: 700;
      color: #0d9488;
    }
    .mf-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #e2e8f0;
      outline: none;
      transition: background 0.2s;
    }
    .mf-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #0d9488;
      cursor: pointer;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      transition: transform 0.15s ease;
    }
    .mf-slider::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }
    .mf-select {
      width: 100%;
      padding: 8px 12px;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      color: #1e293b;
      background: #fff;
      outline: none;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .mf-select:focus {
      border-color: #0d9488;
    }

    /* Reasons List */
    .mf-reasons-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mf-reason-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      font-size: 12px;
      color: #334155;
      line-height: 1.4;
    }
    .mf-reason-icon {
      font-size: 16px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .mf-reason-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .mf-reason-title {
      font-weight: 700;
      color: #0f172a;
    }

    /* Greener Swaps */
    .mf-swaps-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mf-swap-card {
      padding: 12px;
      border-radius: 10px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .mf-swap-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .mf-swap-title {
      font-size: 12px;
      font-weight: 700;
      color: #166534;
    }
    .mf-swap-reduction {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      background: #dcfce7;
      color: #15803d;
    }
    .mf-swap-desc {
      font-size: 11px;
      color: #374151;
      line-height: 1.35;
    }

    /* Cart Summary Banner */
    .mf-cart-banner {
      margin: 16px 0;
      padding: 14px 18px;
      border-radius: 12px;
      background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
      border: 1.5px solid #99f6e4;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 6px rgba(13, 148, 136, 0.08);
    }
    .mf-cart-banner h3 {
      font-size: 14px;
      font-weight: 700;
      color: #115e59;
    }
    .mf-cart-banner p {
      font-size: 12px;
      color: #0f766e;
    }
    .mf-cart-stat {
      font-size: 20px;
      font-weight: 800;
      color: #0d9488;
    }

    /* Footer */
    .mf-panel-footer {
      padding: 14px 22px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      background: #fafafa;
      flex-shrink: 0;
    }
    .mf-recalc-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #0d9488;
      font-weight: 600;
      font-size: 11px;
    }
  `;

  // ═══════════════════════════════════════════════════════════
  // COMMUNICATION & STATE
  // ═══════════════════════════════════════════════════════════

  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (res) => {
        resolve(res || { success: false, error: 'Extension service worker unreachable' });
      });
    });
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function waitForElement(selectorFn, timeout = 7000) {
    return new Promise((resolve) => {
      const el = selectorFn();
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const found = selectorFn();
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // PURE SVG 50-WASH LIFECYCLE CHART
  // ═══════════════════════════════════════════════════════════

  function generateSvgChart(predictions, washValues, stabilizationWash, color = '#0d9488') {
    if (!predictions || predictions.length === 0) {
      return `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:12px;">Curve will load upon model prediction</div>`;
    }

    const width = 360;
    const height = 170;
    const pad = { top: 20, right: 20, bottom: 30, left: 45 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const maxVal = Math.max(...predictions) * 1.15;
    const minVal = 0;

    const points = predictions.map((v, i) => {
      const x = pad.left + (i / (predictions.length - 1)) * plotW;
      const y = pad.top + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;
      return { x, y, v, wash: washValues ? washValues[i] : (i + 1) };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${pad.top + plotH} L ${points[0].x.toFixed(1)} ${pad.top + plotH} Z`;

    // Horizontal grid lines
    const gridLines = [0.25, 0.5, 0.75, 1.0].map(fraction => {
      const val = minVal + fraction * (maxVal - minVal);
      const y = pad.top + plotH - fraction * plotH;
      return `
        <line x1="${pad.left}" y1="${y}" x2="${pad.left + plotW}" y2="${y}" stroke="#f1f5f9" stroke-width="1" />
        <text x="${pad.left - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">${Math.round(val)}</text>
      `;
    }).join('');

    // Stabilization wash vertical line
    let stabMarker = '';
    if (stabilizationWash && stabilizationWash > 1 && stabilizationWash <= predictions.length) {
      const stabIdx = stabilizationWash - 1;
      const stabPt = points[stabIdx];
      if (stabPt) {
        stabMarker = `
          <line x1="${stabPt.x.toFixed(1)}" y1="${pad.top}" x2="${stabPt.x.toFixed(1)}" y2="${pad.top + plotH}" stroke="#0d9488" stroke-dasharray="3,3" stroke-width="1.5" />
          <circle cx="${stabPt.x.toFixed(1)}" cy="${stabPt.y.toFixed(1)}" r="4" fill="#0d9488" stroke="#fff" stroke-width="2" />
          <text x="${stabPt.x.toFixed(1)}" y="${pad.top - 6}" text-anchor="middle" font-size="9" font-weight="700" fill="#0d9488" font-family="Inter, sans-serif">Wash ${stabilizationWash}</text>
        `;
      }
    }

    return `
      <svg class="mf-chart-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mfAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.32" />
            <stop offset="100%" stop-color="${color}" stop-opacity="0.01" />
          </linearGradient>
        </defs>

        <!-- Grids -->
        ${gridLines}

        <!-- Area fill -->
        <path d="${areaD}" fill="url(#mfAreaGrad)" />

        <!-- Line stroke -->
        <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

        <!-- Stabilization marker -->
        ${stabMarker}

        <!-- X-axis baseline & labels -->
        <line x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" stroke="#cbd5e1" stroke-width="1" />
        <text x="${pad.left}" y="${pad.top + plotH + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-family="Inter, sans-serif">1</text>
        <text x="${pad.left + plotW / 2}" y="${pad.top + plotH + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-family="Inter, sans-serif">25 washes</text>
        <text x="${pad.left + plotW}" y="${pad.top + plotH + 16}" text-anchor="middle" font-size="10" fill="#64748b" font-family="Inter, sans-serif">50</text>
        <text x="${pad.left - 6}" y="${pad.top - 6}" text-anchor="end" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">mg</text>
      </svg>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  // PRODUCT PAGE INJECTION
  // ═══════════════════════════════════════════════════════════

  let currentScoreData = null;
  let currentExtracted = null;
  let currentSettings  = null;
  let isPanelOpen      = false;
  let isInjecting      = false;

  async function injectProductBadge(adapter) {
    if (isInjecting) return;
    if (document.getElementById(BADGE_HOST_ID)) return;
    isInjecting = true;

    try {
      const anchor = await waitForElement(() => adapter.getBadgeAnchorElement(), 7000);
      if (!anchor) {
        console.warn('[Microfiber Score] Price anchor element not found for', adapter.name);
        return;
      }

      // Check again after async wait
      if (document.getElementById(BADGE_HOST_ID)) return;

      // 1. Load user settings
      const settingsRes = await sendMessage({ type: 'GET_SETTINGS' });
      currentSettings = settingsRes?.data || {
        washTemperature: 40,
        mechanicalAgitation: 1.0,
        detergentType: 'Standard'
      };

      // 2. Extract garment fabric specs
      const materialText = adapter.getMaterialText() || '';
      const title        = adapter.getProductTitle() || '';
      const description  = adapter.getProductDescription() || '';
      const allText      = [materialText, title, description].filter(Boolean).join(' ');

      currentExtracted = window.MicrofiberExtractors?.extractFabricInfo(allText) || {};

      // 3. Request real score from backend
      const scorePayload = {
        Fabric_Type: currentExtracted.fabric_type || null,
        Blend: (currentExtracted.blend && Object.keys(currentExtracted.blend).length > 0) ? currentExtracted.blend : null,
        Fabric_Weight_gsm: currentExtracted.gsm ? parseFloat(currentExtracted.gsm) : null,
        Yarn_Count: currentExtracted.yarn_count ? parseFloat(currentExtracted.yarn_count) : null,
        Weave_Type: currentExtracted.weave || null,
        Wash_Temperature_C: parseFloat(currentSettings.washTemperature || 40),
        Detergent_Type: currentSettings.detergentType || 'Standard',
        Mechanical_Agitation: parseFloat(currentSettings.mechanicalAgitation || 1.0),
        Number_of_Washes: 50,
        Product_Title: title,
        Raw_Text: allText
      };

      const apiRes = await sendMessage({
        type: 'API_REQUEST',
        endpoint: '/score',
        payload: scorePayload
      });

      if (apiRes.success && apiRes.data) {
        currentScoreData = apiRes.data;
      } else {
        // Fallback with offline calculated estimations
        console.warn('[Microfiber Score] Backend API call failed or offline:', apiRes.error);
        const isSynth = /polyester|nylon|acrylic|microfiber|poly/i.test(currentExtracted.fabric_type || allText);
        currentScoreData = {
          grade: isSynth ? 'D' : 'B',
          grade_label: isSynth ? 'Poor' : 'Good',
          color: isSynth ? '#ea580c' : '#65a30d',
          ring_color: isSynth ? '#fed7aa' : '#d9f99d',
          cumulative_grams: isSynth ? 18.5 : 9.8,
          synthetic_percentage: isSynth ? 100 : 0,
          synthetic_microplastics_g: isSynth ? 18.5 : 0.0,
          confidence: 'medium',
          uncertainty_range: { low_g: 8.0, high_g: 11.5, margin_pct: 18 },
          predictions: Array.from({ length: 50 }, (_, i) => Math.round(250 * Math.exp(-0.03 * i) + 80)),
          wash_values: Array.from({ length: 50 }, (_, i) => i + 1),
          estimated_shelf_life: 25,
          reasons: [
            { icon: '🧵', title: 'Material', text: `Fabric: ${currentExtracted.fabric_type || 'Standard apparel'}` },
            { icon: '⚠️', title: 'Status', text: 'Backend offline: estimated via baseline heuristics.' }
          ],
          greener_swaps: [
            { title: 'Cold wash at 20°C', potential_reduction: 'Saves ~18% microfiber shed', description: 'Cuts fiber thermal degradation significantly.' }
          ]
        };
      }

      // Clean up any stale badge hosts before injecting
      document.querySelectorAll('#' + BADGE_HOST_ID).forEach(el => el.remove());
      document.querySelectorAll('#' + PANEL_HOST_ID).forEach(el => el.remove());

      // 4. Create isolated Shadow DOM for the badge
      const badgeHost = document.createElement('div');
      badgeHost.id = BADGE_HOST_ID;
      const badgeShadow = badgeHost.attachShadow({ mode: 'closed' });

      const badgeStyle = document.createElement('style');
      badgeStyle.textContent = SHADOW_CSS;
      badgeShadow.appendChild(badgeStyle);

      const badgeEl = createBadgeDom(currentScoreData);
      badgeShadow.appendChild(badgeEl);

      // 5. Create isolated Shadow DOM for the side panel
      const panelHost = document.createElement('div');
      panelHost.id = PANEL_HOST_ID;
      const panelShadow = panelHost.attachShadow({ mode: 'closed' });

      const panelStyle = document.createElement('style');
      panelStyle.textContent = SHADOW_CSS;
      panelShadow.appendChild(panelStyle);

      const panelEl = createPanelDom(currentScoreData, currentSettings);
      panelShadow.appendChild(panelEl);

      // 6. Connect badge click & panel events
      const toggle = () => {
        isPanelOpen = !isPanelOpen;
        const backdrop = panelShadow.getElementById('mf-backdrop');
        const panel = panelShadow.getElementById('mf-panel');
        if (backdrop && panel) {
          backdrop.classList.toggle('open', isPanelOpen);
          panel.classList.toggle('open', isPanelOpen);
        }
      };

      badgeEl.addEventListener('click', toggle);
      badgeEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') toggle();
      });

      const closeBtn = panelShadow.getElementById('mf-close');
      const backdrop = panelShadow.getElementById('mf-backdrop');
      if (closeBtn) closeBtn.addEventListener('click', toggle);
      if (backdrop) backdrop.addEventListener('click', () => { if (isPanelOpen) toggle(); });

      // 7. Wire up live sliders recalculation
      wireSliders(panelShadow, badgeShadow);

      // 8. Insert into host page
      anchor.parentNode.insertBefore(badgeHost, anchor.nextSibling);
      document.body.appendChild(panelHost);

      console.log('[Microfiber Score] Successfully injected badge for:', title || adapter.name);
    } finally {
      isInjecting = false;
    }
  }

  function createBadgeDom(score) {
    const badge = document.createElement('div');
    badge.className = 'mf-badge';
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-label', `Microfiber Score: Grade ${score.grade}, ${score.cumulative_grams}g over 50 washes`);

    const col = score.color || '#0d9488';
    const ring = score.ring_color || '#bbf7d0';

    badge.innerHTML = `
      <div class="mf-grade-circle" style="background:${col}; box-shadow: 0 0 0 3px ${ring};">
        ${score.grade}
      </div>
      <div class="mf-badge-info">
        <span class="mf-badge-label">Microfiber Score</span>
        <span class="mf-badge-value">~${score.cumulative_grams}g over 50 washes</span>
        <span class="mf-badge-sub">
          <span class="mf-conf-dot mf-conf-${score.confidence || 'medium'}"></span>
          ${score.grade_label} · ${(score.confidence || 'medium').toUpperCase()}
        </span>
      </div>
      <span class="mf-badge-arrow">▸</span>
    `;
    return badge;
  }

  function createPanelDom(score, settings) {
    const wrapper = document.createElement('div');
    const col = score.color || '#0d9488';
    const ring = score.ring_color || '#bbf7d0';

    const confMsg = score.confidence === 'high'
      ? '✓ Exact fabric composition & specs detected from product'
      : (score.confidence === 'medium'
          ? 'ℹ Key fabric identified; standard garment specs used'
          : '⚠ Estimated from title/description; verify on label');

    const chartHtml = generateSvgChart(score.predictions, score.wash_values, score.estimated_shelf_life, col);

    wrapper.innerHTML = `
      <div class="mf-panel-backdrop" id="mf-backdrop"></div>
      <div class="mf-panel" id="mf-panel">
        <div class="mf-panel-header">
          <div class="mf-panel-title-wrap">
            <span class="mf-panel-logo">🧵</span>
            <div>
              <h2>Microfiber Score</h2>
              <p>Physics-Grounded LSTM Textile Model</p>
            </div>
          </div>
          <button class="mf-panel-close" id="mf-close" aria-label="Close panel">✕</button>
        </div>

        <div class="mf-panel-body">
          <!-- Confidence & Margin -->
          <div class="mf-confidence-banner mf-conf-banner-${score.confidence || 'medium'}">
            <span>${confMsg}</span>
            <span class="mf-uncertainty-pill">±${score.uncertainty_range?.margin_pct || 15}% uncertainty</span>
          </div>

          <!-- Grade Overview Card -->
          <div class="mf-grade-card">
            <div class="mf-grade-circle-lg" style="background:${col}; box-shadow: 0 0 0 4px ${ring};">
              ${score.grade}
            </div>
            <div class="mf-grade-meta">
              <div class="mf-grade-status">
                <span class="mf-grade-label">${score.grade_label}</span>
                <span class="mf-uncertainty-pill">${score.uncertainty_range?.low_g || score.cumulative_grams}g – ${score.uncertainty_range?.high_g || score.cumulative_grams}g</span>
              </div>
              <span class="mf-grade-sub"><strong>~${score.cumulative_grams}g</strong> cumulative shed across 50 wash cycles</span>
              ${score.synthetic_percentage > 0 ? `
                <span class="mf-synthetic-badge">⚠️ ${score.synthetic_percentage}% synthetic microplastics (~${score.synthetic_microplastics_g}g)</span>
              ` : `
                <span class="mf-uncertainty-pill" style="color:#166534;background:#dcfce7;">🌿 100% natural biodegradable fibers</span>
              `}
            </div>
          </div>

          <!-- 50-Wash Lifecycle Chart -->
          <div class="mf-section">
            <div class="mf-section-header">
              <span class="mf-section-title">50-Wash Lifecycle Shedding Curve</span>
              ${score.estimated_shelf_life ? `<span class="mf-shelf-life-badge">Plateaus at Wash ${score.estimated_shelf_life}</span>` : ''}
            </div>
            <div class="mf-chart-box" id="mf-chart-container">
              ${chartHtml}
            </div>
          </div>

          <!-- Wash Settings Sliders -->
          <div class="mf-section">
            <div class="mf-section-header">
              <span class="mf-section-title">Your Wash Habit Simulator</span>
              <span id="mf-recalc-status"></span>
            </div>
            <div class="mf-sliders-card">
              <div class="mf-slider-row">
                <div class="mf-slider-label">
                  <span>Wash Temperature</span>
                  <span class="mf-slider-val" id="mf-temp-val">${settings.washTemperature || 40}°C</span>
                </div>
                <input type="range" class="mf-slider" id="mf-temp" min="20" max="60" value="${settings.washTemperature || 40}" step="5">
              </div>

              <div class="mf-slider-row">
                <div class="mf-slider-label">
                  <span>Mechanical Agitation</span>
                  <span class="mf-slider-val" id="mf-agit-val">${parseFloat(settings.mechanicalAgitation || 1.0).toFixed(1)}x</span>
                </div>
                <input type="range" class="mf-slider" id="mf-agit" min="0.5" max="1.5" value="${settings.mechanicalAgitation || 1.0}" step="0.1">
              </div>

              <div class="mf-slider-row">
                <div class="mf-slider-label">
                  <span>Detergent Formulation</span>
                </div>
                <select class="mf-select" id="mf-detergent">
                  <option value="Standard" ${settings.detergentType === 'Standard' ? 'selected' : ''}>Standard Powder/Liquid</option>
                  <option value="Enzyme" ${settings.detergentType === 'Enzyme' ? 'selected' : ''}>Bio-Enzymatic</option>
                  <option value="Eco" ${settings.detergentType === 'Eco' ? 'selected' : ''}>Plant-Based Eco Detergent</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Why This Grade? -->
          <div class="mf-section">
            <span class="mf-section-title">Why This Grade?</span>
            <ul class="mf-reasons-list" id="mf-reasons-container">
              ${(score.reasons || []).map(r => `
                <li class="mf-reason-item">
                  <span class="mf-reason-icon">${r.icon || 'ℹ️'}</span>
                  <div class="mf-reason-content">
                    <span class="mf-reason-title">${r.title || 'Impact Factor'}</span>
                    <span>${r.text}</span>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Greener Swaps & Mitigation -->
          <div class="mf-section">
            <span class="mf-section-title">Greener Swaps & Tips</span>
            <div class="mf-swaps-list" id="mf-swaps-container">
              ${(score.greener_swaps || []).map(s => `
                <div class="mf-swap-card">
                  <div class="mf-swap-title-row">
                    <span class="mf-swap-title">${s.title}</span>
                    <span class="mf-swap-reduction">${s.potential_reduction}</span>
                  </div>
                  <p class="mf-swap-desc">${s.description}</p>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="mf-panel-footer">
          Microfiber Shelf-Life Extension · Deep Learning (PyTorch 2-layer LSTM)
        </div>
      </div>
    `;

    return wrapper;
  }

  function wireSliders(panelShadow, badgeShadow) {
    const tempSlider = panelShadow.getElementById('mf-temp');
    const agitSlider = panelShadow.getElementById('mf-agit');
    const detSelect  = panelShadow.getElementById('mf-detergent');

    const tempVal = panelShadow.getElementById('mf-temp-val');
    const agitVal = panelShadow.getElementById('mf-agit-val');
    const statusEl = panelShadow.getElementById('mf-recalc-status');

    if (!tempSlider || !agitSlider || !detSelect) return;

    const performRecalc = debounce(async () => {
      if (statusEl) {
        statusEl.innerHTML = `<span class="mf-recalc-indicator">⏳ Recalculating...</span>`;
      }

      const newTemp = parseFloat(tempSlider.value);
      const newAgit = parseFloat(agitSlider.value);
      const newDet  = detSelect.value;

      // Save updated habit defaults
      sendMessage({
        type: 'SAVE_SETTINGS',
        payload: {
          washTemperature: newTemp,
          mechanicalAgitation: newAgit,
          detergentType: newDet
        }
      });

      const updatedPayload = {
        Fabric_Type: currentExtracted?.fabric_type,
        Blend: currentExtracted?.blend,
        Fabric_Weight_gsm: currentExtracted?.gsm,
        Yarn_Count: currentExtracted?.yarn_count,
        Weave_Type: currentExtracted?.weave,
        Wash_Temperature_C: newTemp,
        Detergent_Type: newDet,
        Mechanical_Agitation: newAgit,
        Number_of_Washes: 50
      };

      const res = await sendMessage({
        type: 'API_REQUEST',
        endpoint: '/score',
        payload: updatedPayload
      });

      if (res.success && res.data) {
        currentScoreData = res.data;
        updatePanelAndBadge(panelShadow, badgeShadow, res.data);
      }

      if (statusEl) statusEl.innerHTML = '';
    }, 280);

    tempSlider.addEventListener('input', () => {
      if (tempVal) tempVal.textContent = `${tempSlider.value}°C`;
      performRecalc();
    });

    agitSlider.addEventListener('input', () => {
      if (agitVal) agitVal.textContent = `${parseFloat(agitSlider.value).toFixed(1)}x`;
      performRecalc();
    });

    detSelect.addEventListener('change', performRecalc);
  }

  function updatePanelAndBadge(panelShadow, badgeShadow, score) {
    const col = score.color || '#0d9488';
    const ring = score.ring_color || '#bbf7d0';

    // 1. Update Badge
    const badgeGradeEl = badgeShadow.querySelector('.mf-grade-circle');
    const badgeValEl   = badgeShadow.querySelector('.mf-badge-value');
    const badgeSubEl   = badgeShadow.querySelector('.mf-badge-sub');

    if (badgeGradeEl) {
      badgeGradeEl.textContent = score.grade;
      badgeGradeEl.style.background = col;
      badgeGradeEl.style.boxShadow = `0 0 0 3px ${ring}`;
    }
    if (badgeValEl) {
      badgeValEl.textContent = `~${score.cumulative_grams}g over 50 washes`;
    }
    if (badgeSubEl) {
      badgeSubEl.innerHTML = `
        <span class="mf-conf-dot mf-conf-${score.confidence || 'medium'}"></span>
        ${score.grade_label} · ${(score.confidence || 'medium').toUpperCase()}
      `;
    }

    // 2. Update Big Grade Card
    const cardGradeEl = panelShadow.querySelector('.mf-grade-circle-lg');
    const cardLabelEl = panelShadow.querySelector('.mf-grade-label');
    const cardSubEl   = panelShadow.querySelector('.mf-grade-sub');

    if (cardGradeEl) {
      cardGradeEl.textContent = score.grade;
      cardGradeEl.style.background = col;
      cardGradeEl.style.boxShadow = `0 0 0 4px ${ring}`;
    }
    if (cardLabelEl) cardLabelEl.textContent = score.grade_label;
    if (cardSubEl) cardSubEl.innerHTML = `<strong>~${score.cumulative_grams}g</strong> cumulative shed across 50 wash cycles`;

    // 3. Update Chart
    const chartBox = panelShadow.getElementById('mf-chart-container');
    if (chartBox) {
      chartBox.innerHTML = generateSvgChart(score.predictions, score.wash_values, score.estimated_shelf_life, col);
    }

    // 4. Update Reasons
    const reasonsContainer = panelShadow.getElementById('mf-reasons-container');
    if (reasonsContainer && score.reasons) {
      reasonsContainer.innerHTML = score.reasons.map(r => `
        <li class="mf-reason-item">
          <span class="mf-reason-icon">${r.icon || 'ℹ️'}</span>
          <div class="mf-reason-content">
            <span class="mf-reason-title">${r.title || 'Impact Factor'}</span>
            <span>${r.text}</span>
          </div>
        </li>
      `).join('');
    }

    // 5. Update Swaps
    const swapsContainer = panelShadow.getElementById('mf-swaps-container');
    if (swapsContainer && score.greener_swaps) {
      swapsContainer.innerHTML = score.greener_swaps.map(s => `
        <div class="mf-swap-card">
          <div class="mf-swap-title-row">
            <span class="mf-swap-title">${s.title}</span>
            <span class="mf-swap-reduction">${s.potential_reduction}</span>
          </div>
          <p class="mf-swap-desc">${s.description}</p>
        </div>
      `).join('');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LISTING PAGE (SEARCH RESULTS) BATCH BADGING
  // ═══════════════════════════════════════════════════════════

  async function injectListingBadges(adapter) {
    const cards = adapter.getProductCards();
    if (!cards || cards.length === 0) return;

    console.log(`[Microfiber Score] Processing ${cards.length} cards on listing page`);

    const unbadgedCards = [];
    const payloads = [];

    for (const card of cards.slice(0, 24)) { // process up to 24 items per view
      if (!card.element || card.element.querySelector('.mf-mini-badge-host')) continue;

      const cardId = card.id || card.titleText;
      if (cardScoreCache.has(cardId)) {
        renderMiniBadge(card, cardScoreCache.get(cardId));
        continue;
      }

      unbadgedCards.push(card);
      payloads.push({
        raw_text: `${card.titleText || ''} ${card.materialText || ''}`,
        product_title: card.titleText || '',
        number_of_washes: 50
      });
    }

    if (payloads.length === 0) return;

    const batchRes = await sendMessage({
      type: 'API_BATCH',
      endpoint: '/score',
      items: payloads
    });

    if (batchRes.success && Array.isArray(batchRes.data)) {
      batchRes.data.forEach((item, idx) => {
        const card = unbadgedCards[idx];
        if (!card) return;

        let score = null;
        if (item.success && item.data) {
          score = item.data;
        } else {
          // Fallback based on card title
          const isPoly = /poly|nylon|acrylic|fleece/i.test(card.titleText || '');
          score = {
            grade: isPoly ? 'D' : 'B',
            cumulative_grams: isPoly ? 18.0 : 8.5,
            color: isPoly ? '#ea580c' : '#65a30d'
          };
        }

        const cardId = card.id || card.titleText;
        cardScoreCache.set(cardId, score);
        renderMiniBadge(card, score);
      });
    }
  }

  function renderMiniBadge(card, score) {
    if (!card.element || card.element.querySelector('.mf-mini-badge-host')) return;

    const host = document.createElement('div');
    host.className = 'mf-mini-badge-host';
    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    shadow.appendChild(style);

    const mini = document.createElement('div');
    mini.className = 'mf-mini-badge';
    mini.title = `Microfiber Score Grade ${score.grade}: ~${score.cumulative_grams}g over 50 washes`;

    const col = score.color || '#0d9488';
    mini.innerHTML = `
      <span class="mf-mini-grade" style="background:${col};">${score.grade}</span>
      <span>${score.cumulative_grams}g</span>
    `;

    shadow.appendChild(mini);

    const target = card.priceElement || card.element.querySelector('h2, .pdp-price, .product-price') || card.element;
    if (target.parentNode) {
      target.parentNode.insertBefore(host, target.nextSibling);
    } else {
      card.element.appendChild(host);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CART LEVEL SUMMARY (PHASE 6)
  // ═══════════════════════════════════════════════════════════

  async function checkCartSummary() {
    const isCart = window.location.pathname.includes('/cart') ||
                   window.location.pathname.includes('/gp/cart') ||
                   window.location.pathname.includes('/checkout');
    if (!isCart || document.getElementById(CART_HOST_ID)) return;

    // Detect items in cart
    const itemTitles = Array.from(document.querySelectorAll('.sc-product-title, .cart-item-title, [class*="itemTitle"]'))
      .map(el => el.textContent.trim())
      .filter(Boolean);

    if (itemTitles.length === 0) return;

    const payloads = itemTitles.map(title => ({ raw_text: title, number_of_washes: 50 }));
    const batchRes = await sendMessage({
      type: 'API_BATCH',
      endpoint: '/score',
      items: payloads
    });

    if (batchRes.success && Array.isArray(batchRes.data)) {
      let totalCartGrams = 0;
      let totalSynthGrams = 0;

      batchRes.data.forEach(item => {
        if (item.success && item.data) {
          totalCartGrams += item.data.cumulative_grams || 0;
          totalSynthGrams += item.data.synthetic_microplastics_g || 0;
        } else {
          totalCartGrams += 12.0;
        }
      });

      const host = document.createElement('div');
      host.id = CART_HOST_ID;
      const shadow = host.attachShadow({ mode: 'closed' });

      const style = document.createElement('style');
      style.textContent = SHADOW_CSS;
      shadow.appendChild(style);

      const banner = document.createElement('div');
      banner.className = 'mf-cart-banner';
      banner.innerHTML = `
        <div>
          <h3>🛒 Basket Microfiber Impact</h3>
          <p>${itemTitles.length} clothing item${itemTitles.length > 1 ? 's' : ''} in cart · ~${roundNum(totalSynthGrams, 1)}g non-biodegradable microplastics</p>
        </div>
        <div style="text-align:right;">
          <div class="mf-cart-stat">${roundNum(totalCartGrams, 1)}g</div>
          <div style="font-size:11px;color:#0f766e;">Total 50-wash shed</div>
        </div>
      `;

      shadow.appendChild(banner);

      const insertTarget = document.querySelector('#sc-active-cart, .cart-items, main, body');
      if (insertTarget) {
        insertTarget.prepend(host);
      }
    }
  }

  function roundNum(val, dec = 1) {
    return Number(Math.round(Number(val + 'e' + dec)) + 'e-' + dec).toFixed(dec);
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN ROUTER
  // ═══════════════════════════════════════════════════════════

  async function run() {
    const adapter = window.MicrofiberAdapters?.getAdapter();
    if (!adapter) return;

    if (adapter.isProductPage()) {
      await injectProductBadge(adapter);
    } else if (adapter.isListingPage()) {
      await injectListingBadges(adapter);
    }

    await checkCartSummary();
  }

  let lastUrl = window.location.href;

  function scheduleRun() {
    run();
    setTimeout(run, 1500);
  }

  window.addEventListener('popstate', scheduleRun);
  window.addEventListener('mf:pagechange', scheduleRun);

  // URL change poller for client-side routing
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      const oldBadge = document.getElementById(BADGE_HOST_ID);
      if (oldBadge) oldBadge.remove();
      const oldPanel = document.getElementById(PANEL_HOST_ID);
      if (oldPanel) oldPanel.remove();
      scheduleRun();
    }
  }, 1000);

  // Execute on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleRun);
  } else {
    scheduleRun();
  }

})();
