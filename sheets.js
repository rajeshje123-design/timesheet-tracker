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

  /**
   * Called by the gapi script's onload callback (gapiLoaded in index.html).
   * Initialises gapi.client with the Sheets discovery document.
   */
  async function initGapiClient() {
    await gapi.client.init({
      discoveryDocs: [CONFIG.DISCOVERY_DOC],
    });
    gapiInited = true;
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

  function _maybeReady() {
    if (gapiInited && gisInited) {
      onAuthChange(false); // Both loaded; not yet signed in
    }
  }

  // ── Auth ──────────────────────────────────────────────────

  /** Opens the OAuth popup / consent screen. */
  function signIn() {
    return new Promise((resolve, reject) => {
      tokenClient.callback = (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        accessToken = response.access_token;
        onAuthChange(true);
        resolve(accessToken);
      };

      if (accessToken) {
        // Already have a token — just request new one silently if expired
        tokenClient.requestAccessToken({ prompt: '' });
      } else {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      }
    });
  }

  /** Revokes the current token and signs out. */
  function signOut() {
    return new Promise((resolve) => {
      if (!accessToken) { resolve(); return; }
      google.accounts.oauth2.revoke(accessToken, () => {
        accessToken = null;
        gapi.client.setToken(null);
        onAuthChange(false);
        resolve();
      });
    });
  }

  /** Returns true if we currently have an access token. */
  function isSignedIn() {
    return !!accessToken;
  }

  // ── Internal helpers ──────────────────────────────────────

  /** Makes sure gapi.client uses the latest access token. */
  function _applyToken() {
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
    _applyToken();
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
    _applyToken();
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
    _applyToken();
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
    set onAuthChange(fn) { onAuthChange = fn; },
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
