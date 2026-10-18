// popup.js — Logic for the extension toolbar popup

document.addEventListener('DOMContentLoaded', () => {
  const DOM = {
    apiStatus:   document.getElementById('api-status'),
    statusDot:   null, // set below
    statusText:  null,
    toggleEnabled: document.getElementById('toggle-enabled'),
    washTemp:    document.getElementById('wash-temp'),
    washTempVal: document.getElementById('wash-temp-val'),
    washAgit:    document.getElementById('wash-agit'),
    washAgitVal: document.getElementById('wash-agit-val'),
    washDetergent: document.getElementById('wash-detergent'),
    washFreq:    document.getElementById('wash-freq'),
    washFreqVal: document.getElementById('wash-freq-val'),
    apiUrl:      document.getElementById('api-url'),
    saveBtn:     document.getElementById('save-btn'),
    saveStatus:  document.getElementById('save-status'),
  };

  DOM.statusDot  = DOM.apiStatus.querySelector('.status-dot');
  DOM.statusText = DOM.apiStatus.querySelector('.status-text');

  // ─── Load saved settings ───────────────────────────────────
  chrome.storage.sync.get({
    enabled: true,
    washTemperature: 40,
    mechanicalAgitation: 1.0,
    detergentType: 'Standard',
    washesPerMonth: 4,
    apiUrl: 'http://127.0.0.1:8000'
  }, (settings) => {
    DOM.toggleEnabled.checked    = settings.enabled;
    DOM.washTemp.value           = settings.washTemperature;
    DOM.washTempVal.textContent  = settings.washTemperature + '°C';
    DOM.washAgit.value           = settings.mechanicalAgitation;
    DOM.washAgitVal.textContent  = parseFloat(settings.mechanicalAgitation).toFixed(1);
    DOM.washDetergent.value      = settings.detergentType;
    DOM.washFreq.value           = settings.washesPerMonth;
    DOM.washFreqVal.textContent  = settings.washesPerMonth;
    DOM.apiUrl.value             = settings.apiUrl;
  });

  // ─── Slider live labels ────────────────────────────────────
  DOM.washTemp.addEventListener('input', () => {
    DOM.washTempVal.textContent = DOM.washTemp.value + '°C';
  });
  DOM.washAgit.addEventListener('input', () => {
    DOM.washAgitVal.textContent = parseFloat(DOM.washAgit.value).toFixed(1);
  });
  DOM.washFreq.addEventListener('input', () => {
    DOM.washFreqVal.textContent = DOM.washFreq.value;
  });

  // ─── Save button ───────────────────────────────────────────
  DOM.saveBtn.addEventListener('click', () => {
    const settings = {
      enabled:              DOM.toggleEnabled.checked,
      washTemperature:      parseInt(DOM.washTemp.value, 10),
      mechanicalAgitation:  parseFloat(DOM.washAgit.value),
      detergentType:        DOM.washDetergent.value,
      washesPerMonth:       parseInt(DOM.washFreq.value, 10),
      apiUrl:               DOM.apiUrl.value.replace(/\/+$/, '') // strip trailing slash
    };

    chrome.storage.sync.set(settings, () => {
      DOM.saveStatus.textContent = '✓ Saved';
      DOM.saveStatus.style.color = '#16a34a';
      setTimeout(() => { DOM.saveStatus.textContent = ''; }, 2000);
    });
  });

  // ─── Check API health ─────────────────────────────────────
  async function checkApi() {
    try {
      const url = DOM.apiUrl.value.replace(/\/+$/, '');
      const response = await fetch(url + '/', { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        DOM.statusDot.className = 'status-dot online';
        DOM.statusText.textContent = 'API connected';
      } else {
        throw new Error('bad status');
      }
    } catch {
      DOM.statusDot.className = 'status-dot offline';
      DOM.statusText.textContent = 'API offline';
    }
  }

  checkApi();
});
