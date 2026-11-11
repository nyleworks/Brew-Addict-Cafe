# Stamp card setup

The stamp card needs no sign-up. Each customer's phone gets a card that is a random code, shown as a QR code.
After paying, the customer shows the QR code and staff scan it with the cafe phone. That opens the **staff page**,
where staff tap **Add stamp** or **Give free drink**. The customer's card updates within a few seconds.

- 10 stamps = one free drink of any kind. One stamp per card per day (Kundasang time).
- A card lasts one month from its first stamp. If it isn't full by then, it clears and starts again.
- No names or phone numbers are collected. The Google Sheet keeps only a scrambled copy of each card code
  (it can't be turned back into the code), the stamp count and dates.
- Cards with no activity for 6 months are deleted automatically every night.
- The card lives on the customer's phone, so right after their first stamp the website shows a full-screen
  **Save your card** page (screenshot, copy the card link, or add to home screen). A reminder stays on the card
  until the customer taps **I saved it**.

Until the setup below is done, the website runs the card in **preview mode**: it's saved on that phone only,
and buttons pretend to be the staff.

## Before you start

Use the cafe's own Google account, and turn on **2-Step Verification** for it
(Google Account → Security → 2-Step Verification). This account is the only one that can stamp cards.

## One-time setup (about 15 minutes)

1. Create a new Google Sheet in the cafe Google account, for example "Brew Addict stamp cards".
2. In the sheet: **Extensions → Apps Script**. Delete what's there, paste all of the code from
   [The code to paste](#the-code-to-paste) at the end of this page, and save.
3. Choose **setup** in the function menu at the top and press **Run**. Allow the permissions it asks for.
   This makes the Summary, Cards and Log tabs and a nightly clean-up.
4. **Deploy → New deployment → Web app** with *Execute as*: **Me** and *Who has access*: **Anyone**.
   Deploy and copy the URL (it ends in `/exec`). This is the **public link**: it can only look up a card's stamps.
5. **Deploy → New deployment → Web app** again, this time with *Who has access*: **Only myself**.
   Copy this URL too. This is the **staff link**.
6. Send both links to Claude, or paste them into `stamp-card.js` as `STAMP_API` (public) and `STAFF_URL` (staff).

## Setting up the cafe phone

1. In the phone's browser, sign in to the cafe Google account, and make sure it is the **only** Google account
   signed in to that browser (Google's staff pages get confused by several accounts).
2. Open the website with `#staff-phone=on` at the end, for example
   `https://nyleworks.github.io/Brew-Addict-Cafe/#staff-phone=on`. The card will say this phone is now the staff phone.
3. Open the staff link once and bookmark it. It shows the numbers from the Summary tab.
4. Test it: open the stamp card on your own phone, scan its QR code with the cafe phone's camera, and tap **Add stamp**.

To stop a phone being the staff phone, open the website with `#staff-phone=off`.
If the cafe phone is lost, sign it out from the cafe Google account (Google Account → Security → Your devices).
Without that sign-in, nobody can stamp cards, even if they have the phone.

## The numbers

The **Summary** tab updates by itself: members, active members in the last 30 days, stamps this week and month,
free drinks given, cards that reached 10, cards that expired, average days to fill a card, busiest days and hours,
and which drinks people take free. Counts are close but not exact: a customer whose phone lost their card and
who had no screenshot shows up as two cards.

## Helping a customer at the counter

**"This card was used on a different phone before."** Every phone puts a random tag in its QR code, and a card
remembers the phone that got its stamps. If the card turns up on another phone (the customer restored it from a
screenshot, or someone copied their QR code), the staff page asks before stamping. Ask the customer if it's their
card. If yes, tap **Yes, it's theirs. Move card here**. The move is logged, and the Summary counts moves this month.
If you're not sure, don't move it. Cards from before this update have no tag yet; they get one at their next stamp.

**A regular lost their card and has no screenshot.** Their old stamps can't be found (the sheet has no names), so
let them start a new card, scan it, open **Customer lost their old card?**, pick how many stamps they had and write
a short reason. Limits: 1 to 9 stamps, only on an empty card, once per card, and 3 a day for the whole cafe. Each one
is logged with the reason, and the Summary counts them per month. You can still add today's stamp afterwards.

## Limits and safety

- **Public link limit.** The website asks the public link for a card's stamps every 3 seconds while the card is
  open. Each card may ask 40 times a minute, and the whole link 1,200 times a minute. Past that, the link answers
  "busy" straight away without opening the sheet, and the card waits 20 seconds before asking again. The counts
  are kept in Apps Script's cache, so they are close, not exact.
- **What the limit doesn't cover.** Google runs at most about 30 copies of the script at once for one account. A
  flood of requests can still fill those, and then the staff page waits too. The limit makes each extra request
  very short, which helps, but it isn't a wall. If that ever happens, the fix is to put the public link on a second
  Google account or behind a small proxy.
- **Owner only.** `setup`, `styleSheets` and `housekeeping` refuse to run for anyone but the cafe account (or the
  nightly trigger). Every staff action checks the signed-in account too.
- **Website lock-down.** `index.html` has a Content Security Policy: the page only runs its own scripts, loads
  fonts from Google Fonts, and only talks to Google Apps Script. If you add something from another site later (a
  map, an analytics script), add its address to that line or it will be blocked.
- **A QR code is like a paper card.** Anyone holding a copy can show it. The phone tag makes a copy stand out to
  staff, but someone determined could copy the tag too. Staff checking is the real guard.

## Updating to this version (November 2026)

1. Open the sheet → **Extensions → Apps Script**, replace all the code with the code at the end of this page, save.
2. Choose **setup** in the function menu and press **Run**. It adds the new columns (device, moves, rescued, note)
   and two new Summary rows. Cards and the Log are not touched.
3. **Deploy → Manage deployments**. Edit the **public** deployment → *Version*: **New version** → Deploy. Then do
   the same for the **staff** deployment. The links stay the same.
4. Publish the website files (`index.html`, `stamp-card.js`, `styles.css`).
5. Test: open the card on your phone, scan it with the cafe phone, add a stamp. Your phone should show the
   **Save your card** page.

## The look of the sheet

The sheet uses the website's black-and-white style: black header bars, soft striped rows, Lexend and Archivo
fonts, no gridlines. In the Cards tab a full card (10 stamps, waiting for its free drink) shows in black. In the
Log tab free drinks show in black and expired cards in grey italics.

**setup** applies this for you. If your sheet was made before this was added (or the look gets messed up):
1. Open the sheet → **Extensions → Apps Script**, replace the code with the new code at the end of this page, save.
2. Choose **styleSheets** in the function menu and press **Run**. It only changes the look, never the data.

This doesn't change the website, so you don't need to update the deployments for it. If Lexend or Archivo show up
as Arial, add them once from the sheet's font menu: **Font → More fonts**, search for each and press OK.

## Good to know

- If you change `Code.gs` later, update **both** deployments: **Deploy → Manage deployments → Edit → New version**,
  so the links stay the same.
- Please don't type in the Cards or Log tabs. To fix a mistake, ask Claude.

## The code to paste

Copy everything inside the box below, from the first line `/**` to the last line `].join("\n");`.
The same code is in `apps-script/Code.gs`; if you change one, change the other.

```javascript
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
```
