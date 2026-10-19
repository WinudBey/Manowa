const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Mobile Reader Bars: Ust bar bolum basligi ve alt bar dengeli esnek yapisi dogru tanimlanmali', () => {
  const readerCss = fs.readFileSync(path.join(__dirname, '../src/styles/reader.css'), 'utf-8');
  const novelCss = fs.readFileSync(path.join(__dirname, '../src/styles/reader-novel.css'), 'utf-8');
  const layoutCss = fs.readFileSync(path.join(__dirname, '../src/styles/layout.css'), 'utf-8');

  // 1. Ust bar bolum secici butonunun mobil modda gizlenmemesi ve gorunurluk kurali
  assert.equal(
    /\.reader-chapter-dropdown-btn\s+\.btn-label\s*\{[^}]*display:\s*inline-block\s*!important;/s.test(novelCss),
    true,
    '.reader-chapter-dropdown-btn .btn-label mobil modda display: inline-block !important olmali'
  );
  assert.equal(
    /\.reader-chapter-dropdown-btn\s+\.btn-label\s*\{[^}]*text-overflow:\s*ellipsis;/s.test(novelCss),
    true,
    'Uzun bolum basliklari icin text-overflow: ellipsis tanimli olmali'
  );
  assert.equal(
    /\.reader-chapter-dropdown-btn\s*\{[^}]*height:\s*34px;/s.test(novelCss),
    true,
    'Mobil modda buton yuksekligi 34px olmali'
  );

  // 2. Alt bar mobil dengeli dock yerlesimi ve seekbar esnekligi
  assert.equal(
    /\.mihon-prev-dock\s*\{[^}]*flex:\s*0\s+0\s+auto;/s.test(readerCss),
    true,
    '.mihon-prev-dock mobil modda flex: 0 0 auto olmali'
  );
  assert.equal(
    /\.mihon-action-dock\s*\{[^}]*flex:\s*0\s+0\s+auto;/s.test(readerCss),
    true,
    '.mihon-action-dock mobil modda flex: 0 0 auto olmali'
  );
  assert.equal(
    /\.mihon-seekbar-row\s*\{[^}]*flex:\s*1\s+1\s+auto;/s.test(readerCss),
    true,
    '.mihon-seekbar-row mobil modda flex: 1 1 auto ile tam genislik almali'
  );
  assert.equal(
    /env\(safe-area-inset-bottom/s.test(readerCss),
    true,
    'Mobil alt bar icin safe-area-inset-bottom destegi olmali'
  );
  assert.equal(
    /\.reader-viewport\s*\{[^}]*padding-bottom:\s*4\.5rem;/s.test(readerCss),
    true,
    '.reader-viewport mobil modda alt bar icin 4.5rem padding-bottom bosluguna sahip olmali'
  );
  assert.equal(
    /\.reader-viewport\.mode-single,\s*\.reader-viewport\.mode-double\s*\{[^}]*padding-bottom:\s*0\s*!important;/s.test(
      readerCss
    ),
    true,
    '.reader-viewport.mode-single ve mode-double alt boslugu sifirlanmali (0 !important)'
  );
  assert.equal(
    /\.mihon-mini-page-pill\s*\{[^}]*position:\s*fixed;/s.test(readerCss),
    true,
    '.mihon-mini-page-pill DOM akisindan cikarilip position: fixed olmali'
  );
  assert.equal(
    /body\[data-active-view="reader"\]\s+\.disqus-container:not\(\.reader-comments-visible\)\s*\{[^}]*display:\s*none\s*!important;/s.test(
      layoutCss
    ),
    true,
    'Okuyucu gorunumunde aktiflesmemis yorum alani display: none olmali'
  );

  // 3. Reader wrapper esnek dikey kapsayici kurali
  assert.equal(
    /body\[data-active-view="reader"\]\s+\.reader-wrapper\s*\{[^}]*display:\s*flex\s*!important;\s*flex-direction:\s*column\s*!important;/s.test(
      layoutCss
    ),
    true,
    'reader-wrapper esnek dikey kolon yapisina sahip olmali'
  );
  assert.equal(
    /body\[data-active-view="reader"\]\s+\.reader-viewport\s*\{[^}]*flex:\s*1\s+0\s+auto\s*!important;/s.test(
      layoutCss
    ),
    true,
    'reader-viewport flex: 1 0 auto ile kalan alani doldurmali'
  );

  // 4. Ust bar baslik ve kontrollerinin dengeli flex: 1 1 0% yapisi ve ortalama
  assert.equal(
    /\.reader-toolbar\s+\.reader-title-group\s*\{[^}]*flex:\s*1\s+1\s+0%\s*!important;/s.test(readerCss),
    true,
    'reader-toolbar .reader-title-group mobil modda flex: 1 1 0% !important ile dengeli olmali'
  );
  assert.equal(
    /\.reader-toolbar\s+\.reader-controls\s*\{[^}]*flex:\s*1\s+1\s+0%\s*!important;/s.test(readerCss),
    true,
    'reader-toolbar .reader-controls mobil modda flex: 1 1 0% !important ile dengeli olmali'
  );
  assert.equal(
    /\.reader-chapter-switcher\s*\{[^}]*margin:\s*0\s+auto;/s.test(readerCss),
    true,
    '.reader-chapter-switcher her iki ekranda da margin: 0 auto ile tam ortalanmali'
  );

  // 5. Seekbar dinamik ilerleme izi (--slider-fill) tanimi
  assert.equal(
    /\.mihon-page-slider\s*\{[^}]*--slider-fill:\s*0%;/s.test(readerCss),
    true,
    '.mihon-page-slider dinamik --slider-fill degiskenine sahip olmali'
  );
  assert.equal(
    /\.mihon-page-slider\s*\{[^}]*background:\s*linear-gradient\([^}]*var\(--slider-fill/s.test(readerCss),
    true,
    '.mihon-page-slider arka planinda --slider-fill ilerleme izi kullanilmali'
  );
});

