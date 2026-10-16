// extractors.js — Regex-based extraction of fabric properties from raw text
// This is loaded as a content script and exposes window.MicrofiberExtractors.
//
// Phase 1: basic stubs + regex skeletons
// Phase 2: full extraction logic

window.MicrofiberExtractors = {

  // ─── Known fabric types (order matters: longer matches first) ────
  FABRIC_TYPES: [
    'cotton-poly blend', 'cotton-polyester blend', 'cotton polyester',
    'poly-cotton', 'polycotton',
    'polyester', 'cotton', 'nylon', 'acrylic', 'silk', 'wool',
    'linen', 'rayon', 'viscose', 'spandex', 'lycra', 'elastane',
    'microfiber', 'fleece', 'denim', 'modal', 'tencel', 'hemp'
  ],

  // ─── Weave keywords ────────────────────────────────────────
  WEAVE_TYPES: ['plain', 'twill', 'satin', 'knitted', 'knit', 'woven',
                'jersey', 'rib', 'interlock', 'jacquard'],

  /**
   * Extract structured fabric info from arbitrary product text.
   * @param {string} text — raw material / description text
   * @returns {Object} { fabric_type, blend, gsm, weave, yarn_count, raw_text }
   */
  extractFabricInfo(text) {
    if (!text) return this._empty(text);
    const t = text.toLowerCase();

    return {
      fabric_type: this._extractFabricType(t),
      blend:       this._extractBlend(t),
      gsm:         this._extractGSM(t),
      weave:       this._extractWeave(t),
      yarn_count:  this._extractYarnCount(t),
      raw_text:    text.slice(0, 500)
    };
  },

  // ─── Private helpers ───────────────────────────────────────

  _empty(text) {
    return { fabric_type: null, blend: null, gsm: null,
             weave: null, yarn_count: null, raw_text: text || '' };
  },

  /**
   * Extract the primary fabric type.
   * e.g. "100% Cotton" → "Cotton", "Polyester blend" → "Polyester"
   */
  _extractFabricType(text) {
    for (const ft of this.FABRIC_TYPES) {
      if (text.includes(ft)) {
        // Normalise to the model's known types
        return this._normaliseFabricType(ft);
      }
    }
    return null;
  },

  /**
   * Extract blend percentages.
   * e.g. "60% Cotton 40% Polyester" → { "Cotton": 0.6, "Polyester": 0.4 }
   *       "Cotton/Poly Blend"       → { "Cotton": 0.5, "Polyester": 0.5 }
   */
  _extractBlend(text) {
    // Pattern: "60% cotton 40% polyester" or "60% cotton, 40% polyester"
    const pctPattern = /(\d{1,3})\s*%\s*([\w\s-]+?)(?=\s*(?:\d{1,3}\s*%|,|and\b|$))/gi;
    const matches = [...text.matchAll(pctPattern)];

    if (matches.length >= 2) {
      const blend = {};
      let total = 0;
      for (const m of matches) {
        const pct = parseInt(m[1], 10);
        const name = this._normaliseFabricType(m[2].trim());
        if (name && pct > 0 && pct <= 100) {
          blend[name] = pct / 100;
          total += pct;
        }
      }
      // Accept if blend percentages are roughly valid (80-105 to allow rounding)
      if (Object.keys(blend).length >= 2 && total >= 80 && total <= 105) {
        return blend;
      }
    }

    // Check for slash-separated blends: "Cotton/Polyester"
    const slashPattern = /([\w]+)\s*[\/&]\s*([\w]+)/i;
    const slashMatch = text.match(slashPattern);
    if (slashMatch) {
      const a = this._normaliseFabricType(slashMatch[1].trim());
      const b = this._normaliseFabricType(slashMatch[2].trim());
      if (a && b && a !== b) {
        return { [a]: 0.5, [b]: 0.5 }; // assume 50/50 when unknown
      }
    }

    return null;
  },

  /**
   * Extract GSM (grams per square metre).
   * e.g. "180 GSM", "220gsm fabric"
   */
  _extractGSM(text) {
    const gsmPattern = /(\d{2,4})\s*gsm/i;
    const match = text.match(gsmPattern);
    if (match) {
      const gsm = parseInt(match[1], 10);
      if (gsm >= 50 && gsm <= 600) return gsm;
    }
    return null;
  },

  /**
   * Extract weave type.
   * e.g. "Twill weave", "Satin finish"
   */
  _extractWeave(text) {
    for (const w of this.WEAVE_TYPES) {
      if (text.includes(w)) {
        return this._normaliseWeaveType(w);
      }
    }
    return null;
  },

  /**
   * Extract yarn count (Ne).
   * Rare on product pages; look for patterns like "40s count", "30Ne"
   */
  _extractYarnCount(text) {
    const nePattern = /(\d{1,3})\s*(?:s\b|ne\b|count)/i;
    const match = text.match(nePattern);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count >= 10 && count <= 200) return count;
    }
    return null;
  },

  /**
   * Normalise a raw fabric name to one the model knows.
   * Model categories: Cotton, Polyester, Cotton-Poly Blend, Nylon, Acrylic
   */
  _normaliseFabricType(raw) {
    if (!raw) return null;
    const r = raw.toLowerCase().trim();

    if (/poly-?cotton|cotton.?poly|polycotton/.test(r)) return 'Cotton-Poly Blend';
    if (/cotton/.test(r))    return 'Cotton';
    if (/polyester/.test(r)) return 'Polyester';
    if (/nylon/.test(r))     return 'Nylon';
    if (/acrylic/.test(r))   return 'Acrylic';
    // Map similar synthetics to closest model category
    if (/microfiber|fleece/.test(r)) return 'Polyester';
    if (/rayon|viscose|modal|tencel/.test(r)) return 'Cotton'; // cellulosic
    if (/denim/.test(r))     return 'Cotton';
    if (/spandex|lycra|elastane/.test(r)) return 'Nylon';
    if (/linen|hemp/.test(r)) return 'Cotton'; // plant-based
    if (/silk/.test(r))       return 'Nylon';  // protein fiber, similar shedding
    if (/wool/.test(r))       return 'Acrylic'; // similar staple shedding

    return null;
  },

  /**
   * Normalise weave to model categories: Plain, Twill, Satin
   */
  _normaliseWeaveType(raw) {
    if (!raw) return null;
    const r = raw.toLowerCase().trim();

    if (/plain|woven/.test(r))   return 'Plain';
    if (/twill|denim/.test(r))   return 'Twill';
    if (/satin/.test(r))         return 'Satin';
    if (/knit|jersey|rib|interlock/.test(r)) return 'Plain'; // closest approximation
    if (/jacquard/.test(r))      return 'Twill';

    return null;
  }
};
