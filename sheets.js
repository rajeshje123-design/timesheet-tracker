/* ============================================================
   sheets.js — Google Sheets API Integration
   Uses Google Identity Services (GIS) + gapi
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const SheetsAPI = (() => {
  let gapiInited = false;
  let gisInited  = false;
  let tokenClient = null;
  let accessToken = null;

  const HEADERS = [
    'Date',
    'Start Time',
    'End Time',
    'Duration (hrs)',
    'Company',
    'Task Group',
    'Task Type',
    'Task Description',
    'Task Nature',
  ];

  // ── Callback hooks set by app.js ──────────────────────────
  let onAuthChange = () => {};   // called with (isSignedIn)

  // ── Init ──────────────────────────────────────────────────

  let gapiResolve;
  const gapiReady = new Promise(resolve => { gapiResolve = resolve; });

  /**
   * Called by the gapi script's onload callback (gapiLoaded in index.html).
   * Initialises gapi.client with the Sheets discovery document.
   */
  async function initGapiClient() {
    await gapi.client.init({
      discoveryDocs: [CONFIG.DISCOVERY_DOC],
    });
    gapiInited = true;
    if (gapiResolve) gapiResolve();
    _maybeReady();
  }

  /**
   * Called by the GIS script's onload callback (gisLoaded in index.html).
   */
  function initGIS() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: '', // set dynamically before each request
    });
    gisInited = true;
    _maybeReady();
  }

  const STORAGE_KEY = 'ts_g_auth_token';
  const LOGIN_FLAG_KEY = 'ts_g_has_logged_in';

  function _saveToken(token, expiresInSec = 3599) {
    accessToken = token;
    if (gapiInited) {
      gapi.client.setToken({ access_token: token });
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        token,
        expires_at: Date.now() + (expiresInSec * 1000)
      }));
      localStorage.setItem(LOGIN_FLAG_KEY, 'true');
    } catch (e) {
      console.warn('Could not save auth token to localStorage', e);
    }
  }

  function _loadValidStoredToken() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Give a 2-minute buffer before expiry
      if (data && data.token && data.expires_at > (Date.now() + 120000)) {
        return data.token;
      }
    } catch (e) {}
    return null;
  }

  function _clearStoredToken() {
    accessToken = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LOGIN_FLAG_KEY);
    } catch (e) {}
  }

  function _maybeReady() {
    if (gapiInited && gisInited) {
      const storedToken = _loadValidStoredToken();
      if (storedToken) {
        accessToken = storedToken;
        gapi.client.setToken({ access_token: storedToken });
        onAuthChange(true);
      } else {
        onAuthChange(false);
      }
    }
  }

  // ── Auth ──────────────────────────────────────────────────

  /** Opens the OAuth popup / signs in. */
  function signIn() {
    return new Promise((resolve, reject) => {
      tokenClient.callback = (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        _saveToken(response.access_token, response.expires_in || 3599);
        onAuthChange(true);
        resolve(accessToken);
      };

      // prompt: '' will NOT re-prompt consent or show the unverified warning screen if already authorized!
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  /** Revokes the current token and signs out. */
  function signOut() {
    return new Promise((resolve) => {
      const oldToken = accessToken;
      _clearStoredToken();
      if (gapiInited) {
        gapi.client.setToken(null);
      }
      onAuthChange(false);

      if (oldToken) {
        google.accounts.oauth2.revoke(oldToken, () => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /** Returns true if we currently have an access token. */
  function isSignedIn() {
    return !!(accessToken || _loadValidStoredToken());
  }

  // ── Internal helpers ──────────────────────────────────────

  /** Makes sure gapi.client uses the latest access token. */
  async function _applyToken() {
    await gapiReady;
    if (!accessToken) throw new Error('Not signed in.');
    gapi.client.setToken({ access_token: accessToken });
  }

  /** Returns the full A1 range string for the sheet. */
  function _range(r) {
    return `${CONFIG.SHEET_NAME}!${r}`;
  }

  // ── Header Management ─────────────────────────────────────

  /**
   * Checks if row 1 of the sheet has the expected headers.
   * Writes them if the sheet is empty or the first row is blank.
   */
  async function ensureHeaders() {
    await _applyToken();
    try {
      const res = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.SHEET_ID,
        range: _range('A1:Z1'),
      });
      const values = res.result.values;
      if (!values || values.length === 0 || values[0].length === 0) {
        // Write headers
        await gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: CONFIG.SHEET_ID,
          range: _range('A1'),
          valueInputOption: 'RAW',
          resource: { values: [HEADERS] },
        });
      }
    } catch (err) {
      // Sheet might not exist yet — surface the error
      throw new Error(`Could not ensure headers: ${err.message}`);
    }
  }

  // ── Write ─────────────────────────────────────────────────

  /**
   * Appends a single data row to the sheet.
   * @param {Object} rowData — keys matching HEADERS (minus "Duration (hrs)")
   *   Expected keys: date, startTime, endTime, durationHrs, company,
   *                  taskGroup, taskType, taskDescription, taskNature
   */
  async function appendRow(rowData) {
    await _applyToken();
    await ensureHeaders();

    const row = [
      rowData.date,
      rowData.startTime,
      rowData.endTime,
      rowData.durationHrs,
      rowData.company,
      rowData.taskGroup,
      rowData.taskType,
      rowData.taskDescription,
      rowData.taskNature,
    ];

    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.SHEET_ID,
      range: _range('A1'),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [row] },
    });
  }

  // ── Read ──────────────────────────────────────────────────

  /**
   * Fetches all data rows from the sheet.
   * @returns {Array<Object>} Array of objects keyed by header name.
   */
  async function getAllRows() {
    await _applyToken();
    await ensureHeaders();

    const res = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SHEET_ID,
      range: _range('A1:Z10000'),
    });

    const values = res.result.values;
    if (!values || values.length < 2) return [];

    const headers = values[0];
    return values.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? '';
      });
      return obj;
    });
  }

  // ── Public API ────────────────────────────────────────────
  return {
    initGapiClient,
    initGIS,
    signIn,
    signOut,
    isSignedIn,
    ensureHeaders,
    appendRow,
    getAllRows,
    getStoredToken: _loadValidStoredToken,
    set onAuthChange(fn) {
      onAuthChange = fn;
      const validToken = _loadValidStoredToken();
      if (validToken) {
        accessToken = validToken;
        onAuthChange(true);
      }
    },
    get headers() { return [...HEADERS]; },
  };
})();

// ── Global callbacks invoked by the Google API <script> tags ──
function gapiLoaded() {
  gapi.load('client', SheetsAPI.initGapiClient);
}

function gisLoaded() {
  SheetsAPI.initGIS();
}
