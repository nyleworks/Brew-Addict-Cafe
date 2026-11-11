// Brew Addict Café: stamp card.
// No sign-up: each phone gets a card that is a random code, shown as a QR code. After paying, the customer shows
// the QR and staff scan it with the cafe phone, which opens the staff page (only works signed in to the cafe
// Google account). While the card is open it checks for new stamps every few seconds, so it updates live.
// 10 stamps = a free drink. One stamp a day. A card lasts one month from its first stamp.
// The card only lives on this phone, so after the first stamp a full-screen "Save your card" page asks the
// customer to keep a copy (screenshot, card link or home screen), and a reminder stays until they tap "I saved it".
// Each phone also has a random device tag in its QR code, so the staff page notices when a card moves phones.
// Backend: apps-script/Code.gs (Google Sheet). Setup: STAMP-CARD-SETUP.md.

(function () {
  "use strict";

  // The two web app URLs from the Apps Script deployments (both end in /exec). Left empty, the card runs in
  // preview mode: saved on this device only, with buttons that pretend to be the staff.
  var STAMP_API = "https://script.google.com/macros/s/AKfycbwCjEXeP72AaBCnvS3u0a-ozlrlWQSot3t6jqPDVIVlglmRchja2RIdLFcYjwOvvgo7/exec";   // public deployment: looks up a card's stamps
  var STAFF_URL = "https://script.google.com/macros/s/AKfycbwHNN-h9TviJ1A9mMAr-mvKgWMC66NWMfq4pKhpEMl3g8z2jaAmLKRoyoR97w1QJEE-/exec";   // staff deployment: the staff page

  var SIZE = 10;
  var CARD_KEY = "ba-card";
  var STAFF_KEY = "ba-staff-phone";
  var DEVICE_KEY = "ba-device";
  var SAVED_KEY = "ba-card-saved";   // holds the card code the customer said they saved
  var POLL_MS = 3000;            // how often an open card checks for stamps
  var BUSY_MS = 20000;           // wait this long after the sheet says it's busy
  var POLL_FOR_MS = 3 * 60000;   // then it pauses until the customer taps "Check for stamps"

  var S = {
    en: {
      tab: "Stamp card", title: "Stamp card", close: "Close",
      intro: "10 stamps, 1 free drink.",
      privacy: "No sign-up needed.",
      how: "Show this at the counter after you pay. One stamp a day.",
      qrAlt: "Your stamp card QR code",
      count: "{n} of 10 stamps",
      ends: "Ends {date}.",
      fresh: "Cards last one month from the first stamp.",
      today: "Today's stamp is in. See you tomorrow!",
      full: "Free drink ready! Show this QR to our staff.",
      stamped: "Stamp added! {n} of 10.",
      redeemed: "Enjoy! A new card has started.",
      earned: "Free drinks so far: {n}", free: "Free",
      live: "Live",
      paused: "Check for stamps",
      backup: "Screenshot this card. Scan the screenshot to restore it.",
      home: "",
      homeBtn: "Add to home screen",
      homeNext: "Now tap Share (or your browser menu), then Add to Home Screen.",
      homeMissing: "Stamps missing? In your browser, tap \u201cCopy card link\u201d, then tap below.",
      haveCard: "Card on another browser? Copy its link there, then tap below.",
      pasteBtn: "Paste card link",
      pasteBad: "That isn't a card link.",
      pasteManual: "Paste your card link:",
      copyBtn: "Copy card link",
      copied: "Card link copied.",
      copyManual: "Copy your card link:",
      restored: "Your card is back.",
      movedNote: "Staff will confirm the move at your next stamp.",
      replace: "This phone has a card with {n} stamps. Replace it?",
      replaceAny: "Replace the card on this phone with this one?",
      saveTitle: "Save your card",
      saveWhy: "Your stamps are kept in this browser only. If the phone clears it, the stamps are gone. Save a copy now. It takes 5 seconds.",
      saveShot: "Take a screenshot of this screen now.",
      saveShotHow: "iPhone: side button + volume up. Android: power + volume down.",
      saveLink: "Or copy your card link and keep it somewhere safe, like a chat to yourself.",
      saveHome: "Even better: put the card on your home screen.",
      saveRestore: "Lost it anyway? Scan the screenshot with your camera and the card comes back.",
      saveDone: "I saved it",
      saveLater: "Remind me later",
      savedOk: "Great, your card is saved.",
      nag: "Your card isn't saved yet. If this browser clears, your stamps are gone.",
      nagBtn: "Save your card",
      staffOn: "This is now the staff phone.",
      staffOff: "This phone is no longer the staff phone.",
      loading: "Loading your card…",
      demo: "Preview: saved on this device only. The buttons below act as staff.",
      simStamp: "Add a stamp", simFree: "Give the free drink",
      network: "Couldn't load your card. Check your connection."
    },
    ms: {
      tab: "Kad setem", title: "Kad setem", close: "Tutup",
      intro: "10 setem, 1 minuman percuma.",
      privacy: "Tiada pendaftaran.",
      how: "Tunjukkan di kaunter selepas bayar. Satu setem sehari.",
      qrAlt: "Kod QR kad setem anda",
      count: "{n} daripada 10 setem",
      ends: "Tamat {date}.",
      fresh: "Kad sah sebulan dari setem pertama.",
      today: "Setem hari ini sudah ada. Jumpa esok!",
      full: "Minuman percuma sedia! Tunjukkan QR ini kepada staf.",
      stamped: "Setem ditambah! {n} daripada 10.",
      redeemed: "Selamat menikmati! Kad baharu sudah bermula.",
      earned: "Minuman percuma setakat ini: {n}", free: "Percuma",
      live: "Langsung",
      paused: "Semak setem",
      backup: "Ambil tangkapan skrin kad ini. Imbas untuk memulihkannya.",
      home: "",
      homeBtn: "Tambah ke skrin utama",
      homeNext: "Sekarang tekan Kongsi (atau menu pelayar), kemudian Tambah ke Skrin Utama.",
      homeMissing: "Setem tiada? Dalam pelayar, tekan \u201cSalin pautan kad\u201d, kemudian tekan di bawah.",
      haveCard: "Ada kad dalam pelayar lain? Salin pautannya di sana, kemudian tekan di bawah.",
      pasteBtn: "Tampal pautan kad",
      pasteBad: "Itu bukan pautan kad.",
      pasteManual: "Tampal pautan kad anda:",
      copyBtn: "Salin pautan kad",
      copied: "Pautan kad disalin.",
      copyManual: "Salin pautan kad anda:",
      restored: "Kad anda sudah kembali.",
      movedNote: "Staf akan mengesahkan pemindahan ini pada setem seterusnya.",
      replace: "Telefon ini ada kad dengan {n} setem. Gantikan?",
      replaceAny: "Gantikan kad pada telefon ini dengan kad ini?",
      saveTitle: "Simpan kad anda",
      saveWhy: "Setem anda disimpan dalam pelayar ini sahaja. Jika telefon memadamnya, setem akan hilang. Simpan salinan sekarang. Hanya 5 saat.",
      saveShot: "Ambil tangkapan skrin skrin ini sekarang.",
      saveShotHow: "iPhone: butang sisi + naik suara. Android: kuasa + turun suara.",
      saveLink: "Atau salin pautan kad dan simpan di tempat selamat, contohnya mesej kepada diri sendiri.",
      saveHome: "Lebih baik: letak kad di skrin utama.",
      saveRestore: "Kad hilang juga? Imbas tangkapan skrin dengan kamera dan kad akan kembali.",
      saveDone: "Saya sudah simpan",
      saveLater: "Ingatkan saya nanti",
      savedOk: "Bagus, kad anda sudah disimpan.",
      nag: "Kad anda belum disimpan. Jika pelayar ini dipadam, setem anda hilang.",
      nagBtn: "Simpan kad anda",
      staffOn: "Ini kini telefon staf.",
      staffOff: "Telefon ini bukan lagi telefon staf.",
      loading: "Memuatkan kad anda…",
      demo: "Pratonton: disimpan pada peranti ini sahaja. Butang di bawah bertindak sebagai staf.",
      simStamp: "Tambah setem", simFree: "Beri minuman percuma",
      network: "Tidak dapat memuatkan kad. Semak sambungan anda."
    }
  };

  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function validCode(c) { return typeof c === "string" && /^[A-Za-z0-9_-]{22}$/.test(c); }
  function validDevice(d) { return typeof d === "string" && /^[A-Za-z0-9_-]{12}$/.test(d); }
  function randomId(bytes) {
    var b = new Uint8Array(bytes);
    crypto.getRandomValues(b);
    return btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // ---- Arriving from a scanned QR code (#card=…) or the staff phone set-up link (#staff-phone=on|off) ----
  // The card can arrive in the hash (a scanned QR code) or the query (the address a home screen icon opens with)
  var hash = new URLSearchParams(location.hash.slice(1));
  var query = new URLSearchParams(location.search);
  var scanned = hash.get("card") || query.get("card");
  // d: the device tag in a QR code (tells the staff page which phone showed it).
  // dev: the device tag in a card link or home screen address (the same phone, so this browser takes it over).
  var linkDev = hash.get("dev") || query.get("dev");
  var qrDev = hash.get("d") || query.get("d") || linkDev;
  var staffSetting = hash.get("staff-phone");
  if (validCode(scanned) && STAFF_URL && load(STAFF_KEY) === "1") {
    // The staff phone hands the card straight to the staff page
    location.replace(STAFF_URL + "?card=" + encodeURIComponent(scanned) + (validDevice(qrDev) ? "&d=" + encodeURIComponent(qrDev) : ""));
    return;
  }

  var tab = document.getElementById("stamp-tab");
  var panel = document.getElementById("stamp-panel");
  var scrim = document.getElementById("stamp-scrim");
  var body = document.getElementById("stamp-body");
  var closeBtn = document.getElementById("stamp-close");
  if (!tab || !panel || !body) return;

  var device = load(DEVICE_KEY);
  if (!validDevice(device)) { device = randomId(9); store(DEVICE_KEY, device); }

  var state = {
    code: load(CARD_KEY),
    saving: false,     // the full-screen "Save your card" page is showing
    later: false,      // "Remind me later" was tapped (asks again at the next stamp or visit)
    card: null,        // { stamps, size, expires, stampedToday, freeDrinks }
    msg: null,         // { text, ok }
    fresh: -1,         // index of a stamp that has just appeared (animates once)
    paused: false,
    error: false
  };
  if (!validCode(state.code)) state.code = null;

  function lang() { return document.documentElement.lang === "ms" ? "ms" : "en"; }
  function tr(key, vars) {
    var s = S[lang()][key] || S.en[key] || "";
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // A new card: 16 random bytes as 22 URL-safe characters. Nothing is sent anywhere until staff stamp it.
  function newCode() { return randomId(16); }
  function ensureCode() {
    if (!state.code) { state.code = newCode(); store(CARD_KEY, state.code); }
    return state.code;
  }
  function standalone() {
    return window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  }
  // The QR code carries this phone's tag as d; a copied card link carries it as dev, so this phone's other browser
  // (or its home screen icon) counts as the same phone. A copy of the QR code made on another phone does not.
  function qrLink(code) { return location.origin + location.pathname + "#card=" + code + "&d=" + device; }
  function cardLink(code) { return location.origin + location.pathname + "#card=" + code + "&dev=" + device; }
  function isSaved() { return load(SAVED_KEY) === state.code; }
  function needsSave() { return !!(state.card && state.card.stamps > 0 && state.code && !isSaved()); }

  // ---- Talking to the sheet ----
  function fetchCard() {
    if (!state.code) return Promise.resolve(null);
    if (!STAMP_API) return Promise.resolve(demoView(demoGet(state.code)));
    // A plain-text POST keeps this a "simple" request, which Apps Script web apps accept from any site
    return fetch(STAMP_API, { method: "POST", body: JSON.stringify({ action: "card", card: state.code }), redirect: "follow" })
      .then(function (r) { return r.json(); })
      .then(function (r) { return r && r.ok ? r.card : r && r.error === "busy" ? "busy" : null; })
      .catch(function () { return null; });
  }

  // ---- Preview mode: the same rules, stored on this device ----
  function demoDb() { try { return JSON.parse(load("ba-card-demo") || "{}"); } catch (e) { return {}; } }
  function demoGet(code) { return demoDb()[code] || { stamps: 0, cardStart: null, freeDrinks: 0 }; }
  function demoPut(code, c) { var db = demoDb(); db[code] = c; store("ba-card-demo", JSON.stringify(db)); }
  function demoView(c) {
    var end = null;
    if (c.cardStart) { end = new Date(c.cardStart); end.setMonth(end.getMonth() + 1); }
    return { stamps: c.stamps, size: SIZE, expires: c.stamps > 0 && c.stamps < SIZE && end ? end.toISOString() : null,
      stampedToday: false, freeDrinks: c.freeDrinks };
  }
  function demoStamp() {
    var c = demoGet(state.code);
    if (c.stamps >= SIZE) return;
    if (!c.stamps) c.cardStart = new Date().toISOString();
    c.stamps++; demoPut(state.code, c);
  }
  function demoFree() {
    var c = demoGet(state.code);
    if (c.stamps < SIZE) return;
    c.stamps = 0; c.cardStart = null; c.freeDrinks++; demoPut(state.code, c);
  }

  // ---- Applying a fresh look at the card: animates a new stamp and says what changed ----
  // card is null when the lookup failed, or "busy" when the sheet asked us to slow down (keeps what we have)
  function apply(card) {
    if (card === "busy") return false;
    if (!card) { state.error = true; return true; }
    var before = state.card, changed = !before || state.error ||
      before.stamps !== card.stamps || before.freeDrinks !== card.freeDrinks || before.stampedToday !== card.stampedToday;
    state.error = false;
    if (before) {
      if (card.freeDrinks > before.freeDrinks) state.msg = { text: tr("redeemed"), ok: true };
      else if (card.stamps > before.stamps) {
        state.fresh = card.stamps - 1;
        state.msg = { text: tr("stamped", { n: card.stamps }), ok: true };
        state.later = false;   // a new stamp is worth saving: ask again
      }
    }
    state.card = card;
    // Right after a stamp (or on a visit with an unsaved card) is when the customer cares: ask them to save it
    if (needsSave() && !state.later && !state.saving) { state.saving = true; changed = true; }
    return changed;
  }

  // ---- Rendering ----
  function fmtDate(iso) {
    try {
      return new Intl.DateTimeFormat(lang() === "ms" ? "ms-MY" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kuching" }).format(new Date(iso));
    } catch (e) { return iso.slice(0, 10); }
  }

  function grid(card) {
    var html = '<ol class="stamp-grid' + (card.stamps >= SIZE ? " is-full" : "") + '" aria-label="' + esc(tr("count", { n: card.stamps })) + '">';
    for (var i = 0; i < SIZE; i++) {
      var on = i < card.stamps;
      var tilt = [-7, 5, -3, 8, -5, 4, -8, 6, -4, 3][i];
      html += '<li class="stamp-dot' + (on ? " is-on" : "") + (i === state.fresh ? " is-new" : "") + (i === SIZE - 1 ? " stamp-dot--free" : "") +
        '" style="--tilt:' + tilt + 'deg"' + (i === SIZE - 1 ? ' data-free="' + esc(tr("free")) + '"' : "") + ' aria-hidden="true">' +
        '<span class="stamp-dot__num">' + (i + 1) + '</span><span class="stamp-dot__mascot"></span></li>';
    }
    return html + "</ol>";
  }

  var qrCache = { code: null, svg: "" };
  function qrSvg(code) {
    if (qrCache.code === code) return qrCache.svg;
    var svg = "";
    if (typeof qrcode === "function") {
      var q = qrcode(0, "M");
      q.addData(qrLink(code));
      q.make();
      svg = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: tr("qrAlt") });
    }
    qrCache = { code: code, svg: svg };
    return svg;
  }

  function render() {
    tab.querySelector("#stamp-tab-label").textContent = tr("tab");
    document.getElementById("stamp-title").textContent = tr("title");
    closeBtn.setAttribute("aria-label", tr("close"));
    var badge = tab.querySelector(".stamp-tab__badge");
    if (state.card && state.card.stamps > 0) {
      if (!badge) { badge = document.createElement("span"); badge.className = "stamp-tab__badge"; tab.appendChild(badge); }
      badge.textContent = state.card.stamps;
    } else if (badge) badge.remove();
    if (badge) badge.classList.toggle("is-unsaved", needsSave());
    panel.classList.toggle("is-saving", isOpen && state.saving);
    if (!isOpen) return;
    if (state.saving) { renderSave(); return; }
    document.getElementById("stamp-title").textContent = tr("title");

    var h = STAMP_API ? "" : '<p class="stamp-demo">' + esc(tr("demo")) + "</p>";
    var c = state.card;
    if (!c) {
      h += state.error ? '<p class="stamp-error" role="alert">' + esc(tr("network")) + "</p>" : '<p class="stamp-muted">' + esc(tr("loading")) + "</p>";
      if (state.error) h += '<div class="stamp-actions"><button class="ba-btn ba-btn--outline" type="button" data-act="check">' + esc(tr("paused")) + "</button></div>";
      body.innerHTML = h;
      return;
    }
    if (needsSave()) h += '<div class="stamp-nag" role="status"><p>' + esc(tr("nag")) + '</p>' +
      '<button class="ba-btn ba-btn--primary" type="button" data-act="save-open">' + esc(tr("nagBtn")) + "</button></div>";
    h += '<p class="stamp-muted">' + esc(tr("intro")) + "</p>" + grid(c) +
      '<p class="stamp-progress">' + esc(tr("count", { n: c.stamps })) + "</p>";
    if (c.stamps >= SIZE) h += "<p>" + esc(tr("full")) + "</p>";
    else if (c.expires) h += '<p class="stamp-muted">' + esc(tr("ends", { date: fmtDate(c.expires) })) + "</p>";
    else h += '<p class="stamp-muted">' + esc(tr("fresh")) + "</p>";
    if (c.stampedToday && c.stamps < SIZE) h += '<p class="stamp-note">' + esc(tr("today")) + "</p>";
    if (state.msg) h += '<p class="stamp-msg' + (state.msg.ok ? " stamp-msg--ok" : "") + '" role="status">' + esc(state.msg.text) + "</p>";

    h += '<div class="stamp-qr">' + qrSvg(state.code) + "</div>" +
      '<p class="stamp-how">' + esc(tr("how")) + "</p>";
    if (state.error) h += '<p class="stamp-error" role="alert">' + esc(tr("network")) + "</p>";
    h += state.paused || state.error
      ? '<button class="stamp-link" type="button" data-act="check">' + esc(tr("paused")) + "</button>"
      : '<p class="stamp-live"><span class="stamp-live__dot" aria-hidden="true"></span>' + esc(tr("live")) + "</p>";
    if (!STAMP_API) {
      h += '<div class="stamp-actions">' +
        (c.stamps < SIZE ? '<button class="ba-btn ba-btn--outline" type="button" data-act="sim-stamp">' + esc(tr("simStamp")) + "</button>"
          : '<button class="ba-btn ba-btn--outline" type="button" data-act="sim-free">' + esc(tr("simFree")) + "</button>") + "</div>";
    }
    if (c.freeDrinks > 0) h += '<p class="stamp-muted stamp-note">' + esc(tr("earned", { n: c.freeDrinks })) + "</p>";
    h += '<p class="stamp-muted stamp-small">' + esc(tr("backup")) + "</p>" +
      // An empty card may just mean this is a new home screen icon: offer to bring an existing card over
      (c.stamps === 0 && !c.freeDrinks ? '<p class="stamp-muted stamp-small">' + esc(tr(standalone() ? "homeMissing" : "haveCard")) + "</p>" +
        '<button class="stamp-link" type="button" data-act="paste">' + esc(tr("pasteBtn")) + "</button>" : "") +
      (standalone() ? "" : '<button class="stamp-link" type="button" data-act="home">' + esc(tr("homeBtn")) + "</button>" +
        '<button class="stamp-link" type="button" data-act="copy">' + esc(tr("copyBtn")) + "</button>") +
      '<p class="stamp-muted stamp-small">' + esc(tr("privacy")) + "</p>";
    body.innerHTML = h;
    state.fresh = -1;   // the stamp animation plays once
  }

  // The full-screen "Save your card" page. The QR code is on it, so a screenshot of this page is the backup.
  function renderSave() {
    document.getElementById("stamp-title").textContent = tr("saveTitle");
    var h = (state.msg ? '<p class="stamp-msg' + (state.msg.ok ? " stamp-msg--ok" : "") + '" role="status">' + esc(state.msg.text) + "</p>" : "") +
      '<p class="stamp-save__why">' + esc(tr("saveWhy")) + "</p>" +
      '<div class="stamp-qr">' + qrSvg(state.code) + "</div>" +
      '<ol class="stamp-save__steps">' +
      "<li><strong>" + esc(tr("saveShot")) + '</strong><span class="stamp-muted">' + esc(tr("saveShotHow")) + "</span></li>" +
      "<li>" + esc(tr("saveLink")) + '<button class="ba-btn ba-btn--outline" type="button" data-act="copy">' + esc(tr("copyBtn")) + "</button></li>" +
      (standalone() ? "" : "<li>" + esc(tr("saveHome")) + '<button class="ba-btn ba-btn--outline" type="button" data-act="home">' + esc(tr("homeBtn")) + "</button></li>") +
      "</ol>" +
      '<p class="stamp-muted stamp-small">' + esc(tr("saveRestore")) + "</p>" +
      '<div class="stamp-save__done"><button class="ba-btn ba-btn--primary" type="button" data-act="save-done">' + esc(tr("saveDone")) + "</button>" +
      '<button class="stamp-link" type="button" data-act="save-later">' + esc(tr("saveLater")) + "</button></div>";
    body.innerHTML = h;
  }
  function closeSave(later) {
    state.saving = false;
    if (later) state.later = true;
    else { store(SAVED_KEY, state.code); state.msg = { text: tr("savedOk"), ok: true }; }
    render();
    body.scrollTop = 0;
  }

  // ---- Live updates while the card is open ----
  var poll = { timer: 0, until: 0, busy: false };
  function startLive() {
    poll.until = Date.now() + POLL_FOR_MS;
    if (state.paused) { state.paused = false; render(); }
    clearTimeout(poll.timer);
    check();
  }
  function check() {
    if (poll.busy) return;
    poll.busy = true;
    fetchCard().then(function (card) {
      poll.busy = false;
      if (apply(card)) render();
      clearTimeout(poll.timer);
      if (!isOpen || document.hidden) return;
      if (Date.now() > poll.until) { state.paused = true; render(); return; }
      poll.timer = setTimeout(check, card === "busy" ? BUSY_MS : POLL_MS);
    });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && isOpen) startLive(); });

  body.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var act = b.dataset.act;
    if (act === "check") { state.msg = null; startLive(); }
    else if (act === "save-open") { state.saving = true; state.msg = null; render(); body.scrollTop = 0; }
    else if (act === "save-done") closeSave(false);
    else if (act === "save-later") closeSave(true);
    else if (act === "home") {
      // A home screen icon gets its own storage on iPhones. Putting the card in the address now means the icon
      // opens with this card (the icon remembers the address it was added from).
      // Added as ?card=… because a home screen icon may drop the part after #
      history.replaceState(null, "", location.pathname + "?card=" + state.code + "&dev=" + device);
      state.msg = { text: tr("homeNext"), ok: true };
      render();
      body.scrollTop = 0;
    }
    else if (act === "copy") {
      var link = cardLink(state.code);
      (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(link) : Promise.reject())
        .then(function () { state.msg = { text: tr("copied"), ok: true }; render(); body.scrollTop = 0; },
              function () { window.prompt(tr("copyManual"), link); });
    }
    else if (act === "paste") {
      var use = function (text) {
        var m = /card=([A-Za-z0-9_-]{22})/.exec(text || "");
        if (!m) { state.msg = { text: tr("pasteBad"), ok: false }; render(); body.scrollTop = 0; return; }
        var d = /[?&#]dev=([A-Za-z0-9_-]{12})/.exec(text);
        if (d) { device = d[1]; store(DEVICE_KEY, device); qrCache.code = null; }
        state.code = m[1]; store(CARD_KEY, m[1]); state.card = null;
        state.msg = { text: tr("restored"), ok: true }; render(); body.scrollTop = 0; startLive();
      };
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(use, function () { use(window.prompt(tr("pasteManual"))); });
      else use(window.prompt(tr("pasteManual")));
    }
    else if (act === "sim-stamp") { demoStamp(); check(); }
    else if (act === "sim-free") { demoFree(); check(); }
  });

  // ---- Opening and closing ----
  var isOpen = false;
  function open() {
    if (isOpen) return;
    isOpen = true;
    ensureCode();
    panel.hidden = false; scrim.hidden = false;
    panel.inert = false;
    requestAnimationFrame(function () { panel.classList.add("is-open"); scrim.classList.add("is-open"); });
    tab.setAttribute("aria-expanded", "true");
    tab.classList.add("is-hidden");
    setTimeout(function () { closeBtn.focus({ preventScroll: true }); }, 50);
    render();
    startLive();
  }
  function close() {
    if (!isOpen) return;
    if (state.saving) { state.saving = false; state.later = true; }   // closing the save page means "later"
    isOpen = false;
    panel.classList.remove("is-saving");
    clearTimeout(poll.timer);
    panel.classList.remove("is-open"); scrim.classList.remove("is-open");
    panel.inert = true;
    tab.setAttribute("aria-expanded", "false");
    tab.classList.remove("is-hidden");
    setTimeout(function () { if (!isOpen) scrim.hidden = true; }, 300);
    state.msg = null;
    tab.focus({ preventScroll: true });
  }
  tab.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  scrim.addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) close(); });
  document.addEventListener("ba:lang", function () { qrCache.code = null; render(); });

  // ---- Start ----
  panel.inert = true;
  tab.hidden = false;
  if (scanned || staffSetting) {
    query.delete("card"); query.delete("dev"); query.delete("d");
    var qs = query.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  if (staffSetting === "on" || staffSetting === "off") {
    store(STAFF_KEY, staffSetting === "on" ? "1" : null);
    state.msg = { text: tr(staffSetting === "on" ? "staffOn" : "staffOff"), ok: true };
    open();
  } else if (validCode(scanned) && scanned !== state.code) {
    // A customer scanned their own card (for example a screenshot): bring it back to this phone
    // Ask first when the card on this phone has stamps, or when we couldn't check it (busy or offline)
    fetchCard().then(function (current) {
      var known = current && current !== "busy";
      var ask = !state.code ? null : !known ? tr("replaceAny") : current.stamps > 0 ? tr("replace", { n: current.stamps }) : null;
      if (ask && !window.confirm(ask)) { apply(current); open(); return; }
      state.code = scanned; store(CARD_KEY, scanned);
      // From this phone's own card link: same phone, keep its tag. From a QR code or screenshot: staff confirm.
      var samePhone = validDevice(linkDev);
      if (samePhone) { device = linkDev; store(DEVICE_KEY, device); }
      store(SAVED_KEY, scanned);   // they restored it from a copy, so they have one
      state.card = null;
      state.msg = { text: tr("restored") + (samePhone ? "" : " " + tr("movedNote")), ok: true };
      open();
    });
  } else if (state.code) {
    fetchCard().then(function (card) { if (card) { apply(card); render(); } });
    if (scanned) open();
  }
})();
