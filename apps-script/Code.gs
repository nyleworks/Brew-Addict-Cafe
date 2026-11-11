/**
 * Brew Addict Café: stamp card backend (Google Apps Script, bound to a Google Sheet).
 *
 * How it stays safe
 * - No personal details. A card is a random code that lives on the customer's phone. The sheet keeps only a
 *   one-way fingerprint (SHA-256) of that code, the stamp count and dates.
 * - Only staff can add stamps or give free drinks. Those actions run only for the Google account that owns
 *   this script, signed in on the cafe phone (Google checks the password and 2-step verification).
 * - The public web app can do one thing: look up a card's stamps by its code, so the customer's card can
 *   update live. Lookups are rate limited (LIMITS below): too many in a minute get a quick "busy" reply
 *   that never touches the sheet.
 * - Each phone also has a random device tag, shown in its QR code. A card remembers the tag of the phone that
 *   got its stamps. If the card turns up on a different phone (a restored screenshot, or a copied QR code),
 *   the staff page asks staff to confirm before stamping, and the move is logged.
 * - setup(), styleSheets() and housekeeping() refuse to run for anyone but the owner (or the nightly trigger).
 *
 * The sheet gets a "Stamp card" menu: "Monthly report…" makes a report tab for one month, and "Save report as
 * PDF" saves the open report tab to Google Drive (folder "Brew Addict stamp reports").
 *
 * Rules: 10 stamps = one free drink. One stamp per card per day (Kundasang time). A card lasts one month from
 * its first stamp; an unfinished card then clears. Cards with no activity for 6 months are deleted.
 *
 * Setup: see STAMP-CARD-SETUP.md. Two deployments of this same script:
 *   Public: Execute as Me, Who has access: Anyone       → its URL goes in stamp-card.js as STAMP_API
 *   Staff:  Execute as Me, Who has access: Only myself  → its URL goes in stamp-card.js as STAFF_URL
 */

var TZ = "Asia/Kuching";
var CARD_SIZE = 10;
var KEEP_DAYS = 183;   // delete cards with no activity for about 6 months

// Public lookups allowed per minute. A card polls every 3 seconds while open (20 a minute), so 40 leaves room.
// "all" caps the whole public link, so a flood of made-up codes can't hammer the sheet.
var LIMITS = { perCard: 40, all: 1200 };
// Staff "lost card" rescues: up to 9 stamps, once per card, at most RESCUES_PER_DAY a day for the whole cafe.
var RESCUE_MAX = CARD_SIZE - 1;
var RESCUES_PER_DAY = 3;

// Drinks staff can pick when giving a free drink (from the menu on the website)
var DRINKS = ["Brew Addict Signature", "Americano", "Caffe Latte", "Spanish Latte", "Vanilla Latte", "Hazelnut Latte",
  "Caramel Macchiato", "Cocoa Royale", "Matcha Strawberry", "Matcha Blossom", "Matcha Mango", "Matcha Latte",
  "Matcha Cloud", "Jasmine Tea", "Pink Soda"];

var CARD_HEADERS = ["card", "stamps", "cardStart", "lastStampDate", "freeDrinks", "createdAt", "lastActivity",
  "device", "moves", "rescued"];
var LOG_HEADERS = ["time", "date", "card", "event", "stampNumber", "weekday", "hour", "drink", "daysToFill", "note"];

// ---------------------------------------------------------------------------------------------------------
// Run once from the editor: creates the tabs, the Summary formulas and the nightly clean-up. Safe to run again
// after updating the code: it adds any new columns and rebuilds the Summary, without touching cards or the log.
// ---------------------------------------------------------------------------------------------------------
function setup() {
  requireStaff_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  var cards = ensureSheet_(ss, "Cards", CARD_HEADERS);
  cards.getRange("A:J").setNumberFormat("@");          // codes and dates stay as text
  var log = ensureSheet_(ss, "Log", LOG_HEADERS);
  log.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
  log.getRange("B:D").setNumberFormat("@");
  log.getRange("F:F").setNumberFormat("@");
  log.getRange("H:H").setNumberFormat("@");
  log.getRange("J:J").setNumberFormat("@");
  buildSummary_(ss);

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "housekeeping") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("housekeeping").timeBased().everyDays(1).atHour(4).inTimezone(TZ).create();
  styleSheets();
  Logger.log("Done. Staff actions will only work for " + Session.getEffectiveUser().getEmail() + ".");
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  else sh.getRange(1, 1, 1, headers.length).setValues([headers]);   // adds columns that newer code uses
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  return sh;
}

