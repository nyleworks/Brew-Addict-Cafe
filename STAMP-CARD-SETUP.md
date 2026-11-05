# Stamp card setup

The stamp card needs no sign-up. Each customer's phone gets a card that is a random code, shown as a QR code.
After paying, the customer shows the QR code and staff scan it with the cafe phone. That opens the **staff page**,
where staff tap **Add stamp** or **Give free drink**. The customer's card updates within a few seconds.

- 10 stamps = one free drink of any kind. One stamp per card per day (Kundasang time).
- A card lasts one month from its first stamp. If it isn't full by then, it clears and starts again.
- No names or phone numbers are collected. The Google Sheet keeps only a scrambled copy of each card code
  (it can't be turned back into the code), the stamp count and dates.
- Cards with no activity for 6 months are deleted automatically every night.

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
 *   update live.
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

// Drinks staff can pick when giving a free drink (from the menu on the website)
var DRINKS = ["Brew Addict Signature", "Americano", "Caffe Latte", "Spanish Latte", "Vanilla Latte", "Hazelnut Latte",
  "Caramel Macchiato", "Cocoa Royale", "Matcha Strawberry", "Matcha Blossom", "Matcha Mango", "Matcha Latte",
  "Matcha Cloud", "Jasmine Tea", "Pink Soda"];

var CARD_HEADERS = ["card", "stamps", "cardStart", "lastStampDate", "freeDrinks", "createdAt", "lastActivity"];
var LOG_HEADERS = ["time", "date", "card", "event", "stampNumber", "weekday", "hour", "drink", "daysToFill"];

// ---------------------------------------------------------------------------------------------------------
// Run once from the editor: creates the tabs, the Summary formulas and the nightly clean-up.
// ---------------------------------------------------------------------------------------------------------
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  var cards = ensureSheet_(ss, "Cards", CARD_HEADERS);
  cards.getRange("A:G").setNumberFormat("@");          // codes and dates stay as text
  var log = ensureSheet_(ss, "Log", LOG_HEADERS);
  log.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
  log.getRange("B:D").setNumberFormat("@");
  log.getRange("F:F").setNumberFormat("@");
  log.getRange("H:H").setNumberFormat("@");
  buildSummary_(ss);

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "housekeeping") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("housekeeping").timeBased().everyDays(1).atHour(4).inTimezone(TZ).create();
  Logger.log("Done. Staff actions will only work for " + Session.getEffectiveUser().getEmail() + ".");
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sh;
}

function buildSummary_(ss) {
  var sh = ss.getSheetByName("Summary") || ss.insertSheet("Summary", 0);
  sh.clear();
  var since30 = 'Log!A2:A>=NOW()-30';
  var rows = [
    ["Brew Addict stamp card", ""],
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
    ["", ""],
    ["Stamps by day of the week", ""]
  ];
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (d) {
    rows.push([d, '=COUNTIFS(Log!D2:D, "stamp", Log!F2:F, "' + d + '")']);
  });
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange("A1").setFontSize(14).setFontWeight("bold");
  sh.getRange("A2").setFontColor("#5c5750");
  sh.getRange("A15").setFontWeight("bold");
  sh.getRange("D4").setValue("Stamps by hour").setFontWeight("bold");
  sh.getRange("D5").setFormula("=IFERROR(QUERY(Log!D2:G, \"select G, count(D) where D = 'stamp' group by G order by G label G 'Hour', count(D) 'Stamps'\", 0), \"No stamps yet\")");
  sh.getRange("G4").setValue("Free drinks by drink").setFontWeight("bold");
  sh.getRange("G5").setFormula("=IFERROR(QUERY(Log!D2:H, \"select H, count(D) where D = 'free_drink' and H <> '' group by H order by count(D) desc label H 'Drink', count(D) 'Free drinks'\", 0), \"None yet\")");
  sh.setColumnWidth(1, 300);
  sh.setColumnWidth(7, 200);
}

// ---------------------------------------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------------------------------------

// GET: the staff page (only for the owner's Google account), otherwise a plain status reply.
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (isStaff_()) return staffPage_(validCode_(p.card) ? p.card : "");
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
  var found = findCard_(cardsSheet_(), fingerprint_(code));
  return { ok: true, card: view_(found ? found.data : blankCard_(""), false) };
}

// ---------------------------------------------------------------------------------------------------------
// Staff actions, called from the staff page with google.script.run. Each one checks the signed-in account.
// ---------------------------------------------------------------------------------------------------------
function staffCard(code) {
  requireStaff_();
  if (!validCode_(code)) return { ok: false, error: "bad_card" };
  var found = findCard_(cardsSheet_(), fingerprint_(code));
  return { ok: true, card: view_(found ? found.data : blankCard_(""), false) };
}

