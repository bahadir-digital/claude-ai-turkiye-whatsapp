# Claude.ai Türkiye — Topluluk Arşivi

WhatsApp topluluğunun ve alt gruplarının konuşma geçmişini gösteren statik bir site.
GitHub Pages'te yayınlanır, ekstra sunucu gerektirmez. Sen export dosyalarını
yükledikçe site onları otomatik okur, üye ve mesaj sayısını hesaplar, "katıldı /
ayrıldı" gibi sistem mesajlarını gizler.

## Klasör yapısı

```
.
├── index.html              → Ana sayfa (tüm grup kartları)
├── group.html              → Tek grup sayfası (?g=slug ile açılır)
├── .nojekyll               → GitHub Pages'in klasörleri bozmaması için (silme)
├── css/
│   └── style.css
├── js/
│   ├── parser.js           → WhatsApp export ayrıştırıcı
│   ├── home.js             → Ana sayfa
│   └── group.js            → Grup sayfası
└── data/
    ├── groups.json         → TÜM grupların listesi (tek ayar dosyası)
    ├── chats/              → Konuşma geçmişi export'ları (.txt)
    │   ├── ana-community.txt
    │   ├── genel-claude.txt
    │   └── ...
    └── logos/              → Grup logoları (.png)
        ├── genel-claude.png
        └── ...
```

## Nasıl çalışır

Her grubun bir **slug**'ı vardır (örn. `skills`). Site şu iki dosyayı arar:

- Konuşma geçmişi → `data/chats/<slug>.txt`
- Logo → `data/logos/<slug>.png`

Dosya yoksa site çökmez: kartta sayılar `—` görünür, logo yerine emoji çıkar.
Dosyayı yükleyince bir sonraki açılışta otomatik gelir.

### Slug eşleşmeleri

| Grup | Slug → dosya adı |
|---|---|
| Claude.ai Türkiye (Ana) | `ana-community` |
| Genel Bilgi Paylaşımı (Claude) | `genel-claude` |
| Genel Bilgi Paylaşımı (ChatGPT, Gemini, Grok vb.) | `genel-diger-ai` |
| Claude Skills | `skills` |
| Claude Projects | `projects` |
| Claude in Excel & PowerPoint | `excel-powerpoint` |
| Claude Code | `code` |
| Claude Cowork | `cowork` |
| Claude Artifacts | `artifacts` |
| Claude Design | `design` |

## Konuşma geçmişi nasıl eklenir (telefondan)

1. WhatsApp'ta grubu aç → grup adına dokun → **Sohbeti dışa aktar**.
2. **Medya olmadan** seçeneğini seç (daha küçük, daha hızlı dosya). `.txt` üretir.
3. Dosyayı `data/chats/` klasörüne, **slug adıyla** yükle. Örnek: Skills grubu için
   dosyayı `skills.txt` olarak adlandır.
4. GitHub'a commit/upload et. Bitti.

> iOS ve Android, Türkçe ve İngilizce export formatlarının hepsi desteklenir.
> "X katıldı / X ayrıldı / grup oluşturuldu / şifreleme bildirimi" gibi satırlar
> sohbette **gösterilmez**, ama üye sayısını hesaplamak için kullanılır.

## Logo nasıl eklenir

`data/logos/` içine **slug.png** olarak yükle (örn. `code.png`). Kare görsel önerilir.

## Yeni grup ekleme / düzenleme

Sadece `data/groups.json` dosyasını düzenle. Her grup şu alanlara sahip:

```json
{
  "slug": "yeni-grup",
  "emoji": "💡",
  "name": "Görünen Grup Adı",
  "description": "Kısa açıklama",
  "invite": "https://chat.whatsapp.com/XXXX"
}
```

Ana topluluk kartı (en üstteki büyük kart) için `"main": true` eklenir. Yalnızca
bir grup `main` olmalı.

## GitHub Pages'te yayınlama

1. Bu klasördeki tüm dosyaları repoya yükle (kök dizine).
2. GitHub'da: **Settings → Pages → Source = Deploy from a branch**, branch `main`,
   klasör `/ (root)` seç.
3. Birkaç dakika sonra `https://<kullanıcı-adın>.github.io/<repo-adı>/` adresinde yayında.
4. Bu adresi grup açıklamasına ekle.

## Önemli not

`data/chats/` içinde şu an `genel-claude.txt`, `skills.txt`, `code.txt` dosyaları
**örnek/demo veridir** (siteyi önizleyebilmen için). Gerçek export'larla değiştir.
Diğer gruplarınki boş yer tutucudur.
