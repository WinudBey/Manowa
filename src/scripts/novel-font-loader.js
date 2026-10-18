/**
 * @fileoverview Novel okuma modunda Google Fonts uzerinden dinamik yazi tipi yukleme
 * ve yonetim modulu.
 */

(function (globalScope) {
  'use strict';

  /**
   * Roman okuma modunda kullanilabilecek Google Fonts ve sistem yazi tipleri.
   * @type {Array<{id: string, name: string, family: string, google: string|null}>}
   */
  const NOVEL_FONTS = [
    {
      id: 'sans',
      name: 'Varsayılan (Sans)',
      family: 'inherit',
      google: null
    },
    {
      id: 'serif',
      name: 'Merriweather (Serif)',
      family: "'Merriweather', Georgia, serif",
      google: 'Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400'
    },
    {
      id: 'lora',
      name: 'Lora (Serif)',
      family: "'Lora', Georgia, serif",
      google: 'Lora:ital,wght@0,400;0,600;0,700;1,400'
    },
    {
      id: 'roboto-slab',
      name: 'Roboto Slab',
      family: "'Roboto Slab', Georgia, serif",
      google: 'Roboto+Slab:wght@400;600;700'
    },
    {
      id: 'nunito',
      name: 'Nunito (Sans)',
      family: "'Nunito', sans-serif",
      google: 'Nunito:ital,wght@0,400;0,600;0,700;1,400'
    },
    {
      id: 'inter',
      name: 'Inter (Sans)',
      family: "'Inter', sans-serif",
      google: 'Inter:wght@400;600;700'
    },
    {
      id: 'eb-garamond',
      name: 'EB Garamond (Serif)',
      family: "'EB Garamond', Georgia, serif",
      google: 'EB+Garamond:ital,wght@0,400;0,600;1,400'
    },
    {
      id: 'playfair',
      name: 'Playfair Display (Serif)',
      family: "'Playfair Display', Georgia, serif",
      google: 'Playfair+Display:ital,wght@0,400;0,700;1,400'
    }
  ];

  const STORAGE_KEY = 'manowa_novel_font';

  /**
   * Google Fonts yoneticisi sinifi.
   */
  class NovelFontLoader {
    /**
     * @param {Object} [options={}] - Yapilandirma secenekleri.
     * @param {Object} [options.storage] - Yerel depolama nesnesi (localStorage).
     * @param {Object} [options.logger] - Logger nesnesi.
     */
    constructor(options = {}) {
      this.storage =
        options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.loadedFonts = new Set();
      this.activeFontId = this._resolveInitialFont();
    }

    /**
     * Ilk yazi tipi kimligini belirler.
     * @private
     * @returns {string} Font kimligi.
     */
    _resolveInitialFont() {
      if (!this.storage) return 'sans';
      try {
        const saved = this.storage.getItem(STORAGE_KEY);
        if (saved && this.getFont(saved)) {
          return saved;
        }
      } catch (_e) {
        // Depolama erisim hatasinda varsayilan kullanilir
      }
      return 'sans';
    }

    /**
     * Log kaydi yazar.
     * @private
     * @param {string} level - Log seviyesi.
     * @param {string} message - Mesaj.
     * @param {Object} [data] - Veri.
     */
    _log(level, message, data) {
      if (this.logger && typeof this.logger[level] === 'function') {
        this.logger[level](`[NovelFontLoader] ${message}`, data);
      }
    }

    /**
     * Tum tanimli yazi tiplerini dondurur.
     * @returns {Array<{id: string, name: string, family: string, google: string|null}>}
     */
    getFonts() {
      return NOVEL_FONTS;
    }

    /**
     * Kimlige gore yazi tipi nesnesini dondurur.
     * @param {string} fontId - Font kimligi.
     * @returns {Object|null}
     */
    getFont(fontId) {
      const match = NOVEL_FONTS.find((f) => f.id === fontId);
      return match || null;
    }

    /**
     * Guncel aktif yazi tipi nesnesini dondurur.
     * @returns {Object}
     */
    getActiveFont() {
      return this.getFont(this.activeFontId) || NOVEL_FONTS[0];
    }

    /**
     * Bir sonraki yazi tipine gecer ve font kimligini dondurur.
     * @returns {string} Yeni font kimligi.
     */
    cycleFont() {
      const currIdx = NOVEL_FONTS.findIndex((f) => f.id === this.activeFontId);
      const nextIdx = (currIdx + 1) % NOVEL_FONTS.length;
      const nextFont = NOVEL_FONTS[nextIdx];
      this.setFont(nextFont.id);
      return this.activeFontId;
    }

    /**
     * Aktif yazi tipini ayarlar ve kalici olarak kaydeder.
     * @param {string} fontId - Font kimligi.
     * @returns {Object} Secilen font nesnesi.
     */
    setFont(fontId) {
      const found = this.getFont(fontId) || NOVEL_FONTS[0];
      this.activeFontId = found.id;
      if (this.storage) {
        try {
          this.storage.setItem(STORAGE_KEY, found.id);
        } catch (_e) {
          // Depolama hatasi yoksayilir
        }
      }
      this._log('info', 'Yazi tipi secildi.', { fontId: found.id, fontName: found.name });
      return found;
    }

    /**
     * Google Fonts baglantilarini (<link>) DOM icine ekler.
     * @param {string} [fontId] - Yuklenecek font kimligi (belirtilmezse aktif font).
     * @param {Document} [doc] - Hedef document nesnesi.
     * @returns {boolean} Yukleme linki eklendi veya zaten mevcutsa true.
     */
    ensureGoogleFontLoaded(fontId, doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || !targetDoc.head) {
        return false;
      }

      const fontDef = this.getFont(fontId || this.activeFontId);
      if (!fontDef || !fontDef.google) {
        return false;
      }

      const linkId = `gfont-link-${fontDef.id}`;
      if (targetDoc.getElementById(linkId)) {
        return true;
      }

      // Preconnect linklerini ekle
      this._ensurePreconnect(targetDoc);

      const link = targetDoc.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fontDef.google}&display=swap`;
      targetDoc.head.appendChild(link);

      this.loadedFonts.add(fontDef.id);
      this._log('debug', 'Google Font linki head bolumune eklendi.', {
        fontId: fontDef.id,
        href: link.href
      });
      return true;
    }

    /**
     * Google Fonts icin preconnect linklerinin mevcudiyetini saglar.
     * @private
     * @param {Document} targetDoc - Hedef document.
     */
    _ensurePreconnect(targetDoc) {
      if (!targetDoc.getElementById('gfont-preconnect-api')) {
        const linkApi = targetDoc.createElement('link');
        linkApi.id = 'gfont-preconnect-api';
        linkApi.rel = 'preconnect';
        linkApi.href = 'https://fonts.googleapis.com';
        targetDoc.head.appendChild(linkApi);
      }
      if (!targetDoc.getElementById('gfont-preconnect-static')) {
        const linkStatic = targetDoc.createElement('link');
        linkStatic.id = 'gfont-preconnect-static';
        linkStatic.rel = 'preconnect';
        linkStatic.href = 'https://fonts.gstatic.com';
        linkStatic.setAttribute('crossorigin', '');
        targetDoc.head.appendChild(linkStatic);
      }
    }

    /**
     * Secilen fontu bir DOM elemanina veya CSS degiskenine uygular.
     * @param {HTMLElement} [element] - Novel icerik kutusu elemani.
     * @param {Document} [doc] - Hedef document.
     * @returns {string} Uygulanan font family degeri.
     */
    applyActiveFont(element, doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      const font = this.getActiveFont();

      if (font.google && targetDoc) {
        this.ensureGoogleFontLoaded(font.id, targetDoc);
      }

      if (element && element.style && typeof element.style.setProperty === 'function') {
        element.style.setProperty('--novel-font-family', font.family);
        if (font.family !== 'inherit') {
          element.style.fontFamily = font.family;
        } else {
          element.style.fontFamily = '';
        }
      }

      return font.family;
    }
  }

  globalScope.NOVEL_FONTS = NOVEL_FONTS;
  globalScope.NovelFontLoader = NovelFontLoader;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      NOVEL_FONTS,
      NovelFontLoader
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