test('ReadingEngine & ReaderHud: Manga modunda seekbar LTR yonunde kalmali ve dinamik iz (--slider-fill) guncellenmeli', () => {
  const { ReadingEngine } = require('../src/scripts/reading-engine');
  const { ReaderHudController } = require('../src/scripts/reader-hud');

  // Sahte DOM elemanlari
  const elements = {};
  const mockDoc = {
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = {
          id,
          style: {
            _props: {},
            setProperty(prop, val) { this._props[prop] = val; },
            getPropertyValue(prop) { return this._props[prop] || ''; }
          },
          attributes: {},
          setAttribute(name, val) { this.attributes[name] = val; },
          getAttribute(name) { return this.attributes[name]; },
          classList: {
            toggle: () => {}
          },
          textContent: '',
          value: '1',
          min: '1',
          max: '32',
          addEventListener: () => {}
        };
      }
      return elements[id];
    }
  };

  const engine = new ReadingEngine({ seriesType: 'manga' });
  const pages = Array.from({ length: 32 }, (_, i) => `sayfa_${i + 1}.jpg`);
  engine.loadChapter({
    seriesId: 'manga-wistoria',
    chapterId: 'bolum-3',
    seriesType: 'manga',
    defaultMode: 'single',
    pages
  });

  // Manga serisinde okuma yonu RTL olmalidir fakat seekbar LTR kalmalidir
  assert.equal(engine.direction, 'rtl', 'Manga serisinde sayfa okuma yonu RTL olmali');

  // Sayfa 1 icin DOM render islemi
  engine.renderViewportIntoDom(mockDoc);
  const slider = mockDoc.getElementById('reader-page-slider');
  assert.equal(slider.getAttribute('dir'), 'ltr', 'Seekbar slider niteligi RTL manga serisinde bile LTR olmali');
  assert.equal(slider.value, '1', '1. sayfada seekbar degeri 1 olmali');
  assert.equal(slider.style.getPropertyValue('--slider-fill'), '0%', '1. sayfada dinamik iz 0% olmali');

  // Son sayfaya (32) gecildiginde dinamik iz 100% olmali
  engine.goToPage(31);
  engine.renderViewportIntoDom(mockDoc);
  assert.equal(slider.value, '32', '32. sayfada seekbar degeri 32 olmali');
  assert.equal(slider.style.getPropertyValue('--slider-fill'), '100%', '32. sayfada dinamik iz 100% olmali');

  // ReaderHudController seekbar surukleme destegi testi
  const hud = new ReaderHudController();
  hud.handleSeekbarChange(engine, 16, mockDoc);
  assert.equal(engine.currentIndex, 15, '16. sayfaya gecis yapilmali');
  engine.renderViewportIntoDom(mockDoc);
  assert.equal(slider.style.getPropertyValue('--slider-fill'), '48%', '16. sayfada dinamik iz yaklasik 48% olmali');
});
