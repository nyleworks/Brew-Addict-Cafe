/**
 * Brew Addict Café — stamp card backend (Google Apps Script, bound to a Google Sheet).
 *
 * Rules
 * - Customers register with name, phone number and a 4–6 digit PIN (stored hashed, never as plain text).
 * - One stamp per customer per day (Kundasang time), added by scanning the counter QR code after paying.
 * - 10 stamps = one free drink of any kind. Staff confirm the claim with the staff PIN, which starts a new card.
 * - A card lasts one month from its first stamp. If it isn't full by then, its stamps clear and the next
 *   purchase starts a new card on the same account. A full card waits until it is claimed.
 *
 * Setup: see STAMP-CARD-SETUP.md. Script properties needed: STAMP_CODE (the code inside the counter QR)
 * and STAFF_PIN (staff type it to give out a free drink).
 */

var TZ = "Asia/Kuching";
var CARD_SIZE = 10;
var MAX_FAILS = 5;            // wrong PINs in a row before the account is locked for a while
var LOCK_MINUTES = 15;

var CUSTOMER_HEADERS = ["id", "name", "phone", "pinHash", "salt", "token", "createdAt",
  "stamps", "cardStart", "lastStampDate", "freeDrinks", "failCount", "lockUntil"];

// ---- Run once from the editor: creates the sheets with their headers ----
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, "Customers", CUSTOMER_HEADERS);
  ensureSheet(ss, "Stamps", ["time", "customerId", "name", "phone", "stampNumber", "cardStart"]);
  ensureSheet(ss, "FreeDrinks", ["time", "customerId", "name", "phone"]);
  var props = PropertiesService.getScriptProperties();
  ["STAMP_CODE", "STAFF_PIN"].forEach(function (k) {
    Logger.log(k + (props.getProperty(k) ? " is set." : " is missing: add it in Project Settings → Script properties."));
  });
}

function ensureSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  // Phone numbers and dates are kept as text so Sheets doesn't reformat them
  sh.getRange("A:Z").setNumberFormat("@");
  return sh;
}

// ---- Web app entry points ----
function doGet() {
  return json({ ok: true, service: "brew-addict-stamps" });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var handlers = { register: register, login: login, card: card, stamp: stamp, redeem: redeem, logout: logout };
    var fn = handlers[req.action];
    if (!fn) return json({ ok: false, error: "bad_request" });
    return json(fn(req));
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: "server" });
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---- Actions ----
function register(req) {
  var name = String(req.name || "").trim().slice(0, 60);
  var phone = normPhone(req.phone);
  var pin = String(req.pin || "");
  if (!name) return { ok: false, error: "name" };
  if (!phone) return { ok: false, error: "phone" };
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "pin" };
  var db = customers();
  if (db.find("phone", phone)) return { ok: false, error: "exists" };
  var salt = Utilities.getUuid();
  var row = {
    id: Utilities.getUuid(), name: name, phone: phone, pinHash: hash(salt + pin), salt: salt,
    token: newToken(), createdAt: nowIso(), stamps: 0, cardStart: "", lastStampDate: "",
    freeDrinks: 0, failCount: 0, lockUntil: ""
  };
  db.add(row);
  return { ok: true, token: row.token, card: view(row) };
}

function login(req) {
  var phone = normPhone(req.phone);
  var db = customers();
  var row = phone && db.find("phone", phone);
  if (!row) return { ok: false, error: "no_account" };
  if (row.lockUntil && new Date(row.lockUntil) > new Date()) return { ok: false, error: "locked" };
  if (hash(row.salt + String(req.pin || "")) !== row.pinHash) {
    row.failCount = Number(row.failCount || 0) + 1;
    if (row.failCount >= MAX_FAILS) {
      row.failCount = 0;
      row.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
    }
    db.save(row);
    return { ok: false, error: "wrong_pin" };
  }
  row.failCount = 0; row.lockUntil = "";
  row.token = newToken();          // signing in on a new phone signs the old one out
  expire(row);
  db.save(row);
  return { ok: true, token: row.token, card: view(row) };
}

function card(req) {
  var db = customers();
  var row = byToken(db, req.token);
  if (!row) return { ok: false, error: "signed_out" };
  if (expire(row)) db.save(row);
  return { ok: true, card: view(row) };
}

