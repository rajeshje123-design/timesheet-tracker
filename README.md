# Timesheet Tracker — Setup Guide

A single-page web app that lets you log work hours directly into your personal Google Sheet and visualize them in a live dashboard. No backend required — it runs entirely in your browser.

---

## Prerequisites

- A Google account
- A modern browser (Chrome, Edge, Firefox, Safari)
- A place to host the files over HTTPS:
  - **Netlify** (recommended — free, instant)
  - GitHub Pages
  - Any other static host

---

## Step 1 — Create Your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and sign in.
2. Click **+ Blank** to create a new spreadsheet.
3. Rename it (top-left) to something memorable, e.g. `Timesheet Tracker`.
4. Inside the sheet, rename the default tab (bottom) to `Timesheets`
   - Right-click the tab → **Rename** → type `Timesheets`.
5. Copy the **Sheet ID** from the browser URL:
   ```
   https://docs.google.com/spreadsheets/d/  ← SHEET_ID →  /edit
   ```
   It is the long alphanumeric string between `/d/` and `/edit`.
6. Keep this tab open — you'll paste the ID into `config.js` shortly.

> **Note**: The app will automatically write the header row on first use. You don't need to add any columns manually.

---

## Step 2 — Set Up Google Cloud Console

### 2a. Create / Select a Project

1. Open [console.cloud.google.com](https://console.cloud.google.com).
2. Click the project selector (top bar) → **New Project**.
3. Name it (e.g. `Timesheet Tracker`) → **Create**.
4. Wait a few seconds, then select the new project.

### 2b. Enable the Google Sheets API

1. In the left menu go to **APIs & Services → Library**.
2. Search for `Google Sheets API`.
3. Click it → **Enable**.

### 2c. Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Select **External** → **Create**.
3. Fill in:
   - **App name**: `Timesheet Tracker`
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue** through the remaining steps (Scopes, Test Users).
5. On the **Test users** step, click **+ Add Users** and add your own Google email.
6. Click **Save and Continue** → **Back to Dashboard**.

### 2d. Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials** → **+ Create Credentials → OAuth client ID**.
2. Select **Web application** as the application type.
3. Give it a name, e.g. `Timesheet Web Client`.
4. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5500` (for local development with Live Server)
   - `http://localhost:3000` (optional, for other local servers)
   - Your production URL, e.g. `https://my-timesheet.netlify.app`
   *(Add all origins you plan to use — no trailing slashes)*
5. Leave **Authorized redirect URIs** empty (not needed for this app).
6. Click **Create**.
7. A popup shows your **Client ID**. Copy it — it ends in `.apps.googleusercontent.com`.

---

## Step 3 — Configure the App

Open `config.js` in a text editor and replace the placeholder values:

```javascript
const CONFIG = {
  CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',  // ← paste here
  SHEET_ID:  'YOUR_GOOGLE_SHEET_ID',                               // ← paste here
  SHEET_NAME: 'Timesheets',   // must match the tab name in your sheet
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
  DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
};
```

Save the file.

---

## Step 4 — Test Locally

You **must** serve the files over HTTP (not `file://`) for the Google API to work.

**Option A — VS Code Live Server extension** (easiest):
1. Install [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code.
2. Right-click `index.html` → **Open with Live Server**.
3. The app opens at `http://localhost:5500`.

**Option B — Python**:
```bash
cd "d:\Google AI\Project 1 - time sheet"
python -m http.server 5500
# open http://localhost:5500 in your browser
```

**Option C — Node.js**:
```bash
npx serve .
```

---

## Step 5 — Deploy to Netlify

### 5a. Push to GitHub

1. Create a new repository on [github.com](https://github.com) (keep it private if you wish).
2. Push all project files:
   ```bash
   cd "d:\Google AI\Project 1 - time sheet"
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/timesheet-tracker.git
   git push -u origin main
   ```

### 5b. Connect Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**.
2. Connect your GitHub account and select your repository.
3. Leave build settings blank (this is a plain HTML project — no build step needed).
4. Click **Deploy site**.
5. After deployment, copy your Netlify URL (e.g. `https://sparkling-sunflower-123456.netlify.app`).

### 5c. Add Netlify URL to Google Cloud Console

1. Return to **APIs & Services → Credentials** in Google Cloud Console.
2. Click your OAuth client ID to edit it.
3. Under **Authorized JavaScript origins**, click **+ Add URI** and paste your Netlify URL (no trailing slash).
4. Click **Save**.

> Changes to authorized origins can take a few minutes to propagate.

---

## Step 6 — First Run

1. Open your Netlify URL (or localhost).
2. Click **Sign in with Google**.
3. If prompted about an unverified app, click **Advanced → Go to Timesheet Tracker (unsafe)**.
   *(This warning appears because the app is in "Testing" mode. To remove it, publish the OAuth consent screen.)*
4. Grant permission to access Google Sheets.
5. You're in! Start logging time entries.

---

## Step 7 — Access from Other Devices

Simply share your Netlify URL with yourself (email, bookmark, etc.) and open it on any device.
Sign in with the same Google account — all your data lives in that one Google Sheet.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Sign-in failed" | Check CLIENT_ID in config.js; ensure your URL is in Authorized Origins |
| "Could not ensure headers" | Check SHEET_ID in config.js; make sure the sheet tab is named `Timesheets` |
| App blank / JS error | Must be served over HTTP/HTTPS — not `file://` |
| Data not saving | Make sure you've granted Sheets permission during sign-in |
| Changes not showing | Click **Refresh** in the Dashboard tab |
| Want to remove "unsafe" warning | Publish the OAuth consent screen in Google Cloud Console |

---

## Project File Structure

```
d:\Google AI\Project 1 - time sheet\
├── index.html      Main HTML — UI structure and CDN imports
├── style.css       Custom CSS (tabs, toasts, table, chart, spinner)
├── config.js       ← Edit this: CLIENT_ID and SHEET_ID
├── sheets.js       Google Sheets API integration (gapi + GIS)
├── app.js          Application logic (form, dashboard, charts, pivot)
└── README.md       This file
```

---

## Data Storage

All data is stored in **your own Google Sheet** under your Google account.
No data passes through any external server. The app calls the Google Sheets API directly from your browser using OAuth 2.0.

| Column | Description |
|---|---|
| Date | Work date (YYYY-MM-DD) |
| Start Time | Session start (HH:MM) |
| End Time | Session end (HH:MM) |
| Duration (hrs) | Decimal hours, e.g. 2.5 |
| Company | Client / company name |
| Task Group | Category, e.g. Development |
| Task Type | Specific task type, e.g. Bug Fix |
| Task Description | Free-text notes |
| Task Nature | Regular or Additional |
