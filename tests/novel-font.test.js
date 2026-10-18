/**
 * @fileoverview Novel okuma modu Google Fonts yukleyici ve alt bar navigasyon birim testleri.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { NovelFontLoader, NOVEL_FONTS } = require('../src/scripts/novel-font-loader');
const { ReadingEngine } = require('../src/scripts/reading-engine');

function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, val) {
      store[key] = String(val);
    },
    removeItem(key) {
      delete store[key];
    }
  };
}

function createMockDocument() {
  const elements = new Map();
  const headChildren = [];

  const head = {
    appendChild(node) {
      headChildren.push(node);
      if (node.id) {
        elements.set(node.id, node);
      }
      return node;
    }
  };

  const doc = {
    head,
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        id: '',
        rel: '',
        href: '',
        attributes: {},
        setAttribute(name, val) {
          this.attributes[name] = String(val);
        }
      };
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    _registerElement(id, el) {
      elements.set(id, el);
    },
    _headChildren: headChildren
  };

  return doc;
}

test('NovelFontLoader: Varsayilan font listesi ve Google Fonts tanimlari dogru olmali', () => {
  const loader = new NovelFontLoader({ storage: createMockStorage() });
  const fonts = loader.getFonts();

  assert.equal(Array.isArray(fonts), true);
  assert.equal(fonts.length >= 7, true);

  const sans = loader.getFont('sans');
  assert.equal(sans.id, 'sans');
  assert.equal(sans.google, null);

  const serif = loader.getFont('serif');
  assert.equal(serif.id, 'serif');
  assert.equal(serif.name.includes('Merriweather'), true);
  assert.equal(serif.google.includes('Merriweather'), true);

  const lora = loader.getFont('lora');
  assert.equal(lora.id, 'lora');
  assert.equal(lora.name.includes('Lora'), true);
  assert.equal(lora.google.includes('Lora'), true);
});

test('NovelFontLoader: cycleFont tum fontlari sirayla donmeli ve localStorage uzerine kaydetmeli', () => {
  const storage = createMockStorage();
  const loader = new NovelFontLoader({ storage });

  assert.equal(loader.activeFontId, 'sans');
  assert.equal(loader.cycleFont(), 'serif');
  assert.equal(storage.getItem('manowa_novel_font'), 'serif');

  assert.equal(loader.cycleFont(), 'lora');
  assert.equal(storage.getItem('manowa_novel_font'), 'lora');

  // Bir sonraki yuklemede kaydedilen font hatirlanmali
  const loader2 = new NovelFontLoader({ storage });
  assert.equal(loader2.activeFontId, 'lora');
  assert.equal(loader2.getActiveFont().name.includes('Lora'), true);
});

test('NovelFontLoader: ensureGoogleFontLoaded preconnect ve stylesheet linklerini head bolumune eklemeli', () => {
  const loader = new NovelFontLoader({ storage: createMockStorage() });
  const doc = createMockDocument();

  const added = loader.ensureGoogleFontLoaded('serif', doc);
  assert.equal(added, true);

  const preconnectApi = doc.getElementById('gfont-preconnect-api');
  assert.equal(Boolean(preconnectApi), true);
  assert.equal(preconnectApi.href, 'https://fonts.googleapis.com');

  const preconnectStatic = doc.getElementById('gfont-preconnect-static');
  assert.equal(Boolean(preconnectStatic), true);
  assert.equal(preconnectStatic.href, 'https://fonts.gstatic.com');

  const linkMerriweather = doc.getElementById('gfont-link-serif');
  assert.equal(Boolean(linkMerriweather), true);
  assert.equal(linkMerriweather.rel, 'stylesheet');
  assert.equal(linkMerriweather.href.includes('Merriweather'), true);

  // Ayni font tekrar yuklenmek istendiginde cift link eklenmemeli
  const addedAgain = loader.ensureGoogleFontLoaded('serif', doc);
  assert.equal(addedAgain, true);
  assert.equal(doc._headChildren.filter((el) => el.id === 'gfont-link-serif').length, 1);
});

test('ReadingEngine: Novel modunda Google Fonts secim listesi (select-font-family) ve DOM esitlemesi calismali', () => {
  const storage = createMockStorage();
  const engine = new ReadingEngine({ storage });

  engine.loadChapter({
    seriesId: 'omniscient-novel',
    chapterId: 'ch-1',
    pages: [],
    htmlContent: '<p class="orv_line">Kader Senaryosu Basladi.</p>'
  });

  const state1 = engine.getState();
  assert.equal(state1.mode, 'novel');
  assert.equal(state1.novelFontFamily, 'sans');

  // setNovelFontFamily ile secim listesinden secim yapilmasi
  engine.setNovelFontFamily('lora');
  assert.equal(engine.novelFontFamily, 'lora');
  assert.equal(engine.getNovelFontLabel().includes('Lora'), true);

  // Mock DOM uzerinde syncControlsIntoDom ve renderViewportIntoDom testi
  const doc = createMockDocument();
  const fontLabelEl = { textContent: '' };
  const fontSelectEl = { value: '' };
  const viewportEl = {
    className: '',
    innerHTML: '',
    style: {
      setProperty: () => {}
    }
  };
  doc._registerElement('font-family-label', fontLabelEl);
  doc._registerElement('select-font-family', fontSelectEl);
  doc._registerElement('reader-viewport', viewportEl);

  engine.syncControlsIntoDom(doc);
  assert.equal(fontLabelEl.textContent.includes('Lora'), true);
  assert.equal(fontSelectEl.value, 'lora');

  engine.renderViewportIntoDom(doc);
  assert.equal(viewportEl.innerHTML.includes('Lora'), true);
  assert.equal(viewportEl.innerHTML.includes('Kader Senaryosu Basladi.'), true);
  assert.equal(Boolean(doc.getElementById('gfont-link-lora')), true);
});

test('Template: Alt barda Onceki ve Sonraki bolum butonlari seekbar disinda ve secim listesi mevcut olmali', () => {
  const bodyContentPath = path.resolve(__dirname, '../src/templates/body-content.html');
  const content = fs.readFileSync(bodyContentPath, 'utf8');

  // select-font-family secim listesi ve Google Fonts secenekleri
  assert.equal(content.includes('id="select-font-family"'), true);
  assert.equal(content.includes('value="lora"'), true);
  assert.equal(content.includes('value="serif"'), true);
  assert.equal(content.includes('value="roboto-slab"'), true);

  // Alt bar (#reader-footer-bar) icinde btn-prev-chapter ve btn-next-chapter yerlesimi
  const footerBarPart = content.split('id="reader-footer-bar"')[1].split('</section>')[0];
  assert.equal(footerBarPart.includes('id="btn-prev-chapter"'), true);
  assert.equal(footerBarPart.includes('id="btn-next-chapter"'), true);
  assert.equal(footerBarPart.includes('id="reader-seekbar-row"'), true);
});

test('Custom Font Dropdown: Temaya uygun ozel acilir font listesi ve WAI-ARIA erisilebilirlik yapisi', () => {
  const bodyContentPath = path.resolve(__dirname, '../src/templates/body-content.html');
  const content = fs.readFileSync(bodyContentPath, 'utf8');
  const novelCssPath = path.resolve(__dirname, '../src/styles/reader-novel.css');
  const novelCss = fs.readFileSync(novelCssPath, 'utf8');

  // DOM ve ARIA bilesenleri kontrolu
  assert.equal(content.includes('id="reader-font-dropdown"'), true);
  assert.equal(content.includes('id="btn-font-family"'), true);
  assert.equal(content.includes('aria-haspopup="listbox"'), true);
  assert.equal(content.includes('aria-expanded="false"'), true);
  assert.equal(content.includes('id="reader-font-menu"'), true);
  assert.equal(content.includes('role="listbox"'), true);
  assert.equal(content.includes('class="reader-font-option active"'), true);
  assert.equal(content.includes('data-font-id="serif"'), true);
  assert.equal(content.includes('data-font-id="lora"'), true);
  assert.equal(content.includes('data-font-id="roboto-slab"'), true);
  assert.equal(content.includes('role="option"'), true);
  assert.equal(content.includes('ui-icon-chevron'), true);

  // Koyu/Turuncu tema stilleri kontrolu
  assert.equal(novelCss.includes('.reader-font-dropdown'), true);
  assert.equal(novelCss.includes('.reader-font-menu'), true);
  assert.equal(novelCss.includes('backdrop-filter: blur('), true);
  assert.equal(novelCss.includes('var(--accent-primary)'), true);
  assert.equal(novelCss.includes('.reader-font-option.active'), true);
  assert.equal(novelCss.includes('.sr-only-select'), true);
});

test('ReaderHudController: syncHudIntoDom acilir font menusu seceneklerini aktif fonta gore esitlemeli', () => {
  const { ReaderHudController } = require('../src/scripts/reader-hud');
  const hud = new ReaderHudController();
  const storage = createMockStorage();
  const engine = new ReadingEngine({ storage });

  let menuHidden = true;

  const fontOptions = [
    {
      fontId: 'sans',
      classes: new Set(['reader-font-option', 'active']),
      getAttribute(attr) { return attr === 'data-font-id' ? 'sans' : null; },
      classList: {
        toggle(cls, val) { if (val) fontOptions[0].classes.add(cls); else fontOptions[0].classes.delete(cls); },
        contains(cls) { return fontOptions[0].classes.has(cls); }
      },
      setAttribute(k, v) { this[k] = v; }
    },
    {
      fontId: 'lora',
      classes: new Set(['reader-font-option']),
      getAttribute(attr) { return attr === 'data-font-id' ? 'lora' : null; },
      classList: {
        toggle(cls, val) { if (val) fontOptions[1].classes.add(cls); else fontOptions[1].classes.delete(cls); },
        contains(cls) { return fontOptions[1].classes.has(cls); }
      },
      setAttribute(k, v) { this[k] = v; }
    }
  ];

  const fontMenu = {
    classList: {
      contains(cls) { return cls === 'hidden' ? menuHidden : false; },
      toggle(cls, val) { if (cls === 'hidden') menuHidden = Boolean(val); }
    },
    querySelectorAll(selector) {
      if (selector === '.reader-font-option') return fontOptions;
      return [];
    }
  };

  const mockDoc = {
    getElementById(id) {
      if (id === 'reader-font-menu') return fontMenu;
      return null;
    }
  };

  engine.loadChapter({
    seriesId: 'omniscient-novel',
    chapterId: 'ch-1',
    pages: [],
    htmlContent: '<p>Kader senaryosu</p>'
  });
  engine.setNovelFontFamily('lora');

  hud.syncHudIntoDom(engine, null, mockDoc);

  assert.equal(fontOptions[0].classes.has('active'), false);
  assert.equal(fontOptions[1].classes.has('active'), true);
  assert.equal(fontOptions[1]['aria-selected'], 'true');
});

test('Template: Novel yazi boyutu ve yazi tipi kontrolleri ust cubuktan alinip reader-settings-sheet icine tasinmis olmali', () => {
  const bodyContentPath = path.resolve(__dirname, '../src/templates/body-content.html');
  const content = fs.readFileSync(bodyContentPath, 'utf8');

  // Ust cubuktaki .reader-controls icerisinde reader-group-novel olmamali, yalnizca btn-reader-settings olmali
  const headerPart = content.split('<div class="reader-controls">')[1].split('</div>')[0];
  assert.equal(headerPart.includes('id="reader-group-novel"'), false);
  assert.equal(headerPart.includes('id="btn-reader-settings"'), true);

  // reader-settings-sheet icinde reader-group-novel, mihon-setting-font-size-group ve mihon-setting-font-family-group bulunmali
  const sheetPart = content.split('id="reader-settings-sheet"')[1].split('<div class="translator-note-box')[0];
  assert.equal(sheetPart.includes('id="reader-group-novel"'), true);
  assert.equal(sheetPart.includes('id="mihon-setting-font-size-group"'), true);
  assert.equal(sheetPart.includes('id="mihon-setting-font-family-group"'), true);
  assert.equal(sheetPart.includes('id="btn-font-decrease"'), true);
  assert.equal(sheetPart.includes('id="font-size-label"'), true);
  assert.equal(sheetPart.includes('id="btn-font-increase"'), true);
  assert.equal(sheetPart.includes('id="reader-font-dropdown"'), true);
});

test('ReaderHudController: Ayarlar cekmecesi kapatildiginda acik olan reader-font-menu otomatik gizlenmeli', () => {
  const { ReaderHudController } = require('../src/scripts/reader-hud');
  const hud = new ReaderHudController();
  let menuHidden = false;
  let fontBtnExpanded = 'true';

  const mockDoc = {
    getElementById(id) {
      if (id === 'reader-settings-sheet') {
        return { classList: { toggle() {} } };
      }
      if (id === 'reader-font-menu') {
        return {
          classList: {
            add(cls) { if (cls === 'hidden') menuHidden = true; }
          }
        };
      }
      if (id === 'btn-font-family') {
        return {
          setAttribute(k, v) { if (k === 'aria-expanded') fontBtnExpanded = v; }
        };
      }
      return null;
    }
  };

  hud.settingsOpen = true;
  hud.toggleSettingsSheet(false, mockDoc);
  assert.equal(hud.settingsOpen, false);
  assert.equal(menuHidden, true);
  assert.equal(fontBtnExpanded, 'false');
});



