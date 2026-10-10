# Manowa — Modern Manga, Manhwa ve Novel Blogger Teması

![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)
![Blogger](https://img.shields.io/badge/Blogger-XML%20v3-orange.svg)

**Manowa**, Manga, Manhwa, Manhua ve Web Novel çevirilerini Blogger altyapısı üzerinde yayınlamak için geliştirilmiş, çok modlu okuma motoruna (`ReadingEngine`), dinamik JSON Feed veri çekicisine (`BloggerFeedLoader`) ve Disqus yorum entegrasyonuna (`DisqusLoader`) sahip açık kaynaklı, modüler bir Blogger temasıdır.

---

## Temel Özellikler

* **Çok Modlu Okuma Motoru (`ReadingEngine`):**
  * **Webtoon Modu (Dikey Şerit):** Manhwa ve Manhua serileri için kesintisiz dikey kaydırma ve ayarlanabilir görsel arası boşluk (`0px`, `8px`, `16px`).
  * **Tek Sayfa Modu:** Klasik sayfa sayfa okuma ve klavye yön tuşlarıyla hızlı geçiş.
  * **Çift Sayfa (Kitap) Modu:** Masaüstü ekranlar için yan yana çift sayfa görünümü.
  * **Novel (Metin) Modu:** Web Novel bölümleri için okunabilirliği optimize edilmiş metin görünümü ve kapak/illüstrasyon desteği.
* **Okuma Yönü ve Yardımcı Araçlar:**
  * **Soldan Sağa (`LTR`)** ve **Sağdan Sola (`RTL` - Japon Manga düzeni)** okuma yönü.
  * Yakınlaştırma (`%50` – `%150`), Otomatik Kaydırma (`Auto-scroll`), Tam Ekran (`Fullscreen`), sağ tık görüntü koruma ve `localStorage` ile kaldığı bölümü/sayfayı hatırlama.
* **Dinamik Blogger JSON Feed Entegrasyonu (`BloggerFeedLoader`):**
  * `/feeds/posts/default?alt=json&max-results=500` uç noktasından tüm `Seri` ve `Bölüm` gönderilerini otomatik çeker ve ayrıştırır.
  * Seri kapaklarını, özetlerini, yazar/çizer bilgilerini, kaynak dil (`KR`, `JP`, `CN`, `EN`) ve tür (`Manhwa`, `Manga`, `Manhua`, `Novel`) etiketlerini dinamik katalogda listeler.
* **Tam Blogger URL ve Tarayıcı Geri/İleri Tuşu Uyumu (`RouterController`):**
  * Seri ve bölüm geçişlerinde tarayıcı adres çubuğunu gerçek Blogger kalıcı bağlantısıyla (`history.pushState`) günceller.
  * Tarayıcı Geri (`←`) ve İleri (`→`) düğmeleri (`popstate`) ile okuyucudan seriye, seriden kataloğa kesintisiz geçiş sağlar.
* **Dinamik Disqus Yorum Sistemi (`DisqusLoader`):**
  * Ana sayfa, seri tanıtım sayfası ve her bölüm için bağımsız Disqus yorum başlığı yükler.
* **Dahili Blogger Gönderi Kodu Oluşturucu (`PostGenerator`):**
  * Yeni seri veya bölüm eklerken Blogger HTML görünümüne yapıştırılacak standart kodu arayüz üzerinden tek tıkla üretir.

---

## Proje Mimarisi

Blogger tek bir `.xml` dosyası talep eder. Kod kalitesini ve sürdürülebilirliği korumak için proje **Sorumlulukların Ayrılığı (Separation of Concerns)** prensibiyle modüllere ayrılmıştır. Hiçbir kaynak dosya 1000 satırı geçmez. [`ThemeBuilder`](src/core/builder.js) derleyicisi tüm modülleri birleştirerek kullanıma hazır [`dist/theme.xml`](dist/theme.xml) ve yerel önizleme dosyası [`dist/preview.html`](dist/preview.html) çıktılarını üretir.

```text
manowa/
├── dist/
│   ├── theme.xml                  # Blogger'a doğrudan yüklenecek derlenmiş tema dosyası
│   └── preview.html               # Tarayıcıda yerel test ve önizleme dosyası
├── src/
│   ├── core/
│   │   ├── build-cli.js           # Komut satırı derleme başlatıcısı
│   │   ├── builder.js             # Modüler XML/HTML derleyici ve 1000 satır denetleyicisi
│   │   └── logger.js              # DEBUG seviyeli derleme loglama modülü
│   ├── scripts/
│   │   ├── client-logger.js       # Tarayıcı içi oturum loglama modülü
│   │   ├── blogger-feed-loader.js # Blogger JSON Feed API istemcisi ve HTML ayrıştırıcı
│   │   ├── catalog-controller.js  # Katalog arama, dil/tür filtreleme ve sıralama yöneticisi
│   │   ├── reading-engine.js      # Webtoon, Tek/Çift Sayfa ve Novel okuma motoru
│   │   ├── disqus-loader.js       # Dinamik Disqus yorum yükleyici
│   │   ├── post-generator.js      # Blogger seri/bölüm HTML şablon üreticisi
│   │   ├── router-controller.js   # Kalıcı URL (pushState) ve Geri/İleri (popstate) yönlendiricisi
│   │   └── app-init.js            # Ana uygulama denetleyicisi ve DOM bağlayıcısı
│   ├── styles/
│   │   ├── variables.css          # Koyu/Açık tema renk ve tipografi değişkenleri
│   │   ├── layout.css             # Üst çubuk, vitrin (hero) ve sayfa düzeni stilleri
│   │   ├── cards.css              # Katalog kartları, seri detay ve Disqus stilleri
│   │   ├── reader.css             # Okuma motoru ve kontrol çubuğu stilleri
│   │   └── generator.css          # Gönderi oluşturucu modal stilleri
│   └── templates/
│       ├── base.xml               # Blogger XML v3 ana şablon iskeleti
│       ├── body-content.html      # Uygulama arayüz bileşenleri
│       └── preview-shell.html     # Yerel HTML önizleme kabuğu
├── tests/
│   ├── faz1.test.js               # Loglama ve derleyici birim testleri
│   ├── faz2.test.js               # Katalog, Blogger Feed ve Disqus birim testleri
│   ├── faz3.test.js               # Okuma motoru birim testleri
│   └── faz4.test.js               # Gönderi oluşturucu ve URL yönlendirici birim testleri
└── package.json
```

---

## Blogger'a Kurulum (Hızlı Başlangıç)

1. Sağ menüdeki **Releases** ([Son Sürüm](https://github.com/WinudBey/Manowa/releases/latest)) bölümünden veya [`dist/theme.xml`](dist/theme.xml) konumundan otomatik derlenmiş `theme.xml` dosyasını indirin.
2. **Blogger Yönetim Paneli** → **Tema** menüsüne gidin.
3. **Özelleştir** düğmesinin yanındaki aşağı oka tıklayın ve **Geri Yükle** (veya **HTML'yi düzenle**) seçeneğini açın.
4. İndirdiğiniz `theme.xml` dosyasını yükleyin (veya içeriğini yapıştırıp sağ üstteki **Kaydet** simgesine tıklayın).

---

## Blogger Gönderi Etiketleri ve Kullanımı

Temanın gönderileri otomatik tanıması için Blogger gönderilerinizde şu etiket kurallarını kullanın:

1. **Seri Tanıtım Gönderileri:**
   * Gönderi etiketlerine `Seri` etiketini ve serinin türünü (`Manhwa`, `Manga`, `Manhua` veya `Novel`) ekleyin.
   * Gönderi içeriğinde `[Slug: seri-kisa-adi]` veya `<span id="actual-series-tag">Seri Adı</span>` tanımını bulundurun.
2. **Bölüm Gönderileri:**
   * Gönderi etiketlerine `Bölüm` etiketini ve ait olduğu serinin adını/etiketini ekleyin.
   * Bölüm başlığında bölüm numarasını belirtin (ör. `Seri Adı - Bölüm 12`).
   * **Alternatif:** Site üst menüsündeki **Gönderi Oluştur** (`🛠 Gönderi Oluştur`) aracını açarak seri veya bölüm HTML kodunu hatasız şekilde otomatik üretebilirsiniz.

---

## Geliştirici Kurulumu ve Derleme

Projeyi yerel ortamınızda düzenlemek ve yeniden derlemek için **Node.js 18+** sürümü yeterlidir (harici paket bağımlılığı yoktur).

```bash
# 1. Depoyu klonlayın
git clone https://github.com/KULLANICI_ADINIZ/manowa.git
cd manowa

# 2. Birim testlerini çalıştırın
npm test

# 3. Kaynak dosyaları dist/theme.xml ve dist/preview.html olarak derleyin
npm run build

# 4. Test ve derleme doğrulamasını birlikte çalıştırın
npm run verify
```

Yerel önizleme için derleme sonrasında oluşan `dist/preview.html` dosyasını tarayıcınızda doğrudan açabilirsiniz.

---

## Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.
