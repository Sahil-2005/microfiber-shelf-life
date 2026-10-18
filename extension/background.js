// background.js — MV3 Service Worker for Microfiber Score
// Handles API communication between content scripts and the backend,
// and stores / retrieves user wash-habit settings from chrome.storage.

const DEFAULT_SETTINGS = {
  washTemperature: 40,       // °C
  detergentType: 'Standard', // Standard | Enzyme | Eco
  mechanicalAgitation: 1.0,  // 0.5 – 1.5
  washesPerMonth: 4,
  apiUrl: 'http://127.0.0.1:8000',
  enabled: true
};

// ─── Message Router ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  // 1. Proxy an API call to the backend
  if (message.type === 'API_REQUEST') {
    handleApiRequest(message, sendResponse);
    return true; // keep channel open for async response
  }

  // 2. Batch API call (for listing pages)
  if (message.type === 'API_BATCH') {
    handleApiBatch(message, sendResponse);
    return true;
  }

  // 3. Read user settings
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, settings => {
      sendResponse({ success: true, data: settings });
    });
    return true;
  }

  // 4. Write user settings
  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.sync.set(message.payload, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// ─── API helpers ─────────────────────────────────────────────

async function getApiUrl() {
  return new Promise(resolve => {
    chrome.storage.sync.get({ apiUrl: DEFAULT_SETTINGS.apiUrl }, s => {
      resolve(s.apiUrl);
    });
  });
}

async function handleApiRequest(message, sendResponse) {
  try {
    const apiUrl = await getApiUrl();
    const { endpoint, payload } = message;

    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    sendResponse({ success: true, data });
  } catch (error) {
    console.error('[Microfiber Score] API error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleApiBatch(message, sendResponse) {
  try {
    const apiUrl = await getApiUrl();
    const { endpoint, items } = message; // items is an array of payloads

    const results = await Promise.allSettled(
      items.map(payload =>
        fetch(`${apiUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => {
          if (!r.ok) throw new Error(`API ${r.status}`);
          return r.json();
        })
      )
    );

    const data = results.map(r =>
      r.status === 'fulfilled'
        ? { success: true, data: r.value }
        : { success: false, error: r.reason?.message }
    );

    sendResponse({ success: true, data });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

console.log('[Microfiber Score] Service worker initialized');
