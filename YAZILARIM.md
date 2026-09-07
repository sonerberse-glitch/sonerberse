# Yazılarım: içerik ve yayın iş akışı

Soner, **sonerberse.com** yazılarını aynı kayıtlı projede asistanla hazırlayıp yayımlamak ister. Kod yazması veya her yazıda ana sayfa tasarımını değiştirmesi gerekmez.

## İçerik yaklaşımı

Başlık ve menü adı **Yazılarım** olarak kalır. Hedef kitle akademisyenler, çalışan hemşireler ve öğrencilerdir. Konular akademik gelişmeler hakkındaki görüşler, yapay zekâ, eğitim, kişisel akademik deneyimler, duyurular, yeni yayınlar veya ölçekler olabilir. Kısa ve uzun yazılar desteklenir.

Sabit dar kategoriler ve az içerikte filtreler açılmaz; isteğe bağlı konu etiketleri yeterlidir. Ana sayfada kısa tanıtımın altındaki **Son Yazılarım** en fazla üç güncel yazıyı gösterir. **Yazılarım** arşivinde bütün yayımlanmış yazılar, her yazının da kalıcı adresi bulunur. Görsel zorunlu değildir.

Soner adına görüş, deneyim, alıntı veya örnek yayın uydurulmaz. Boş arşiv sade bir mesajla gösterilir. Sosyal medya otomasyonu, abonelik, ağır CMS ve yeni yayın/ölçek kayıtları ayrıca istenmedikçe eklenmez.

## Soner ile çalışma

1. Soner aynı projede konusunu veya notlarını paylaşır: “Bu notlardan Yazılarım için bir taslak hazırla.” Asistan doğrulanması gereken iddiaları belirler.
2. Başlık, tarih, kısa özet ve metin düzenlenir. Gerektiğinde etiket, görsel açıklaması, kaynak ve ilişkili yayın bağlantıları eklenir.
3. Asistan **taslağı** kaydedip yerel önizlemeyi açar. Soner metni ve görünümü değerlendirir. GitHub deposu herkese açık olduğundan taslaklar sürüm takibi dışındaki yerel `content/drafts/` klasöründe tutulur.
4. Son metin onaylanınca asistan somut sonucu ve canlı yayın hedefini bildirir. Yayın açık yetkiyle yapılır; verilmiş yetki yeniden sorulmaz. Önizleme isteği canlı yayın yetkisi değildir.
5. Yayından sonra canlı adres kontrol edilir; yerelde hazırlanan ve canlıya çıkan değişiklikler ayrı bildirilir.

İlk iki içerik için yerel `content/drafts/` klasöründe bir güncel görüş yazısı ve bir kısa yeni yayın tanıtımının hazırlık iskeletleri bulunur. Bunlar onaylanmış yazı değildir: ilki için konu, kullanıcının kendi görüşü ve kaynaklar; ikincisi için kesin yayın başlığı, DOI veya PDF, yazarın katkısı ve doğrulanacak sonuçlar beklenir. Eksik bilgiler kullanıcı adına doldurulmaz; hazırlık iskeletleri yayımlanmış içerik olarak gösterilmez.

7 Eylül 2026'da kullanıcı “Hemşirelik eğitiminde yapay zekâ: Öğrencinin yerine düşünmek mi, düşünmesini desteklemek mi?” metnini ve yerel önizlemede ana sayfa/arşiv/yazı sayfasına eklenmesini onayladı. Onaylı metin `content/posts/hemsirelik-egitiminde-yapay-zeka-dusunmeyi-desteklemek.json` içinde, mevcut listeleme için `published` durumuyla hazırlanmıştır. 8 Eylül 2026'da kullanıcı son önizlemeyi inceleyerek “Tamam şimdi bunu canlıya al” dedi; bu sürüm için **commit, push ve sonerberse.com'a canlı yayın onayı verildi.** Bu onay, ChatGPT Tutum Ölçeği'nin yalnız makale bağlantısıyla kalmasını ve Word indirme bağlantısının e-postaya eklenmemesini içerir. İki eski hazırlık iskeleti özel taslak olarak kalır. Yayının gerçekleştiği ayrıca canlı adres üzerinden doğrulanır.

## Kaynak, önizleme ve canlı site

