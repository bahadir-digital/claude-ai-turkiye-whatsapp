/* Grup sayfası: export'u oku, WhatsApp benzeri sohbet akışını çiz,
   arama yap, en çok katkı sağlayanları listele. */

(function () {
  "use strict";

  var BATCH = 120;           // her seferde çizilecek mesaj
  var SEARCH_CAP = 600;      // arama sonucu üst sınırı
  var MONTHS = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];

  var state = { all: [], rendered: 0, group: null };

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
        '<span class="bubble__sender" style="color:' + colorFor(m.sender) + '">' + esc(m.sender) + "</span>" +
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
            '<span class="contrib__name">' + esc(c.name) + "</span>" +
            '<span class="contrib__bar"><i style="width:' + pct + '%"></i></span>' +
          "</span>" +
          '<span class="contrib__num">' + fmt(c.count) + "</span>" +
        "</li>"
      );
    }).join("");
  }

  function setHeader(g, stats) {
    document.title = g.name + " — Claude.ai Türkiye";
    $("ch-name").textContent = g.name;
    $("s-desc").textContent = g.description || "";
    $("join").href = g.invite;

    var logo = $("ch-logo");
    var img = new Image();
    img.onload = function () { logo.innerHTML = ""; logo.appendChild(img); };
    img.onerror = function () { logo.textContent = g.emoji || "💬"; };
    img.alt = "";
    img.src = "data/logos/" + g.slug + ".png";

    if (stats) {
      $("ch-meta").textContent = fmt(stats.memberCount) + " üye · " + fmt(stats.messageCount) + " mesaj";
      $("s-members").textContent = fmt(stats.memberCount);
      $("s-messages").textContent = fmt(stats.messageCount);
    } else {
      $("ch-meta").textContent = "konuşma geçmişi bekleniyor";
    }
  }

  function showError(msg) {
    $("chat").innerHTML = '<div class="chat-error"><b>' + esc(msg) + "</b></div>";
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
      setHeader(g, null);

      return fetch("data/chats/" + slug + ".txt", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) { setHeader(g, null); renderInitial(); return; }
        return r.text().then(function (txt) {
          if (!txt.trim()) { renderInitial(); return; }
          var p = WAParser.parse(txt);
          state.all = p.messages;
          setHeader(g, { memberCount: p.memberCount, messageCount: p.messageCount });
          renderContributors(p.contributors);
          renderInitial();
        });
      });
    })
    .catch(function () { showError("Veriler yüklenemedi."); });

  // Arama (debounce)
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
