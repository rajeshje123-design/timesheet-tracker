// Google API Configuration
// INSTRUCTIONS: Replace these values with your own Google API credentials
// See README.md for step-by-step setup instructions
const CONFIG = {
  // Get this from Google Cloud Console → APIs & Services → Credentials
  CLIENT_ID: '178741739952-ba44qa0eil4uvsdnctj2957jdc51441r.apps.googleusercontent.com',

  // Create a Google Sheet, then copy the ID from the URL
  // URL format: https://docs.google.com/spreadsheets/d/SHEET_ID/edit
  SHEET_ID: '1rFNMTA4h1ZpKkpeRems2AMy_IXCOBJswCK9WgOMiRsM',

  // The name of the tab/sheet inside your Google Sheets document
  SHEET_NAME: 'Timesheets',

  // OAuth scopes needed
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets',

  // Google API Discovery URL
  DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
};
