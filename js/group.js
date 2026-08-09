/* Grup sayfası: export'u oku, WhatsApp benzeri sohbet akışını çiz,
   arama yap, en çok katkı sağlayanları listele. */

(function () {
  "use strict";

  var BATCH = 120;           // her seferde çizilecek mesaj
  var SEARCH_CAP = 600;      // arama sonucu üst sınırı
  var MONTHS = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];

  var state = { all: [], rendered: 0, group: null, cards: false };

  function $(id) { return document.getElementById(id); }
  function param(k) { return new URLSearchParams(location.search).get(k); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return n.toLocaleString("tr-TR"); }

  // İsme göre kararlı renk (WhatsApp grup isim renkleri gibi)
  var PALETTE = ["#1f8a70","#0a7cba","#b5651d","#9b1d64","#5b4ad6","#127e6b",
                 "#c0392b","#7d6608","#16635a","#8e44ad","#2c7873","#a04000"];
  function colorFor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  function initials(name) {
    var parts = name.trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : "?";
    var b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
  }
  // Gizlilik: her isim/soyisim parçasının ilk 2 harfi görünür, gerisi ***
  // ("Bahadır Eren" -> "Ba*** Er***"). "Üye" gibi anonim etiketler değişmez.
  function maskName(name) {
    if (!name || name === "Üye") return name;
    return name.split(/\s+/).map(function (w) {
      return w.length <= 2 ? w : w.slice(0, 2) + "***";
    }).join(" ");
  }
  function dayKey(m) { return m.y + "-" + m.mo + "-" + m.d; }
  function dayLabel(m) { return m.d + " " + MONTHS[m.mo - 1] + " " + m.y; }
  function timeLabel(m) {
    return ("0" + m.hh).slice(-2) + ":" + ("0" + m.mi).slice(-2);
  }

  function highlight(text, q) {
    var safe = esc(text);
    if (!q) return safe;
    var rx = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return safe.replace(rx, "<mark>$1</mark>");
  }

  function bubbleHTML(m, q) {
    var inner = m.media
      ? '<span class="bubble__media">📎 Medya (dahil edilmedi)</span>'
      : '<span class="bubble__text">' + highlight(m.text, q) + "</span>";
    return (
      '<div class="msg"><div class="bubble">' +
        '<span class="bubble__sender" style="color:' + colorFor(m.sender) + '">' + esc(state.cards ? m.sender : maskName(m.sender)) + "</span>" +
        inner +
        '<span class="bubble__time">' + timeLabel(m) + "</span>" +
      "</div></div>"
    );
  }

  // Bir mesaj dilimini, gün ayraçlarıyla birlikte HTML'e çevir.
  function sliceHTML(msgs, q, prevDay) {
    var html = "";
    var last = prevDay || null;
    for (var i = 0; i < msgs.length; i++) {
      var k = dayKey(msgs[i]);
      if (k !== last) {
        html += '<div class="datesep"><span>' + dayLabel(msgs[i]) + "</span></div>";
        last = k;
      }
      html += bubbleHTML(msgs[i], q);
    }
    return { html: html, lastDay: last };
  }

  // Normal görünüm: en yeni mesajlar altta, eskiler "daha fazla" ile yüklenir.
  function renderInitial() {
    var chat = $("chat");
    chat.innerHTML = "";
    state.rendered = 0;
    if (!state.all.length) {
      chat.innerHTML =
        '<div class="chat-empty"><b>Konuşma geçmişi henüz yüklenmedi</b>' +
        "Bu grubun export dosyası eklendiğinde mesajlar burada görünecek.</div>";
      return;
    }
    appendOlder(true);
  }

  // Sohbetin başına daha eski mesajları ekle (scroll konumunu koru).
  function appendOlder(scrollToBottom) {
    var chat = $("chat");
    var total = state.all.length;
    var end = total - state.rendered;
    var start = Math.max(0, end - BATCH);
    var chunk = state.all.slice(start, end);
    if (!chunk.length) return;

    var nextDay = state.rendered ? dayKey(state.all[end]) : null;
    var out = sliceHTML(chunk, null, null);

    var prevH = chat.scrollHeight;
    // "Daha fazla" düğmesi (varsa) en üstte kalsın
    var btn = chat.querySelector(".loadmore");
    if (btn) btn.remove();

    chat.insertAdjacentHTML("afterbegin", out.html);
    state.rendered += chunk.length;

    if (start > 0) {
      var b = document.createElement("button");
      b.className = "loadmore";
      b.textContent = "↑ Daha eski mesajları yükle";
      b.onclick = function () { appendOlder(false); };
      chat.insertAdjacentElement("afterbegin", b);
    }

    if (scrollToBottom) {
      chat.scrollTop = chat.scrollHeight;
    } else {
      chat.scrollTop = chat.scrollHeight - prevH; // konumu sabit tut
    }
  }

  // Arama görünümü: tüm geçmişte filtrele.
  function renderSearch(q) {
    var chat = $("chat");
    var ql = q.toLowerCase();
    var hits = state.all.filter(function (m) {
      return !m.media && m.text.toLowerCase().indexOf(ql) > -1;
    });
    $("search-count").textContent = hits.length + " sonuç";

    if (!hits.length) {
      chat.innerHTML = '<div class="chat-empty"><b>Sonuç yok</b>"' + esc(q) + '" için mesaj bulunamadı.</div>';
      return;
    }
    var capped = hits.slice(0, SEARCH_CAP);
    var out = sliceHTML(capped, q, null);
    chat.innerHTML = out.html;
    if (hits.length > SEARCH_CAP) {
      chat.insertAdjacentHTML("beforeend",
        '<div class="chat-empty">İlk ' + SEARCH_CAP + " sonuç gösteriliyor. Aramayı daraltmayı dene.</div>");
    }
    chat.scrollTop = 0;
  }

  function renderContributors(list) {
    var ul = $("contrib");
    if (!list.length) { ul.innerHTML = '<li class="skeleton">Henüz veri yok.</li>'; return; }
    var top = list.slice(0, 8);
    var max = top[0].count;
    ul.innerHTML = top.map(function (c, i) {
      var pct = Math.round((c.count / max) * 100);
      return (
        "<li>" +
          '<span class="contrib__rank">' + (i + 1) + "</span>" +
          '<span class="contrib__av" style="background:' + colorFor(c.name) + '">' + esc(initials(c.name)) + "</span>" +
          '<span class="contrib__info">' +
            '<span class="contrib__name">' + esc(state.cards ? c.name : maskName(c.name)) + "</span>" +
            '<span class="contrib__bar"><i style="width:' + pct + '%"></i></span>' +
          "</span>" +
          '<span class="contrib__num">' + fmt(c.count) + "</span>" +
        "</li>"
      );
    }).join("");
  }

  function setHeader(g, stats) {
    document.title = g.name + " · Claude.ai Türkiye 🇹🇷";
    $("ch-name").textContent = g.name;
    $("s-desc").textContent = g.description || "";
    $("join").href = g.invite;

    var logo = $("ch-logo");
    loadLogo(logo, g.slug, g.emoji);

    // Üye: config'teki gerçek sayı öncelikli (yoksa export'tan)
    var memberCount = (g.members != null) ? g.members : (stats ? stats.memberCount : null);
    var msgCount = stats ? stats.messageCount : null;

    if (memberCount != null) $("s-members").textContent = fmt(memberCount);
    if (msgCount != null) $("s-messages").textContent = fmt(msgCount);

    if (memberCount != null && msgCount != null) {
      $("ch-meta").textContent = fmt(memberCount) + " üye · " + fmt(msgCount) + " mesaj";
    } else if (memberCount != null) {
      $("ch-meta").textContent = fmt(memberCount) + " üye";
    } else {
      $("ch-meta").textContent = "konuşma geçmişi bekleniyor";
    }
  }

  function showError(msg) {
    $("chat").innerHTML = '<div class="chat-error"><b>' + esc(msg) + "</b></div>";
  }

  // Kuralları göster: gruba özel kural varsa onu, yoksa topluluk kurallarını.
  function renderRules(communityRules, groupRules) {
    var rules = (groupRules && groupRules.length) ? groupRules : communityRules;
    var panel = $("rules-panel");
    if (!panel) return;
    if (!rules || !rules.length) { panel.style.display = "none"; return; }
    $("rules-list").innerHTML = rules.map(function (r) {
      if (r && typeof r === "object") {
        return "<li><b>" + esc(r.t) + "</b><span>" + esc(r.d) + "</span></li>";
      }
      return "<li><span>" + esc(r) + "</span></li>";
    }).join("");
  }

  // ---- Kartvizit görünümü (tanışma grubu) ----
  // Her kişi için: TAM ad (maskesiz) + kendi yazdığı mesajlar (telefon zaten
  // parser'da gizlenmiş). İsimsiz (numaralı -> "Üye") kişiler kartta gösterilmez.
  function buildCardsData() {
    var map = {}, order = [];
    for (var i = 0; i < state.all.length; i++) {
      var m = state.all[i];
      if (m.sender === "Üye" || m.media) continue;
      if (!map[m.sender]) { map[m.sender] = { name: m.sender, texts: [] }; order.push(m.sender); }
      map[m.sender].texts.push(m.text);
    }
    return order.map(function (s) { return map[s]; })
                .filter(function (c) {
                  var t = c.texts.join(" ");
                  // Anlamlı bir tanıtım olsun: ya biraz uzun ya da link/e-posta içersin
                  return t.length >= 25 || /https?:\/\/|www\.|@[\w.-]+\.\w|[\w.-]+\.(com|net|org|io|co|dev|me|app|ai|tr|info)\b/i.test(t);
                });
  }

  // Metinden LinkedIn, site ve e-posta linklerini çıkarır.
  function extractLinks(text) {
    var out = [], seen = {}, mailDomains = {};
    // E-postalar
    (text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).forEach(function (e) {
      var k = "m:" + e.toLowerCase();
      if (seen[k]) return; seen[k] = 1;
      mailDomains[e.split("@")[1].toLowerCase().replace(/\/$/, "")] = 1;
      out.push({ url: "mailto:" + e, label: e, kind: "mail" });
    });
    // URL'ler (http, www veya çıplak alan adı)
    var re = /((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+(?:\/[^\s)]*)?)/gi, m;
    while ((m = re.exec(text))) {
      var raw = m[1];
      if (raw.indexOf("@") > -1) continue; // e-posta parçalarını atla
      if (!/\.(com|net|org|io|co|dev|me|app|ai|gov|edu|info|xyz|site|online|blog|tr|com\.tr|web\.tr|net\.tr|org\.tr)(\/|$)/i.test(raw)) continue;
      var bare = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "").toLowerCase();
      if (mailDomains[bare]) continue; // e-posta alan adıyla aynıysa tekrar gösterme
      var url = /^https?:\/\//i.test(raw) ? raw : "https://" + raw.replace(/^www\./i, "");
      var k2 = "u:" + url.toLowerCase().replace(/\/$/, "");
      if (seen[k2]) continue; seen[k2] = 1;
      var isLi = /linkedin\.com/i.test(raw);
      out.push({
        url: url,
        label: isLi ? "LinkedIn" : raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, ""),
        kind: isLi ? "linkedin" : "web"
      });
    }
    // LinkedIn'i öne al
    out.sort(function (a, b) { return (a.kind === "linkedin" ? -1 : 0) - (b.kind === "linkedin" ? -1 : 0); });
    return out;
  }

  var LINK_ICON = {
    linkedin: '<svg viewBox="0 0 24 24" class="biz-ico"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5ZM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21H20.6v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H13V9Z"/></svg>',
    web: '<svg viewBox="0 0 24 24" class="biz-ico"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.5a15 15 0 0 0-1.1-3.1A8 8 0 0 1 18.9 8ZM12 4c.7 0 1.6 1.4 2.1 4H9.9C10.4 5.4 11.3 4 12 4ZM4.3 14a8 8 0 0 1 0-4h2.9a17 17 0 0 0 0 4Zm.8 2h2.5c.3 1.2.7 2.2 1.1 3.1A8 8 0 0 1 5.1 16Zm2.5-8H5.1a8 8 0 0 1 3.6-3.1C8.3 5.8 7.9 6.8 7.6 8ZM12 20c-.7 0-1.6-1.4-2.1-4h4.2c-.5 2.6-1.4 4-2.1 4Zm2.4-6H9.6a15 15 0 0 1 0-4h4.8a15 15 0 0 1 0 4Zm.4 5.1c.4-.9.8-1.9 1.1-3.1h2.5a8 8 0 0 1-3.6 3.1ZM16.8 14a17 17 0 0 0 0-4h2.9a8 8 0 0 1 0 4Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" class="biz-ico"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2 8 5 8-5H4Zm16 12V8l-8 5-8-5v10h16Z"/></svg>'
  };

  function bizCardHTML(c, q) {
    var full = c.texts.join("\n");
    var links = extractLinks(full);
    var chips = links.map(function (l) {
      return '<a class="biz-chip biz-chip--' + l.kind + '" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
        (LINK_ICON[l.kind] || "") + '<span>' + esc(l.label) + "</span></a>";
    }).join("");
    return (
      '<article class="biz">' +
        '<div class="biz__accent"></div>' +
        '<div class="biz__inner">' +
          '<div class="biz__head">' +
            '<span class="biz__av" style="background:' + colorFor(c.name) + '">' + esc(initials(c.name)) + "</span>" +
            '<div class="biz__name">' + esc(c.name) + "</div>" +
          "</div>" +
          '<div class="biz__bio">' + highlight(full, q) + "</div>" +
          (chips ? '<div class="biz__links">' + chips + "</div>" : "") +
        "</div>" +
      "</article>"
    );
  }

  function renderBizCards() {
    var slot = document.getElementById("cards-slot");
    if (!slot) return;
    var data = buildCardsData();
    if (!data.length) { slot.innerHTML = ""; return; }
    slot.innerHTML =
      '<section class="bizsec">' +
        '<div class="bizsec__head"><h2>Kartvizitler</h2>' +
          '<span>' + data.length + " kişi kendini tanıttı</span></div>" +
        '<div class="bizgrid">' + data.map(function (c) { return bizCardHTML(c, null); }).join("") + "</div>" +
      "</section>";
  }

  // --- Başlat ---
  var slug = param("g");
  if (!slug) { location.href = "index.html"; return; }

  fetch("data/groups.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      var g = cfg.groups.filter(function (x) { return x.slug === slug; })[0];
      if (!g) { showError("Grup bulunamadı."); return; }
      state.group = g;
      state.cards = g.layout === "cards";
      setHeader(g, null);
      if (state.cards) {
        // Kartvizit sayfasında "en çok katkı" panelini gizle
        var cpanel = document.getElementById("contrib");
        if (cpanel && cpanel.closest(".panel")) cpanel.closest(".panel").style.display = "none";
      }

      return fetch("data/chats/" + slug + ".txt", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) { setHeader(g, null); renderInitial(); return; }
        return r.text().then(function (txt) {
          if (!txt.trim()) { renderInitial(); return; }
          var p = WAParser.parse(txt, cfg.privacy || {});
          state.all = p.messages;
          setHeader(g, { memberCount: p.memberCount, messageCount: p.messageCount });
          if (state.cards) { renderBizCards(); }
          else { renderContributors(p.contributors); }
          renderInitial();
        });
      });
    })
    .catch(function () { showError("Veriler yüklenemedi."); });

  // Arama (debounce) — sohbeti filtreler
  var t = null;
  document.addEventListener("input", function (e) {
    if (e.target.id !== "search") return;
    clearTimeout(t);
    var q = e.target.value.trim();
    t = setTimeout(function () {
      if (!q) { $("search-count").textContent = ""; renderInitial(); }
      else renderSearch(q);
    }, 180);
  });
})();
