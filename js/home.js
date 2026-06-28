/* Ana sayfa: grupları yükle, çift butonlu kartları oluştur, kuralları göster,
   her grubun export'unu okuyup üye/mesaj sayısını hesapla. */

(function () {
  "use strict";

  var WA_ICON =
    '<svg class="wa-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.02ZM12.04 20.2h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14 0-.31-.01-.47-.01a.9.9 0 0 0-.65.31c-.22.25-.86.84-.86 2.05 0 1.21.88 2.38 1 2.55.12.17 1.73 2.64 4.2 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return n.toLocaleString("tr-TR"); }
  function statBlock(v, l) { return '<div class="stat"><b>' + v + '</b><small>' + l + "</small></div>"; }
  function groupUrl(slug) { return "group.html?g=" + encodeURIComponent(slug); }

  function loadStats(slug) {
    return fetch("data/chats/" + slug + ".txt", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (txt) {
        if (txt == null || !txt.trim()) return null;
        var p = WAParser.parse(txt);
        return { members: p.memberCount, messages: p.messageCount };
      })
      .catch(function () { return null; });
  }

  function buildHero(g) {
    var el = document.createElement("div");
    el.className = "hero";
    el.innerHTML =
      '<div class="hero__row">' +
        '<div class="hero__logo"></div>' +
        '<div class="hero__body">' +
          '<span class="hero__badge">Ana Topluluk</span>' +
          '<div class="hero__name">' + esc(g.name) + "</div>" +
          '<p class="hero__desc">' + esc(g.description) + "</p>" +
          '<div class="hero__actions">' +
            '<a class="btn btn--ghost" href="' + groupUrl(g.slug) + '">Konuşma geçmişini gör</a>' +
            '<a class="btn btn--join" href="' + esc(g.invite) + '" target="_blank" rel="noopener">' + WA_ICON + " Gruba Katıl</a>" +
          "</div>" +
        "</div>" +
      "</div>";
    document.getElementById("hero-slot").appendChild(el);
    loadLogo(el.querySelector(".hero__logo"), g.slug, g.emoji);
  }

  function buildCard(g) {
    var el = document.createElement("div");
    el.className = "card";
    el.innerHTML =
      '<a class="card__link" href="' + groupUrl(g.slug) + '">' +
        '<div class="card__top">' +
          '<div class="card__logo"></div>' +
          '<div class="card__name">' + esc(g.name) + "</div>" +
        "</div>" +
        '<p class="card__desc">' + esc(g.description) + "</p>" +
        '<div class="card__stats" id="stats-' + g.slug + '">' +
          statBlock("—", "üye") + statBlock("—", "mesaj") +
        "</div>" +
      "</a>" +
      '<div class="card__actions">' +
        '<a class="btn btn--ghost" href="' + groupUrl(g.slug) + '">Geçmişi gör</a>' +
        '<a class="btn btn--join" href="' + esc(g.invite) + '" target="_blank" rel="noopener">' + WA_ICON + " Gruba Katıl</a>" +
      "</div>";
    loadLogo(el.querySelector(".card__logo"), g.slug, g.emoji);
    return el;
  }

  function buildRules(rules) {
    if (!rules || !rules.length) return;
    var d = document.getElementById("rules-slot");
    d.innerHTML =
      "<details class='rules'><summary>Topluluk Kuralları</summary><ol>" +
      rules.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") +
      "</ol></details>";
  }

  function init(cfg) {
    document.getElementById("intro-note").textContent = cfg.note || "";
    buildRules(cfg.rules);

    var main = cfg.groups.filter(function (g) { return g.main; })[0];
    var rest = cfg.groups.filter(function (g) { return !g.main; });

    if (main) buildHero(main);
    var grid = document.getElementById("grid");
    rest.forEach(function (g) { grid.appendChild(buildCard(g)); });

    cfg.groups.forEach(function (g) {
      if (g.main) return;
      loadStats(g.slug).then(function (s) {
        if (!s) return;
        var el = document.getElementById("stats-" + g.slug);
        if (el) el.innerHTML = statBlock(fmt(s.members), "üye") + statBlock(fmt(s.messages), "mesaj");
      });
    });
  }

  fetch("data/groups.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(init)
    .catch(function () {
      document.getElementById("intro-note").textContent =
        "Grup listesi yüklenemedi. data/groups.json dosyasını kontrol et.";
    });
})();
