/**
 * GOOGLE APPS SCRIPT - BUKU TAMU & RSVP DIGITAL WEDDING
 * Mempelai: Zerri & Cindi
 * Spreadsheet ID: 1tQg6TYFANdqqglim4nc6Y-f9ZhLImz0gSX2MbV3-b9U
 * Nama Sheet: Sheet1
 *
 * Kolom yang digunakan:
 * 1. timestamp
 * 2. nama tamu
 * 3. ucapan
 * 4. konfirmasi kehadiran
 * 5. jumlah tamu
 *
 * CARA DEPLOY:
 * 1. Buka spreadsheet Anda: https://docs.google.com/spreadsheets/d/1tQg6TYFANdqqglim4nc6Y-f9ZhLImz0gSX2MbV3-b9U/edit
 * 2. Klik menu 'Extensions' (Ekstensi) > 'Apps Script'.
 * 3. Hapus semua kode bawaan di editor, lalu paste seluruh kode di bawah ini.
 * 4. Klik tombol 'Deploy' (Terapkan) > 'New deployment' (Penerapan baru).
 * 5. Pilih jenis (Select type): 'Web app' (Aplikasi web).
 * 6. Konfigurasi:
 *    - Description: "RSVP & Ucapan Zerri Cindi"
 *    - Execute as: "Me" (Email Google Anda)
 *    - Who has access: "Anyone" (Siapa saja)  <-- PENTING!
 * 7. Klik 'Deploy', izinkan akses (Authorize Access jika diminta).
 * 8. Salin "Web app URL" (akhiran /exec) dan masukkan ke variabel GOOGLE_SCRIPT_URL di website!
 */

const SPREADSHEET_ID = "1tQg6TYFANdqqglim4nc6Y-f9ZhLImz0gSX2MbV3-b9U";
const SHEET_NAME = "Sheet1";

// Header kolom sesuai permintaan
const HEADERS = ["timestamp", "nama tamu", "ucapan", "konfirmasi kehadiran", "jumlah tamu"];

/**
 * Mendapatkan sheet target & membuat header otomatis jika sheet masih kosong
 */
function getTargetSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#CDA379")
      .setFontColor("#FFFFFF")
      .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Endpoint GET: Mengambil daftar ucapan untuk ditampilkan di web
 * Juga mendukung penambahan data via GET parameter sebagai fallback
 */
function doGet(e) {
  try {
    const sheet = getTargetSheet();
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "read";

    // Fallback: Kirim ucapan via GET jika browser memiliki batasan CORS POST
    if (action === "add") {
      return handleAddRow(sheet, e.parameter);
    }

    // Default: Membaca daftar ucapan
    const rows = sheet.getDataRange().getValues();
    const listUcapan = [];

    if (rows.length > 1) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rawTime = row[0];
        let formattedTime = "";
        if (rawTime instanceof Date) {
          formattedTime = Utilities.formatDate(rawTime, "Asia/Jakarta", "dd MMM yyyy, HH:mm");
        } else if (rawTime) {
          formattedTime = String(rawTime);
        }

        const nama = String(row[1] || "").trim();
        const ucapan = String(row[2] || "").trim();
        const rawJml = row[4];
        const jumlahTamu = (rawJml !== undefined && rawJml !== null && String(rawJml).trim() !== "") ? String(rawJml).trim() : (kehadiran === "Tidak Hadir" ? "0" : "1");

        if (nama || ucapan) {
          listUcapan.push({
            timestamp: formattedTime,
            nama: nama,
            ucapan: ucapan,
            kehadiran: kehadiran,
            jumlahTamu: jumlahTamu
          });
        }
      }
    }

    // Balik urutan agar ucapan paling baru berada di paling atas
    listUcapan.reverse();

    return createJsonResponse({
      status: "success",
      total: listUcapan.length,
      data: listUcapan
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: err.toString()
    });
  }
}

/**
 * Endpoint POST: Menyimpan ucapan & RSVP dari website
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Tunggu antrean simpan maksimal 30 detik
    lock.waitLock(30000);
    const sheet = getTargetSheet();

    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (ex) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    return handleAddRow(sheet, data);

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Fungsi pembantu untuk menyimpan data ke baris spreadsheet
 */
function handleAddRow(sheet, data) {
  const now = new Date();
  const timestampStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
  const displayTime = Utilities.formatDate(now, "Asia/Jakarta", "dd MMM yyyy, HH:mm");

  const nama = String(data.nama || data["nama tamu"] || data.name || "Tamu Undangan").trim();
  const ucapan = String(data.ucapan || data.message || data.comment || "-").trim();
  const kehadiran = String(data.kehadiran || data["konfirmasi kehadiran"] || data.attendance || "Hadir").trim();
  const rawJumlah = data.jumlahTamu || data["jumlah tamu"] || data.guest;
  const jumlahTamu = (kehadiran === "Tidak Hadir") ? "0" : (rawJumlah !== undefined && rawJumlah !== null && String(rawJumlah).trim() !== "" ? String(rawJumlah).trim() : "1");

  // Susunan kolom: [1. timestamp, 2. nama tamu, 3. ucapan, 4. konfirmasi kehadiran, 5. jumlah tamu]
  sheet.appendRow([timestampStr, nama, ucapan, kehadiran, jumlahTamu]);

  return createJsonResponse({
    status: "success",
    message: "Ucapan & RSVP berhasil disimpan!",
    entry: {
      timestamp: displayTime,
      nama: nama,
      ucapan: ucapan,
      kehadiran: kehadiran,
      jumlahTamu: jumlahTamu
    }
  });
}

/**
 * Menghasilkan response JSON standar
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
