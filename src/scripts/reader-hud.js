/**
 * @fileoverview Mihon (Tachiyomi) tarzi okuyucu HUD cubuklarini, etkilesimli sayfa kaydiricisini
 * (seekbar), acilir ayarlar cekmecesini ve Webtoon kaydirma takibini yoneten modul.
 */

(function (globalScope) {
  'use strict';

  const MODE_LABELS = {
    webtoon: 'Dikey Şerit',
    single: 'Tek Sayfa',
    double: 'Çift Sayfa',
    novel: 'Novel'
  };

  const iconFn =
    (globalScope.ManowaIcons && globalScope.ManowaIcons.get) ||
    (typeof require === 'function' ? require('./svg-icons').getSvgIcon : () => '');

  /**
   * Mihon okuyucu ust/alt HUD katmanini, ayar cekmecesini ve seekbar etkilesimini yoneten sinif.
   */
  class ReaderHudController {
    /**
     * ReaderHudController nesnesini yapilandirir.
     * @param {Object} [options={}] - Yapilandirma secenekleri.
     */
    constructor(options = {}) {
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.settingsOpen = false;
      this._log('debug', 'ReaderHudController baslatildi.');
    }

    /**
     * Ic loglama yardimcisi.
     * @param {'debug'|'info'|'warn'|'error'} level - Log seviyesi.
     * @param {string} msg - Mesaj.
     * @param {Object|null} [meta=null] - Ek veri.
     * @returns {void}
     */
    _log(level, msg, meta = null) {
      if (this.logger && typeof this.logger[level] === 'function') {
        this.logger[level](msg, meta);
      }
    }

    /**
     * Mihon okuyucu ayarlar cekmecesini acar veya kapatir.
     * @param {boolean} [force] - Zorunlu acik/kapali durumu.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {boolean} Yeni acik durumu.
     */
    toggleSettingsSheet(force, doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      this.settingsOpen = typeof force === 'boolean' ? force : !this.settingsOpen;
      if (targetDoc && typeof targetDoc.getElementById === 'function') {
        const sheet = targetDoc.getElementById('reader-settings-sheet');
        const topBtn = targetDoc.getElementById('btn-reader-settings');
        if (sheet && sheet.classList) {
          sheet.classList.toggle('hidden', !this.settingsOpen);
        }
        if (topBtn) {
          if (topBtn.classList) topBtn.classList.toggle('active', this.settingsOpen);
          if (typeof topBtn.setAttribute === 'function') {
            topBtn.setAttribute('aria-expanded', String(this.settingsOpen));
          }
        }
      }
      this._log('debug', 'Mihon ayarlar cekmecesi durumu degisti.', {
        settingsOpen: this.settingsOpen
      });
      return this.settingsOpen;
    }

    /**
     * Mihon HUD cubuklarini, seekbar degerlerini, arka plan temasini ve ayar haplarini DOM ile esitler.
     * @param {Object} reader - ReadingEngine ornegi.
     * @param {Object} [chapterMeta=null] - Aktif bolum/seri gezinme meta verisi.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {void}
     */
    syncHudIntoDom(reader, chapterMeta = null, doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || typeof targetDoc.getElementById !== 'function' || !reader) return;

      const state = reader.getState();
      const wrapper = targetDoc.getElementById('reader-wrapper');
      if (wrapper && wrapper.classList) {
        wrapper.classList.toggle('hud-hidden', !state.hudVisible);
        ['dark', 'amoled', 'sepia', 'light'].forEach((bg) => {
          wrapper.classList.toggle(`reader-bg-${bg}`, state.backgroundTheme === bg);
        });
      }

      if (!state.hudVisible && this.settingsOpen) {
        this.toggleSettingsSheet(false, targetDoc);
      }

      const dockModeLabel = targetDoc.getElementById('dock-mode-label');
      const dockDirLabel = targetDoc.getElementById('dock-dir-label');
      const dockModeBtn = targetDoc.getElementById('btn-dock-mode');
      const dockDirBtn = targetDoc.getElementById('btn-dock-direction');
      const seekbarRow = targetDoc.getElementById('reader-seekbar-row');
      const gapGroup = targetDoc.getElementById('mihon-setting-gap-group');
      const scrollSpeedGroup = targetDoc.getElementById('mihon-setting-scroll-speed-group');
      const scrollPauseGroup = targetDoc.getElementById('mihon-setting-scroll-pause-group');
      const modeGroup = targetDoc.getElementById('mihon-setting-mode-group');
      const dirGroup = targetDoc.getElementById('mihon-setting-dir-group');

      const isNovel = state.mode === 'novel' || state.seriesType === 'novel';
      const isManga = state.seriesType === 'manga' && !isNovel;
      if (dockModeLabel) dockModeLabel.textContent = MODE_LABELS[state.mode] || 'Dikey Şerit';
      if (dockDirLabel) dockDirLabel.textContent = state.direction.toUpperCase();
      if (dockModeBtn && dockModeBtn.classList) dockModeBtn.classList.toggle('hidden', !isManga);
      if (dockDirBtn && dockDirBtn.classList) {
        dockDirBtn.classList.toggle('hidden', !isManga || state.mode === 'webtoon');
      }
      if (seekbarRow && seekbarRow.classList) {
        seekbarRow.classList.toggle('hidden', isNovel || state.totalPages <= 1);
      }
      if (gapGroup && gapGroup.classList) {
        gapGroup.classList.toggle('hidden', isNovel || state.mode !== 'webtoon');
      }
      if (scrollSpeedGroup && scrollSpeedGroup.classList) {
        scrollSpeedGroup.classList.toggle('hidden', isNovel || state.mode !== 'webtoon');
      }
      if (scrollPauseGroup && scrollPauseGroup.classList) {
        scrollPauseGroup.classList.toggle('hidden', isNovel || state.mode !== 'webtoon');
      }
      if (modeGroup && modeGroup.classList) {
        modeGroup.classList.toggle('hidden', !isManga);
      }
      if (dirGroup && dirGroup.classList) {
        dirGroup.classList.toggle('hidden', !isManga || state.mode === 'webtoon');
      }

      const autoScrollBtn = targetDoc.getElementById('btn-autoscroll');
      if (autoScrollBtn) {
        if (autoScrollBtn.classList) {
          autoScrollBtn.classList.toggle('hidden', !state.showAutoScroll);
          autoScrollBtn.classList.toggle('active', Boolean(state.autoScrollActive));
        }
        autoScrollBtn.innerHTML = state.autoScrollActive
          ? `${iconFn('pause')} <span class="btn-label">Durdur</span>`
          : `${iconFn('play')} <span class="btn-label">Oto-Kaydır</span>`;
      }

      const syncPillGroup = (containerId, attrName, activeValue) => {
        const container = targetDoc.getElementById(containerId);
        if (!container || typeof container.querySelectorAll !== 'function') return;
        container.querySelectorAll(`[${attrName}]`).forEach((btn) => {
          const val = btn.getAttribute(attrName);
          btn.classList.toggle('active', String(val) === String(activeValue));
        });
      };

      syncPillGroup('mihon-mode-pills', 'data-mode-pill', state.mode);
      syncPillGroup('mihon-dir-pills', 'data-dir-pill', state.direction);
      syncPillGroup('mihon-bg-pills', 'data-bg-pill', state.backgroundTheme);
      syncPillGroup('mihon-gap-pills', 'data-gap-pill', state.gap);
      syncPillGroup('mihon-scroll-speed-pills', 'data-scroll-speed-pill', state.autoScrollSpeed);
      syncPillGroup('mihon-scroll-pause-pills', 'data-scroll-pause-pill', state.autoScrollPause);

      if (chapterMeta) {
        const endLabel = targetDoc.getElementById('reader-end-chapter-label');
        const endPrevBtn = targetDoc.getElementById('btn-end-prev-chapter');
        const endNextBtn = targetDoc.getElementById('btn-end-next-chapter');
        const endSeriesBtn = targetDoc.getElementById('btn-end-series');
        const dockPrevBtn = targetDoc.getElementById('btn-prev-chapter');
        const dockNextBtn = targetDoc.getElementById('btn-next-chapter');

        if (endLabel && chapterMeta.chapterLabel) {
          endLabel.textContent = `${chapterMeta.chapterLabel} Tamamlandı`;
        }
        if (endPrevBtn) endPrevBtn.disabled = !chapterMeta.hasPrevChapter;
        if (endNextBtn) endNextBtn.disabled = !chapterMeta.hasNextChapter;
        if (dockPrevBtn) dockPrevBtn.disabled = !chapterMeta.hasPrevChapter;
        if (dockNextBtn) dockNextBtn.disabled = !chapterMeta.hasNextChapter;
        if (endSeriesBtn && chapterMeta.seriesHref && chapterMeta.seriesId) {
          endSeriesBtn.setAttribute('href', chapterMeta.seriesHref);
          endSeriesBtn.setAttribute('data-action', 'detail');
          endSeriesBtn.setAttribute('data-series', chapterMeta.seriesId);
        }
      }
    }

    /**
     * Mihon sayfa kaydiricisi (seekbar) degeri degistiginde hedef sayfaya gecis yapar.
     * @param {Object} reader - ReadingEngine ornegi.
     * @param {number|string} pageNumber - 1 tabanli hedef sayfa numarasi.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {number} Gidilen 0 tabanli sayfa indeksi.
     */
    handleSeekbarChange(reader, pageNumber, doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!reader) return 0;
      const targetIdx = Math.max(0, (Number(pageNumber) || 1) - 1);
      const idx = reader.goToPage(targetIdx);

      if (reader.mode === 'webtoon') {
        if (targetDoc && typeof targetDoc.getElementById === 'function') {
          const viewport = targetDoc.getElementById('reader-viewport');
          const currEl = targetDoc.getElementById('seekbar-current-page');
          const miniEl = targetDoc.getElementById('reader-mini-page-pill');
          const progEl = targetDoc.getElementById('reader-progress-bar');
          const total = Math.max(1, reader.pages.length);
          if (currEl) currEl.textContent = String(idx + 1);
          if (miniEl) miniEl.textContent = `${idx + 1} / ${total}`;
          if (progEl && progEl.style) progEl.style.width = `${reader.getProgressPercent()}%`;
          if (viewport && typeof viewport.querySelector === 'function') {
            const imgEl = viewport.querySelector(`[data-page-index="${idx}"]`);
            if (imgEl && typeof imgEl.scrollIntoView === 'function') {
              imgEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }
      } else {
        reader.syncControlsIntoDom(targetDoc);
        reader.renderViewportIntoDom(targetDoc);
      }

      this.syncHudIntoDom(reader, null, targetDoc);
      return idx;
    }

    /**
     * Webtoon (Dikey Serit) modunda kullanici sayfayi kaydirdikca aktif sayfa indeksini algilar
     * ve seekbar ile ilerleme cubugunu gunceller.
     * @param {Object} reader - ReadingEngine ornegi.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {number} Algilanan aktif sayfa indeksi.
     */
    updateWebtoonScrollPage(reader, doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!reader || reader.mode !== 'webtoon' || !targetDoc) {
        return reader ? reader.currentIndex : 0;
      }
      const viewport = targetDoc.getElementById('reader-viewport');
      if (!viewport || typeof viewport.querySelectorAll !== 'function') {
        return reader.currentIndex;
      }
      const items = viewport.querySelectorAll('[data-page-index]');
      if (!items || items.length === 0) return reader.currentIndex;

      const winHeight =
        (typeof globalScope.innerHeight === 'number' && globalScope.innerHeight) || 720;
      const thresholdY = winHeight * 0.42;
      let detectedIdx = reader.currentIndex;

      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        if (typeof el.getBoundingClientRect !== 'function') continue;
        const rect = el.getBoundingClientRect();
        const pageIdx = Number(el.getAttribute('data-page-index'));
        if (!Number.isNaN(pageIdx) && rect.top <= thresholdY && rect.bottom >= 60) {
          detectedIdx = pageIdx;
        }
      }

      if (detectedIdx !== reader.currentIndex) {
        reader.currentIndex = detectedIdx;
        reader.saveProgress();
        const total = Math.max(1, reader.pages.length);
        const currPage = Math.min(total, detectedIdx + 1);
        const seekbarSlider = targetDoc.getElementById('reader-page-slider');
        const seekbarCurr = targetDoc.getElementById('seekbar-current-page');
        const miniPill = targetDoc.getElementById('reader-mini-page-pill');
        const progressBar = targetDoc.getElementById('reader-progress-bar');
        if (seekbarCurr) seekbarCurr.textContent = String(currPage);
        if (seekbarSlider) seekbarSlider.value = String(currPage);
        if (miniPill) miniPill.textContent = `${currPage} / ${total}`;
        if (progressBar && progressBar.style) {
          progressBar.style.width = `${reader.getProgressPercent()}%`;
        }
      }

      return reader.currentIndex;
    }

    /**
     * Okuyucu gorunumune ait tum DOM olay dinleyicilerini baglar.
     * @param {Object} app - AppController ornegi.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {void}
     */
    bindDomEvents(app, doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || !app || !app.reader) return;

      const on = (id, event, fn) => {
        const el = targetDoc.getElementById(id);
        if (el && typeof el.addEventListener === 'function') {
          el.addEventListener(event, fn);
        }
      };

      const refreshAll = () => {
        app.syncReaderControls();
        app.renderReaderViewport();
        this.syncHudIntoDom(app.reader, null, targetDoc);
      };

      on('select-chapter', 'change', (e) => app.openReader(app.activeSeriesId, e.target.value));
      on('select-mode', 'change', (e) => {
        app.reader.setMode(e.target.value);
        refreshAll();
      });
      on('select-direction', 'change', (e) => {
        app.reader.setDirection(e.target.value);
        refreshAll();
      });
      on('btn-zoom-in', 'click', () => {
        app.reader.setZoom(app.reader.zoom + 15);
        refreshAll();
      });
      on('btn-zoom-out', 'click', () => {
        app.reader.setZoom(app.reader.zoom - 15);
        refreshAll();
      });
      on('btn-font-increase', 'click', () => {
        app.reader.setNovelFontSize((app.reader.novelFontSize || 105) + 10);
        refreshAll();
      });
      on('btn-font-decrease', 'click', () => {
        app.reader.setNovelFontSize((app.reader.novelFontSize || 105) - 10);
        refreshAll();
      });
      on('btn-font-family', 'click', () => {
        app.reader.toggleNovelFontFamily();
        refreshAll();
      });
      on('btn-autoscroll', 'click', (e) => {
        const active = app.reader.toggleAutoScroll();
        e.currentTarget.classList.toggle('active', active);
        e.currentTarget.innerHTML = active
          ? `${iconFn('pause')} <span class="btn-label">Durdur</span>`
          : `${iconFn('play')} <span class="btn-label">Oto-Kaydır</span>`;
      });
      on('btn-next-page', 'click', () => {
        if (app.reader.nextPage()) refreshAll();
      });
      on('btn-prev-page', 'click', () => {
        if (app.reader.prevPage()) refreshAll();
      });
      on('reader-viewport', 'click', (e) => {
        if (!e.currentTarget || typeof e.currentTarget.getBoundingClientRect !== 'function') return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        const ratio = (e.clientX - rect.left) / rect.width;
        const action = app.reader.handleViewportClick(ratio);
        if (action === 'toggle-hud') {
          this.syncHudIntoDom(app.reader, null, targetDoc);
        } else if (action !== 'none') {
          refreshAll();
        }
      });
      on('btn-next-chapter', 'click', () => app.navigateChapter(1));
      on('btn-prev-chapter', 'click', () => app.navigateChapter(-1));
      on('btn-top-next-chapter', 'click', () => app.navigateChapter(1));
      on('btn-top-prev-chapter', 'click', () => app.navigateChapter(-1));
      on('btn-end-next-chapter', 'click', () => app.navigateChapter(1));
      on('btn-end-prev-chapter', 'click', () => app.navigateChapter(-1));

      on('btn-reader-settings', 'click', () => this.toggleSettingsSheet(undefined, targetDoc));
      on('btn-close-reader-settings', 'click', () => this.toggleSettingsSheet(false, targetDoc));

      on('btn-dock-mode', 'click', () => {
        const modes = ['webtoon', 'single', 'double'];
        const nextIdx = (Math.max(0, modes.indexOf(app.reader.mode)) + 1) % modes.length;
        app.reader.setMode(modes[nextIdx]);
        refreshAll();
      });
      on('btn-dock-direction', 'click', () => {
        app.reader.setDirection(app.reader.direction === 'rtl' ? 'ltr' : 'rtl');
        refreshAll();
      });
      on('btn-dock-comments', 'click', () => {
        const disqusEl = targetDoc.getElementById('disqus-section');
        if (disqusEl && typeof disqusEl.scrollIntoView === 'function') {
          disqusEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      on('reader-page-slider', 'input', (e) => {
        this.handleSeekbarChange(app.reader, e.target.value, targetDoc);
      });

      const sheet = targetDoc.getElementById('reader-settings-sheet');
      if (sheet && typeof sheet.addEventListener === 'function') {
        sheet.addEventListener('click', (e) => {
          const pill = e.target.closest('button.mihon-choice-pill');
          if (!pill) return;
          if (pill.hasAttribute('data-mode-pill')) {
            app.reader.setMode(pill.getAttribute('data-mode-pill'));
          } else if (pill.hasAttribute('data-dir-pill')) {
            app.reader.setDirection(pill.getAttribute('data-dir-pill'));
          } else if (pill.hasAttribute('data-bg-pill')) {
            app.reader.setBackgroundTheme(pill.getAttribute('data-bg-pill'));
          } else if (pill.hasAttribute('data-gap-pill')) {
            app.reader.setGap(Number(pill.getAttribute('data-gap-pill')));
          } else if (pill.hasAttribute('data-scroll-speed-pill')) {
            app.reader.setAutoScrollSpeed(Number(pill.getAttribute('data-scroll-speed-pill')));
          } else if (pill.hasAttribute('data-scroll-pause-pill')) {
            app.reader.setAutoScrollPause(Number(pill.getAttribute('data-scroll-pause-pill')));
          }
          refreshAll();
        });
      }

      if (typeof globalScope.addEventListener === 'function') {
        globalScope.addEventListener(
          'scroll',
          () => {
            if (app.currentView === 'reader') {
              this.updateWebtoonScrollPage(app.reader, targetDoc);
            }
          },
          { passive: true }
        );
      }
    }
  }

  globalScope.ReaderHudController = ReaderHudController;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ReaderHudController,
      MODE_LABELS
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