function buildSummary_(ss) {
  var sh = ss.getSheetByName("Summary") || ss.insertSheet("Summary", 0);
  sh.clear();
  var since30 = 'Log!A2:A>=NOW()-30';
  var rows = [
    ["BREW ADDICT STAMP CARD", ""],
    ["Updates by itself from the Log tab. Please don't edit this tab.", ""],
    ["", ""],
    ["Members (cards with at least 1 stamp)", '=IFERROR(COUNTUNIQUE(FILTER(Log!C2:C, Log!D2:D="stamp")), 0)'],
    ["Active members, last 30 days", '=IFERROR(COUNTUNIQUE(FILTER(Log!C2:C, Log!D2:D="stamp", ' + since30 + ')), 0)'],
    ["Stamps this week (from Monday)", '=COUNTIFS(Log!D2:D, "stamp", Log!A2:A, ">="&(TODAY()-WEEKDAY(TODAY(), 3)))'],
    ["Stamps this month", '=COUNTIFS(Log!D2:D, "stamp", Log!A2:A, ">="&(EOMONTH(TODAY(), -1)+1))'],
    ["Stamps, all time", '=COUNTIF(Log!D2:D, "stamp")'],
    ["Free drinks given this month", '=COUNTIFS(Log!D2:D, "free_drink", Log!A2:A, ">="&(EOMONTH(TODAY(), -1)+1))'],
    ["Free drinks given, all time", '=COUNTIF(Log!D2:D, "free_drink")'],
    ["Cards that reached 10 stamps", '=COUNTIFS(Log!D2:D, "stamp", Log!E2:E, 10)'],
    ["Cards that expired unfinished", '=COUNTIF(Log!D2:D, "expired")'],
    ["Average days to fill a card", '=IFERROR(ROUND(AVERAGEIF(Log!D2:D, "free_drink", Log!I2:I), 1), "-")'],
    ["Lost cards rescued by staff, this month", '=COUNTIFS(Log!D2:D, "rescue", Log!A2:A, ">="&(EOMONTH(TODAY(), -1)+1))'],
    ["Cards moved to a new phone, this month", '=COUNTIFS(Log!D2:D, "moved", Log!A2:A, ">="&(EOMONTH(TODAY(), -1)+1))'],
    ["", ""],
    ["Stamps by day of the week", ""]
  ];
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (d) {
    rows.push([d, '=COUNTIFS(Log!D2:D, "stamp", Log!F2:F, "' + d + '")']);
  });
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange("A1").setFontSize(14).setFontWeight("bold");
  sh.getRange("A2").setFontColor("#5c5750");
  sh.getRange("A17").setFontWeight("bold");
  sh.getRange("D4").setValue("Stamps by hour").setFontWeight("bold");
  sh.getRange("D5").setFormula("=IFERROR(QUERY(Log!D2:G, \"select G, count(D) where D = 'stamp' group by G order by G label G 'Hour', count(D) 'Stamps'\", 0), \"No stamps yet\")");
  sh.getRange("G4").setValue("Free drinks by drink").setFontWeight("bold");
  sh.getRange("G5").setFormula("=IFERROR(QUERY(Log!D2:H, \"select H, count(D) where D = 'free_drink' and H <> '' group by H order by count(D) desc label H 'Drink', count(D) 'Free drinks'\", 0), \"None yet\")");
  sh.setColumnWidth(1, 300);
  sh.setColumnWidth(7, 200);
}

// ---------------------------------------------------------------------------------------------------------
// Look of the sheet: the website's black-and-white style. Run styleSheets() from the editor any time; it only
// changes fonts, colours and sizes, never the data. setup() runs it too.
// ---------------------------------------------------------------------------------------------------------
var STYLE = {
  ink: "#161412", muted: "#5c5750", paper: "#f5f2ec", paper2: "#ece7df", line: "#cfc8bc", white: "#ffffff",
  sans: "Lexend", poster: "Archivo", mono: "Roboto Mono"
};

function styleSheets() {
  requireStaff_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  styleSummary_(ss.getSheetByName("Summary"));
  styleTable_(ss.getSheetByName("Cards"), CARD_HEADERS.length, [260, 80, 200, 120, 100, 200, 200, 150, 70, 110], [1, 8]);
  styleTable_(ss.getSheetByName("Log"), LOG_HEADERS.length, [140, 100, 120, 100, 110, 90, 70, 190, 100, 260], [3]);
  styleCardsRules_(ss.getSheetByName("Cards"));
  styleLogRules_(ss.getSheetByName("Log"));
}

// Cards and Log: black header bar, soft banded rows, code columns in a mono font, no gridlines.
function styleTable_(sh, cols, widths, monoCols) {
  if (!sh) return;
  var rows = sh.getMaxRows();
  sh.setTabColor(STYLE.ink);
  sh.setHiddenGridlines(true);
  sh.setFrozenRows(1);
  sh.getBandings().forEach(function (b) { b.remove(); });

  var all = sh.getRange(1, 1, rows, cols);
  all.setFontFamily(STYLE.sans).setFontSize(10).setFontColor(STYLE.ink).setVerticalAlignment("middle");
  monoCols.forEach(function (c) { sh.getRange(2, c, Math.max(rows - 1, 1), 1).setFontFamily(STYLE.mono); });

  var band = all.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  band.setHeaderRowColor(STYLE.ink).setFirstRowColor(STYLE.white).setSecondRowColor(STYLE.paper);

  var head = sh.getRange(1, 1, 1, cols);
  head.setFontFamily(STYLE.poster).setFontWeight("bold").setFontColor(STYLE.paper).setFontSize(10)
    .setHorizontalAlignment("left");
  sh.setRowHeight(1, 36);
  if (rows > 1) sh.setRowHeights(2, rows - 1, 26);
  all.setBorder(null, null, true, null, null, true, STYLE.line, SpreadsheetApp.BorderStyle.SOLID);
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
}

// Cards: a full card (10 stamps, waiting for its free drink) shows in black.
function styleCardsRules_(sh) {
  if (!sh) return;
  var range = sh.getRange("A2:J");
  var full = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=VALUE($B2)>=' + CARD_SIZE)
    .setBackground(STYLE.ink).setFontColor(STYLE.paper).setBold(true)
    .setRanges([range]).build();
  sh.setConditionalFormatRules([full]);
  sh.getRange("B2:B").setHorizontalAlignment("center");
  sh.getRange("E2:E").setHorizontalAlignment("center");
  sh.getRange("I2:I").setHorizontalAlignment("center");
}

// Log: free drinks in black, expired cards in grey italics, staff rescues and phone moves in bold, stamps plain.
function styleLogRules_(sh) {
  if (!sh) return;
  var range = sh.getRange("A2:J");
  var free = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$D2="free_drink"')
    .setBackground(STYLE.ink).setFontColor(STYLE.paper).setBold(true)
    .setRanges([range]).build();
  var expired = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$D2="expired"')
    .setFontColor(STYLE.muted).setItalic(true)
    .setRanges([range]).build();
  var staff = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=OR($D2="rescue", $D2="moved")')
    .setBackground(STYLE.paper2).setBold(true)
    .setRanges([range]).build();
  sh.setConditionalFormatRules([free, expired, staff]);
  sh.getRange("E2:G").setHorizontalAlignment("center");
  sh.getRange("I2:I").setHorizontalAlignment("center");
}