function stamp(req) {
  var code = PropertiesService.getScriptProperties().getProperty("STAMP_CODE");
  if (!code || String(req.code || "") !== code) return { ok: false, error: "bad_code" };
  var db = customers();
  var row = byToken(db, req.token);
  if (!row) return { ok: false, error: "signed_out" };
  expire(row);
  var today = todayStr();
  if (Number(row.stamps) >= CARD_SIZE) { db.save(row); return { ok: false, error: "full", card: view(row) }; }
  if (row.lastStampDate === today) { db.save(row); return { ok: false, error: "today", card: view(row) }; }
  if (Number(row.stamps) === 0) row.cardStart = nowIso();
  row.stamps = Number(row.stamps) + 1;
  row.lastStampDate = today;
  db.save(row);
  sheet("Stamps").appendRow([nowIso(), row.id, row.name, row.phone, row.stamps, row.cardStart]);
  return { ok: true, stamped: true, card: view(row) };
}

function redeem(req) {
  var staffPin = PropertiesService.getScriptProperties().getProperty("STAFF_PIN");
  var db = customers();
  var row = byToken(db, req.token);
  if (!row) return { ok: false, error: "signed_out" };
  if (!staffPin || String(req.staffPin || "") !== staffPin) return { ok: false, error: "staff_pin" };
  if (Number(row.stamps) < CARD_SIZE) return { ok: false, error: "not_full", card: view(row) };
  row.stamps = 0; row.cardStart = "";
  row.freeDrinks = Number(row.freeDrinks || 0) + 1;
  db.save(row);
  sheet("FreeDrinks").appendRow([nowIso(), row.id, row.name, row.phone]);
  return { ok: true, redeemed: true, card: view(row) };
}

function logout(req) {
  var db = customers();
  var row = byToken(db, req.token);
  if (row) { row.token = ""; db.save(row); }
  return { ok: true };
}

// ---- Card rules ----
function expiryOf(row) {
  if (!row.cardStart) return null;
  var d = new Date(row.cardStart);
  d.setMonth(d.getMonth() + 1);
  return d;
}

// Clears an unfinished card once its month is up. Returns true if it changed anything.
function expire(row) {
  var n = Number(row.stamps || 0);
  var end = expiryOf(row);
  if (n > 0 && n < CARD_SIZE && end && new Date() >= end) {
    row.stamps = 0; row.cardStart = "";
    return true;
  }
  return false;
}

function view(row) {
  var end = expiryOf(row);
  return {
    name: row.name,
    stamps: Number(row.stamps || 0),
    size: CARD_SIZE,
    cardStart: row.cardStart || null,
    expires: end ? end.toISOString() : null,
    stampedToday: row.lastStampDate === todayStr(),
    freeDrinks: Number(row.freeDrinks || 0)
  };
}

// ---- Helpers ----
function normPhone(p) {
  var d = String(p || "").replace(/\D/g, "");
  if (d.indexOf("60") === 0) d = d.slice(2);
  if (d.indexOf("0") === 0) d = d.slice(1);
  return d.length >= 8 && d.length <= 11 ? "60" + d : "";
}
function hash(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join("");
}
function newToken() { return Utilities.getUuid() + Utilities.getUuid().replace(/-/g, ""); }
function nowIso() { return new Date().toISOString(); }
function todayStr() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }
function sheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function byToken(db, token) { return token ? db.find("token", String(token)) : null; }

// A tiny table helper over the Customers sheet: rows become objects keyed by header.
function customers() {
  var sh = sheet("Customers");
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var rows = values.slice(1).map(function (r, i) {
    var o = { _row: i + 2 };
    headers.forEach(function (h, k) { o[h] = r[k] === "" ? "" : String(r[k]); });
    return o;
  });
  function toArray(o) { return headers.map(function (h) { return o[h] == null ? "" : String(o[h]); }); }
  return {
    find: function (key, val) { for (var i = 0; i < rows.length; i++) if (rows[i][key] === val) return rows[i]; return null; },
    add: function (o) { sh.appendRow(toArray(o)); },
    save: function (o) { sh.getRange(o._row, 1, 1, headers.length).setValues([toArray(o)]); }
  };
}
