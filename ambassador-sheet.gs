// BeeYarn Campus Ambassador — Google Apps Script
// Paste this into script.google.com, deploy as a Web App (Anyone can access),
// then copy the deployment URL into campus-ambassador.html as APPS_SCRIPT_URL.

var SHEET_NAME = 'BeeYarn Ambassador Applications';

function doGet(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var data = e.parameter;
    Logger.log('Received data: ' + JSON.stringify(data));

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('Spreadsheet: ' + ss.getName());

    var sheet = ss.getSheetByName(SHEET_NAME);
    Logger.log('Sheet found: ' + (sheet ? 'yes' : 'no'));

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'Timestamp', 'Full Name', 'Email', 'Phone',
        'Institution', 'Department', 'Level',
        'Social Platform', 'Why They Want to Join', 'Status'
      ]);
    }

    sheet.appendRow([
      new Date(),
      data.fullName       || '',
      data.email          || '',
      data.phone          || '',
      data.institution    || '',
      data.department     || '',
      data.level          || '',
      data.socialPlatform || '',
      data.whyAmbassador  || '',
      'Pending'
    ]);

    Logger.log('Row appended successfully');
    output.setContent(JSON.stringify({ result: 'success' }));
  } catch (err) {
    Logger.log('Error: ' + err.message);
    output.setContent(JSON.stringify({ result: 'error', message: err.message }));
  }

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
