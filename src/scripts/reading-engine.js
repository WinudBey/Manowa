/**
 * @fileoverview Cok modlu okuma motoru (Webtoon, Tek Sayfa, Cift Sayfa ve Novel) sinifi.
 * Okuma yonu (LTR/RTL), zoom, sayfa boslugu, otomatik kaydirma ve ilerleme kaydini yonetir.
 */

(function (globalScope) {
  'use strict';

  const VALID_MODES = ['webtoon', 'single', 'double', 'novel'];
  const VALID_DIRECTIONS = ['ltr', 'rtl'];

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
      this.storage =
        options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      this.historyKey = 'manowa_reading_history';
      this.mode = VALID_MODES.includes(options.mode) ? options.mode : 'webtoon';
      this.direction = VALID_DIRECTIONS.includes(options.direction) ? options.direction : 'ltr';
      this.zoom = this._clamp(options.zoom || 100, 50, 150);
      this.gap = typeof options.gap === 'number' ? Math.max(0, options.gap) : 0;
      this.novelFontSize = this._clamp(options.novelFontSize || 105, 85, 160);
      this.novelFontFamily = options.novelFontFamily === 'serif' ? 'serif' : 'sans';
      this.protectImages =
        options.protectImages !== undefined ? Boolean(options.protectImages) : true;
      this.pages = [];
      this.htmlContent = '';
      this.currentIndex = 0;
      this.seriesId = '';
      this.chapterId = '';
      this.autoScrollActive = false;
      this.autoScrollSpeed = 2;
      this._autoScrollTimer = null;

      this._log('debug', 'ReadingEngine baslatildi.', {
        mode: this.mode,
        direction: this.direction,
        zoom: this.zoom
      });
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
     * Yeni bir bolumu okuma motoruna yukler.
     * @param {Object} [chapterData={}] - Bolum verileri.
     * @returns {Object} Guncel motor durumu.
     */
    loadChapter(chapterData = {}) {
      this.stopAutoScroll();
      this.seriesId = chapterData.seriesId || '';
      this.chapterId = chapterData.chapterId || '';
      this.pages = Array.isArray(chapterData.pages) ? chapterData.pages.slice() : [];
      this.htmlContent = String(chapterData.htmlContent || '');

      if (this.pages.length === 0 && this.htmlContent) {
        this.mode = 'novel';
      } else if (chapterData.defaultMode && VALID_MODES.includes(chapterData.defaultMode)) {
        this.mode = chapterData.defaultMode;
      }

      const saved = this.getProgress(this.seriesId);
      if (typeof chapterData.startPage === 'number') {
        this.currentIndex = this._clamp(chapterData.startPage, 0, Math.max(0, this.pages.length - 1));
      } else if (
        saved &&
        saved.chapterId === this.chapterId &&
        typeof saved.pageIndex === 'number'
      ) {
        this.currentIndex = this._clamp(saved.pageIndex, 0, Math.max(0, this.pages.length - 1));
      } else {
        this.currentIndex = 0;
      }

      this.saveProgress();
      this.preloadAdjacentPages();
      this._log('info', 'Bolum okuma motoruna yuklendi.', {
        seriesId: this.seriesId,
        chapterId: this.chapterId,
        pageCount: this.pages.length,
        isNovel: Boolean(this.htmlContent && this.pages.length === 0),
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
     * Novel modu yazi tipini ('sans' ve 'serif') arasinda degistirir.
     * @returns {string} Guncel yazi tipi ('sans' veya 'serif').
     */
    toggleNovelFontFamily() {
      this.novelFontFamily = this.novelFontFamily === 'serif' ? 'sans' : 'serif';
      this._log('info', 'Novel yazi tipi degistirildi.', { novelFontFamily: this.novelFontFamily });
      return this.novelFontFamily;
    }

    /**
     * Mevcut mod ve yone gore ekranda gosterilecek sayfa indekslerini dondurur.
     * @returns {Array<number>} Sayfa indeks dizisi.
     */
    getVisiblePageIndices() {
      const total = this.pages.length;
      if (total === 0) {
        return [];
      }
      if (this.mode === 'webtoon') {
        return this.pages.map((_, idx) => idx);
      }
      if (this.mode === 'single') {
        return [this.currentIndex];
      }
      const pair = [this.currentIndex];
      if (this.currentIndex + 1 < total) {
        pair.push(this.currentIndex + 1);
      }
      if (this.direction === 'rtl' && pair.length === 2) {
        return [pair[1], pair[0]];
      }
      return pair;
    }

    /**
     * Sonraki sayfaya gecer (Single ve Double modlarinda).
     * @returns {boolean} Sayfa degistiyse true.
     */
    nextPage() {
      if (this.mode === 'webtoon' || this.mode === 'novel' || this.pages.length === 0) {
        return false;
      }
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
      if (this.mode === 'webtoon' || this.mode === 'novel' || this.pages.length === 0) {
        return false;
      }
      const step = this.mode === 'double' ? 2 : 1;
      if (this.currentIndex > 0) {
        this.currentIndex = Math.max(0, this.currentIndex - step);
        this.saveProgress();
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
     * Sonraki 2 sayfanin gorsellerini onceden bellekleme (preload) yapar.
     * @returns {Array<string>} On yuklenen URL listesi.
     */
    preloadAdjacentPages() {
      const preloaded = [];
      for (let i = 1; i <= 2; i++) {
        const targetIdx = this.currentIndex + i;
        if (targetIdx < this.pages.length) {
          const url = this.pages[targetIdx];
          preloaded.push(url);
          if (typeof Image !== 'undefined') {
            const img = new Image();
            img.src = url;
          }
        }
      }
      return preloaded;
    }

    /**
     * Otomatik dikey kaydirmayi baslatir.
     * @param {Function|null} [scrollCallback=null] - Ozel kaydirma islevi.
     * @returns {boolean} Aktif durumu.
     */
    startAutoScroll(scrollCallback = null) {
      this.stopAutoScroll();
      this.autoScrollActive = true;
      this._log('info', 'Otomatik kaydirma baslatildi.', { speed: this.autoScrollSpeed });
      this._autoScrollTimer = setInterval(() => {
        const pixels = this.autoScrollSpeed * 2;
        if (typeof scrollCallback === 'function') {
          scrollCallback(pixels);
        } else if (typeof window !== 'undefined' && typeof window.scrollBy === 'function') {
          window.scrollBy({ top: pixels, behavior: 'auto' });
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
      if (!this.storage) {
        return {};
      }
      try {
        const raw = this.storage.getItem(this.historyKey);
        return raw ? JSON.parse(raw) : {};
      } catch (_err) {
        return {};
      }
    }

    /**
     * Motorun anlik durum özetini dondurur.
     * @returns {Object} Motor durum nesnesi.
     */
    getState() {
      return {
        mode: this.mode,
        direction: this.direction,
        zoom: this.zoom,
        gap: this.gap,
        novelFontSize: this.novelFontSize,
        novelFontFamily: this.novelFontFamily,
        protectImages: this.protectImages,
        currentIndex: this.currentIndex,
        totalPages: this.pages.length,
        hasNovelContent: Boolean(this.htmlContent),
        visibleIndices: this.getVisiblePageIndices(),
        progressPercent: this.getProgressPercent(),
        autoScrollActive: this.autoScrollActive
      };
    }

    /**
     * Okuyucu kontrol cubugunu motor durumuyla esitler.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {void}
     */
    syncControlsIntoDom(doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || typeof targetDoc.getElementById !== 'function') return;
      const state = this.getState();
      const modeSelect = targetDoc.getElementById('select-mode');
      const dirSelect = targetDoc.getElementById('select-direction');
      const gapSelect = targetDoc.getElementById('select-gap');
      const zoomLabel = targetDoc.getElementById('zoom-label');
      if (modeSelect) modeSelect.value = state.mode;
      if (dirSelect) dirSelect.value = state.direction;
      if (gapSelect) gapSelect.value = String(state.gap);
      if (zoomLabel) zoomLabel.textContent = `${state.zoom}%`;
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
      if (!viewport) return;
      const state = this.getState();
      viewport.className = `reader-viewport mode-${state.mode} ${state.protectImages ? 'protect-images' : ''}`;
      if (viewport.style && typeof viewport.style.setProperty === 'function') {
        viewport.style.setProperty('--reader-zoom', `${Math.round((state.zoom / 100) * 800)}px`);
        viewport.style.setProperty('--page-gap', `${state.gap}px`);
      }
      if (state.mode === 'novel' || (state.totalPages === 0 && this.htmlContent)) {
        const fontClass = state.novelFontFamily === 'serif' ? 'font-serif' : '';
        const fontSizePct = state.novelFontSize || 105;
        viewport.innerHTML = `<article class="novel-content-box ${fontClass}" style="font-size: ${fontSizePct}%;">${this.htmlContent}</article>`;
      } else if (state.mode === 'double') {
        const imgs = state.visibleIndices
          .map(
            (idx) =>
              `<img class="reader-page-item" src="${this.pages[idx]}" alt="Sayfa ${idx + 1}" />`
          )
          .join('');
        viewport.innerHTML = `<div class="double-page-grid">${imgs}</div>`;
      } else {
        viewport.innerHTML = state.visibleIndices
          .map(
            (idx) =>
              `<img class="reader-page-item" src="${this.pages[idx]}" alt="Sayfa ${idx + 1}" loading="lazy" />`
          )
          .join('');
      }
      if (progressBar && progressBar.style) progressBar.style.width = `${state.progressPercent}%`;
      if (pageCounter) {
        if (state.mode === 'novel') {
          pageCounter.textContent = `Novel Metin (${state.novelFontSize || 105}%)`;
        } else if (state.mode === 'webtoon') {
          pageCounter.textContent = `Webtoon Şerit (${state.totalPages} Sayfa)`;
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
      VALID_DIRECTIONS
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