// Summary: a poster-style title, numbers in big bold type, small tables for hour and drink.
function styleSummary_(sh) {
  if (!sh) return;
  var ink = STYLE.ink, solid = SpreadsheetApp.BorderStyle.SOLID, thick = SpreadsheetApp.BorderStyle.SOLID_THICK;
  sh.setTabColor(ink);
  sh.setHiddenGridlines(true);
  var page = sh.getRange(1, 1, Math.max(sh.getMaxRows(), 40), Math.max(sh.getMaxColumns(), 9));
  page.setBackground(STYLE.paper).setFontFamily(STYLE.sans).setFontSize(10).setFontColor(ink)
    .setVerticalAlignment("middle").setBorder(false, false, false, false, false, false);

  sh.getRange("A1").setFontFamily(STYLE.poster).setFontSize(20).setFontWeight("bold");
  sh.getRange("A2").setFontColor(STYLE.muted).setFontStyle("italic");
  sh.setRowHeight(1, 44);
  sh.setRowHeights(4, 21, 30);

  // Key numbers, rows 4 to 15
  sh.getRange("A4:B15").setBackground(STYLE.white)
    .setBorder(true, true, true, true, null, true, ink, solid);
  sh.getRange("A4:B15").setBorder(true, true, true, true, null, null, ink, thick);
  sh.getRange("B4:B15").setFontFamily(STYLE.poster).setFontSize(14).setFontWeight("bold").setHorizontalAlignment("right");

  // Day of the week, rows 17 to 24
  sh.getRange("A17").setFontFamily(STYLE.poster).setFontSize(11).setFontWeight("bold");
  sh.getRange("A17:B17").setBorder(null, null, true, null, null, null, ink, thick);
  sh.getRange("A18:B24").setBackground(STYLE.white).setBorder(null, true, true, true, null, true, STYLE.line, solid);
  sh.getRange("B18:B24").setFontWeight("bold").setHorizontalAlignment("right");

  // Stamps by hour (D:E) and free drinks by drink (G:H): filled by QUERY, so style a fixed block of rows
  [["D4", "D5:E5", "D6:E28"], ["G4", "G5:H5", "G6:H28"]].forEach(function (t) {
    sh.getRange(t[0]).setFontFamily(STYLE.poster).setFontSize(11).setFontWeight("bold");
    sh.getRange(t[1]).setBackground(ink).setFontColor(STYLE.paper).setFontWeight("bold");
    sh.getRange(t[2]).setBorder(null, null, null, null, null, true, STYLE.line, solid);
  });
  sh.getRange("E5:E28").setHorizontalAlignment("right");
  sh.getRange("H5:H28").setHorizontalAlignment("right");

  sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 90); sh.setColumnWidth(3, 28);
  sh.setColumnWidth(4, 80);  sh.setColumnWidth(5, 80); sh.setColumnWidth(6, 28);
  sh.setColumnWidth(7, 200); sh.setColumnWidth(8, 100);
}

// ---------------------------------------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------------------------------------

// GET: the staff page (only for the owner's Google account), otherwise a plain status reply.
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (isStaff_()) return staffPage_(validCode_(p.card) ? p.card : "", validDevice_(p.d) ? p.d : "");
  return json_({ ok: true, service: "brew-addict-stamps" });
}

// POST from the website: the only public action is looking up a card by its code.
function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (req.action === "card") return json_(lookup_(req.card));
    return json_({ ok: false, error: "bad_request" });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: "server" });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function lookup_(code) {
  if (!validCode_(code)) return { ok: false, error: "bad_card" };
  var id = fingerprint_(code);
  if (!rateOk_(id)) return { ok: false, error: "busy", retry: 20 };
  var found = findCard_(cardsSheet_(), id);
  return { ok: true, card: view_(found ? found.data : blankCard_("")) };
}

// Counts public lookups for this minute in the script cache: per card, and for the whole public link.
// Over either limit, the lookup gets "busy" without reading the sheet. The counts are close, not exact (two
// lookups at the same moment can read the same count), which is fine for a limit.
function rateOk_(id) {
  var cache = CacheService.getScriptCache(), minute = Math.floor(Date.now() / 60000);
  var kCard = "rl:" + minute + ":" + id.slice(0, 16), kAll = "rl:" + minute + ":all";
  var got = cache.getAll([kCard, kAll]);
  var nCard = (Number(got[kCard]) || 0) + 1, nAll = (Number(got[kAll]) || 0) + 1;
  var put = {};
  put[kCard] = String(nCard);
  put[kAll] = String(nAll);
  cache.putAll(put, 120);
  return nCard <= LIMITS.perCard && nAll <= LIMITS.all;
}

// ---------------------------------------------------------------------------------------------------------
// Staff actions, called from the staff page with google.script.run. Each one checks the signed-in account.
// `dev` is the device tag from the customer's QR code (empty for QR codes made before tags existed).
// ---------------------------------------------------------------------------------------------------------
function staffCard(code, dev) {
  requireStaff_();
  if (!validCode_(code)) return { ok: false, error: "bad_card" };
  var found = findCard_(cardsSheet_(), fingerprint_(code));
  return { ok: true, card: staffView_(found ? found.data : blankCard_(""), dev) };
}

function staffStamp(code, dev) {
  requireStaff_();
  if (!validCode_(code)) return { ok: false, error: "bad_card" };
  return withLock_(function () {
    var sh = cardsSheet_(), id = fingerprint_(code);
    var found = findCard_(sh, id) || { row: 0, data: blankCard_(id) };
    var c = found.data, now = new Date(), today = todayStr_();
    var changed = expire_(c, now);
    var stop = movedTo_(c, dev) ? "moved" : c.stamps >= CARD_SIZE ? "full" : c.lastStampDate === today ? "today" : "";
    if (stop) { if (changed) saveCard_(sh, found); return { ok: false, error: stop, card: staffView_(c, dev) }; }
    bindDevice_(c, dev);
    if (c.stamps === 0) c.cardStart = now.toISOString();
    c.stamps += 1;
    c.lastStampDate = today;
    c.lastActivity = now.toISOString();
    saveCard_(sh, found);
    log_(now, id, "stamp", c.stamps, "", "", "");
    return { ok: true, card: staffView_(c, dev) };
  });
}