function staffStamp(code) {
  requireStaff_();
  if (!validCode_(code)) return { ok: false, error: "bad_card" };
  return withLock_(function () {
    var sh = cardsSheet_(), id = fingerprint_(code);
    var found = findCard_(sh, id) || { row: 0, data: blankCard_(id) };
    var c = found.data, now = new Date(), today = todayStr_();
    expire_(c, now);
    if (c.stamps >= CARD_SIZE) { saveCard_(sh, found); return { ok: false, error: "full", card: view_(c, false) }; }
    if (c.lastStampDate === today) { saveCard_(sh, found); return { ok: false, error: "today", card: view_(c, false) }; }
    if (c.stamps === 0) c.cardStart = now.toISOString();
    c.stamps += 1;
    c.lastStampDate = today;
    c.lastActivity = now.toISOString();
    saveCard_(sh, found);
    log_(now, id, "stamp", c.stamps, "", "");
    return { ok: true, card: view_(c, false) };
  });
}

function staffFreeDrink(code, drink) {
  requireStaff_();
  if (!validCode_(code)) return { ok: false, error: "bad_card" };
  drink = DRINKS.indexOf(drink) >= 0 ? drink : "";
  return withLock_(function () {
    var sh = cardsSheet_(), id = fingerprint_(code);
    var found = findCard_(sh, id);
    if (!found) return { ok: false, error: "not_full", card: view_(blankCard_(""), false) };
    var c = found.data, now = new Date();
    if (c.stamps < CARD_SIZE) return { ok: false, error: "not_full", card: view_(c, false) };
    var days = c.cardStart ? Math.max(0, Math.round((now - new Date(c.cardStart)) / 864e5)) : "";
    c.stamps = 0; c.cardStart = ""; c.freeDrinks += 1; c.lastActivity = now.toISOString();
    saveCard_(sh, found);
    log_(now, id, "free_drink", "", drink, days);
    return { ok: true, card: view_(c, false) };
  });
}

function staffSummary() {
  requireStaff_();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Summary");
  if (!sh) return { ok: false };
  var v = sh.getRange("A4:B13").getDisplayValues();
  return { ok: true, rows: v.filter(function (r) { return r[0]; }) };
}

function staffDrinks() { requireStaff_(); return DRINKS; }

// ---------------------------------------------------------------------------------------------------------
// Nightly clean-up (time trigger made by setup): clears expired cards and deletes long-unused ones.
// ---------------------------------------------------------------------------------------------------------
function housekeeping() {
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
  });
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
    if (c.id) log_(now, c.id, "expired", c.stamps, "", "");
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
  return { id: id, stamps: 0, cardStart: "", lastStampDate: "", freeDrinks: 0, createdAt: new Date().toISOString(), lastActivity: "" };
}

function toCard_(r) {
  return { id: String(r[0]), stamps: Number(r[1]) || 0, cardStart: String(r[2] || ""), lastStampDate: String(r[3] || ""),
    freeDrinks: Number(r[4]) || 0, createdAt: String(r[5] || ""), lastActivity: String(r[6] || "") };
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
  var vals = [[c.id, String(c.stamps), c.cardStart, c.lastStampDate, String(c.freeDrinks), c.createdAt, c.lastActivity]];
  if (found.row) sh.getRange(found.row, 1, 1, CARD_HEADERS.length).setValues(vals);
  else { sh.appendRow(vals[0]); found.row = sh.getLastRow(); }
}

function log_(now, id, event, stampNumber, drink, days) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log").appendRow([
    now, Utilities.formatDate(now, TZ, "yyyy-MM-dd"), id.slice(0, 12), event, stampNumber,
    Utilities.formatDate(now, TZ, "EEE"), Number(Utilities.formatDate(now, TZ, "H")), drink, days
  ]);
}

function todayStr_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }

