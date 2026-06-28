/* =========================================================================
   WhatsApp konuşma geçmişi ayrıştırıcı (parser)
   -------------------------------------------------------------------------
   - iOS ve Android, Türkçe ve İngilizce export formatlarını destekler.
   - "katıldı / ayrıldı / ekledi / çıkardı" gibi sistem mesajlarını
     SOHBET AKIŞINDAN TEMİZLER, ama üye sayısını hesaplamak için kullanır.
   - Çıktı: { messages, memberCount, messageCount, contributors }
   ========================================================================= */

(function (global) {
  "use strict";

  // WhatsApp export'larında satır içine serpiştirilen görünmez yön/biçim
  // karakterleri (LRM, RLM, narrow no-break space vb.) ayrıştırmayı bozar.
  function clean(str) {
    return str
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .replace(/\u00a0|\u202f/g, " ")
      .replace(/\r/g, "");
  }

  // Bir satırın yeni bir mesajla mı başladığını yakalar.
  // Örnekler:
  //   12.06.2024 14:30 - Ahmet: Merhaba           (Android)
  //   12.06.2024, 14:30 - Ahmet: Merhaba          (Android, virgüllü)
  //   [12.06.2024 14:30:00] Ahmet: Merhaba         (iOS)
  //   [12.06.2024, 14:30:00] Ahmet: Merhaba        (iOS, virgüllü)
  const LINE_START = /^\[?\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})[,]?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:\]|\s)\s*[-–]?\s*/;

  // Türkçe + İngilizce sistem mesajı kalıpları (katılma/ayrılma/diğer).
  // Sıralama önemli: önce kişiyi sayıma ekleyen/çıkaranları test ederiz.
  const SYS = {
    // Katılım (kişiyi gruba ekler)
    joined: [
      /^(.+?)\s+(?:gruba\s+)?(?:bu\s+gruba\s+)?(?:davet\s+bağlantısı\s+(?:aracılığıyla|kullanarak|üzerinden)\s+)?katıldı\.?$/i,
      /^(.+?)\s+joined(?:\s+using\s+this\s+group's\s+invite\s+link)?\.?$/i
    ],
    // "Siz katıldınız" / "You joined"
    selfJoined: [
      /^Siz\s+katıldınız\.?$/i,
      /^You\s+joined\.?$/i,
      /^Bu\s+gruba\s+(?:davet\s+bağlantısı.*)?katıldınız\.?$/i
    ],
    // Grup oluşturma -> oluşturan kişi üyedir
    created: [
      /^(.+?)\s+(?:".+?"\s+)?grubu(?:nu)?\s+oluşturdu\.?$/i,
      /^(.+?)\s+created\s+(?:this\s+)?group\.?$/i,
      /^(.+?)\s+created\s+group\s+".+?"\.?$/i
    ],
    // Birini ekleme: "Ahmet, Mehmet'i ekledi"  /  "Ahmet, Mehmet ve Ayşe'yi ekledi"
    added: [
      /^(.+?),\s+(.+?)\s+ekledi\.?$/i,
      /^(.+?)\s+added\s+(.+?)\.?$/i
    ],
    // Ayrılma (kişiyi gruptan çıkarır)
    left: [
      /^(.+?)\s+(?:gruptan\s+)?ayrıldı\.?$/i,
      /^(.+?)\s+left\.?$/i
    ],
    // Çıkarılma: "Ahmet, Mehmet'i çıkardı"
    removed: [
      /^(.+?),\s+(.+?)\s+(?:gruptan\s+)?çıkardı\.?$/i,
      /^(.+?)\s+removed\s+(.+?)\.?$/i
    ],
    // Sayımı etkilemeyen ama yine de temizlenecek diğer sistem mesajları
    ignore: [
      /uçtan\s+uca\s+şifreli/i,
      /end-to-end\s+encrypted/i,
      /güvenlik\s+kodun?u?z?\s+değişti/i,
      /security\s+code\s+changed/i,
      /grup\s+açıklamasını\s+değiştirdi/i,
      /changed\s+the\s+group\s+description/i,
      /grup\s+(?:simgesini|resmini|fotoğrafını)\s+değiştirdi/i,
      /changed\s+this\s+group's\s+icon/i,
      /(?:grubun\s+)?konusunu\s+.+\s+olarak\s+değiştirdi/i,
      /changed\s+the\s+subject/i,
      /grup\s+ayarlarını\s+değiştirdi/i,
      /changed\s+the\s+group\s+settings/i,
      /mesajların\s+süresi\s+dol/i,
      /disappearing\s+messages/i,
      /telefon\s+numarası(?:nı)?\s+değiştirdi/i,
      /changed\s+(?:their|to)\s+(?:phone\s+)?number/i,
      /bu\s+mesajı\s+sildiniz?/i,
      /this\s+message\s+was\s+deleted/i,
      /bu\s+gruba\s+eklendiniz/i,
      /you\s+were\s+added/i,
      /yönetici\s+(?:yapıldı|olarak)/i,
      /(?:is\s+now\s+an?\s+)?admin/i
    ]
  };

  // "Mehmet'i", "Ayşe'yi", "Ali ve Veli'yi" gibi ifadelerden isimleri ayıkla.
  function extractNames(chunk) {
    if (!chunk) return [];
    return chunk
      .split(/,|\s+ve\s+|\s+and\s+/i)
      .map(function (n) {
        return n
          .replace(/['’][^\s]*$/u, "") // sondaki ekleri at: Mehmet'i -> Mehmet
          .replace(/[.]+$/, "")
          .trim();
      })
      .filter(Boolean);
  }

  function tryMatch(patterns, text) {
    for (var i = 0; i < patterns.length; i++) {
      var m = text.match(patterns[i]);
      if (m) return m;
    }
    return null;
  }

  // Bir sistem mesajını sınıflandır. Sohbette gösterilmeyecekse true döner
  // ve "present" / "left" setlerini günceller.
  function handleSystem(text, present, removed) {
    var m;

    if ((m = tryMatch(SYS.selfJoined, text))) {
      present.add("Siz");
      return true;
    }
    if ((m = tryMatch(SYS.created, text))) {
      present.add(m[1].trim());
      return true;
    }
    if ((m = tryMatch(SYS.added, text))) {
      extractNames(m[2]).forEach(function (n) { present.add(n); removed.delete(n); });
      return true;
    }
    if ((m = tryMatch(SYS.joined, text))) {
      present.add(m[1].trim());
      removed.delete(m[1].trim());
      return true;
    }
    if ((m = tryMatch(SYS.removed, text))) {
      extractNames(m[2]).forEach(function (n) { removed.add(n); present.delete(n); });
      return true;
    }
    if ((m = tryMatch(SYS.left, text))) {
      var name = m[1].trim();
      removed.add(name);
      present.delete(name);
      return true;
    }
    if (tryMatch(SYS.ignore, text)) {
      return true; // temizle ama sayımı etkileme
    }
    return false;
  }

  function parse(raw) {
    var text = clean(raw || "");
    var rawLines = text.split("\n");

    var entries = []; // ham giriş: { date, time, body }
    var current = null;

    for (var i = 0; i < rawLines.length; i++) {
      var line = rawLines[i];
      var m = line.match(LINE_START);
      if (m) {
        if (current) entries.push(current);
        var yyyy = m[3].length === 2 ? "20" + m[3] : m[3];
        current = {
          d: parseInt(m[1], 10),
          mo: parseInt(m[2], 10),
          y: parseInt(yyyy, 10),
          hh: parseInt(m[4], 10),
          mi: parseInt(m[5], 10),
          body: line.slice(m[0].length)
        };
      } else if (current) {
        current.body += "\n" + line; // çok satırlı mesajın devamı
      }
      // current yoksa (dosya başındaki başlıklar vb.) satırı yok say
    }
    if (current) entries.push(current);

    var present = new Set(); // gruptaki kişiler
    var removed = new Set(); // ayrılan/çıkarılan kişiler
    var messages = [];
    var counts = {}; // gönderen -> mesaj sayısı

    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      var body = e.body;

      // "Gönderen: mesaj" ayrımı. İlk ": " bölmesini dene.
      var sep = body.indexOf(": ");
      var sender = null, content = null;
      if (sep > -1 && sep < 80 && body.slice(0, sep).indexOf("\n") === -1) {
        sender = body.slice(0, sep).trim();
        content = body.slice(sep + 2);
      }

      if (sender === null) {
        // Gönderen ayrımı yok -> büyük olasılıkla sistem mesajı
        handleSystem(body.trim(), present, removed);
        continue;
      }

      // Gönderen ayrımı olsa da bazı sistem mesajları ": " içerebilir
      // (örn. "... açıklamasını değiştirdi: ..."). Yine de eleyelim.
      if (handleSystem(body.trim(), present, removed)) continue;

      // Gerçek kullanıcı mesajı
      present.add(sender);
      removed.delete(sender);
      counts[sender] = (counts[sender] || 0) + 1;

      var msgText = content.trim();
      var isMedia =
        /<\s*medya\s+dahil\s+edilmedi\s*>/i.test(msgText) ||
        /<\s*media\s+omitted\s*>/i.test(msgText) ||
        /görsel\s+dahil\s+edilmedi|video\s+dahil\s+edilmedi|ses\s+dahil\s+edilmedi|belge\s+dahil\s+edilmedi/i.test(msgText) ||
        /image\s+omitted|video\s+omitted|audio\s+omitted|document\s+omitted|sticker\s+omitted|gif\s+omitted/i.test(msgText);

      messages.push({
        sender: sender,
        text: msgText,
        media: isMedia,
        y: e.y, mo: e.mo, d: e.d, hh: e.hh, mi: e.mi
      });
    }

    // Üye sayısı: sayıma giren kişiler eksi ayrılanlar.
    // (Mesaj gönderen herkes zaten "present" içinde.)
    var memberCount = present.size;

    // Top contributor listesi
    var contributors = Object.keys(counts)
      .map(function (name) { return { name: name, count: counts[name] }; })
      .sort(function (a, b) { return b.count - a.count; });

    return {
      messages: messages,
      memberCount: memberCount,
      messageCount: messages.length,
      contributors: contributors
    };
  }

  global.WAParser = { parse: parse, clean: clean };
})(window);