function staffFreeDrink(code, drink, dev) {
  requireStaff_();
  if (!validCode_(code)) return { ok: false, error: "bad_card" };
  drink = DRINKS.indexOf(drink) >= 0 ? drink : "";
  return withLock_(function () {
    var sh = cardsSheet_(), id = fingerprint_(code);
    var found = findCard_(sh, id);
    if (!found) return { ok: false, error: "not_full", card: staffView_(blankCard_(""), dev) };
    var c = found.data, now = new Date();
    if (movedTo_(c, dev)) return { ok: false, error: "moved", card: staffView_(c, dev) };
    if (c.stamps < CARD_SIZE) return { ok: false, error: "not_full", card: staffView_(c, dev) };
    var days = c.cardStart ? Math.max(0, Math.round((now - new Date(c.cardStart)) / 864e5)) : "";
    bindDevice_(c, dev);
    c.stamps = 0; c.cardStart = ""; c.freeDrinks += 1; c.lastActivity = now.toISOString();
    saveCard_(sh, found);
    log_(now, id, "free_drink", "", drink, days, "");
    return { ok: true, card: staffView_(c, dev) };
  });
}

// The card has turned up on a different phone and staff have checked with the customer: move it to this phone.
function staffConfirmMove(code, dev) {
  requireStaff_();
  if (!validCode_(code) || !validDevice_(dev)) return { ok: false, error: "bad_card" };
  return withLock_(function () {
    var sh = cardsSheet_(), id = fingerprint_(code);
    var found = findCard_(sh, id);
    if (!found) return { ok: true, card: staffView_(blankCard_(""), dev) };
    var c = found.data, now = new Date();
    if (!movedTo_(c, dev)) return { ok: true, card: staffView_(c, dev) };
    c.device = deviceTag_(dev); c.moves += 1; c.lastActivity = now.toISOString();
    saveCard_(sh, found);
    log_(now, id, "moved", view_(c).stamps, "", "", "Move " + c.moves + ", confirmed by staff");
    return { ok: true, card: staffView_(c, dev) };
  });
}

// A customer lost their card (no screenshot) and has started a new one: staff put their old stamps on it.
// Only on an empty card, once per card, RESCUES_PER_DAY a day for the whole cafe, with a reason in the log.
function staffRescue(code, count, reason, dev) {
  requireStaff_();
  if (!validCode_(code)) return { ok: false, error: "bad_card" };
  var n = Math.floor(Number(count));
  if (!(n >= 1 && n <= RESCUE_MAX)) return { ok: false, error: "bad_number" };
  var note = cleanNote_(reason);
  if (note.length < 3) return { ok: false, error: "need_reason" };
  return withLock_(function () {
    var sh = cardsSheet_(), id = fingerprint_(code);
    var found = findCard_(sh, id) || { row: 0, data: blankCard_(id) };
    var c = found.data, now = new Date(), today = todayStr_();
    var changed = expire_(c, now);
    var stop = movedTo_(c, dev) ? "moved" : c.rescued ? "rescued_before" : c.stamps > 0 ? "has_stamps" : "";
    var props = PropertiesService.getScriptProperties(), key = "rescues:" + today;
    var used = Number(props.getProperty(key)) || 0;
    if (!stop && used >= RESCUES_PER_DAY) stop = "rescue_limit";
    if (stop) { if (changed && found.row) saveCard_(sh, found); return { ok: false, error: stop, card: staffView_(c, dev) }; }
    props.setProperty(key, String(used + 1));
    bindDevice_(c, dev);
    c.stamps = n; c.cardStart = now.toISOString(); c.rescued = today; c.lastActivity = now.toISOString();
    saveCard_(sh, found);
    log_(now, id, "rescue", n, "", "", note);
    return { ok: true, card: staffView_(c, dev) };
  });
}

function staffSummary() {
  requireStaff_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Summary");
  if (!sh) return { ok: false };
  var v = sh.getRange("A4:B15").getDisplayValues();
  return { ok: true, rows: v.filter(function (r) { return r[0]; }) };
}

function staffDrinks() { requireStaff_(); return DRINKS; }

// ---------------------------------------------------------------------------------------------------------
// Nightly clean-up (time trigger made by setup): clears expired cards and deletes long-unused ones.
// Runs for the trigger, or for the owner from the editor; nobody else.
// ---------------------------------------------------------------------------------------------------------
function housekeeping(e) {
  if (!fromOwnTrigger_(e)) requireStaff_();
  withLock_(function () {
    var sh = cardsSheet_(), now = new Date();
    var values = sh.getDataRange().getValues();
    var cutoff = now.getTime() - KEEP_DAYS * 864e5;
    for (var r = values.length - 1; r >= 1; r--) {
      var found = { row: r + 1, data: toCard_(values[r]) };
      var c = found.data;
      var last = c.lastActivity ? new Date(c.lastActivity).getTime() : 0;
      if (last && last < cutoff) { sh.deleteRow(r + 1); continue; }
      if (expire_(c, now)) saveCard_(sh, found);
    }
    // Rescue counters are only needed for their own day
    var props = PropertiesService.getScriptProperties(), keep = "rescues:" + todayStr_();
    props.getKeys().forEach(function (k) { if (k.indexOf("rescues:") === 0 && k !== keep) props.deleteProperty(k); });
  });
}

// True only when a real trigger of this project called the function (a trigger passes its own id).
function fromOwnTrigger_(e) {
  var uid = e && e.triggerUid;
  if (!uid) return false;
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === String(uid); });
}

// ---------------------------------------------------------------------------------------------------------
// Card rules
// ---------------------------------------------------------------------------------------------------------
function expiryOf_(c) {
  if (!c.cardStart) return null;
  var d = new Date(c.cardStart);
  d.setMonth(d.getMonth() + 1);
  return d;
}

// Clears an unfinished card once its month is up and logs it. Returns true if it changed the card.
function expire_(c, now) {
  var end = expiryOf_(c);
  if (c.stamps > 0 && c.stamps < CARD_SIZE && end && now >= end) {
    if (c.id) log_(now, c.id, "expired", c.stamps, "", "", "");
    c.stamps = 0; c.cardStart = "";
    return true;
  }
  return false;
}

// What the customer's card and the staff page show. An expired card shows as empty without being saved.
function view_(c) {
  var stamps = c.stamps, end = expiryOf_(c);
  if (stamps > 0 && stamps < CARD_SIZE && end && new Date() >= end) { stamps = 0; end = null; }
  return {
    stamps: stamps,
    size: CARD_SIZE,
    expires: stamps > 0 && stamps < CARD_SIZE && end ? end.toISOString() : null,
    stampedToday: c.lastStampDate === todayStr_(),
    freeDrinks: c.freeDrinks
  };
}