Asıl proje `/Users/sonerberse/soner berşe sayfa` konumundadır. Codex ayrı çalışma kopyasında çalışabilir. Her oturumda etkin klasör kontrol edilir, kullanıcı değişiklikleri korunur; çalışma kopyasındaki değişikliklerin asıl klasöre geçtiği varsayılmaz.

Yerel düzenleme ve önizleme canlı siteyi güncellemez. Doğrulanan yayın yolu: GitHub `sonerberse-glitch/sonerberse` deposunun `main` dalına gönderim → Vercel Production → **sonerberse.com**. Bu gönderim canlı yayını tetikler; yetkisiz yapılmaz. Sonraki oturumlarda hesap erişimi ve hedef proje yeniden doğrulanır.

## Dosyalar ve asistanın kullanacağı komutlar

Her yazı ayrı JSON dosyasıdır. Yerel taslak `content/drafts/<slug>.json` içindedir. Onaylanan yazı `content/posts/<slug>.json` konumuna, `status: published` ile taşınır. Küçük ASCII harf, rakam ve tirelerden oluşan `slug`, kalıcı `/yazilar/<slug>/` adresini belirler.

| Alan | Kullanım |
| --- | --- |
| `title`, `slug`, `status`, `summary`, `body` | Zorunlu. `status`: `draft` veya `published`; `body`: boş olmayan blok dizisi. |
| `publishedAt` | Yayımlanmış yazıda zorunlu; `YYYY-MM-DD` veya saat dilimi içeren ISO tarih. Taslakta isteğe bağlı. |
| `tags` | İsteğe bağlı metin dizisi. |
| `image` | İsteğe bağlı `{url, alt}`; açıklama anlamlı olmalı. |
| `sources`, `relatedPublications` | İsteğe bağlı `{title, url}` dizileri. APA kaynakçada yalnız `sources` girdilerine isteğe bağlı `publication` (italik dergi/cilt) ve `locator` (sayfa veya makale numarası) eklenebilir. |

Her gövde bloğunda `type` bulunur: `paragraph` (`text`), `heading` (`text`, `level: 2|3`), `list` (`items`, isteğe bağlı `ordered`), `quote` (`text`, varsa `attribution`), `link` (`text`, `url`). HTML/Markdown kullanılmaz. Alıntı için kullanıcının metni veya doğrulanmış kaynak gerekir.

Görsel adresi HTTPS, `/assets/...` veya `media/dosya.jpg` olabilir. Yazıya özel medya `content/media/`, taslak medya `content/drafts/media/` içindedir. Dosyaları asistan düzenler.

- `npm run build`: Vercel’in sunduğu `dist/` çıktısını üretir. `content/posts/` içinde taslak veya gelecekteki tarih varsa durur; yazı taslak klasörüne alınmalıdır.
- `npm run build:preview`: `.preview/` çıktısını üretir. Taslak adresleri yerel `/_taslaklar/<slug>/` biçimindedir. Önizlemenin tamamı arama motorlarına kapalı işaretlenir.
- `npm run preview`: önizlemeyi üretip `http://127.0.0.1:8765` yerel sunucusunu başlatır.
- `npm test`: geçici test verileriyle içerik üretimini denetler.

Üretilen `dist/` ve `.preview/` elle düzenlenmez; içerik veya şablon değiştirilip yeniden üretilir. `.preview/` ve `content/drafts/` sürüm takibine eklenmez. Kullanıcının mevcut `public/` klasörü üretim çıktısı değildir; korunur.

## Asistan için kısa kontrol listesi

- Taslaklar üretim çıktısına, ana sayfaya, arşive ve site haritasına girmez.
- İçerik eksiksiz, bağlantılar çalışır; kalıcı adres sebepsiz değiştirilmez.
- Masaüstü, tablet ve telefonda menü çalışır; klavye odağı görünür, metin taşmaz.
- Ana sayfa en fazla üç güncel yazı gösterir. Tekrar üretim kaldırılmış yazıları siler; deneme içeriği bırakılmaz.
- Son kullanıcı talimatıyla makale **54+**, atıf **350+**, bildiri **20+**, kitap bölümü **3+**; varsa h-endeksi ve i10-endeksi **10+** gösterilir. `+` kullanıcının gösterim tercihidir; diğer sayaçların taban sayıları değiştirilmez. Bu güncellemedeki **350 atıf kullanıcı beyanıdır**; Google Scholar üzerinden ayrıca doğrulanmış gibi sunulmaz.
