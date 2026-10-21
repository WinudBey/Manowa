/**
 * @fileoverview Cok modlu okuma motoru (Webtoon, Tek Sayfa, Cift Sayfa ve Novel) sinifi.
 * Okuma yonu (LTR/RTL), zoom, sayfa boslugu, otomatik kaydirma ve ilerleme kaydini yonetir.
 */

(function (globalScope) {
  'use strict';

  const VALID_MODES = ['webtoon', 'single', 'double', 'novel'];
  const VALID_DIRECTIONS = ['ltr', 'rtl'];
  const VALID_BG_THEMES = ['dark', 'amoled', 'sepia', 'light'];

  /**
   * Manga, Manhwa ve Novel okuma deneyimini yoneten sinif.
   */
  class ReadingEngine {
    /**
     * ReadingEngine nesnesini baslatir.
     * @param {Object} [options={}] - Baslangic secenekleri.
     */
    constructor(options = {}) {
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      this.historyKey = 'manowa_reading_history';
      this.seriesType = this.normalizeSeriesType(
        options.seriesType || 'Manhwa',
        options.sourceLang || '',
        Boolean(options.isNovel)
      );
      this.mode = VALID_MODES.includes(options.mode) ? options.mode : 'webtoon';
      this.direction = VALID_DIRECTIONS.includes(options.direction) ? options.direction : 'ltr';
      this.zoom = this._clamp(options.zoom || 100, 50, 150);
      this.gap = typeof options.gap === 'number' ? Math.max(0, options.gap) : 0;
      this.backgroundTheme = VALID_BG_THEMES.includes(options.backgroundTheme) ? options.backgroundTheme : 'dark';
      this.hudVisible = options.hudVisible !== undefined ? Boolean(options.hudVisible) : true;
      let FontLoaderClass = globalScope.NovelFontLoader;
      if (!FontLoaderClass && typeof require === 'function') {
        try { FontLoaderClass = require('./novel-font-loader').NovelFontLoader; } catch (_e) {}
      }
      this.fontLoader =
        options.fontLoader ||
        (FontLoaderClass ? new FontLoaderClass({ storage: this.storage, logger: this.logger }) : null);
      this.novelFontSize = this._clamp(options.novelFontSize || 105, 85, 160);
      this.novelFontFamily =
        options.novelFontFamily || (this.fontLoader ? this.fontLoader.activeFontId : 'sans');
      if (options.novelFontFamily && this.fontLoader) {
        this.fontLoader.setFont(this.novelFontFamily);
      }
      this.protectImages = options.protectImages !== undefined ? Boolean(options.protectImages) : true;
      this.sliceMerger =
        options.sliceMerger ||
        (globalScope.SliceMerger ? new globalScope.SliceMerger({ logger: this.logger }) : null);
      if (!this.sliceMerger && typeof require !== 'undefined') {
        try {
          const { SliceMerger } = require('./slice-merger');
          if (SliceMerger) this.sliceMerger = new SliceMerger({ logger: this.logger });
        } catch (_err) {}
      }
      this.rawPages = [];
      this.pageGroups = [];
      this.pages = [];
      this.htmlContent = '';
      this.currentIndex = 0;
      this.seriesId = '';
      this.chapterId = '';
      this.autoScrollActive = false;
      this.autoScrollSpeed = this._clamp(options.autoScrollSpeed || 2, 1, 5);
      this.autoScrollPause = Math.max(0, Number(options.autoScrollPause) || 0);
      this._autoScrollTimer = null;
      this._autoScrollPausedUntil = 0;
      this._autoScrollMovedPx = 0;

      this._log('debug', 'ReadingEngine baslatildi.', {
        seriesType: this.seriesType,
        mode: this.mode,
        direction: this.direction,
        zoom: this.zoom
      });
    }

    /**
     * Seri turunu ('manhwa', 'manhua', 'manga', 'novel') olarak normalize eder.
     * @param {string} [rawType=''] - Ham seri turu.
     * @param {string} [sourceLang=''] - Kaynak dil kodu ('KR', 'JP', 'CN', 'EN').
     * @param {boolean} [isNovel=false] - Bolumun metin tabanli olup olmadigi.
     * @returns {'manhwa'|'manhua'|'manga'|'novel'} Normalize edilmis tur.
     */
    normalizeSeriesType(rawType = '', sourceLang = '', isNovel = false) {
      const lower = String(rawType || '').trim().toLowerCase();
      const lang = String(sourceLang || '').trim().toUpperCase();
      if (isNovel || lower === 'novel' || lower === 'roman' || lower === 'webnovel') {
        return 'novel';
      }
      if (lower === 'manga' || lang === 'JP') {
        return 'manga';
      }
      if (lower === 'manhua' || lang === 'CN') {
        return 'manhua';
      }
      return 'manhwa';
    }

    /**
     * Aktif seri turunun kullanici arayuzu etiketini dondurur.
     * @returns {string} Gosterilecek tur etiketi.
     */
    getSeriesTypeLabel() {
      const map = {
        novel: 'Novel',
        manga: 'Manga',
        manhua: 'Manhua',
        manhwa: 'Manhwa'
      };
      return map[this.seriesType] || 'Manhwa';
    }

    /**
     * Bolum secici acilir kutusu icin tekrarli seri adindan arindirilmis kisa etiket uretir.
     * @param {Object} [chapter={}] - Bolum nesnesi.
     * @returns {string} Kisa bolum etiketi (orn: "Bölüm 279").
     */
    formatChapterSelectLabel(chapter = {}) {
      if (chapter && chapter.number !== undefined && chapter.number !== null && chapter.number !== '') {
        return `Bölüm ${chapter.number}`;
      }
      const rawTitle = String((chapter && chapter.title) || '').trim();
      const match = rawTitle.match(/B[öo]l[üu]m\s*(\d+(?:[.,]\d+)?)/i);
      if (match) {
        return `Bölüm ${match[1]}`;
      }
      return rawTitle || 'Bölüm';
    }

    /**
     * Gorsel URL'sinden "01_01", "01_02", "02-01" gibi bolunmus sayfa grup anahtarini cikarir.
     * @param {string} rawUrl - Gorsel URL dizgesi.
     * @returns {string|null} Mantiksal sayfa grup anahtari veya null.
     */
    extractSliceGroupKey(rawUrl) {
      if (globalScope.SliceMerger) return globalScope.SliceMerger.extractSliceGroupKey(rawUrl);
      const clean = String(rawUrl || '').split(/[?#]/)[0];
      const match = clean.match(/(?:sayfa[_-]?|page[_-]?|p)?(\d+)[_](\d+)\.[a-z0-9]+$/i);
      return match ? `page:${Number(match[1])}` : null;
    }

    /**
     * Bolunmus gorsel URL listesini tam sayfa gruplarina donusturur.
     * @param {Array<string>} [rawPages=[]] - Ham URL dizisi.
     * @returns {Array<Array<string>>} Gruplanmis mantiksal sayfa dilimleri.
     */
    groupSlicedPages(rawPages = []) {
      if (globalScope.SliceMerger) return globalScope.SliceMerger.groupSlicedPages(rawPages);
      if (!Array.isArray(rawPages)) return [];
      return rawPages.map((p) => [p]);
    }

    /**
     * Belirtilen mantiksal sayfa indeksine ait tum gorsel dilimlerini dondurur.
     * @param {number} pageIndex - Mantiksal sayfa indeksi.
     * @returns {Array<string>} Sayfayi olusturan gorsel URL dilimleri.
     */
    getPageSlices(pageIndex) {
      if (Array.isArray(this.pageGroups) && Array.isArray(this.pageGroups[pageIndex])) {
        return this.pageGroups[pageIndex];
      }
      if (this.pages[pageIndex]) {
        return [this.pages[pageIndex]];
      }
      return [];
    }

    /**
     * Ic loglama yardimcisi.
     * @param {'debug'|'info'|'warn'|'error'} level - Log seviyesi.
     * @param {string} msg - Log mesaji.
     * @param {Object|null} [meta=null] - Ek veri.
     * @returns {void}
     */
    _log(level, msg, meta = null) {
      if (this.logger && typeof this.logger[level] === 'function') {
        this.logger[level](msg, meta);
      }
    }

    /**
     * Sayisal degeri min ve max araliginda sinirlar.
     * @param {number} val - Deger.
     * @param {number} min - Alt sinir.
     * @param {number} max - Ust sinir.
     * @returns {number} Sinirlanmis deger.
     */
    _clamp(val, min, max) {
      return Math.min(max, Math.max(min, Number(val) || min));
    }

    /**
     * Yeni bir bolumu okuma motoruna yukler ve seri turune gore modu/yonu otomatik ayarlar.
     * Bolunmus ("01_01, 01_02") gorselleri mantiksal tam sayfalara gruplar.
     * @param {Object} [chapterData={}] - Bolum verileri.
     * @returns {Object} Guncel motor durumu.
     */
    loadChapter(chapterData = {}) {
      this.stopAutoScroll();
      if (this.sliceMerger && typeof this.sliceMerger.clearCache === 'function') {
        this.sliceMerger.clearCache();
      }
      this.seriesId = chapterData.seriesId || '';
      this.chapterId = chapterData.chapterId || '';
      this.rawPages = Array.isArray(chapterData.pages) ? chapterData.pages.slice() : [];
      this.pageGroups = this.groupSlicedPages(this.rawPages);
      this.pages = this.pageGroups.map((group) => group[0]);
      this.htmlContent = String(chapterData.htmlContent || '');
      const hasOnlyNovelHtml = Boolean(this.pages.length === 0 && this.htmlContent);
      const isNovelChapter = Boolean(chapterData.isNovel || hasOnlyNovelHtml);

      this.seriesType = this.normalizeSeriesType(
        chapterData.seriesType || '',
        chapterData.sourceLang || '',
        isNovelChapter
      );

      if (this.seriesType === 'novel' || hasOnlyNovelHtml) {
        this.seriesType = 'novel';
        this.mode = 'novel';
        this.direction = 'ltr';
      } else {
        if (chapterData.defaultMode && VALID_MODES.includes(chapterData.defaultMode) && chapterData.defaultMode !== 'novel') {
          this.mode = chapterData.defaultMode;
        } else if (this.seriesType === 'manga') {
          this.mode = 'single';
        } else {
          this.mode = 'webtoon';
        }

        if (chapterData.direction && VALID_DIRECTIONS.includes(chapterData.direction)) {
          this.direction = chapterData.direction;
        } else if (this.seriesType === 'manga') {
          this.direction = 'rtl';
        } else {
          this.direction = 'ltr';
        }
      }

      const saved = this.getProgress(this.seriesId);
      if (typeof chapterData.startPage === 'number') {
        this.currentIndex = this._clamp(chapterData.startPage, 0, Math.max(0, this.pages.length - 1));
      } else if (saved && saved.chapterId === this.chapterId && typeof saved.pageIndex === 'number') {
        this.currentIndex = this._clamp(saved.pageIndex, 0, Math.max(0, this.pages.length - 1));
      } else {
        this.currentIndex = 0;
      }

      this.saveProgress();
      this.preloadAdjacentPages();
      this._log('info', 'Bolum okuma motoruna yuklendi.', {
        seriesId: this.seriesId,
        chapterId: this.chapterId,
        seriesType: this.seriesType,
        mode: this.mode,
        direction: this.direction,
        pageCount: this.pages.length,
        rawSliceCount: this.rawPages.length,
        isNovel: this.seriesType === 'novel',
        startIndex: this.currentIndex
      });

      return this.getState();
    }

    /**
     * Okuma modunu degistirir ('webtoon', 'single', 'double', 'novel').
     * @param {string} newMode - Yeni okuma modu.
     * @returns {string} Aktif okuma modu.
     */
    setMode(newMode) {
      if (VALID_MODES.includes(newMode)) {
        this.mode = newMode;
        if (this.mode !== 'webtoon') this.stopAutoScroll();
        this._log('info', 'Okuma modu degistirildi.', { mode: this.mode });
      } else {
        this._log('warn', 'Gecersiz okuma modu reddedildi.', { attempted: newMode });
      }
      return this.mode;
    }

    /**
     * Okuma yonunu degistirir ('ltr' veya 'rtl').
     * @param {string} newDir - Yeni yon.
     * @returns {string} Aktif yon.
     */
    setDirection(newDir) {
      if (VALID_DIRECTIONS.includes(newDir)) {
        this.direction = newDir;
        this._log('info', 'Okuma yonu degistirildi.', { direction: this.direction });
      }
      return this.direction;
    }

    /**
     * Yakinlastirma (zoom) yuzdesini ayarlar (50 - 150).
     * @param {number} zoomPercent - Zoom degeri.
     * @returns {number} Guncel zoom degeri.
     */
    setZoom(zoomPercent) {
      this.zoom = this._clamp(zoomPercent, 50, 150);
      this._log('debug', 'Zoom seviyesi guncellendi.', { zoom: this.zoom });
      return this.zoom;
    }

    /**
     * Webtoon modunda sayfalar arasi boslugu ayarlar.
     * @param {number} gapPx - Piksel cinsinden bosluk.
     * @returns {number} Guncel bosluk.
     */
    setGap(gapPx) {
      this.gap = Math.max(0, Number(gapPx) || 0);
      this._log('debug', 'Sayfa arasi bosluk guncellendi.', { gap: this.gap });
      return this.gap;
    }

    /**
     * Novel modu yazi boyutunu yuzde olarak ayarlar (85 - 160).
     * @param {number} sizePercent - Yazi boyutu yuzdesi.
     * @returns {number} Guncel yazi boyutu yuzdesi.
     */
    setNovelFontSize(sizePercent) {
      this.novelFontSize = this._clamp(sizePercent, 85, 160);
      this._log('debug', 'Novel yazi boyutu guncellendi.', { novelFontSize: this.novelFontSize });
      return this.novelFontSize;
    }

    /**
     * Novel modu yazi tipini degistirir (Google Fonts dongusu).
     * @returns {string} Guncel yazi tipi kimligi.
     */
    toggleNovelFontFamily() {
      if (this.fontLoader && typeof this.fontLoader.cycleFont === 'function') {
        this.novelFontFamily = this.fontLoader.cycleFont();
      } else {
        this.novelFontFamily = this.novelFontFamily === 'serif' ? 'sans' : 'serif';
      }
      this._log('info', 'Novel yazi tipi degistirildi.', { novelFontFamily: this.novelFontFamily });
      return this.novelFontFamily;
    }

    /**
     * Novel modu yazi tipini dogrudan secer.
     * @param {string} fontId - Font kimligi.
     * @returns {string} Secilen font kimligi.
     */
    setNovelFontFamily(fontId) {
      if (this.fontLoader && typeof this.fontLoader.setFont === 'function') {
        const font = this.fontLoader.setFont(fontId);
        this.novelFontFamily = font.id;
      } else {
        this.novelFontFamily = fontId;
      }
      this._log('info', 'Novel yazi tipi secildi.', { novelFontFamily: this.novelFontFamily });
      return this.novelFontFamily;
    }

    /**
     * Novel yazi tipi etiketini dondurur.
     * @returns {string} Font adi.
     */
    getNovelFontLabel() {
      if (this.fontLoader && typeof this.fontLoader.getActiveFont === 'function') {
        return this.fontLoader.getActiveFont().name;
      }
      return this.novelFontFamily === 'serif' ? 'Serif' : 'Sans';
    }

    /**
     * Mevcut mod ve yone gore ekranda gosterilecek sayfa indekslerini dondurur.
     * @returns {Array<number>} Sayfa indeks dizisi.
     */
    getVisiblePageIndices() {
      const total = this.pages.length;
      if (total === 0) return [];
      if (this.mode === 'webtoon') return this.pages.map((_, idx) => idx);
      if (this.mode === 'single') return [this.currentIndex];
      const pair = [this.currentIndex];
      if (this.currentIndex + 1 < total) pair.push(this.currentIndex + 1);
      if (this.direction === 'rtl' && pair.length === 2) return [pair[1], pair[0]];
      return pair;
    }

    /**
     * Sonraki sayfaya gecer (Single ve Double modlarinda).
     * @returns {boolean} Sayfa degistiyse true.
     */
    nextPage() {
      if (this.mode === 'webtoon' || this.mode === 'novel' || this.pages.length === 0) return false;
      const step = this.mode === 'double' ? 2 : 1;
      if (this.currentIndex + step < this.pages.length) {
        this.currentIndex += step;
        this.saveProgress();
        this.preloadAdjacentPages();
        this._log('debug', 'Sonraki sayfaya gecildi.', { currentIndex: this.currentIndex });
        return true;
      }
      return false;
    }

    /**
     * Onceki sayfaya doner (Single ve Double modlarinda).
     * @returns {boolean} Sayfa degistiyse true.
     */
    prevPage() {
      if (this.mode === 'webtoon' || this.mode === 'novel' || this.pages.length === 0) return false;
      const step = this.mode === 'double' ? 2 : 1;
      if (this.currentIndex > 0) {
        this.currentIndex = Math.max(0, this.currentIndex - step);
        this.saveProgress();
        this.preloadAdjacentPages();
        this._log('debug', 'Onceki sayfaya donuldu.', { currentIndex: this.currentIndex });
        return true;
      }
      return false;
    }

    /**
     * Belirtilen sayfa indeksine dogrudan gider.
     * @param {number} pageIndex - Hedef sayfa indeksi.
     * @returns {number} Gidilen sayfa indeksi.
     */
    goToPage(pageIndex) {
      if (this.pages.length === 0) {
        this.currentIndex = 0;
        return 0;
      }
      this.currentIndex = this._clamp(pageIndex, 0, this.pages.length - 1);
      this.saveProgress();
      this.preloadAdjacentPages();
      return this.currentIndex;
    }

    /**
     * Okuma ilerleme yuzdesini hesaplar.
     * @returns {number} 0-100 arasi yuzde.
     */
    getProgressPercent() {
      if (this.mode === 'novel') {
        return 100;
      }
      const total = this.pages.length;
      if (total <= 1) {
        return total === 1 ? 100 : 0;
      }
      const lastVisible =
        this.mode === 'double' ? Math.min(total - 1, this.currentIndex + 1) : this.currentIndex;
      return Math.round(((lastVisible + 1) / total) * 100);
    }

    /**
     * Sonraki mantiksal sayfalarin tum gorsel dilimlerini onceden bellekleme (preload) yapar.
     * @returns {Array<string>} On yuklenen URL listesi.
     */
    preloadAdjacentPages() {
      const preloaded = [];
      const ahead = 3;
      for (let i = 1; i <= ahead; i++) {
        const targetIdx = this.currentIndex + i;
        if (targetIdx < this.pages.length) {
          const slices = this.getPageSlices(targetIdx);
          if (Array.isArray(slices) && slices.length > 1 && this.sliceMerger && typeof this.sliceMerger.preload === 'function') {
            try {
              const p = this.sliceMerger.preload(slices);
              if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch (_err) {}
          }
          slices.forEach((url) => {
            preloaded.push(url);
            if (typeof Image !== 'undefined') {
              const img = new Image();
              img.src = url;
            }
          });
        }
      }
      return preloaded;
    }

    /**
     * Otomatik kaydirma hizini ayarlar (1 - 5).
     * @param {number} speed - Kaydirma hiz carpani.
     * @returns {number} Guncel hiz carpani.
     */
    setAutoScrollSpeed(speed) {
      this.autoScrollSpeed = this._clamp(speed, 1, 5);
      this._log('debug', 'Otomatik kaydirma hizi guncellendi.', {
        autoScrollSpeed: this.autoScrollSpeed
      });
      return this.autoScrollSpeed;
    }

    /**
     * Otomatik kaydirma duraklama suresini (ms) ayarlar (0 - 5000).
     * @param {number} pauseMs - Duraklama suresi (milisaniye).
     * @returns {number} Guncel duraklama suresi (ms).
     */
    setAutoScrollPause(pauseMs) {
      this.autoScrollPause = this._clamp(Number(pauseMs) || 0, 0, 5000);
      this._autoScrollPausedUntil = 0;
      this._autoScrollMovedPx = 0;
      this._log('debug', 'Otomatik kaydirma duraklama suresi guncellendi.', {
        autoScrollPause: this.autoScrollPause
      });
      return this.autoScrollPause;
    }

    /**
     * Otomatik dikey kaydirmayi baslatir.
     * @param {Function|null} [scrollCallback=null] - Ozel kaydirma islevi.
     * @returns {boolean} Aktif durumu.
     */
    startAutoScroll(scrollCallback = null) {
      this.stopAutoScroll();
      this.autoScrollActive = true;
      this._autoScrollPausedUntil = 0;
      this._autoScrollMovedPx = 0;
      this._log('info', 'Otomatik kaydirma baslatildi.', {
        speed: this.autoScrollSpeed,
        pauseMs: this.autoScrollPause
      });
      this._autoScrollTimer = setInterval(() => {
        if (this.autoScrollPause > 0 && Date.now() < this._autoScrollPausedUntil) {
          return;
        }
        const pixels = this.autoScrollSpeed * 2;
        if (typeof scrollCallback === 'function') {
          scrollCallback(pixels);
        } else if (typeof window !== 'undefined' && typeof window.scrollBy === 'function') {
          window.scrollBy({ top: pixels, behavior: 'auto' });
        }
        if (this.autoScrollPause > 0) {
          this._autoScrollMovedPx += pixels;
          if (this._autoScrollMovedPx >= 480) {
            this._autoScrollMovedPx = 0;
            this._autoScrollPausedUntil = Date.now() + this.autoScrollPause;
          }
        }
      }, 30);
      return this.autoScrollActive;
    }

    /**
     * Otomatik kaydirmayi durdurur.
     * @returns {boolean} Aktif durumu (false).
     */
    stopAutoScroll() {
      if (this._autoScrollTimer) {
        clearInterval(this._autoScrollTimer);
        this._autoScrollTimer = null;
      }
      this._autoScrollPausedUntil = 0;
      this._autoScrollMovedPx = 0;
      this.autoScrollActive = false;
      return false;
    }

    /**
     * Otomatik kaydirmayi acar veya kapatir.
     * @param {Function|null} [scrollCallback=null] - Ozel kaydirma islevi.
     * @returns {boolean} Yeni durum.
     */
    toggleAutoScroll(scrollCallback = null) {
      if (this.autoScrollActive) {
        return this.stopAutoScroll();
      }
      return this.startAutoScroll(scrollCallback);
    }

    /**
     * Klavye kisayol komutunu isler (RTL yonunde sag/sol tuslarini ters cevirir).
     * @param {string} key - Klavye tus kodu (orn: 'ArrowRight', 'KeyM', 'KeyF').
     * @returns {string} Yapilan islem ('next', 'prev', 'mode:*', 'fullscreen', 'none').
     */
    handleKeyCommand(key) {
      if (key === 'ArrowRight' || key === 'KeyD') {
        if (this.direction === 'rtl') {
          this.prevPage();
          return 'prev';
        }
        this.nextPage();
        return 'next';
      }
      if (key === 'ArrowLeft' || key === 'KeyA') {
        if (this.direction === 'rtl') {
          this.nextPage();
          return 'next';
        }
        this.prevPage();
        return 'prev';
      }
      if (key === 'KeyM') {
        const imageModes = ['webtoon', 'single', 'double'];
        const currentIdx = Math.max(0, imageModes.indexOf(this.mode));
        const nextIdx = (currentIdx + 1) % imageModes.length;
        this.setMode(imageModes[nextIdx]);
        return 'mode:' + this.mode;
      }
      if (key === 'KeyF') {
        return 'fullscreen';
      }
      return 'none';
    }

    /**
     * Okuma ilerlemesini localStorage uzerine kaydeder.
     * @returns {void}
     */
    saveProgress() {
      if (!this.seriesId || !this.chapterId || !this.storage) {
        return;
      }
      try {
        const history = this.getAllHistory();
        history[this.seriesId] = {
          seriesId: this.seriesId,
          chapterId: this.chapterId,
          pageIndex: this.currentIndex,
          updatedAt: new Date().toISOString()
        };
        this.storage.setItem(this.historyKey, JSON.stringify(history));
      } catch (_err) {
        // Depolama hatasini yoksay
      }
    }

    /**
     * Belirtilen seri icin kaydedilmis okuma ilerlemesini getirir.
     * @param {string} seriesId - Seri kimligi.
     * @returns {Object|null} Kayitli ilerleme.
     */
    getProgress(seriesId) {
      const history = this.getAllHistory();
      return history[seriesId] || null;
    }

    /**
     * Tum okuma gecmisini dondurur.
     * @returns {Object} Seri bazli gecmis nesnesi.
     */
    getAllHistory() {
      if (!this.storage) return {};
      try {
        const raw = this.storage.getItem(this.historyKey);
        return raw ? JSON.parse(raw) : {};
      } catch (_err) {
        return {};
      }
    }

    /**
     * Seri turune ve aktif moda gore gosterilecek kontrol gruplarini hesaplar.
     * @returns {{ showMangaControls: boolean, showImageControls: boolean, showAutoScroll: boolean, showNovelControls: boolean, showPageFooterNav: boolean }}
     */
    getVisibleControlGroups() {
      const isNovelMode = this.mode === 'novel' || this.seriesType === 'novel';
      const isMangaType = this.seriesType === 'manga' && !isNovelMode;
      const isPagedMode = !isNovelMode && (this.mode === 'single' || this.mode === 'double');
      return {
        showMangaControls: isMangaType,
        showImageControls: !isNovelMode,
        showAutoScroll: !isNovelMode && this.mode === 'webtoon',
        showNovelControls: isNovelMode,
        showPageFooterNav: isPagedMode
      };
    }

    /**
     * Okuyucu arka plan temasini degistirir ('dark', 'amoled', 'sepia', 'light').
     * @param {string} theme - Arka plan temasi.
     * @returns {string} Aktif arka plan temasi.
     */
    setBackgroundTheme(theme) {
      if (VALID_BG_THEMES.includes(theme)) {
        this.backgroundTheme = theme;
        this._log('info', 'Okuyucu arka plan temasi degistirildi.', {
          backgroundTheme: this.backgroundTheme
        });
      }
      return this.backgroundTheme;
    }

    /**
     * Mihon ust ve alt HUD cubuklarinin gorunurlugunu acar veya kapatir.
     * @param {boolean} [force] - Zorunlu gorunurluk durumu.
     * @returns {boolean} Guncel HUD gorunurlugu.
     */
    toggleHud(force) {
      this.hudVisible = typeof force === 'boolean' ? force : !this.hudVisible;
      return this.hudVisible;
    }

    /**
     * Mihon 3 bolgeli tiklama mantigi: Tek/Cift sayfada sol/sag kenar sayfa degistirir,
     * orta bolge (0.35 - 0.65) ve Webtoon modu HUD cubuklarini gizler/gosterir.
     * @param {number} clickRatioX - 0 ile 1 arasinda yatay tiklama orani.
     * @returns {'next'|'prev'|'toggle-hud'|'none'} Yapilan islem.
     */
    handleViewportClick(clickRatioX) {
      if (this.mode === 'novel') return 'none';
      const ratio = Number(clickRatioX);
      if (Number.isNaN(ratio)) return 'none';
      if (this.mode === 'webtoon') {
        this.toggleHud();
        return 'toggle-hud';
      }
      if (ratio < 0.35) {
        const moved = this.direction === 'rtl' ? this.nextPage() : this.prevPage();
        return moved ? (this.direction === 'rtl' ? 'next' : 'prev') : 'none';
      }
      if (ratio > 0.65) {
        const moved = this.direction === 'rtl' ? this.prevPage() : this.nextPage();
        return moved ? (this.direction === 'rtl' ? 'prev' : 'next') : 'none';
      }
      this.toggleHud();
      return 'toggle-hud';
    }

    /**
     * Mobil dokunmatik ekranlarda yatay kaydirma (swipe) hareketiyle sayfa degistirir.
     * @param {number} startX - Dokunma baslangic X koordinati.
     * @param {number} endX - Dokunma bitis X koordinati.
     * @param {number} [startY=0] - Dokunma baslangic Y koordinati.
     * @param {number} [endY=0] - Dokunma bitis Y koordinati.
     * @returns {'next'|'prev'|'none'} Yapilan sayfa gecisi.
     */
    handleTouchSwipe(startX, endX, startY = 0, endY = 0) {
      if (this.mode !== 'single' && this.mode !== 'double') {
        return 'none';
      }
      const deltaX = Number(endX) - Number(startX);
      const deltaY = Number(endY) - Number(startY);
      if (Number.isNaN(deltaX) || Math.abs(deltaX) < 45) {
        return 'none';
      }
      if (!Number.isNaN(deltaY) && Math.abs(deltaY) > Math.abs(deltaX) * 0.85) {
        return 'none';
      }
      if (deltaX < 0) {
        const moved = this.direction === 'rtl' ? this.prevPage() : this.nextPage();
        return moved ? (this.direction === 'rtl' ? 'prev' : 'next') : 'none';
      }
      const moved = this.direction === 'rtl' ? this.nextPage() : this.prevPage();
      return moved ? (this.direction === 'rtl' ? 'next' : 'prev') : 'none';
    }

    /**
     * Motorun anlik durum özetini dondurur.
     * @returns {Object} Motor durum nesnesi.
     */
    getState() {
      const controlGroups = this.getVisibleControlGroups();
      return {
        seriesType: this.seriesType,
        seriesTypeLabel: this.getSeriesTypeLabel(),
        mode: this.mode,
        direction: this.direction,
        zoom: this.zoom,
        gap: this.gap,
        backgroundTheme: this.backgroundTheme,
        hudVisible: this.hudVisible,
        novelFontSize: this.novelFontSize,
        novelFontFamily: this.novelFontFamily,
        novelFontLabel: this.getNovelFontLabel(),
        protectImages: this.protectImages,
        currentIndex: this.currentIndex,
        totalPages: this.pages.length,
        hasNovelContent: Boolean(this.htmlContent),
        visibleIndices: this.getVisiblePageIndices(),
        progressPercent: this.getProgressPercent(),
        autoScrollActive: this.autoScrollActive,
        autoScrollSpeed: this.autoScrollSpeed,
        autoScrollPause: this.autoScrollPause,
        ...controlGroups
      };
    }

    /**
     * Okuyucu kontrol cubugunu motor durumuyla ve seri turuyle esitler.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {void}
     */
    syncControlsIntoDom(doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || typeof targetDoc.getElementById !== 'function') return;
      const state = this.getState();
      const getEl = (id) => targetDoc.getElementById(id);
      const modeSelect = getEl('select-mode');
      const dirSelect = getEl('select-direction');
      const zoomLabel = getEl('zoom-label');
      const fontSizeLabel = getEl('font-size-label');
      const fontFamilyLabel = getEl('font-family-label');
      const fontSelect = getEl('select-font-family');
      const mangaGroup = getEl('reader-group-manga');
      const imageGroup = getEl('reader-group-image');
      const novelGroup = getEl('reader-group-novel');
      const autoScrollBtn = getEl('btn-autoscroll');
      const footerPageNav = getEl('reader-footer-page-nav');
      const prevPageBtn = getEl('btn-prev-page');
      const nextPageBtn = getEl('btn-next-page');

      if (modeSelect) modeSelect.value = state.mode;
      if (dirSelect) dirSelect.value = state.direction;
      if (zoomLabel) zoomLabel.textContent = `${state.zoom}%`;
      if (fontSizeLabel) fontSizeLabel.textContent = `${state.novelFontSize}%`;
      if (fontFamilyLabel) fontFamilyLabel.textContent = state.novelFontLabel || (state.novelFontFamily === 'serif' ? 'Serif' : 'Sans');
      if (fontSelect) fontSelect.value = state.novelFontFamily || 'sans';
      if (mangaGroup && mangaGroup.classList) mangaGroup.classList.toggle('hidden', !state.showMangaControls);
      if (imageGroup && imageGroup.classList) imageGroup.classList.toggle('hidden', !state.showImageControls || !state.showAutoScroll);
      if (autoScrollBtn && autoScrollBtn.classList) autoScrollBtn.classList.toggle('hidden', !state.showAutoScroll);
      if (novelGroup && novelGroup.classList) novelGroup.classList.toggle('hidden', !state.showNovelControls);
      if (footerPageNav && footerPageNav.classList) footerPageNav.classList.toggle('hidden', !state.showPageFooterNav);
      if (prevPageBtn) prevPageBtn.disabled = state.currentIndex <= 0;
      if (nextPageBtn) {
        const step = state.mode === 'double' ? 2 : 1;
        nextPageBtn.disabled = state.currentIndex + step >= state.totalPages;
      }
      const endCard = getEl('reader-chapter-end-card');
      const disqusSec = getEl('disqus-section');
      if (endCard && endCard.classList) {
        const isPaged = state.mode === 'single' || state.mode === 'double';
        const step = state.mode === 'double' ? 2 : 1;
        const isAtEnd = isPaged && state.totalPages > 0 && state.currentIndex + step >= state.totalPages;
        endCard.classList.toggle('hidden', isPaged && !isAtEnd);
        if (disqusSec && disqusSec.classList && isPaged) {
          disqusSec.classList.toggle('hidden', !isAtEnd);
          disqusSec.classList.toggle('reader-comments-visible', isAtEnd);
        }
      }
    }

    /**
     * DOM icindeki tum stitched canvas elemanlarini birlestirir.
     * @param {HTMLElement} [container] - Kapsayici DOM elemani.
     * @returns {void}
     */
    stitchVisibleCanvases(container) {
      if (!container || !this.sliceMerger || typeof container.querySelectorAll !== 'function') {
        return;
      }
      const canvases = container.querySelectorAll('canvas.reader-stitched-canvas');
      canvases.forEach((canvas) => {
        const pageIdx = Number(canvas.getAttribute('data-page-index'));
        if (!Number.isNaN(pageIdx)) {
          const slices = this.getPageSlices(pageIdx);
          if (Array.isArray(slices) && slices.length > 1) {
            this.sliceMerger.stitchCanvas(canvas, slices);
          }
        }
      });
    }

    /**
     * Okuma motoru goruntuleme alanini (viewport) aktif moda gore cizer.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {void}
     */
    renderViewportIntoDom(doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || typeof targetDoc.getElementById !== 'function') return;
      const viewport = targetDoc.getElementById('reader-viewport');
      const progressBar = targetDoc.getElementById('reader-progress-bar');
      const pageCounter = targetDoc.getElementById('page-counter');
      const seekbarSlider = targetDoc.getElementById('reader-page-slider');
      const seekbarCurr = targetDoc.getElementById('seekbar-current-page');
      const seekbarTotal = targetDoc.getElementById('seekbar-total-pages');
      const miniPagePill = targetDoc.getElementById('reader-mini-page-pill');
      if (!viewport) return;
      if (!viewport._manowaTouchBound && typeof viewport.addEventListener === 'function') {
        viewport._manowaTouchBound = true;
        viewport.addEventListener(
          'touchstart',
          (ev) => {
            if (ev.touches && ev.touches[0]) {
              this._touchStartX = ev.touches[0].clientX;
              this._touchStartY = ev.touches[0].clientY;
            }
          },
          { passive: true }
        );
        viewport.addEventListener(
          'touchend',
          (ev) => {
            if (this._touchStartX !== null && ev.changedTouches && ev.changedTouches[0]) {
              const res = this.handleTouchSwipe(
                this._touchStartX,
                ev.changedTouches[0].clientX,
                this._touchStartY || 0,
                ev.changedTouches[0].clientY || 0
              );
              this._touchStartX = null;
              this._touchStartY = null;
              if (res !== 'none') {
                this.syncControlsIntoDom(targetDoc);
                this.renderViewportIntoDom(targetDoc);
              }
            }
          },
          { passive: true }
        );
      }
      const state = this.getState();
      viewport.className = `reader-viewport mode-${state.mode} ${state.protectImages ? 'protect-images' : ''}`;
      if (targetDoc && targetDoc.body) targetDoc.body.setAttribute('data-reader-mode', state.mode);
      const wrapper = targetDoc && typeof targetDoc.getElementById === 'function' ? targetDoc.getElementById('reader-wrapper') : null;
      if (wrapper) wrapper.setAttribute('data-reader-mode', state.mode);
      if (viewport.style && typeof viewport.style.setProperty === 'function') {
        viewport.style.setProperty('--reader-zoom', `${Math.round((state.zoom / 100) * 800)}px`);
        viewport.style.setProperty('--page-gap', `${state.gap}px`);
      }
      if (state.mode === 'novel' || (state.totalPages === 0 && this.htmlContent)) {
        const fontDef = this.fontLoader ? this.fontLoader.getFont(state.novelFontFamily) : null;
        const fontClass = state.novelFontFamily === 'serif' ? 'font-serif' : '';
        const fontStyle = fontDef && fontDef.family !== 'inherit' ? `font-family: ${fontDef.family};` : '';
        const fontSizePct = state.novelFontSize || 105;
        viewport.innerHTML = `<article class="novel-content-box ${fontClass}" style="font-size: ${fontSizePct}%; ${fontStyle}">${this.htmlContent}</article>`;
        if (this.fontLoader && targetDoc) {
          this.fontLoader.ensureGoogleFontLoaded(state.novelFontFamily, targetDoc);
        }
      } else if (state.mode === 'double' || state.mode === 'single') {
        const renderBlock = (idx) => {
          const slices = this.getPageSlices(idx);
          if (slices.length > 1) {
            const fallback = slices
              .map(
                (src, sIdx) =>
                  `<img class="reader-page-item reader-slice-fallback" src="${src}" alt="Sayfa ${idx + 1} Parça ${sIdx + 1}" />`
              )
              .join('');
            return `<div class="reader-logical-page" data-page-index="${idx}"><canvas class="reader-page-item reader-stitched-canvas" data-page-index="${idx}" aria-label="Sayfa ${idx + 1} (${slices.length} Parça)">${fallback}</canvas></div>`;
          }
          return `<div class="reader-logical-page" data-page-index="${idx}"><img class="reader-page-item" src="${slices[0] || ''}" alt="Sayfa ${idx + 1}" /></div>`;
        };
        const pageBlocks = state.visibleIndices.map(renderBlock).join('');
        viewport.innerHTML =
          state.mode === 'double' ? `<div class="double-page-grid">${pageBlocks}</div>` : pageBlocks;
        this.stitchVisibleCanvases(viewport);
      } else {
        viewport.innerHTML = state.visibleIndices
          .map((idx) => {
            const slices = this.getPageSlices(idx);
            const sliceImgs = slices
              .map(
                (src, sIdx) =>
                  `<img class="reader-page-item" data-page-index="${idx}" data-slice-index="${sIdx}" src="${src}" alt="Sayfa ${idx + 1}" loading="lazy" />`
              )
              .join('');
            return `<div class="reader-logical-page" data-page-index="${idx}">${sliceImgs}</div>`;
          })
          .join('');
      }
      if (progressBar && progressBar.style) progressBar.style.width = `${state.progressPercent}%`;
      const total = Math.max(1, state.totalPages);
      const currPage = Math.min(total, state.currentIndex + 1);
      if (seekbarCurr) seekbarCurr.textContent = String(currPage);
      if (seekbarTotal) seekbarTotal.textContent = String(total);
      if (seekbarSlider) {
        seekbarSlider.min = '1';
        seekbarSlider.max = String(total);
        seekbarSlider.value = String(currPage);
        if (typeof seekbarSlider.setAttribute === 'function') seekbarSlider.setAttribute('dir', 'ltr');
        const fill = total > 1 ? Math.round(((currPage - 1) / (total - 1)) * 100) : 0;
        if (seekbarSlider.style && typeof seekbarSlider.style.setProperty === 'function') {
          seekbarSlider.style.setProperty('--slider-fill', `${fill}%`);
        }
      }
      if (miniPagePill) miniPagePill.textContent = `${currPage} / ${total}`;
      if (pageCounter) {
        if (state.mode === 'novel') {
          pageCounter.textContent = `Novel Metin (${state.novelFontSize || 105}%)`;
        } else if (state.mode === 'webtoon') {
          pageCounter.textContent = `${state.totalPages} Sayfa`;
        } else {
          pageCounter.textContent = `Sayfa ${state.currentIndex + 1} / ${state.totalPages}`;
        }
      }
    }
  }

  globalScope.ReadingEngine = ReadingEngine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ReadingEngine,
      VALID_MODES,
      VALID_DIRECTIONS,
      VALID_BG_THEMES
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