// The staff page also sees whether the card has moved phones and whether a lost-card rescue is allowed.
function staffView_(c, dev) {
  var v = view_(c);
  v.moved = movedTo_(c, dev);
  v.moves = c.moves;
  v.canRescue = v.stamps === 0 && !c.rescued;
  return v;
}

// A card remembers the phone that got its stamps. A QR code from another phone means the card was copied over.
function movedTo_(c, dev) { return !!(c.device && validDevice_(dev) && deviceTag_(dev) !== c.device); }
function bindDevice_(c, dev) { if (!c.device && validDevice_(dev)) c.device = deviceTag_(dev); }

// ---------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------

// The signed-in Google account must be the account that owns this script.
function isStaff_() {
  var me = Session.getEffectiveUser().getEmail();
  var active = Session.getActiveUser().getEmail();
  return !!me && !!active && active === me;
}
function requireStaff_() { if (!isStaff_()) throw new Error("Staff only. Open the staff page signed in to the cafe Google account."); }

// Card codes are 22 random URL-safe characters (128 bits) made on the customer's phone
function validCode_(code) { return typeof code === "string" && /^[A-Za-z0-9_-]{22}$/.test(code); }
// Device tags are 12 random URL-safe characters, one per phone (or per browser on a phone)
function validDevice_(dev) { return typeof dev === "string" && /^[A-Za-z0-9_-]{12}$/.test(dev); }
function deviceTag_(dev) { return fingerprint_("device:" + dev).slice(0, 16); }

// Staff-typed notes go in the log as plain text: one line, short, and never read as a formula
function cleanNote_(s) {
  var t = String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

// One-way fingerprint: the sheet never holds the code itself, so a copy of the sheet can't be used to stamp cards
function fingerprint_(code) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "brew-addict:" + code, Utilities.Charset.UTF_8)
    .map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join("").slice(0, 32);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function cardsSheet_() { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Cards"); }

function blankCard_(id) {
  return { id: id, stamps: 0, cardStart: "", lastStampDate: "", freeDrinks: 0, createdAt: new Date().toISOString(), lastActivity: "",
    device: "", moves: 0, rescued: "" };
}

function toCard_(r) {
  return { id: String(r[0]), stamps: Number(r[1]) || 0, cardStart: String(r[2] || ""), lastStampDate: String(r[3] || ""),
    freeDrinks: Number(r[4]) || 0, createdAt: String(r[5] || ""), lastActivity: String(r[6] || ""),
    device: String(r[7] || ""), moves: Number(r[8]) || 0, rescued: String(r[9] || "") };
}

function findCard_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return null;
  var cell = sh.getRange(2, 1, last - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  if (!cell) return null;
  var row = cell.getRow();
  return { row: row, data: toCard_(sh.getRange(row, 1, 1, CARD_HEADERS.length).getValues()[0]) };
}

function saveCard_(sh, found) {
  var c = found.data;
  var vals = [[c.id, String(c.stamps), c.cardStart, c.lastStampDate, String(c.freeDrinks), c.createdAt, c.lastActivity,
    c.device, String(c.moves), c.rescued]];
  if (found.row) sh.getRange(found.row, 1, 1, CARD_HEADERS.length).setValues(vals);
  else { sh.appendRow(vals[0]); found.row = sh.getLastRow(); }
}

function log_(now, id, event, stampNumber, drink, days, note) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log").appendRow([
    now, Utilities.formatDate(now, TZ, "yyyy-MM-dd"), id.slice(0, 12), event, stampNumber,
    Utilities.formatDate(now, TZ, "EEE"), Number(Utilities.formatDate(now, TZ, "H")), drink, days, note || ""
  ]);
}

function todayStr_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }

// ---------------------------------------------------------------------------------------------------------
// Monthly report: the "Stamp card" menu in the sheet. "Monthly report…" builds a tab for one month from the
// Log tab, and "Save report as PDF" puts the open report tab in Google Drive as a PDF. The numbers are written as
// plain values, so a report never changes after it is made (make it again to refresh it). Owner only.
// ---------------------------------------------------------------------------------------------------------
var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December"];
var REPORT_FOLDER = "Brew Addict stamp reports";

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Stamp card")
    .addItem("Monthly report…", "monthlyReport")
    .addItem("Save report as PDF", "saveReportPdf")
    .addToUi();
}

function monthlyReport() {
  requireStaff_();
  var ui = SpreadsheetApp.getUi();
  var last = new Date();
  last.setDate(1); last.setMonth(last.getMonth() - 1);
  var suggest = Utilities.formatDate(last, TZ, "yyyy-MM");
  var res = ui.prompt("Monthly report", "Which month? Type it like " + suggest + ". Leave empty for " +
    MONTHS[Number(suggest.slice(5)) - 1] + " " + suggest.slice(0, 4) + ".", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var ym = res.getResponseText().trim() || suggest;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) { ui.alert("Please type the month like " + suggest + "."); return; }
  var sh = buildReport_(ym);
  sh.activate();
  ui.alert("Report ready", "To get a PDF: Stamp card menu → Save report as PDF.", ui.ButtonSet.OK);
}

function saveReportPdf() {
  requireStaff_();
  var ui = SpreadsheetApp.getUi(), ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getActiveSheet();
  if (sh.getName().indexOf("Report ") !== 0) {
    ui.alert("Open a report tab first (make one with Stamp card → Monthly report…).");
    return;
  }
  SpreadsheetApp.flush();
  var url = "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?format=pdf&gid=" + sh.getSheetId() +
    "&size=A4&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenum=CENTER" +
    "&top_margin=0.5&bottom_margin=0.5&left_margin=0.5&right_margin=0.5";
  var resp = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) { ui.alert("Couldn't make the PDF (error " + resp.getResponseCode() + "). Try again in a minute."); return; }
  var folders = DriveApp.getFoldersByName(REPORT_FOLDER);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(REPORT_FOLDER);
  var name = "Brew Addict stamp " + sh.getName().toLowerCase() + ".pdf";
  var old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);   // one PDF per month: a new one replaces the old
  var file = folder.createFile(resp.getBlob().setName(name));
  var link = HtmlService.createHtmlOutput('<p style="font:15px/1.5 sans-serif">Saved in Google Drive, folder "' +
    REPORT_FOLDER + '".</p><p style="font:15px/1.5 sans-serif"><a href="' + file.getUrl() + '" target="_blank">Open the PDF</a></p>')
    .setWidth(360).setHeight(140);
  ui.showModalDialog(link, "PDF saved");
}

