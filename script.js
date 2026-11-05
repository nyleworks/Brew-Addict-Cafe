// Brew Addict Café: language switch, menu, "Now" pill, and the scroll-driven hero and day-to-night sky.

(function () {
  "use strict";

  var TZ = "Asia/Kuching"; // UTC+8, same clock as Kundasang
  var OPEN_MIN = 10 * 60;        // 10:00 AM
  var CLOSE_MIN = 23 * 60 + 30;  // 11:30 PM

  // ---- Copy, in English and Bahasa Melayu ----
  var STRINGS = {
    en: {
      "skip": "Skip to content", "top": "Back to top",
      "nav.menu": "Menu", "nav.story": "Our story", "nav.visit": "Visit",
      "now": "Now",
      "time.1000": "Doors open", "time.1500": "The mountain is out", "time.1900": "The fog rolls in",
      "time.2100": "Still brewing", "time.2330": "Closing time",
      "hero.eyebrow": "Brew Addict Café · Kundasang",
      "hero.title": "Open late",
      "hero.lede": "The night-coffee hideout off the Sinisian road. Open from morning mist till 11:30 at night.",
      "cta.menu": "See the menu", "cta.whatsapp": "WhatsApp us", "cta.directions": "Get directions", "cta.foodpanda": "Order on foodpanda",
      "story.title": "Kundasang, after dark",
      "story.p1": "Everyone pictures Kundasang at 7 AM, with Kinabalu in full sun. We're Kundasang at 8:30 PM.",
      "story.p2": "Dark jackets, an iced matcha sweating next to a steaming latte, and the espresso machine still humming when the rest of town has gone quiet.",
      "story.p3": "Come by in the afternoon while the mountain is out. Stay until the fog rolls in.",
      "menu.title": "The menu",
      "menu.note": "Prices in RM.", "menu.col.hot": "Hot", "menu.col.iced": "Iced", "menu.col.price": "RM", "menu.none": "not served",
      "night.title": "Still open",
      "night.lede": "Steam, string lights and a warm cup when the highland cold sets in. No rush. We're here till 11:30 at night.",
      "visit.title": "Find us", "visit.where": "Where", "visit.near": "Near the Sinisian junction.",
      "visit.hours": "Hours", "visit.daily": "Daily, 10:00 AM – 11:30 PM", "visit.contact": "Phone / WhatsApp",
      "sign.alt": "The café's white A-frame sign: WELCOME, Brew Addict, opening hours 10.00am – 11.30pm", "photo.drinks": "Photo: drinks",
      "photo.aframe": "Photo: the A-frame", "photo.night": "Photo: the café at night"
    },
    ms: {
      "skip": "Langkau ke kandungan", "top": "Kembali ke atas",
      "nav.menu": "Menu", "nav.story": "Kisah kami", "nav.visit": "Lawati",
      "now": "Sekarang",
      "time.1000": "Pintu dibuka", "time.1500": "Gunung kelihatan", "time.1900": "Kabus mula turun",
      "time.2100": "Masih membancuh", "time.2330": "Waktu tutup",
      "hero.eyebrow": "Brew Addict Café · Kundasang",
      "hero.title": "Buka hingga lewat malam",
      "hero.lede": "Tempat lepak kopi malam di tepi jalan Sinisian. Buka dari kabus pagi hingga 11:30 malam.",
      "cta.menu": "Lihat menu", "cta.whatsapp": "WhatsApp kami", "cta.directions": "Dapatkan arah", "cta.foodpanda": "Pesan di foodpanda",
      "story.title": "Kundasang, selepas gelap",
      "story.p1": "Semua orang membayangkan Kundasang pada 7 pagi, dengan Kinabalu disinari matahari. Kami ialah Kundasang pada 8:30 malam.",
      "story.p2": "Jaket tebal, matcha ais berembun di sebelah latte berasap, dan mesin espresso masih berdengung ketika seluruh pekan sudah sunyi.",
      "story.p3": "Singgah pada waktu petang ketika gunung kelihatan. Duduklah sampai kabus turun.",
      "menu.title": "Menu",
      "menu.note": "Harga dalam RM.", "menu.col.hot": "Panas", "menu.col.iced": "Sejuk", "menu.col.price": "RM", "menu.none": "tiada",
      "night.title": "Masih buka",
      "night.lede": "Wap, lampu berkelip dan secawan minuman panas ketika sejuk tanah tinggi tiba. Tak perlu tergesa-gesa. Kami di sini hingga 11:30.",
      "visit.title": "Cari kami", "visit.where": "Lokasi", "visit.near": "Berhampiran simpang Sinisian.",
      "visit.hours": "Waktu operasi", "visit.daily": "Setiap hari, 10:00 AM – 11:30 PM", "visit.contact": "Telefon / WhatsApp",
      "sign.alt": "Papan tanda A-frame putih kafe: WELCOME, Brew Addict, waktu operasi 10.00 pagi – 11.30 malam", "photo.drinks": "Foto: minuman",
      "photo.aframe": "Foto: papan tanda", "photo.night": "Foto: kafe pada waktu malam"
    }
  };

  // ---- Menu, from the café's menu board (prices in RM). ----
  // Drinks have a hot and an iced price; null means that version isn't served.
  var MENU = [
    { cat: { en: "Coffee", ms: "Kopi" }, cols: ["hot", "iced"], items: [
      { name: "Brew Addict Signature", hot: null, iced: 15 },
      { name: "Americano", hot: 8, iced: 9 },
      { name: "Caffe Latte", hot: 10, iced: 13 },
      { name: "Spanish Latte", hot: 10, iced: 13 },
      { name: "Vanilla Latte", hot: 10, iced: 13 },
      { name: "Hazelnut Latte", hot: 10, iced: 13 },
      { name: "Caramel Macchiato", hot: 10, iced: 15 }
    ]},
    { cat: { en: "Non-coffee", ms: "Bukan kopi" }, cols: ["hot", "iced"], items: [
      { name: "Cocoa Royale", hot: 10, iced: 15 },
      { name: "Matcha Strawberry", hot: null, iced: 15 },
      { name: "Matcha Blossom", hot: null, iced: 15 },
      { name: "Matcha Mango", hot: null, iced: 15 },
      { name: "Matcha Latte", hot: null, iced: 11 },
      { name: "Matcha Cloud", hot: null, iced: 15 },
      { name: "Jasmine Tea", hot: null, iced: 10 },
      { name: "Pink Soda", hot: null, iced: 10 }
    ]},
    { cat: { en: "Add-ons", ms: "Tambahan" }, cols: ["price"], items: [
      { name: "Extra Shot", price: 2 },
      { name: "Whip Cream", price: 2 },
      { name: "Cold Foam", price: 2 },
      { name: "Syrup", price: 2 }
    ]}
  ];

  var lang = "en";

  function storeGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }

  function t(key) { return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || ""; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderMenu() {
    var grid = document.getElementById("menu-grid");
    if (!grid) return;
    grid.innerHTML = "";
    MENU.forEach(function (group) {
      var cat = el("div", "menu-cat menu-cat--cols-" + group.cols.length);
      var head = el("div", "menu-cat__head");
      head.appendChild(el("h3", "h3", group.cat[lang]));
      group.cols.forEach(function (c) { head.appendChild(el("span", "menu-cat__col", t("menu.col." + c))); });
      cat.appendChild(head);
      group.items.forEach(function (item) {
        var row = el("div", "ba-menu-item");
        row.appendChild(el("span", "ba-menu-item__name", item.name));
        group.cols.forEach(function (c) {
          var v = item[c];
          var cell = el("span", "ba-menu-item__price" + (v == null ? " is-none" : ""), v == null ? "—" : String(v));
          cell.setAttribute("aria-label", t("menu.col." + c) + ": " + (v == null ? t("menu.none") : "RM " + v));
          row.appendChild(cell);
        });
        cat.appendChild(row);
      });
      grid.appendChild(cat);
    });
  }

  function applyLang(next) {
    lang = STRINGS[next] ? next : "en";
    document.documentElement.lang = lang === "ms" ? "ms" : "en";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n"));
      if (v) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-label]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-label"));
      if (v) el.setAttribute("aria-label", v);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-alt"));
      if (v) el.setAttribute("alt", v);
    });
    document.querySelectorAll(".ba-lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false");
    });
    renderMenu();
    tick();
    document.dispatchEvent(new CustomEvent("ba:lang", { detail: lang }));   // stamp-card.js re-renders
    relayout();   // text lengths changed, so the hero's measurements did too
  }

  // ---- Time in Kundasang ----
  function kundasangNow() {
    var parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    var h = 0, m = 0;
    parts.forEach(function (p) { if (p.type === "hour") h = +p.value; if (p.type === "minute") m = +p.value; });
    return h * 60 + m;
  }

  // Which section is "Now": 10–14:59, 15–18:59, 19–20:59, 21–23:29, closed → last.
  function currentSlot(mins) {
    if (mins < OPEN_MIN || mins >= CLOSE_MIN) return 4;
    if (mins < 15 * 60) return 0;
    if (mins < 19 * 60) return 1;
    if (mins < 21 * 60) return 2;
    return 3;
  }

  // Show the "Now" pill on the section that matches the time in Kundasang
  function tick() {
    var slot = currentSlot(kundasangNow());
    document.querySelectorAll("[data-slot]").forEach(function (sec) {
      var pill = sec.querySelector(".ba-time__now");
      if (pill) pill.hidden = +sec.getAttribute("data-slot") !== slot;
    });
  }

  document.querySelectorAll(".ba-lang button").forEach(function (b) {
    b.addEventListener("click", function () {
      var next = b.getAttribute("data-lang");
      storeSet("ba-lang", next);
      applyLang(next);
    });
  });

  // ---- The day-to-night sky: fade the page from morning light to night as you scroll ----
  var root = document.documentElement;
  var header = document.querySelector(".site-header");
  var progressBar = document.getElementById("scroll-progress");
  var slots = Array.prototype.slice.call(document.querySelectorAll("[data-slot]"));
  var stops = [];
  var lastSky = "";
  var skyEls = Array.prototype.slice.call(document.querySelectorAll(".site-header, .sky, .stamp-tab"));
  // Sizes read once per layout change, so scrolling never has to ask the browser to lay the page out again
  var layoutCache = { max: 1, headerH: 72, clockH: 48, vh: window.innerHeight };
  function measureLayout() {
    layoutCache.vh = window.innerHeight;
    layoutCache.max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    layoutCache.headerH = header ? header.offsetHeight : 72;
    var ck = document.getElementById("scroll-clock");
    layoutCache.clockH = (ck && ck.offsetHeight) || 48;
  }

  function hexToRgb(hex) {
    hex = hex.trim().replace("#", "");
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }

  // Each section holds its own colour while it fills the middle of the screen;
  // the colour fades to the next one across the band between them.
  function measure() {
    var css = getComputedStyle(root);
    var names = ["--time-1000", "--time-1500", "--time-1900", "--time-2100", "--time-2330"];
    stops = slots.map(function (sec, i) {
      var r = sec.getBoundingClientRect();
      var top = r.top + window.scrollY;
      return { top: top, bottom: top + r.height, rgb: hexToRgb(css.getPropertyValue(names[i])) };
    });
  }

  var INK_DAY = [22, 20, 18], INK_NIGHT = [242, 237, 228];
  var themed = slots.concat(header ? [header] : [], document.getElementById("scroll-clock") || []);
  var isNight = null;

  function luminance(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function mix(a, b, t) {
    return [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * t); });
  }

  function skyAt(y) {
    if (!stops.length) return [245, 242, 236];
    if (y <= stops[0].bottom) return stops[0].rgb;
    for (var i = 0; i < stops.length - 1; i++) {
      var a = stops[i], b = stops[i + 1];
      if (y <= a.bottom) return a.rgb;
      if (y < b.top) {
        var t = (y - a.bottom) / (b.top - a.bottom);
        t = t * t * (3 - 2 * t); // ease in and out
        return mix(a.rgb, b.rgb, t);
      }
    }
    return stops[stops.length - 1].rgb;
  }

  // ---- Sun, sunset, crescent: the icon by the wordmark follows the same scroll ----
  var SVGNS = "http://www.w3.org/2000/svg";
  var sun = document.getElementById("sky-sun");
  var raysG = document.getElementById("sky-rays");
  var clipRect = document.getElementById("sky-icon-clip-rect");
  var horizon = document.getElementById("sky-horizon");
  var moon = document.getElementById("sky-moon");
  var rays = [];
  if (raysG) {
    for (var r = 0; r < 8; r++) {
      var ln = document.createElementNS(SVGNS, "line");
      raysG.appendChild(ln);
      rays.push({ el: ln, a: r * Math.PI / 4 });
    }
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // Where the middle of the screen sits along the day: 0 at the 10 AM section, 1 at 3 PM, 2 at 7 PM …
  function dayIndex(y) {
    if (!stops.length || y <= stops[0].top) return 0;
    for (var i = 0; i < stops.length - 1; i++) {
      if (y < stops[i + 1].top) return i + (y - stops[i].top) / (stops[i + 1].top - stops[i].top);
    }
    var last = stops[stops.length - 1];
    return stops.length - 1 + clamp01((y - last.top) / Math.max(1, last.bottom - last.top));
  }

  var lastIdx = -1;
  function paintIcon(idx) {
    if (!sun) return;
    idx = Math.round(idx * 500) / 500;
    if (idx === lastIdx) return;
    lastIdx = idx;
    var set = clamp01((idx - 1.25) / 0.75);   // afternoon → dusk: the sun sinks behind the horizon
    var rise = clamp01((idx - 2.05) / 0.6);   // after 7 PM the crescent comes up
    var spin = Math.min(idx, 1.25) * 40;      // rays turn slowly through the day
    var outer = 6.5 + 2.5 * (1 - set);
    rays.forEach(function (ray) {
      var a = ray.a + spin * Math.PI / 180;
      ray.el.setAttribute("x1", (12 + Math.cos(a) * 6.5).toFixed(2));
      ray.el.setAttribute("y1", (12 + Math.sin(a) * 6.5).toFixed(2));
      ray.el.setAttribute("x2", (12 + Math.cos(a) * outer).toFixed(2));
      ray.el.setAttribute("y2", (12 + Math.sin(a) * outer).toFixed(2));
    });
    raysG.setAttribute("opacity", (1 - set).toFixed(3));
    sun.setAttribute("transform", "translate(0 " + (set * 9).toFixed(2) + ")");
    clipRect.setAttribute("height", set > 0 ? "17" : "24");
    sun.setAttribute("opacity", set >= 1 ? "0" : "1");
    horizon.setAttribute("opacity", (clamp01(set * 3) * (1 - rise)).toFixed(3));
    moon.setAttribute("opacity", rise.toFixed(3));
    moon.setAttribute("transform", "translate(0 " + ((1 - rise) * 5).toFixed(2) + ")");
  }

  // ---- Scroll clock: the hands run from 10:00 AM to 11:30 PM as you scroll ----
  var clockEl = document.getElementById("scroll-clock");
  var clockHour = document.getElementById("scroll-clock-hour");
  var clockMin = document.getElementById("scroll-clock-min");
  var SLOT_MINUTES = [10 * 60, 15 * 60, 19 * 60, 21 * 60];   // 10 AM, 3 PM, 7 PM, 9 PM; the page ends at 11:30 PM
  var clockTicks = document.getElementById("scroll-clock-ticks");
  if (clockTicks) {
    for (var tk = 0; tk < 12; tk++) {
      var ta = tk * Math.PI / 6, tl = document.createElementNS(SVGNS, "line"), r0 = tk % 3 === 0 ? 16 : 18;
      tl.setAttribute("x1", (24 + Math.sin(ta) * r0).toFixed(2)); tl.setAttribute("y1", (24 - Math.cos(ta) * r0).toFixed(2));
      tl.setAttribute("x2", (24 + Math.sin(ta) * 20).toFixed(2)); tl.setAttribute("y2", (24 - Math.cos(ta) * 20).toFixed(2));
      clockTicks.appendChild(tl);
    }
  }

  // Minutes since midnight for the current scroll position: each section's top is its time,
  // and the very bottom of the page is closing time.
  function scrollMinutes(max) {
    var y = window.scrollY, knots = [];
    stops.forEach(function (st, i) {
      if (i < SLOT_MINUTES.length) knots.push([i === 0 ? 0 : Math.min(st.top - 80, max), SLOT_MINUTES[i]]);
    });
    knots.push([max, CLOSE_MIN]);
    if (y <= knots[0][0]) return knots[0][1];
    for (var i = 0; i < knots.length - 1; i++) {
      var a = knots[i], b = knots[i + 1];
      if (y <= b[0]) return a[1] + (b[1] - a[1]) * ((y - a[0]) / Math.max(1, b[0] - a[0]));
    }
    return CLOSE_MIN;
  }

  function paintClock() {
    if (!clockEl) return;
    var max = layoutCache.max;
    var p = Math.min(1, window.scrollY / max);
    // The clock appears once you're halfway down the page; while it's hidden there's nothing to draw
    clockEl.classList.toggle("is-shown", p >= 0.5);
    if (p < 0.45) return;
    var mins = scrollMinutes(max);
    // CSS rotations (not SVG attributes), which Safari can redraw without laying the drawing out again
    clockHour.style.transform = "rotate(" + ((mins / 60) % 12 * 30).toFixed(1) + "deg)";
    clockMin.style.transform = "rotate(" + ((mins % 60) * 6).toFixed(1) + "deg)";
    // Ride down the right edge like a scroll thumb, between the header and the bottom of the screen
    var headerH = layoutCache.headerH;
    var travel = layoutCache.vh - headerH - layoutCache.clockH - 32;
    clockEl.style.transform = "translate3d(0," + Math.round(headerH + 16 + Math.max(0, travel) * p) + "px,0)";
    // At the very bottom, the up arrow rises out of the clock
    clockEl.classList.toggle("is-end", window.scrollY >= max - 4);
  }

  // Tapping the clock goes back to the top (10:00 AM)
  if (clockEl) clockEl.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  // ---- Hero: the big wordmark flies into the header, then the signboard drops in from above the screen,
  // lands, teeters on one leg then the other and settles, then the text and buttons rise in from below.
  // All driven by scrolling. Sizes are measured once (measureHero) so scrolling only writes transforms. ----
  var heroSec = document.getElementById("top");
  var stage = document.getElementById("hero-stage");
  var scene = document.getElementById("hero-scene");
  var signDrop = document.getElementById("sign-drop");
  var signImg = document.getElementById("sign-img");
  var signShadow = document.getElementById("sign-shadow");
  var heroMark = document.getElementById("hero-mark");
  var headerMark = document.querySelector(".header-mark");
  var risers = stage ? Array.prototype.slice.call(stage.querySelectorAll("[data-rise]")) : [];
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Where the sign's feet touch the ground in the image (it's a 3/4 view): left foot and front-right foot
  var FOOT_L = "19.4% 90.7%", FOOT_R = "68.5% 99.7%";
  var MARK_END = 0.16, SIGN_START = 0.12;   // share of the hero scroll: wordmark flight, then the sign
  var geo = null;

  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function measureHero() {
    if (!stage || !signDrop) { geo = null; return; }
    var top = header ? header.offsetHeight : 72;
    root.style.setProperty("--header-h", top + "px");
    var vh = window.innerHeight, lane = signDrop.parentNode, timeRow = stage.querySelector(".ba-time");
    geo = {
      top: top,
      start: heroSec.offsetTop - top,
      travel: Math.max(1, heroSec.offsetHeight - stage.offsetHeight),
      stageH: stage.clientHeight,
      overflow: Math.max(0, scene.offsetHeight - stage.clientHeight),
      signTop: top + lane.offsetTop + signDrop.offsetTop,
      signH: signDrop.offsetHeight,
      risers: risers.map(function (el) { return el.offsetTop + el.parentNode.offsetTop; })
    };
    if (heroMark && headerMark) {
      var w = heroMark.offsetWidth, h = heroMark.offsetHeight;
      var floor = timeRow ? top + timeRow.offsetTop + timeRow.offsetHeight + 8 : top + 12;
      var r = headerMark.getBoundingClientRect();   // the header is sticky, so this doesn't move
      geo.mark = {
        // Start: centred in the screen below the header (never over the 10:00 AM time row)
        x0: (root.clientWidth - w) / 2, y0: Math.max(floor, top + (vh - top - h) / 2),
        // End: exactly over the header's own wordmark
        x1: r.left, y1: r.top,
        s1: parseFloat(getComputedStyle(headerMark).fontSize) / parseFloat(getComputedStyle(heroMark).fontSize)
      };
    }
  }

  // Every moving part of the hero for one point of its scroll (raw: 0 at the top of the hero, 1 at its end),
  // as [element, styles] pairs. Used both to paint directly and to build the scroll-linked CSS animation.
  function heroFrame(raw) {
    var out = [];
    var m = geo.mark;
    if (m) {
      var t = seg(raw, 0, MARK_END), e = easeInOut(t);
      // Once docked it stays at the header position (hidden), so the animation never slides it anywhere else
      out.push([heroMark, {
        transform: "translate3d(" + (m.x0 + (m.x1 - m.x0) * e).toFixed(1) + "px," + (m.y0 + (m.y1 - m.y0) * e).toFixed(1) + "px,0) scale(" + (1 + (m.s1 - 1) * e).toFixed(4) + ")",
        visibility: t >= 1 ? "hidden" : "visible" }]);
      out.push([headerMark, { opacity: t >= 1 ? "1" : "0" }]);
    }
    // The sign waits until the big wordmark has mostly flown up into the header
    var p = seg(raw, SIGN_START, 1);
    var fall = seg(p, 0, 0.32);               // drop: speeds up like gravity
    var squash = seg(p, 0.32, 0.40);          // landing thud
    var wobble = seg(p, 0.37, 0.62);          // teeters on one leg, then the other, then balances

    // As the text arrives, pan the scene up just enough for the text to fit under the big sign
    var pan = geo.overflow * easeOut(seg(p, 0.56, 0.86));
    out.push([scene, { transform: pan ? "translate3d(0," + (-pan).toFixed(1) + "px,0)" : "none" }]);

    // Start with the whole sign above the top of the screen
    var start = -(geo.signTop - pan + geo.signH + 24);
    var dy = start * (1 - fall * fall);
    var sq = squash > 0 && squash < 1 ? Math.sin(squash * Math.PI) : 0;
    out.push([signDrop, { transform: "translate3d(0," + dy.toFixed(1) + "px,0) scale(" + (1 + sq * 0.035).toFixed(4) + "," + (1 - sq * 0.05).toFixed(4) + ")" }]);

    var angle = 0;
    if (wobble > 0 && wobble < 1) angle = 12 * Math.exp(-3.2 * wobble) * Math.sin(wobble * Math.PI * 3.5);
    out.push([signImg, { transformOrigin: angle >= 0 ? FOOT_R : FOOT_L, transform: angle ? "rotate(" + angle.toFixed(2) + "deg)" : "none" }]);

    // The shadow gathers as the sign nears the ground and slides with the tip
    var near = fall * fall;
    out.push([signShadow, { opacity: (near * 0.95).toFixed(3),
      transform: "translateX(" + (angle * 2).toFixed(1) + "px) scale(" + (0.35 + 0.65 * near).toFixed(3) + "," + (0.5 + 0.5 * near).toFixed(3) + ")" }]);

    // Text and buttons: each starts just below the bottom of the screen and glides up into place, one after another
    risers.forEach(function (el, i) {
      var r = easeOut(seg(p, 0.58 + i * 0.05, 0.80 + i * 0.05));
      var below = Math.max(0, geo.stageH - (geo.risers[i] - pan)) + 24;
      out.push([el, { transform: r >= 1 ? "none" : "translate3d(0," + ((1 - r) * below).toFixed(1) + "px,0)" }]);
    });
    return out;
  }

  // Where the browser can tie animations to the scroll position itself (Safari 26, recent Chrome), the hero runs
  // as CSS scroll-driven animations: they move in step with the scroll instead of a frame behind it, which is
  // what made the wordmark and the sign look choppy on iPhones. Elsewhere, scrolling paints each frame.
  var cssScroll = !reduceMotion && window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()");
  var heroStyle = null;
  var HERO_STEPS = 200;
  function buildHeroAnimation() {
    if (!cssScroll || !geo) return;
    var frames = [];
    for (var i = 0; i <= HERO_STEPS; i++) frames.push(heroFrame(i / HERO_STEPS));
    var css = "";
    frames[0].forEach(function (pair, k) {
      var name = "ba-hero-" + k;
      css += "@keyframes " + name + "{";
      frames.forEach(function (f, i) {
        var st = f[k][1], decl = "";
        Object.keys(st).forEach(function (prop) {
          decl += prop.replace(/[A-Z]/g, function (c) { return "-" + c.toLowerCase(); }) + ":" + st[prop] + ";";
        });
        css += (i * 100 / HERO_STEPS).toFixed(3) + "%{" + decl + "}";
      });
      css += "}";
      var el = pair[0];
      el.style.animation = name + " 1s linear both";
      el.style.animationTimeline = "scroll(root)";
      el.style.animationRange = Math.round(geo.start) + "px " + Math.round(geo.start + geo.travel) + "px";
    });
    if (!heroStyle) { heroStyle = document.createElement("style"); document.head.appendChild(heroStyle); }
    heroStyle.textContent = css;
    // Clear what direct painting left behind, so the animation is in charge
    frames[0].forEach(function (pair) { Object.keys(pair[1]).forEach(function (prop) { pair[0].style[prop] = ""; }); });
  }

  function paintHero() {
    if (!geo) return;
    var raw = reduceMotion ? 1 : clamp01((window.scrollY - geo.start) / geo.travel);
    if (geo.mark) {
      root.classList.toggle("mark-docked", seg(raw, 0, MARK_END) >= 1);
      var col = isNight ? "var(--ink-on-night)" : "";
      if (heroMark.style.color !== col) heroMark.style.color = col;
    }
    if (cssScroll) return;
    heroFrame(raw).forEach(function (pair) {
      var el = pair[0], st = pair[1];
      Object.keys(st).forEach(function (prop) {
        var v = st[prop] === "none" && prop === "transform" ? "" : st[prop];
        if (el.style[prop] !== v) el.style[prop] = v;
      });
    });
  }

  function paintSky() {
    paintHero();
    var mid = window.scrollY + window.innerHeight / 2;
    paintIcon(dayIndex(mid));
    paintClock();
    var rgb = skyAt(mid);
    var sky = "rgb(" + rgb.join(",") + ")";
    if (sky !== lastSky) {
      // Set on the few elements that use it, not on the page root: a change on the root makes Safari restyle
      // the whole page on every scroll frame
      lastSky = sky;
      skyEls.forEach(function (el) { el.style.setProperty("--sky", sky); });
    }
    // Switch all text to whichever ink reads better on the current sky
    var night = contrast(rgb, INK_NIGHT) > contrast(rgb, INK_DAY);
    if (night !== isNight) {
      isNight = night;
      themed.forEach(function (el) { el.classList.toggle("ba-on-night", night); });
      root.classList.toggle("is-night", night);   // for fixed widgets outside the sections (stamp card)
      if (topoSegs) drawTopo(true);
    }
    var max = layoutCache.max;
    if (progressBar) progressBar.style.setProperty("--progress", max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
  }

  // ---- Mount Kinabalu contour lines behind the page ----
  // A height map of the summit plateau in metres, laid out from a topographic map of the
  // summit: the named peaks sit at their map positions, Low's Gully drops away to the
  // north-east, and the plateau falls more gently to the west and south.
  // Map units: x and y run 0–1 across the reference map's width (north is up).
  var topo = document.getElementById("topo");
  var topoSegs = null;   // contour segments in map units, built once
  var LOWS_PEAK = [0.545, 0.446];
  var PEAKS = [
    // [x, y, rise above the plateau in m, spread]
    [0.545, 0.446, 230, 0.035],  // Low's Peak, 4,095 m
    [0.540, 0.354, 190, 0.030],  // Victoria Peak
    [0.473, 0.555, 180, 0.030],  // St John's Peak
    [0.688, 0.522, 150, 0.030],  // Ugly Sisters Peak
    [0.813, 0.643, 170, 0.030],  // Donkey Ears Peak
    [0.876, 0.703, 110, 0.028],  // Tunku Abdul Rahman Peak
    [0.608, 0.768, 110, 0.035],  // South Peak
    [0.194, 0.375, 230, 0.040],  // Alexandria Peak
    [0.190, 0.270, 130, 0.025],  // Diwali Pinnacles
    [0.305, 0.379, 80, 0.025],
    [0.600, 0.316, 110, 0.030]
  ];

  function hash(x, y) {
    var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function valueNoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    var sum = 0, amp = 0.5, f = 1;
    for (var o = 0; o < 4; o++) { sum += amp * valueNoise(x * f, y * f); amp *= 0.5; f *= 2.1; }
    return sum;
  }
  function bump(x, y, cx, cy, sx, sy, k) {
    var dx = (x - cx) / sx, dy = (y - cy) / sy;
    return k * Math.exp(-(dx * dx + dy * dy));
  }
  function height(x, y) {
    var h = 3780
      + bump(x, y, 0.55, 0.52, 0.24, 0.20, 200)     // the summit dome
      - bump(x, y, 0.50, -0.10, 0.30, 0.22, 500)    // falls away north
      - bump(x, y, 0.66, -0.10, 0.13, 0.42, 1200)   // Low's Gully, the deep north-east cut
      - bump(x, y, 1.08, 0.28, 0.16, 0.24, 650)     // eastern cliffs
      - bump(x, y, 1.05, 0.70, 0.18, 0.20, 300)     // south-east slope
      - bump(x, y, -0.04, 0.35, 0.12, 0.40, 800)    // western flank
      - bump(x, y, 0.10, 0.92, 0.25, 0.22, 700)     // south-west slope
      - bump(x, y, 0.38, 0.44, 0.10, 0.07, 80);     // hollow in the plateau
    for (var p = 0; p < PEAKS.length; p++) {
      var k = PEAKS[p];
      h += bump(x, y, k[0], k[1], k[3] * 2, k[3] * 2, k[2] * 0.5)      // shoulder
         + bump(x, y, k[0], k[1], k[3] * 0.6, k[3] * 0.6, k[2] * 0.55); // spire
    }
    return h + (fbm(x * 7, y * 7) - 0.5) * 140 + (fbm(x * 22 + 5, y * 22) - 0.5) * 30;  // spurs and gullies
  }

  function buildTopo(coarse) {
    // A coarser grid on phones: the lines are drawn smaller there, so the difference doesn't show
    var x0 = -0.4, x1 = 1.4, y0 = -0.4, y1 = 1.3, N = coarse ? 140 : 210, M = Math.round(N * (y1 - y0) / (x1 - x0));
    var dx = (x1 - x0) / N, dy = (y1 - y0) / M, grid = [];
    for (var j = 0; j <= M; j++) {
      var row = [];
      for (var i = 0; i <= N; i++) row.push(height(x0 + i * dx, y0 + j * dy));
      grid.push(row);
    }
    // Marching squares, 10 m contours from 2,500 m to 4,100 m. Each grid cell only visits the
    // levels that actually cross it, which keeps this quick on phones.
    var L0 = 2500, L1 = 4100, STEP = 10, segs = [];
    for (var L = L0; L <= L1; L += STEP) segs.push({ index: L % 50 === 0, lines: [] });   // bolder every 50 m, as on the survey map
    // Which edges each crossing pattern joins: 0 top, 1 right, 2 bottom, 3 left
    var CASES = [null, [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]],
      [[3, 0]], [[0, 2]], [[3, 2], [0, 1]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], null];
    for (var j = 0; j < M; j++) {
      for (var i = 0; i < N; i++) {
        var a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i];
        var lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
        var k0 = Math.max(0, Math.ceil((lo - L0) / STEP)), k1 = Math.min(segs.length - 1, Math.floor((hi - L0) / STEP));
        var X = x0 + i * dx, Y = y0 + j * dy;
        for (var k = k0; k <= k1; k++) {
          var lv = L0 + k * STEP;
          var pairs = CASES[(a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0)];
          if (!pairs) continue;
          var pts = [
            [X + dx * (lv - a) / (b - a), Y], [X + dx, Y + dy * (lv - b) / (c - b)],
            [X + dx * (lv - d) / (c - d), Y + dy], [X, Y + dy * (lv - a) / (d - a)]
          ];
          for (var q = 0; q < pairs.length; q++) segs[k].lines.push([pts[pairs[q][0]], pts[pairs[q][1]]]);
        }
      }
    }
    return segs;
  }

  var topoSize = "";
  function drawTopo(force) {
    if (!topo || !topo.getContext) return;
    // The canvas is as tall as the largest viewport, so a phone's toolbar sliding away doesn't need a redraw
    var W = topo.clientWidth || window.innerWidth, H = topo.clientHeight || window.innerHeight;
    if (!force && topoSize === W + "x" + H) return;
    topoSize = W + "x" + H;
    if (!topoSegs) topoSegs = buildTopo(W < 720);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    topo.width = Math.round(W * dpr); topo.height = Math.round(H * dpr);
    var ctx = topo.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Fit the massif to the screen and keep the summit low and to the right
    var scale = Math.max(W, H * 1.25) * 1.05;
    var ox = W * (W < 720 ? 0.5 : 0.66) - LOWS_PEAK[0] * scale;
    var oy = H * 0.66 - LOWS_PEAK[1] * scale;
    var ink = isNight ? "242,237,228" : "22,20,18";
    topoSegs.forEach(function (lv) {
      ctx.beginPath();
      lv.lines.forEach(function (s) {
        ctx.moveTo(ox + s[0][0] * scale, oy + s[0][1] * scale);
        ctx.lineTo(ox + s[1][0] * scale, oy + s[1][1] * scale);
      });
      ctx.lineWidth = lv.index ? 1 : 0.6;
      ctx.strokeStyle = "rgba(" + ink + "," + (lv.index ? 0.17 : (isNight ? 0.07 : 0.065)) + ")";
      ctx.stroke();
    });
    // Summit marker, as on a survey map
    var px = ox + LOWS_PEAK[0] * scale, py = oy + LOWS_PEAK[1] * scale;
    ctx.fillStyle = "rgba(" + ink + "," + (isNight ? 0.4 : 0.45) + ")";
    ctx.beginPath(); ctx.moveTo(px, py - 5); ctx.lineTo(px + 5, py + 4); ctx.lineTo(px - 5, py + 4); ctx.closePath(); ctx.fill();
  }

  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () { queued = false; paintSky(); });
  }

  // Re-measure everything that depends on layout, then repaint
  var ready = false;
  function relayout() {
    if (!ready) return;
    measureLayout();
    measure();
    measureHero();
    buildHeroAnimation();
    paintSky();
  }

  if (slots.length) {
    root.classList.add("js-sky");
    if (heroMark && headerMark) root.classList.add("js-mark");
    ready = true;
    window.addEventListener("scroll", onScroll, { passive: true });
    // Build the contours once the page has painted (and when the browser is idle, if it can tell us)
    window.setTimeout(function () {
      (window.requestIdleCallback || function (fn) { fn(); })(function () { drawTopo(true); }, { timeout: 800 });
    }, 0);
    // Phones resize the window whenever their toolbar slides in or out while scrolling. Re-measuring then would
    // stall the scroll, so a height-only change waits until the resizing has stopped.
    var resizeQueued = false, lastW = window.innerWidth, heightTimer = 0;
    window.addEventListener("resize", function () {
      if (window.innerWidth === lastW) {
        clearTimeout(heightTimer);
        heightTimer = setTimeout(function () { relayout(); if (topoSegs) drawTopo(); }, 300);
        return;
      }
      lastW = window.innerWidth;
      if (resizeQueued) return;
      resizeQueued = true;
      window.requestAnimationFrame(function () { resizeQueued = false; relayout(); if (topoSegs) drawTopo(); });
    });
    // The page can grow after it loads (images, the menu); keep the scroll length up to date
    if (window.ResizeObserver) new ResizeObserver(function () { measureLayout(); }).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    window.addEventListener("load", relayout);
  }

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  applyLang(storeGet("ba-lang") || "en");   // also measures and paints the first frame
  setInterval(tick, 20000);
})();
