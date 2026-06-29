// Google Apps Script (GAS) 웹 앱용 소스코드
// 이 코드를 복사하여 구글 스프레드시트의 [확장 프로그램] -> [Apps Script]에 붙여넣으세요.

function doGet(e) {
  var sheetName = e.parameter.sheet;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var params = JSON.parse(e.postData.contents);
  var sheetName = params.sheet;
  var action = params.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  // 시트가 없으면 헤더와 함께 새로 생성
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = Object.keys(params.data);
    sheet.appendRow(headers);
  }
  
  var headers = sheet ? sheet.getDataRange().getValues()[0] : [];
  
  // 새로 들어온 데이터의 키 중에 기존 헤더에 없는 것이 있으면 컬럼 추가
  var newKeys = params.data ? Object.keys(params.data) : [];
  var headerChanged = false;
  if (sheet) {
    for (var k = 0; k < newKeys.length; k++) {
      if (headers.indexOf(newKeys[k]) === -1) {
        headers.push(newKeys[k]);
        sheet.getRange(1, headers.length).setValue(newKeys[k]);
        headerChanged = true;
      }
    }
  }
  
  if (action === "uploadFile") {
    try {
      var folderName = "맥스세일즈_첨부파일";
      var folders = DriveApp.getFoldersByName(folderName);
      var folder;
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(folderName);
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      
      var decoded = Utilities.base64Decode(params.base64Data);
      var blob = Utilities.newBlob(decoded, params.mimeType, params.fileName);
      var file = folder.createFile(blob);
      
      return ContentService.createTextOutput(JSON.stringify({success: true, url: file.getUrl()}))
        .setMimeType(ContentService.MimeType.JSON);
    } catch(e) {
      return ContentService.createTextOutput(JSON.stringify({error: e.toString()}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } else if (action === "insert") {
    var newRow = [];
    for (var i = 0; i < headers.length; i++) {
      newRow.push(params.data[headers[i]] !== undefined ? params.data[headers[i]] : "");
    }
    sheet.appendRow(newRow);
    return ContentService.createTextOutput(JSON.stringify({success: true, data: params.data}))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === "update") {
    var idColIndex = headers.indexOf("id");
    if (idColIndex === -1) idColIndex = headers.indexOf("ID");
    
    if (idColIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({error: "id column not found in sheet"}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getDataRange().getValues();
    var targetId = params.data.id || params.data.ID;
    
    for (var r = 1; r < data.length; r++) {
      if (data[r][idColIndex].toString() === targetId.toString()) {
        for (var c = 0; c < headers.length; c++) {
          if (params.data[headers[c]] !== undefined) {
            sheet.getRange(r + 1, c + 1).setValue(params.data[headers[c]]);
          }
        }
        return ContentService.createTextOutput(JSON.stringify({success: true}))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({error: "ID not found: " + targetId}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// CORS 대응을 위한 OPTIONS 요청 처리
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