// Everything the report shows for one month ("yyyy-MM"), worked out from the rows of the Log tab
function reportData_(rows, ym) {
  var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  var daysIn = new Date(y, m, 0).getDate();
  var d = {
    stamps: 0, free: 0, full: 0, expired: 0, lostToExpiry: 0, rescues: 0, rescuedStamps: 0, moves: 0,
    newMembers: 0, active: 0, avgFill: "-", days: [], drinks: [], weekdays: [], hours: [], rescueList: [], moveList: []
  };
  var firstStamp = {}, activeSet = {}, fill = [], byDay = {}, byDrink = {}, byWeekday = {}, byHour = {};
  rows.forEach(function (r) {
    var date = dateKey_(r[1]), card = String(r[2]), ev = String(r[3]);
    if (ev === "stamp" && (!firstStamp[card] || date < firstStamp[card])) firstStamp[card] = date;
    if (date.slice(0, 7) !== ym) return;
    var day = byDay[date] || (byDay[date] = { stamps: 0, free: 0 });
    if (ev === "stamp") {
      d.stamps++; day.stamps++; activeSet[card] = 1;
      if (Number(r[4]) === CARD_SIZE) d.full++;
      byWeekday[r[5]] = (byWeekday[r[5]] || 0) + 1;
      byHour[Number(r[6])] = (byHour[Number(r[6])] || 0) + 1;
    } else if (ev === "free_drink") {
      d.free++; day.free++;
      var drink = String(r[7] || "") || "Not picked";
      byDrink[drink] = (byDrink[drink] || 0) + 1;
      if (r[8] !== "" && r[8] != null && !isNaN(Number(r[8]))) fill.push(Number(r[8]));
    } else if (ev === "expired") {
      d.expired++; d.lostToExpiry += Number(r[4]) || 0;
    } else if (ev === "rescue") {
      d.rescues++; d.rescuedStamps += Number(r[4]) || 0;
      d.rescueList.push([timeText_(r[0]), card, Number(r[4]) || 0, String(r[9] || "")]);
    } else if (ev === "moved") {
      d.moves++;
      d.moveList.push([timeText_(r[0]), card, Number(r[4]) || 0, String(r[9] || "")]);
    }
  });
  Object.keys(firstStamp).forEach(function (c) { if (firstStamp[c].slice(0, 7) === ym) d.newMembers++; });
  d.active = Object.keys(activeSet).length;
  if (fill.length) d.avgFill = Math.round(fill.reduce(function (a, b) { return a + b; }, 0) / fill.length * 10) / 10;
  var wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (var i = 1; i <= daysIn; i++) {
    var key = ym + "-" + ("0" + i).slice(-2), v = byDay[key] || { stamps: 0, free: 0 };
    d.days.push([key, wd[new Date(y, m - 1, i).getDay()], v.stamps, v.free]);
  }
  d.drinks = Object.keys(byDrink).map(function (k) { return [k, byDrink[k]]; })
    .sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
  d.weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(function (k) { return [k, byWeekday[k] || 0]; });
  d.hours = Object.keys(byHour).map(Number).sort(function (a, b) { return a - b; })
    .map(function (h) { return [hourText_(h), byHour[h]]; });
  return d;
}

function dateKey_(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  return String(v || "").slice(0, 10);
}
function timeText_(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") return Utilities.formatDate(v, TZ, "d MMM, h:mm a");
  return String(v || "");
}
function hourText_(h) { return (h % 12 || 12) + (h < 12 ? " AM" : " PM"); }

