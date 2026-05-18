// BeeYarn Campus Ambassador — Google Apps Script
// Paste this into script.google.com, deploy as a Web App (Anyone can access),
// then copy the deployment URL into campus-ambassador.html as APPS_SCRIPT_URL.

var SHEET_NAME = 'BeeYarn Ambassador Applications';

function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var data = JSON.parse(e.postData.contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      // Safety net: create the sheet if it doesn't exist yet
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'Timestamp', 'Full Name', 'Email', 'Phone',
        'Institution', 'Department', 'Level',
        'Social Platform', 'Why They Want to Join', 'Status'
      ]);
    }

    sheet.appendRow([
      new Date(),               // Timestamp
      data.fullName     || '',
      data.email        || '',
      data.phone        || '',
      data.institution  || '',
      data.department   || '',
      data.level        || '',
      data.socialPlatform || '',
      data.whyAmbassador || '',
      'Pending'                 // Status — update manually to Accepted / Rejected
    ]);

    output.setContent(JSON.stringify({ result: 'success' }));
  } catch (err) {
    output.setContent(JSON.stringify({ result: 'error', message: err.message }));
  }

  // CORS headers so the fetch() from the website works
  return output;
}

// Optional: test the script manually inside Apps Script editor
function testDoPost() {
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        fullName: 'Test User',
        email: 'test@example.com',
        phone: '+2348000000000',
        institution: 'University of Lagos',
        department: 'Mass Communication',
        level: '300 Level',
        socialPlatform: 'Instagram',
        whyAmbassador: 'I want to grow BeeYarn on my campus because I believe in the product.'
      })
    }
  };
  var result = doPost(mockEvent);
  Logger.log(result.getContent());
}
