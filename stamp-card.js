// Brew Addict Café: stamp card.
// A tab on the left edge opens the card. Customers sign up with name, phone and PIN; after paying they scan
// the counter QR code (it opens this site with ?stamp=CODE) and get one stamp a day. 10 stamps = a free drink.
// The data lives in a Google Sheet behind a Google Apps Script web app (apps-script/Code.gs).

(function () {
  "use strict";

  // Paste the Apps Script web app URL here (ends in /exec). Left empty, the card runs in preview mode:
  // everything is saved on this device only, so the design can be tried before the sheet is set up.
  var STAMP_API = "";

  var SIZE = 10;
  var TOKEN_KEY = "ba-stamp-token";
  var PENDING_KEY = "ba-stamp-pending";

  var S = {
    en: {
      tab: "Stamp card", title: "Stamp card", close: "Close",
      intro: "Collect 10 stamps and get any drink free.",
      how: "After you pay, scan the QR code at the counter. One stamp a day.",
      signup: "Sign up", signin: "Sign in",
      name: "Your name", phone: "Phone number", pin: "PIN (4–6 digits)", pin2: "Confirm PIN",
      create: "Create my card", go: "Sign in",
      pending: "Sign up or sign in to collect today's stamp.",
      hi: "Hi, {name}", count: "{n} of 10 stamps",
      ends: "This card ends on {date}.",
      fresh: "Your next stamp starts a new card. Each card lasts one month from its first stamp.",
      today: "Today's stamp is collected. See you tomorrow!",
      full: "Your free drink is ready! Show this card to our staff.",
      claim: "Claim free drink", staffPin: "Staff PIN", confirm: "Confirm", cancel: "Cancel",
      staffHelp: "For staff: enter the staff PIN to give the free drink.",
      redeemed: "Enjoy your free drink! Your next purchase starts a new card.",
      stamped: "Stamp added! {n} of 10.",
      earned: "Free drinks so far: {n}", free: "Free",
      signout: "Sign out", loading: "Loading your card…",
      demo: "Preview mode: cards are saved on this device only, and the daily limit is off. The staff PIN is 0000.",
      simulate: "Try a QR scan",
      e: {
        name: "Please enter your name.", phone: "Please enter a valid Malaysian phone number.",
        pin: "The PIN must be 4 to 6 digits.", pin2: "The two PINs don't match.",
        exists: "This number already has a card. Please sign in.", no_account: "No card for this number yet. Please sign up.",
        wrong_pin: "Wrong PIN. Please try again.", locked: "Too many tries. Please wait 15 minutes.",
        today: "You've already collected today's stamp. See you tomorrow!", full: "Your card is full. Claim your free drink first.",
        bad_code: "That QR code didn't work. Please ask our staff.", staff_pin: "Wrong staff PIN.",
        not_full: "This card isn't full yet.", signed_out: "You've been signed out. Please sign in again.",
        network: "Couldn't connect. Check your internet and try again.", server: "Something went wrong. Please try again."
      }
    },
    ms: {
      tab: "Kad setem", title: "Kad setem", close: "Tutup",
      intro: "Kumpul 10 setem dan dapat satu minuman percuma.",
      how: "Selepas bayar, imbas kod QR di kaunter. Satu setem sehari.",
      signup: "Daftar", signin: "Log masuk",
      name: "Nama anda", phone: "Nombor telefon", pin: "PIN (4–6 digit)", pin2: "Sahkan PIN",
      create: "Buat kad saya", go: "Log masuk",
      pending: "Daftar atau log masuk untuk kumpul setem hari ini.",
      hi: "Hai, {name}", count: "{n} daripada 10 setem",
      ends: "Kad ini tamat pada {date}.",
      fresh: "Setem seterusnya memulakan kad baharu. Setiap kad sah sebulan dari setem pertama.",
      today: "Setem hari ini sudah dikumpul. Jumpa esok!",
      full: "Minuman percuma anda sudah sedia! Tunjukkan kad ini kepada staf kami.",
      claim: "Tuntut minuman percuma", staffPin: "PIN staf", confirm: "Sahkan", cancel: "Batal",
      staffHelp: "Untuk staf: masukkan PIN staf untuk beri minuman percuma.",
      redeemed: "Selamat menikmati minuman percuma! Pembelian seterusnya memulakan kad baharu.",
      stamped: "Setem ditambah! {n} daripada 10.",
      earned: "Minuman percuma setakat ini: {n}", free: "Percuma",
      signout: "Log keluar", loading: "Memuatkan kad anda…",
      demo: "Mod pratonton: kad disimpan pada peranti ini sahaja dan had harian dimatikan. PIN staf ialah 0000.",
      simulate: "Cuba imbas QR",
      e: {
        name: "Sila masukkan nama anda.", phone: "Sila masukkan nombor telefon Malaysia yang sah.",
        pin: "PIN mesti 4 hingga 6 digit.", pin2: "Kedua-dua PIN tidak sama.",
        exists: "Nombor ini sudah ada kad. Sila log masuk.", no_account: "Belum ada kad untuk nombor ini. Sila daftar.",
        wrong_pin: "PIN salah. Sila cuba lagi.", locked: "Terlalu banyak cubaan. Sila tunggu 15 minit.",
        today: "Anda sudah kumpul setem hari ini. Jumpa esok!", full: "Kad anda sudah penuh. Tuntut minuman percuma dahulu.",
        bad_code: "Kod QR itu tidak berfungsi. Sila tanya staf kami.", staff_pin: "PIN staf salah.",
        not_full: "Kad ini belum penuh.", signed_out: "Anda telah dilog keluar. Sila log masuk semula.",
        network: "Tidak dapat disambung. Semak internet anda dan cuba lagi.", server: "Ada masalah. Sila cuba lagi."
      }
    }
  };

  var tab = document.getElementById("stamp-tab");
  var panel = document.getElementById("stamp-panel");
  var scrim = document.getElementById("stamp-scrim");
  var body = document.getElementById("stamp-body");
  var closeBtn = document.getElementById("stamp-close");
  if (!tab || !panel || !body) return;

  // ---- State ----
  var state = {
    view: "loading",      // loading | auth | card | staff
    mode: "signup",       // which auth form
    card: null,
    msg: null,            // { text, ok }
    error: "",
    busy: false,
    fresh: -1             // index of a stamp that has just been added (animates once)
  };

  function lang() { return document.documentElement.lang === "ms" ? "ms" : "en"; }
  function tr(key, vars) {
    var s = S[lang()][key] || S.en[key] || "";
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  }
  function errText(code) { return S[lang()].e[code] || S[lang()].e.server; }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sstore(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function sload(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // ---- Talking to the sheet ----
  function api(action, data) {
    var req = Object.assign({ action: action }, data || {});
    if (!STAMP_API) return Promise.resolve(demoApi(req));
    // A plain-text POST keeps this a "simple" request, which Apps Script web apps accept from any site
    return fetch(STAMP_API, { method: "POST", body: JSON.stringify(req), redirect: "follow" })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: "network" }; });
  }

  // ---- Preview mode: the same rules, stored on this device ----
  function demoDb() { try { return JSON.parse(load("ba-stamp-demo") || "{}"); } catch (e) { return {}; } }
  function demoSave(db) { store("ba-stamp-demo", JSON.stringify(db)); }
  function normPhone(p) {
    var d = String(p || "").replace(/\D/g, "");
    if (d.indexOf("60") === 0) d = d.slice(2);
    if (d.indexOf("0") === 0) d = d.slice(1);
    return d.length >= 8 && d.length <= 11 ? "60" + d : "";
  }
  function demoView(u) {
    var end = null;
    if (u.cardStart) { end = new Date(u.cardStart); end.setMonth(end.getMonth() + 1); }
    return { name: u.name, stamps: u.stamps, size: SIZE, cardStart: u.cardStart, expires: end && end.toISOString(),
      stampedToday: false, freeDrinks: u.freeDrinks };
  }
  function demoApi(r) {
    var db = demoDb(), u = null, k;
    if (r.token) for (k in db) if (db[k].token === r.token) u = db[k];
    if (u && u.cardStart && u.stamps > 0 && u.stamps < SIZE) {
      var end = new Date(u.cardStart); end.setMonth(end.getMonth() + 1);
      if (new Date() >= end) { u.stamps = 0; u.cardStart = null; }
    }
    var out;
    switch (r.action) {
      case "register":
        var phone = normPhone(r.phone);
        if (!String(r.name || "").trim()) out = { ok: false, error: "name" };
        else if (!phone) out = { ok: false, error: "phone" };
        else if (!/^\d{4,6}$/.test(r.pin || "")) out = { ok: false, error: "pin" };
        else if (db[phone]) out = { ok: false, error: "exists" };
        else {
          u = db[phone] = { name: String(r.name).trim().slice(0, 60), pin: r.pin, token: "demo-" + Date.now(), stamps: 0, cardStart: null, freeDrinks: 0 };
          out = { ok: true, token: u.token, card: demoView(u) };
        }
        break;
      case "login":
        u = db[normPhone(r.phone)];
        if (!u) out = { ok: false, error: "no_account" };
        else if (u.pin !== r.pin) out = { ok: false, error: "wrong_pin" };
        else { u.token = "demo-" + Date.now(); out = { ok: true, token: u.token, card: demoView(u) }; }
        break;
      case "card": out = u ? { ok: true, card: demoView(u) } : { ok: false, error: "signed_out" }; break;
      case "stamp":
        if (!u) out = { ok: false, error: "signed_out" };
        else if (u.stamps >= SIZE) out = { ok: false, error: "full", card: demoView(u) };
        else {
          if (!u.stamps) u.cardStart = new Date().toISOString();
          u.stamps++;
          out = { ok: true, stamped: true, card: demoView(u) };
        }
        break;
      case "redeem":
        if (!u) out = { ok: false, error: "signed_out" };
        else if (r.staffPin !== "0000") out = { ok: false, error: "staff_pin" };
        else if (u.stamps < SIZE) out = { ok: false, error: "not_full" };
        else { u.stamps = 0; u.cardStart = null; u.freeDrinks++; out = { ok: true, redeemed: true, card: demoView(u) }; }
        break;
      case "logout": if (u) u.token = ""; out = { ok: true }; break;
      default: out = { ok: false, error: "server" };
    }
    demoSave(db);
    return out;
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

  function msgHtml() {
    if (!state.msg) return "";
    return '<p class="stamp-msg' + (state.msg.ok ? " stamp-msg--ok" : "") + '" role="status">' + esc(state.msg.text) + "</p>";
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

    var demo = STAMP_API ? "" : '<p class="stamp-demo">' + esc(tr("demo")) + "</p>";
    var h = demo;

    if (state.view === "loading") {
      h += '<p class="stamp-muted">' + esc(tr("loading")) + "</p>";
    } else if (state.view === "auth") {
      var up = state.mode === "signup";
      h += "<p>" + esc(tr("intro")) + "</p>" +
        '<p class="stamp-muted stamp-note">' + esc(sload(PENDING_KEY) ? tr("pending") : tr("how")) + "</p>" +
        '<div class="stamp-switch" role="group">' +
          '<button type="button" data-mode="signup" aria-pressed="' + up + '">' + esc(tr("signup")) + "</button>" +
          '<button type="button" data-mode="signin" aria-pressed="' + !up + '">' + esc(tr("signin")) + "</button></div>" +
        '<form class="stamp-form" id="stamp-form" novalidate>' +
          (up ? '<label>' + esc(tr("name")) + '<input name="name" autocomplete="name" maxlength="60" required></label>' : "") +
          '<label>' + esc(tr("phone")) + '<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="012-345 6789" required></label>' +
          '<label>' + esc(tr("pin")) + '<input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="' + (up ? "new-password" : "current-password") + '" required></label>' +
          (up ? '<label>' + esc(tr("pin2")) + '<input name="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" required></label>' : "") +
          (state.error ? '<p class="stamp-error" role="alert">' + esc(state.error) + "</p>" : "") +
          '<button class="ba-btn ba-btn--primary" type="submit">' + esc(up ? tr("create") : tr("go")) + "</button>" +
        "</form>";
    } else if (state.view === "card" || state.view === "staff") {
      var c = state.card;
      h += '<p class="stamp-hi">' + esc(tr("hi", { name: c.name })) + "</p>" +
        '<p class="stamp-muted">' + esc(tr("intro")) + "</p>" +
        grid(c) +
        '<p class="stamp-progress">' + esc(tr("count", { n: c.stamps })) + "</p>";
      if (c.stamps >= SIZE) h += "<p>" + esc(tr("full")) + "</p>";
      else if (c.expires && c.stamps > 0) h += '<p class="stamp-muted">' + esc(tr("ends", { date: fmtDate(c.expires) })) + "</p>";
      else h += '<p class="stamp-muted">' + esc(tr("fresh")) + "</p>";
      if (c.stampedToday && c.stamps < SIZE) h += '<p class="stamp-note">' + esc(tr("today")) + "</p>";
      h += msgHtml();
      if (state.view === "staff") {
        h += '<form class="stamp-form stamp-note" id="staff-form" novalidate>' +
          '<p class="stamp-muted">' + esc(tr("staffHelp")) + "</p>" +
          '<label>' + esc(tr("staffPin")) + '<input name="staffPin" type="password" inputmode="numeric" autocomplete="off" required></label>' +
          (state.error ? '<p class="stamp-error" role="alert">' + esc(state.error) + "</p>" : "") +
          '<div class="stamp-actions"><button class="ba-btn ba-btn--primary" type="submit">' + esc(tr("confirm")) + "</button>" +
          '<button class="ba-btn ba-btn--outline" type="button" data-act="cancel">' + esc(tr("cancel")) + "</button></div></form>";
      } else {
        h += '<div class="stamp-actions">';
        if (c.stamps >= SIZE) h += '<button class="ba-btn ba-btn--primary" type="button" data-act="claim">' + esc(tr("claim")) + "</button>";
        if (!STAMP_API && c.stamps < SIZE) h += '<button class="ba-btn ba-btn--outline" type="button" data-act="simulate">' + esc(tr("simulate")) + "</button>";
        h += "</div>";
        if (c.freeDrinks > 0) h += '<p class="stamp-muted stamp-note">' + esc(tr("earned", { n: c.freeDrinks })) + "</p>";
        h += '<button class="stamp-link" type="button" data-act="signout">' + esc(tr("signout")) + "</button>";
      }
    }
    body.innerHTML = h;
    body.classList.toggle("stamp-busy", state.busy);
    state.fresh = -1;   // the stamp animation plays once
  }

  // ---- Actions ----
  function setCard(card) { state.card = card; state.view = "card"; state.error = ""; }

  function signedOut() {
    store(TOKEN_KEY, null);
    state.card = null; state.view = "auth"; state.mode = "signin";
  }

  function busy(p) {
    state.busy = true; render();
    return p.then(function (r) { state.busy = false; return r; });
  }

  function refresh() {
    var token = load(TOKEN_KEY);
    if (!token) { state.view = "auth"; render(); return Promise.resolve(); }
    return api("card", { token: token }).then(function (r) {
      if (r.ok) setCard(r.card);
      else if (r.error === "signed_out") signedOut();
      else { state.view = state.card ? "card" : "auth"; state.error = errText(r.error); }
      render();
    });
  }

  // Apply a stamp waiting from a QR scan, once the customer is signed in
  function applyPending() {
    var code = sload(PENDING_KEY), token = load(TOKEN_KEY);
    if (!code || !token) return Promise.resolve();
    sstore(PENDING_KEY, null);
    return busy(api("stamp", { token: token, code: code })).then(function (r) {
      if (r.card) setCard(r.card);
      if (r.ok) { state.fresh = r.card.stamps - 1; state.msg = { text: tr("stamped", { n: r.card.stamps }), ok: true }; }
      else if (r.error === "signed_out") { signedOut(); sstore(PENDING_KEY, code); }
      else state.msg = { text: errText(r.error), ok: false };
      render();
    });
  }

  body.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || state.busy) return;
    if (b.dataset.mode) { state.mode = b.dataset.mode; state.error = ""; render(); return; }
    var act = b.dataset.act, token = load(TOKEN_KEY);
    if (act === "claim") { state.view = "staff"; state.error = ""; state.msg = null; render(); focusFirst(); }
    else if (act === "cancel") { state.view = "card"; state.error = ""; render(); }
    else if (act === "simulate") { sstore(PENDING_KEY, "demo"); state.msg = null; applyPending(); }
    else if (act === "signout") {
      api("logout", { token: token });
      store(TOKEN_KEY, null); state.card = null; state.msg = null; state.view = "auth"; state.mode = "signin"; render();
    }
  });

  body.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.busy) return;
    var f = e.target, v = function (n) { return f.elements[n] ? f.elements[n].value.trim() : ""; };
    if (f.id === "stamp-form") {
      var up = state.mode === "signup";
      var err = "";
      if (up && !v("name")) err = "name";
      else if (!normPhone(v("phone"))) err = "phone";
      else if (!/^\d{4,6}$/.test(v("pin"))) err = "pin";
      else if (up && v("pin") !== v("pin2")) err = "pin2";
      if (err) { state.error = errText(err); render(); restore(f); return; }
      var saved = { name: v("name"), phone: v("phone") };
      busy(api(up ? "register" : "login", { name: v("name"), phone: v("phone"), pin: v("pin") })).then(function (r) {
        if (r.ok) {
          store(TOKEN_KEY, r.token); setCard(r.card); state.msg = null; render();
          applyPending();
        } else {
          state.error = errText(r.error);
          if (r.error === "exists") state.mode = "signin";
          if (r.error === "no_account") state.mode = "signup";
          render(); restore(body.querySelector("#stamp-form"), saved);
        }
      });
    } else if (f.id === "staff-form") {
      busy(api("redeem", { token: load(TOKEN_KEY), staffPin: v("staffPin") })).then(function (r) {
        if (r.ok) { setCard(r.card); state.msg = { text: tr("redeemed"), ok: true }; }
        else if (r.error === "signed_out") signedOut();
        else state.error = errText(r.error);
        render();
      });
    }
  });

  // Keep what the customer typed when the form re-renders with an error
  function restore(f, vals) {
    if (!f) return;
    vals = vals || {};
    ["name", "phone"].forEach(function (n) { if (f.elements[n] && vals[n] != null) f.elements[n].value = vals[n]; });
  }

  // ---- Opening and closing ----
  var isOpen = false;
  function focusFirst() {
    var el = panel.querySelector("input, .stamp-panel__body button, .stamp-panel__close");
    if (el) el.focus({ preventScroll: true });
  }
  function open() {
    if (isOpen) return;
    isOpen = true;
    panel.hidden = false; scrim.hidden = false;
    panel.inert = false;
    requestAnimationFrame(function () { panel.classList.add("is-open"); scrim.classList.add("is-open"); });
    tab.setAttribute("aria-expanded", "true");
    tab.classList.add("is-hidden");
    setTimeout(focusFirst, 50);
    if (state.view === "card" || state.view === "auth") refresh();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove("is-open"); scrim.classList.remove("is-open");
    panel.inert = true;
    tab.setAttribute("aria-expanded", "false");
    tab.classList.remove("is-hidden");
    setTimeout(function () { if (!isOpen) scrim.hidden = true; }, 300);
    state.msg = null;
    if (state.view === "staff") state.view = "card";
    tab.focus({ preventScroll: true });
  }
  tab.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  scrim.addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) close(); });
  document.addEventListener("ba:lang", render);

  // ---- Start ----
  panel.inert = true;
  tab.hidden = false;
  // Arriving from the counter QR code: remember the code, tidy the address bar and open the card
  var params = new URLSearchParams(location.search);
  var code = params.get("stamp");
  if (code) {
    sstore(PENDING_KEY, code);
    params.delete("stamp");
    var qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }
  refresh().then(function () {
    if (sload(PENDING_KEY)) { open(); applyPending(); }
  });
})();