// Writes the report tab: four columns wide so it prints on one A4 page width
function buildReport_(ym) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = ss.getSheetByName("Log");
  var rows = log.getLastRow() > 1 ? log.getRange(2, 1, log.getLastRow() - 1, LOG_HEADERS.length).getValues() : [];
  var d = reportData_(rows, ym);
  var title = MONTHS[Number(ym.slice(5)) - 1] + " " + ym.slice(0, 4);
  var name = "Report " + ym;
  var sh = ss.getSheetByName(name);
  if (sh) sh.clear(); else sh = ss.insertSheet(name, ss.getSheets().length);
  sh.getBandings().forEach(function (b) { b.remove(); });
  sh.setConditionalFormatRules([]);

  var out = [], heads = [], subs = [];
  function row(a, b, c, e) { out.push([a == null ? "" : a, b == null ? "" : b, c == null ? "" : c, e == null ? "" : e]); }
  function head(t) { row(""); heads.push(out.length + 1); row(t); }
  function sub(cols) { subs.push(out.length + 1); row(cols[0], cols[1], cols[2], cols[3]); }

  row("BREW ADDICT · STAMP CARD REPORT");
  row(title);
  row("Made " + Utilities.formatDate(new Date(), TZ, "d MMMM yyyy, h:mm a") + ", from the Log tab.");
  head("The month in numbers");
  [["Stamps given", d.stamps], ["New members (first stamp this month)", d.newMembers],
   ["Active members (at least 1 stamp)", d.active], ["Free drinks given", d.free],
   ["Cards that reached 10 stamps", d.full], ["Average days to fill a card", d.avgFill],
   ["Cards that expired unfinished", d.expired], ["Stamps lost to expiry", d.lostToExpiry],
   ["Lost-card rescues by staff", d.rescues], ["Stamps given by rescues", d.rescuedStamps],
   ["Cards moved to a new phone", d.moves]].forEach(function (x) { row(x[0], "", "", x[1]); });
  var numbersEnd = out.length;

  head("Day by day");
  sub(["Date", "Day", "Stamps", "Free drinks"]);
  var daysStart = out.length + 1;
  d.days.forEach(function (x) { row(x[0], x[1], x[2], x[3]); });
  row("Total", "", d.stamps, d.free);
  var daysTotal = out.length;

  head("Stamps by day of the week");
  d.weekdays.forEach(function (x) { row(x[0], "", "", x[1]); });
  head("Stamps by hour");
  if (d.hours.length) d.hours.forEach(function (x) { row(x[0], "", "", x[1]); }); else row("No stamps this month");
  head("Free drinks by drink");
  if (d.drinks.length) d.drinks.forEach(function (x) { row(x[0], "", "", x[1]); }); else row("No free drinks this month");

  head("Lost-card rescues (check these)");
  if (d.rescueList.length) { sub(["When", "Card", "Stamps", "Reason"]); d.rescueList.forEach(function (x) { row(x[0], x[1], x[2], x[3]); }); }
  else row("None this month");
  head("Cards moved to a new phone");
  if (d.moveList.length) { sub(["When", "Card", "Stamps", "Note"]); d.moveList.forEach(function (x) { row(x[0], x[1], x[2], x[3]); }); }
  else row("None this month");

  var range = sh.getRange(1, 1, out.length, 4);
  // Numbers stay numbers (so the Excel download adds up). Text gets a leading ' so Sheets never turns it into a date
  range.setValues(out.map(function (r) {
    return r.map(function (v) { return typeof v === "number" || v === "" ? v : "'" + String(v).replace(/^'/, ""); });
  }));

  // Look: the website's black-and-white style
  sh.setHiddenGridlines(true);
  sh.setTabColor(STYLE.ink);
  range.setFontFamily(STYLE.sans).setFontSize(10).setFontColor(STYLE.ink).setVerticalAlignment("middle").setWrap(true);
  sh.getRange("A1").setFontFamily(STYLE.poster).setFontSize(16).setFontWeight("bold");
  sh.getRange("A2").setFontFamily(STYLE.poster).setFontSize(22).setFontWeight("bold");
  sh.getRange("A3").setFontColor(STYLE.muted).setFontStyle("italic");
  heads.forEach(function (r) {
    sh.getRange(r, 1, 1, 4).setFontFamily(STYLE.poster).setFontSize(12).setFontWeight("bold")
      .setBorder(null, null, true, null, null, null, STYLE.ink, SpreadsheetApp.BorderStyle.SOLID_THICK);
  });
  subs.forEach(function (r) { sh.getRange(r, 1, 1, 4).setBackground(STYLE.ink).setFontColor(STYLE.paper).setFontWeight("bold"); });
  sh.getRange(heads[0] + 1, 4, numbersEnd - heads[0], 1).setFontFamily(STYLE.poster).setFontSize(13).setFontWeight("bold");
  sh.getRange(daysStart, 1, daysTotal - daysStart + 1, 4)
    .setBorder(null, null, null, null, null, true, STYLE.line, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(daysTotal, 1, 1, 4).setFontWeight("bold")
    .setBorder(true, null, null, null, null, null, STYLE.ink, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(1, 2, out.length, 3).setHorizontalAlignment("right");
  subs.forEach(function (r) { if (sh.getRange(r, 4).getValue() === "Reason" || sh.getRange(r, 4).getValue() === "Note") sh.getRange(r, 4).setHorizontalAlignment("left"); });
  sh.setColumnWidth(1, 260); sh.setColumnWidth(2, 110); sh.setColumnWidth(3, 90); sh.setColumnWidth(4, 220);
  return sh;
}

// ---------------------------------------------------------------------------------------------------------
// The staff page
// ---------------------------------------------------------------------------------------------------------
function staffPage_(code, dev) {
  var html = HtmlService.createHtmlOutput(STAFF_HTML_.replace("__CARD__", JSON.stringify(code)).replace("__DEV__", JSON.stringify(dev)))
    .setTitle("Brew Addict staff")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
  return html;
}

var STAFF_HTML_ = [
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><base target="_top">',
  '<style>',
  ':root{--ink:#161412;--muted:#5c5750;--paper:#f5f2ec;--line:#cfc8bc}',
  '*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}',
  '.wrap{max-width:460px;margin:0 auto;padding:20px 16px 40px}',
  'h1{font:800 22px/1.1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.02em;margin:0 0 4px}',
  '.sub{color:var(--muted);margin:0 0 20px;font-size:14px}',
  '.card{border:2.5px solid var(--ink);border-radius:20px;padding:18px;background:#fff;box-shadow:5px 5px 0 var(--ink)}',
  '.dots{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:4px 0 14px}',
  '.dot{aspect-ratio:1;border-radius:50%;border:2px dashed var(--line);display:grid;place-items:center;font-weight:800;color:var(--muted)}',
  '.dot.on{border:2.5px solid var(--ink);background:var(--ink);color:var(--paper)}',
  '.count{font:800 26px/1 system-ui,sans-serif;margin:0 0 6px}',
  '.note{color:var(--muted);margin:6px 0 0;font-size:15px}',
  'button,select,input{font:inherit}',
  '.btn{display:block;width:100%;margin-top:16px;padding:16px;border:2.5px solid var(--ink);border-radius:999px;background:var(--ink);color:var(--paper);font-weight:800;font-size:18px;cursor:pointer}',
  '.btn--line{background:#fff;color:var(--ink)}',
  '.btn:disabled{opacity:.4}',
  'select,input{width:100%;margin-top:14px;padding:12px;border:2px solid var(--ink);border-radius:12px;background:#fff;color:var(--ink)}',
  '.done{margin-top:16px;padding:14px;border-radius:14px;background:var(--ink);color:var(--paper);font-weight:700;font-size:18px}',
  '.warn{margin-top:16px;padding:14px;border-radius:14px;border:2px solid var(--ink);font-weight:700}',
  '.warn .note{font-weight:400;margin-top:8px}',
  'details{margin-top:22px;border-top:1px solid var(--line);padding-top:14px}summary{cursor:pointer;font-weight:700}',
  'table{width:100%;border-collapse:collapse;font-size:15px}td{padding:8px 0;border-bottom:1px solid var(--line)}td:last-child{text-align:right;font-weight:700}',
  '.busy{opacity:.5;pointer-events:none}',
  '</style></head><body><div class="wrap">',
  '<h1>Brew Addict staff</h1><p class="sub" id="sub">Stamp card</p><div id="app"><p class="note">Loading…</p></div>',
  '</div><script>',
  'var CARD=__CARD__,DEV=__DEV__,SIZE=10,app=document.getElementById("app"),drinks=[];',
  'function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]})}',
  'function call(fn,args,done){app.classList.add("busy");var r=google.script.run.withSuccessHandler(function(x){app.classList.remove("busy");done(x)}).withFailureHandler(function(e){app.classList.remove("busy");app.innerHTML="<p class=warn>"+esc(e.message||e)+"</p>"});r[fn].apply(r,args)}',
  'var MSG={full:"This card is full. Give the free drink.",today:"This card already has today\'s stamp. One stamp a day.",not_full:"This card doesn\'t have 10 stamps yet.",bad_card:"That QR code isn\'t a Brew Addict card.",',
  'moved:"This card is on a different phone now. Check with the customer first.",rescued_before:"This card already got stamps from a lost card once.",has_stamps:"Stamps can only be moved to an empty card.",',
  'rescue_limit:"Today\'s lost-card rescues are used up (3 a day). Ask the owner, or try again tomorrow.",need_reason:"Write a short reason first.",bad_number:"Pick how many stamps they had."};',
  'function err(r){return MSG[r&&r.error]||"Something went wrong."}',
  'function $(id){return document.getElementById(id)}',
  // done: the action for this scan is finished, so no more buttons (scan the next card)
  'function show(card,msg,ok,done){var h="<div class=card><div class=dots>";for(var i=0;i<SIZE;i++)h+="<div class=\\"dot"+(i<card.stamps?" on":"")+"\\">"+(i+1)+"</div>";',
  'h+="</div><p class=count>"+card.stamps+" of "+SIZE+" stamps</p>";',
  'if(card.expires)h+="<p class=note>Card ends "+new Date(card.expires).toLocaleDateString("en-GB",{day:"numeric",month:"long"})+"</p>";',
  'if(card.freeDrinks)h+="<p class=note>Free drinks so far: "+card.freeDrinks+"</p>";',
  'if(msg)h+="<p class="+(ok?"done":"warn")+">"+esc(msg)+"</p>";',
  'if(card.moved){h+="<div class=warn>This card was used on a different phone before"+(card.moves?" (moved "+(card.moves>1?card.moves+" times":"once")+" before)":"")+".<p class=note>Ask the customer if it is their card, for example restored from their own screenshot. If you are not sure, don\'t move it. Moves are logged.</p></div><button class=btn id=move>Yes, it\'s theirs. Move card here</button>"}',
  'else if(done){}',
  'else if(card.stamps>=SIZE){h+="<select id=drink><option value=\\"\\">Which drink? (optional)</option>";drinks.forEach(function(d){h+="<option>"+esc(d)+"</option>"});h+="</select><button class=btn id=free>Give free drink</button>"}',
  'else{h+="<button class=btn id=stamp"+(card.stampedToday?" disabled":"")+">Add stamp</button>";if(card.stampedToday&&!msg)h+="<p class=note>Already stamped today. One stamp a day.</p>"}',
  'if(card.canRescue&&!card.moved&&!done){h+="<details><summary>Customer lost their old card?</summary><p class=note>If a regular lost their card and had no screenshot, you can put their old stamps on this new card. Once per card, 3 a day for the cafe. The reason goes in the log.</p><select id=rn><option value=\\"\\">How many stamps did they have?</option>";',
  'for(var n=1;n<SIZE;n++)h+="<option>"+n+"</option>";h+="</select><input id=rr maxlength=120 placeholder=\\"Reason, e.g. phone was reset\\"><button class=\\"btn btn--line\\" id=rescue>Move stamps to this card</button></details>"}',
  'h+="</div><p class=note style=\\"margin-top:20px\\">Scan the next card with this phone\'s camera.</p>";app.innerHTML=h;',
  'var s=$("stamp");if(s)s.onclick=function(){call("staffStamp",[CARD,DEV],function(r){if(r.ok)show(r.card,"Stamp added. "+r.card.stamps+" of "+SIZE+".",true,true);else show(r.card||card,err(r),false)})};',
  'var f=$("free");if(f)f.onclick=function(){call("staffFreeDrink",[CARD,$("drink").value,DEV],function(r){if(r.ok)show(r.card,"Free drink given. A new card has started.",true,true);else show(r.card||card,err(r),false)})};',
  'var m=$("move");if(m)m.onclick=function(){call("staffConfirmMove",[CARD,DEV],function(r){if(r.ok)show(r.card,"Card moved to this phone. You can stamp it now.",true);else show(r.card||card,err(r),false)})};',
  'var q=$("rescue");if(q)q.onclick=function(){var n=$("rn").value,why=$("rr").value.trim();if(!n){show(card,MSG.bad_number,false);return}if(why.length<3){show(card,MSG.need_reason,false);return}',
  'if(!confirm("Put "+n+" stamps on this card? This is logged with your reason."))return;call("staffRescue",[CARD,n,why,DEV],function(r){if(r.ok)show(r.card,"Moved "+r.card.stamps+" stamps to this card. You can add today\'s stamp too.",true);else show(r.card||card,err(r),false)})}}',
  'function summary(){call("staffSummary",[],function(r){var h="<div class=card><p class=note style=\\"margin-top:0\\">To stamp a card, scan the customer\'s QR code with this phone\'s camera.</p></div><h1 style=\\"margin-top:28px;font-size:18px\\">Numbers</h1><table>";',
  '(r.rows||[]).forEach(function(x){h+="<tr><td>"+esc(x[0])+"</td><td>"+esc(x[1])+"</td></tr>"});app.innerHTML=h+"</table><p class=note>More detail is in the Summary tab of the Google Sheet.</p>"})}',
  'if(CARD){call("staffDrinks",[],function(d){drinks=d||[];call("staffCard",[CARD,DEV],function(r){if(r.ok)show(r.card);else app.innerHTML="<p class=warn>"+esc(err(r))+"</p>"})})}else summary();',
  '</script></body></html>'
].join("\n");