// ---------------------------------------------------------------------------------------------------------
// The staff page
// ---------------------------------------------------------------------------------------------------------
function staffPage_(code) {
  var html = HtmlService.createHtmlOutput(STAFF_HTML_.replace("__CARD__", JSON.stringify(code)))
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
  'button,select{font:inherit}',
  '.btn{display:block;width:100%;margin-top:16px;padding:16px;border:2.5px solid var(--ink);border-radius:999px;background:var(--ink);color:var(--paper);font-weight:800;font-size:18px;cursor:pointer}',
  '.btn:disabled{opacity:.4}',
  'select{width:100%;margin-top:14px;padding:12px;border:2px solid var(--ink);border-radius:12px;background:#fff}',
  '.done{margin-top:16px;padding:14px;border-radius:14px;background:var(--ink);color:var(--paper);font-weight:700;font-size:18px}',
  '.warn{margin-top:16px;padding:14px;border-radius:14px;border:2px solid var(--ink);font-weight:700}',
  'table{width:100%;border-collapse:collapse;font-size:15px}td{padding:8px 0;border-bottom:1px solid var(--line)}td:last-child{text-align:right;font-weight:700}',
  '.busy{opacity:.5;pointer-events:none}',
  '</style></head><body><div class="wrap">',
  '<h1>Brew Addict staff</h1><p class="sub" id="sub">Stamp card</p><div id="app"><p class="note">Loading…</p></div>',
  '</div><script>',
  'var CARD=__CARD__,SIZE=10,app=document.getElementById("app"),drinks=[];',
  'function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]})}',
  'function call(fn,args,done){app.classList.add("busy");var r=google.script.run.withSuccessHandler(function(x){app.classList.remove("busy");done(x)}).withFailureHandler(function(e){app.classList.remove("busy");app.innerHTML="<p class=warn>"+esc(e.message||e)+"</p>"});r[fn].apply(r,args)}',
  'var MSG={full:"This card is full. Give the free drink.",today:"This card already has today\'s stamp. One stamp a day.",not_full:"This card doesn\'t have 10 stamps yet.",bad_card:"That QR code isn\'t a Brew Addict card."};',
  'function show(card,msg,ok){var h="<div class=card><div class=dots>";for(var i=0;i<SIZE;i++)h+="<div class=\\"dot"+(i<card.stamps?" on":"")+"\\">"+(i+1)+"</div>";',
  'h+="</div><p class=count>"+card.stamps+" of "+SIZE+" stamps</p>";',
  'if(card.expires)h+="<p class=note>Card ends "+new Date(card.expires).toLocaleDateString("en-GB",{day:"numeric",month:"long"})+"</p>";',
  'if(card.freeDrinks)h+="<p class=note>Free drinks so far: "+card.freeDrinks+"</p>";',
  'if(msg)h+="<p class="+(ok?"done":"warn")+">"+esc(msg)+"</p>";',
  'if(card.stamps>=SIZE){h+="<select id=drink><option value=\\"\\">Which drink? (optional)</option>";drinks.forEach(function(d){h+="<option>"+esc(d)+"</option>"});h+="</select><button class=btn id=free>Give free drink</button>"}',
  'else if(!ok){h+="<button class=btn id=stamp"+(card.stampedToday?" disabled":"")+">Add stamp</button>";if(card.stampedToday&&!msg)h+="<p class=note>Already stamped today. One stamp a day.</p>"}',
  'h+="</div><p class=note style=\\"margin-top:20px\\">Scan the next card with this phone\'s camera.</p>";app.innerHTML=h;',
  'var s=document.getElementById("stamp");if(s)s.onclick=function(){call("staffStamp",[CARD],function(r){show(r.card||card,r.ok?"Stamp added. "+r.card.stamps+" of "+SIZE+".":MSG[r.error]||"Something went wrong.",r.ok)})};',
  'var f=document.getElementById("free");if(f)f.onclick=function(){call("staffFreeDrink",[CARD,document.getElementById("drink").value],function(r){show(r.card||card,r.ok?"Free drink given. A new card has started.":MSG[r.error]||"Something went wrong.",r.ok)})}}',
  'function summary(){call("staffSummary",[],function(r){var h="<div class=card><p class=note style=\\"margin-top:0\\">To stamp a card, scan the customer\'s QR code with this phone\'s camera.</p></div><h1 style=\\"margin-top:28px;font-size:18px\\">Numbers</h1><table>";',
  '(r.rows||[]).forEach(function(x){h+="<tr><td>"+esc(x[0])+"</td><td>"+esc(x[1])+"</td></tr>"});app.innerHTML=h+"</table><p class=note>More detail is in the Summary tab of the Google Sheet.</p>"})}',
  'if(CARD){call("staffDrinks",[],function(d){drinks=d||[];call("staffCard",[CARD],function(r){if(r.ok)show(r.card);else app.innerHTML="<p class=warn>"+esc(MSG[r.error]||"Something went wrong.")+"</p>"})})}else summary();',
  '</script></body></html>'
].join("\n");
```
