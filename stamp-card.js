// Brew Addict Café: stamp card.
// No sign-up: each phone gets a card that is a random code, shown as a QR code. After paying, the customer shows
// the QR and staff scan it with the cafe phone, which opens the staff page (only works signed in to the cafe
// Google account). While the card is open it checks for new stamps every few seconds, so it updates live.
// 10 stamps = a free drink. One stamp a day. A card lasts one month from its first stamp.
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
  var POLL_MS = 3000;            // how often an open card checks for stamps
  var POLL_FOR_MS = 3 * 60000;   // then it pauses until the customer taps "Check for stamps"

  var S = {
    en: {
      tab: "Stamp card", title: "Stamp card", close: "Close",
      intro: "Collect 10 stamps and get any drink free.",
      privacy: "No sign-up. We don't ask for your name or phone number.",
      how: "After you pay, show this QR code at the counter and our staff will stamp it. One stamp a day.",
      qrAlt: "Your stamp card QR code",
      count: "{n} of 10 stamps",
      ends: "This card ends on {date}.",
      fresh: "Each card lasts one month from its first stamp.",
      today: "Today's stamp is collected. See you tomorrow!",
      full: "Your free drink is ready! Show this QR code to our staff.",
      stamped: "Stamp added! {n} of 10.",
      redeemed: "Enjoy your free drink! A new card has started.",
      earned: "Free drinks so far: {n}", free: "Free",
      live: "Live: new stamps appear here",
      paused: "Check for stamps",
      backup: "Keep a screenshot of this card. If your phone ever loses it, scan the screenshot with your camera to bring it back.",
      home: "Tip: add this site to your home screen so your phone keeps your card.",
      restored: "Your card is back on this phone.",
      replace: "This phone already has a card with {n} stamps. Replace it with the card you just scanned?",
      staffOn: "This phone is now the staff phone. Scanning a customer's card will open the staff page.",
      staffOff: "This phone is no longer the staff phone.",
      loading: "Loading your card…",
      demo: "Preview mode: this card is saved on this device only. The buttons below pretend to be the staff.",
      simStamp: "Pretend staff stamped it", simFree: "Pretend staff gave the free drink",
      network: "Couldn't check your card. Check your internet and try again."
    },
    ms: {
      tab: "Kad setem", title: "Kad setem", close: "Tutup",
      intro: "Kumpul 10 setem dan dapat satu minuman percuma.",
      privacy: "Tiada pendaftaran. Kami tidak minta nama atau nombor telefon anda.",
      how: "Selepas bayar, tunjukkan kod QR ini di kaunter dan staf kami akan mengecopnya. Satu setem sehari.",
      qrAlt: "Kod QR kad setem anda",
      count: "{n} daripada 10 setem",
      ends: "Kad ini tamat pada {date}.",
      fresh: "Setiap kad sah sebulan dari setem pertama.",
      today: "Setem hari ini sudah dikumpul. Jumpa esok!",
      full: "Minuman percuma anda sudah sedia! Tunjukkan kod QR ini kepada staf kami.",
      stamped: "Setem ditambah! {n} daripada 10.",
      redeemed: "Selamat menikmati minuman percuma! Kad baharu sudah bermula.",
      earned: "Minuman percuma setakat ini: {n}", free: "Percuma",
      live: "Langsung: setem baharu muncul di sini",
      paused: "Semak setem",
      backup: "Simpan tangkapan skrin kad ini. Jika telefon anda kehilangannya, imbas tangkapan skrin itu dengan kamera untuk mendapatkannya semula.",
      home: "Tip: tambah laman ini ke skrin utama supaya telefon anda menyimpan kad anda.",
      restored: "Kad anda sudah kembali pada telefon ini.",
      replace: "Telefon ini sudah ada kad dengan {n} setem. Gantikan dengan kad yang baru diimbas?",
      staffOn: "Telefon ini kini telefon staf. Imbasan kad pelanggan akan membuka halaman staf.",
      staffOff: "Telefon ini bukan lagi telefon staf.",
      loading: "Memuatkan kad anda…",
      demo: "Mod pratonton: kad ini disimpan pada peranti ini sahaja. Butang di bawah berpura-pura menjadi staf.",
      simStamp: "Pura-pura staf mengecop", simFree: "Pura-pura staf beri minuman percuma",
      network: "Tidak dapat menyemak kad anda. Semak internet anda dan cuba lagi."
    }
  };

  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function validCode(c) { return typeof c === "string" && /^[A-Za-z0-9_-]{22}$/.test(c); }

  // ---- Arriving from a scanned QR code (#card=…) or the staff phone set-up link (#staff-phone=on|off) ----
  var hash = new URLSearchParams(location.hash.slice(1));
  var scanned = hash.get("card");
  var staffSetting = hash.get("staff-phone");
  if (validCode(scanned) && STAFF_URL && load(STAFF_KEY) === "1") {
    // The staff phone hands the card straight to the staff page
    location.replace(STAFF_URL + "?card=" + encodeURIComponent(scanned));
    return;
  }

  var tab = document.getElementById("stamp-tab");
  var panel = document.getElementById("stamp-panel");
  var scrim = document.getElementById("stamp-scrim");
  var body = document.getElementById("stamp-body");
  var closeBtn = document.getElementById("stamp-close");
  if (!tab || !panel || !body) return;

  var state = {
    code: load(CARD_KEY),
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
  function newCode() {
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    var s = btoa(String.fromCharCode.apply(null, b));
    return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function ensureCode() {
    if (!state.code) { state.code = newCode(); store(CARD_KEY, state.code); }
    return state.code;
  }
  function cardLink(code) { return location.origin + location.pathname + "#card=" + code; }

  // ---- Talking to the sheet ----
  function fetchCard() {
    if (!state.code) return Promise.resolve(null);
    if (!STAMP_API) return Promise.resolve(demoView(demoGet(state.code)));
    // A plain-text POST keeps this a "simple" request, which Apps Script web apps accept from any site
    return fetch(STAMP_API, { method: "POST", body: JSON.stringify({ action: "card", card: state.code }), redirect: "follow" })
      .then(function (r) { return r.json(); })
      .then(function (r) { return r && r.ok ? r.card : null; })
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
  function apply(card) {
    if (!card) { state.error = true; return true; }
    var before = state.card, changed = !before || state.error ||
      before.stamps !== card.stamps || before.freeDrinks !== card.freeDrinks || before.stampedToday !== card.stampedToday;
    state.error = false;
    if (before) {
      if (card.freeDrinks > before.freeDrinks) state.msg = { text: tr("redeemed"), ok: true };
      else if (card.stamps > before.stamps) {
        state.fresh = card.stamps - 1;
        state.msg = { text: tr("stamped", { n: card.stamps }), ok: true };
      }
    }
    state.card = card;
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
      q.addData(cardLink(code));
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
    if (!isOpen) return;

    var h = STAMP_API ? "" : '<p class="stamp-demo">' + esc(tr("demo")) + "</p>";
    var c = state.card;
    if (!c) {
      h += state.error ? '<p class="stamp-error" role="alert">' + esc(tr("network")) + "</p>" : '<p class="stamp-muted">' + esc(tr("loading")) + "</p>";
      if (state.error) h += '<div class="stamp-actions"><button class="ba-btn ba-btn--outline" type="button" data-act="check">' + esc(tr("paused")) + "</button></div>";
      body.innerHTML = h;
      return;
    }
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
      '<p class="stamp-muted stamp-small">' + esc(tr("home")) + "</p>" +
      '<p class="stamp-muted stamp-small">' + esc(tr("privacy")) + "</p>";
    body.innerHTML = h;
    state.fresh = -1;   // the stamp animation plays once
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
      poll.timer = setTimeout(check, POLL_MS);
    });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && isOpen) startLive(); });

  body.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var act = b.dataset.act;
    if (act === "check") { state.msg = null; startLive(); }
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
    isOpen = false;
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
  if (scanned || staffSetting) history.replaceState(null, "", location.pathname + location.search);

  if (staffSetting === "on" || staffSetting === "off") {
    store(STAFF_KEY, staffSetting === "on" ? "1" : null);
    state.msg = { text: tr(staffSetting === "on" ? "staffOn" : "staffOff"), ok: true };
    open();
  } else if (validCode(scanned) && scanned !== state.code) {
    // A customer scanned their own card (for example a screenshot): bring it back to this phone
    fetchCard().then(function (current) {
      if (current && current.stamps > 0 && !window.confirm(tr("replace", { n: current.stamps }))) { apply(current); open(); return; }
      state.code = scanned; store(CARD_KEY, scanned);
      state.card = null;
      state.msg = { text: tr("restored"), ok: true };
      open();
    });
  } else if (state.code) {
    fetchCard().then(function (card) { if (card) { apply(card); render(); } });
    if (scanned) open();
  }
})();
