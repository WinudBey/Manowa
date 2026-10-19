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
      this._lastChapterMeta = null;
      this._hasScrolledToEnd = false;
      this._scrollTimeout = null;
      this._suppressScrollUntil = 0;
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
        const chapterMenu = targetDoc.getElementById('reader-chapter-menu');
        const chapterBtn = targetDoc.getElementById('btn-chapter-dropdown');
        if (chapterMenu && chapterMenu.classList) chapterMenu.classList.add('hidden');
        if (chapterBtn && typeof chapterBtn.setAttribute === 'function') chapterBtn.setAttribute('aria-expanded', 'false');
        if (!this.settingsOpen) {
          const fontMenu = targetDoc.getElementById('reader-font-menu');
          const fontBtn = targetDoc.getElementById('btn-font-family');
          if (fontMenu && fontMenu.classList) {
            fontMenu.classList.add('hidden');
          }
          if (fontBtn && typeof fontBtn.setAttribute === 'function') {
            fontBtn.setAttribute('aria-expanded', 'false');
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
      const isNovel = state.mode === 'novel' || state.seriesType === 'novel';
      const isManga = state.seriesType === 'manga' && !isNovel;

      if (wrapper && wrapper.classList) {
        wrapper.classList.toggle('hud-hidden', !state.hudVisible);
        wrapper.classList.toggle('mode-novel', isNovel);
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

      const fontMenu = targetDoc.getElementById('reader-font-menu');
      if (fontMenu && typeof fontMenu.querySelectorAll === 'function') {
        const options = fontMenu.querySelectorAll('.reader-font-option');
        options.forEach((opt) => {
          const isSelected = opt.getAttribute('data-font-id') === state.novelFontFamily;
          opt.classList.toggle('active', isSelected);
          opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
      }

      if (chapterMeta) {
        this._lastChapterMeta = chapterMeta;
        this._hasScrolledToEnd = false;
        this._suppressScrollUntil = Date.now() + 400;
      }
      const meta = chapterMeta || this._lastChapterMeta;
      if (meta) {
        const endLabel = targetDoc.getElementById('reader-end-chapter-label');
        const endPrevBtn = targetDoc.getElementById('btn-end-prev-chapter');
        const endNextBtn = targetDoc.getElementById('btn-end-next-chapter');
        const endSeriesBtn = targetDoc.getElementById('btn-end-series');

        if (endLabel && meta.chapterLabel) {
          endLabel.textContent = `${meta.chapterLabel} Tamamlandı`;
        }
        if (endPrevBtn) endPrevBtn.disabled = !meta.hasPrevChapter;
        if (endNextBtn) endNextBtn.disabled = !meta.hasNextChapter;
        if (endSeriesBtn && meta.seriesHref && meta.seriesId) {
          endSeriesBtn.setAttribute('href', meta.seriesHref);
          endSeriesBtn.setAttribute('data-action', 'detail');
          endSeriesBtn.setAttribute('data-series', meta.seriesId);
        }
      }

      const endCard = targetDoc.getElementById('reader-chapter-end-card');
      const disqusSec = targetDoc.getElementById('disqus-section');
      if (endCard && endCard.classList) {
        const isPaged = state.mode === 'single' || state.mode === 'double';
        const step = state.mode === 'double' ? 2 : 1;
        const isAtEnd = isPaged && state.totalPages > 0 && state.currentIndex + step >= state.totalPages;
        endCard.classList.toggle('hidden', isPaged && !isAtEnd);

        if (disqusSec && disqusSec.classList) {
          if (isPaged) {
            disqusSec.classList.toggle('hidden', !isAtEnd);
            disqusSec.classList.toggle('reader-comments-visible', isAtEnd);

            if (isAtEnd && !this._hasScrolledToEnd) {
              this._hasScrolledToEnd = true;
              this.scrollToComments(targetDoc);
            } else if (!isAtEnd) {
              this._hasScrolledToEnd = false;
              if (this._scrollTimeout) {
                clearTimeout(this._scrollTimeout);
                this._scrollTimeout = null;
              }
            }
          } else {
            disqusSec.classList.toggle('hidden', false);
          }
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
          const seekbarSlider = targetDoc.getElementById('reader-page-slider');
          const total = Math.max(1, reader.pages.length);
          if (currEl) currEl.textContent = String(idx + 1);
          if (miniEl) miniEl.textContent = `${idx + 1} / ${total}`;
          if (progEl && progEl.style) progEl.style.width = `${reader.getProgressPercent()}%`;
          if (seekbarSlider && seekbarSlider.style && typeof seekbarSlider.style.setProperty === 'function') {
            const fill = total > 1 ? Math.round((idx / (total - 1)) * 100) : 0;
            seekbarSlider.style.setProperty('--slider-fill', `${fill}%`);
          }
          if (viewport && typeof viewport.querySelector === 'function') {
            const imgEl = viewport.querySelector(`[data-page-index="${idx}"]`);
            if (imgEl && typeof imgEl.scrollIntoView === 'function') {
              imgEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
          if (idx >= total - 1) {
            this.checkCommentsEndVisibility(targetDoc);
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
        if (seekbarSlider) {
          seekbarSlider.value = String(currPage);
          const fill = total > 1 ? Math.round(((currPage - 1) / (total - 1)) * 100) : 0;
          if (seekbarSlider.style && typeof seekbarSlider.style.setProperty === 'function') {
            seekbarSlider.style.setProperty('--slider-fill', `${fill}%`);
          }
        }
        if (miniPill) miniPill.textContent = `${currPage} / ${total}`;
        if (progressBar && progressBar.style) {
          progressBar.style.width = `${reader.getProgressPercent()}%`;
        }
      }

      return reader.currentIndex;
    }

    /**
     * Yorum alanina (#disqus-section) akici ve yumusak bir sekilde kaydirir.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {void}
     */
    scrollToComments(doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || typeof targetDoc.getElementById !== 'function') return;
      if (this._suppressScrollUntil && Date.now() < this._suppressScrollUntil) return;
      const disqusSec = targetDoc.getElementById('disqus-section');
      if (!disqusSec) return;

      disqusSec.classList.remove('hidden');
      disqusSec.classList.add('reader-comments-visible');

      if (this._scrollTimeout) {
        clearTimeout(this._scrollTimeout);
      }
      if (typeof setTimeout === 'function') {
        this._scrollTimeout = setTimeout(() => {
          if (typeof disqusSec.scrollIntoView === 'function') {
            disqusSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else if (typeof globalScope.scrollTo === 'function' && typeof disqusSec.offsetTop === 'number') {
            globalScope.scrollTo({
              top: Math.max(0, disqusSec.offsetTop - 80),
              behavior: 'smooth'
            });
          }
        }, 150);
      }
    }

    /**
     * Dikey kaydirma modlarinda (Webtoon, Novel) bolum sonuna yaklasildiginda
     * yorum alanini (.reader-comments-visible) yumusak bir sekilde gosterir ve kaydirir.
     * @param {Document} [doc] - Hedef DOM belgesi.
     * @returns {void}
     */
    checkCommentsEndVisibility(doc) {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      if (!targetDoc || typeof targetDoc.getElementById !== 'function') return;
      const endCard = targetDoc.getElementById('reader-chapter-end-card');
      const disqusSec = targetDoc.getElementById('disqus-section');
      if (endCard.classList && endCard.classList.contains('hidden')) return;
      if (typeof endCard.offsetHeight === 'number' && endCard.offsetHeight === 0) return;

      if (typeof endCard.getBoundingClientRect === 'function') {
        const rect = endCard.getBoundingClientRect();
        if (rect.height === 0) return;
        const winHeight =
          (typeof globalScope.innerHeight === 'number' && globalScope.innerHeight) || 720;
        if (rect.top <= winHeight + 150) {
          disqusSec.classList.add('reader-comments-visible');
          if (!this._hasScrolledToEnd) {
            this._hasScrolledToEnd = true;
            this.scrollToComments(targetDoc);
          }
        } else if (rect.top > winHeight + 350) {
          this._hasScrolledToEnd = false;
        }
      }
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

      const chapterTrigger = targetDoc.getElementById('btn-chapter-dropdown');
      const chapterMenu = targetDoc.getElementById('reader-chapter-menu');
      const chapterFilterInput = targetDoc.getElementById('input-chapter-filter');
      const chapterDropdown = targetDoc.getElementById('reader-chapter-dropdown');

      const toggleChapterMenu = (forceOpen) => {
        if (!chapterMenu || !chapterTrigger) return;
        const isHidden = chapterMenu.classList.contains('hidden');
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;
        chapterMenu.classList.toggle('hidden', !shouldOpen);
        chapterTrigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        if (shouldOpen) {
          if (chapterFilterInput) {
            chapterFilterInput.value = '';
            chapterMenu.querySelectorAll('.reader-chapter-option').forEach((opt) => opt.classList.remove('hidden'));
            setTimeout(() => {
              if (typeof chapterFilterInput.focus === 'function') {
                chapterFilterInput.focus({ preventScroll: true });
              }
            }, 60);
          }
          const activeOpt = chapterMenu.querySelector('.reader-chapter-option.active');
          const optionsList = targetDoc.getElementById('reader-chapter-options-list');
          if (activeOpt && optionsList) {
            optionsList.scrollTop = Math.max(0, activeOpt.offsetTop - optionsList.offsetTop - 30);
          }
        }
      };

      on('btn-chapter-dropdown', 'click', (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        toggleChapterMenu();
      });

      if (chapterFilterInput) {
        chapterFilterInput.addEventListener('input', (e) => {
          const q = String(e.target.value || '').trim().toLowerCase();
          chapterMenu.querySelectorAll('.reader-chapter-option').forEach((opt) => {
            const matches = !q || (opt.textContent || '').toLowerCase().includes(q);
            opt.classList.toggle('hidden', !matches);
          });
        });
        chapterFilterInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            toggleChapterMenu(false);
            if (chapterTrigger && typeof chapterTrigger.focus === 'function') chapterTrigger.focus();
          }
        });
      }

      if (chapterMenu) {
        chapterMenu.addEventListener('click', (e) => {
          const opt = e.target.closest('.reader-chapter-option');
          if (!opt) return;
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          const chapterId = opt.getAttribute('data-chapter-id');
          if (chapterId && app && typeof app.openReader === 'function') {
            app.openReader(app.activeSeriesId, chapterId);
            toggleChapterMenu(false);
          }
        });
      }

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
      const fontDropdown = targetDoc.getElementById('reader-font-dropdown');
      const fontTrigger = targetDoc.getElementById('btn-font-family');
      const fontMenu = targetDoc.getElementById('reader-font-menu');

      const toggleFontMenu = (forceOpen) => {
        if (!fontMenu || !fontTrigger) return;
        const isHidden = fontMenu.classList.contains('hidden');
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;
        fontMenu.classList.toggle('hidden', !shouldOpen);
        fontTrigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        if (shouldOpen) {
          const activeOpt =
            fontMenu.querySelector('.reader-font-option.active') ||
            fontMenu.querySelector('.reader-font-option');
          if (activeOpt && typeof activeOpt.focus === 'function') {
            activeOpt.focus();
          }
        }
      };

      on('btn-font-family', 'click', (e) => {
        if (fontMenu) {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          toggleFontMenu();
        } else {
          app.reader.toggleNovelFontFamily();
          refreshAll();
        }
      });

      if (fontMenu && typeof fontMenu.querySelectorAll === 'function') {
        const fontOptions = fontMenu.querySelectorAll('.reader-font-option');
        fontOptions.forEach((opt) => {
          opt.addEventListener('click', (e) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            const fontId = opt.getAttribute('data-font-id');
            if (fontId) {
              app.reader.setNovelFontFamily(fontId);
              refreshAll();
              toggleFontMenu(false);
              if (fontTrigger && typeof fontTrigger.focus === 'function') {
                fontTrigger.focus();
              }
            }
          });
        });

        fontMenu.addEventListener('keydown', (e) => {
          const opts = Array.from(fontMenu.querySelectorAll('.reader-font-option'));
          const currentIdx = opts.indexOf(targetDoc.activeElement);
          if (e.key === 'ArrowDown') {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            const nextIdx = (currentIdx + 1) % opts.length;
            if (opts[nextIdx] && typeof opts[nextIdx].focus === 'function') {
              opts[nextIdx].focus();
            }
          } else if (e.key === 'ArrowUp') {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            const prevIdx = (currentIdx - 1 + opts.length) % opts.length;
            if (opts[prevIdx] && typeof opts[prevIdx].focus === 'function') {
              opts[prevIdx].focus();
            }
          } else if (e.key === 'Escape') {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            toggleFontMenu(false);
            if (fontTrigger && typeof fontTrigger.focus === 'function') {
              fontTrigger.focus();
            }
          }
        });
      }

      if (typeof targetDoc.addEventListener === 'function') {
        targetDoc.addEventListener('click', (e) => {
          if (
            fontDropdown &&
            typeof fontDropdown.contains === 'function' &&
            !fontDropdown.contains(e.target) &&
            fontMenu &&
            !fontMenu.classList.contains('hidden')
          ) {
            toggleFontMenu(false);
          }
          if (
            chapterDropdown &&
            typeof chapterDropdown.contains === 'function' &&
            !chapterDropdown.contains(e.target) &&
            chapterMenu &&
            !chapterMenu.classList.contains('hidden')
          ) {
            toggleChapterMenu(false);
          }
        });
      }

      on('select-font-family', 'change', (e) => {
        if (e && e.target && e.target.value) {
          app.reader.setNovelFontFamily(e.target.value);
          refreshAll();
        }
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
      on('reader-page-slider', 'input', (e) => {
        const slider = e.target;
        const total = Math.max(1, (app.reader && app.reader.pages && app.reader.pages.length) || Number(slider.max) || 1);
        const curr = Number(slider.value) || 1;
        const fill = total > 1 ? Math.round(((curr - 1) / (total - 1)) * 100) : 0;
        if (slider.style && typeof slider.style.setProperty === 'function') {
          slider.style.setProperty('--slider-fill', `${fill}%`);
        }
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

      const endCard = targetDoc.getElementById('reader-chapter-end-card');
      const disqusSec = targetDoc.getElementById('disqus-section');
      if (
        endCard &&
        disqusSec &&
        typeof globalScope.IntersectionObserver === 'function'
      ) {
        try {
          const endObserver = new globalScope.IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (
                  entry.isIntersecting &&
                  entry.intersectionRatio > 0 &&
                  app.currentView === 'reader' &&
                  !endCard.classList.contains('hidden') &&
                  endCard.offsetHeight > 0
                ) {
                  disqusSec.classList.add('reader-comments-visible');
                  if (!this._hasScrolledToEnd) {
                    this._hasScrolledToEnd = true;
                    this.scrollToComments(targetDoc);
                  }
                }
              });
            },
            { rootMargin: '0px 0px 150px 0px', threshold: 0.05 }
          );
          endObserver.observe(endCard);
        } catch (_err) {
          // Fallback to scroll check
        }
      }

      on('reader-chapter-end-card', 'click', (e) => {
        if (
          e.target &&
          (e.target.tagName === 'BUTTON' ||
            e.target.tagName === 'A' ||
            (typeof e.target.closest === 'function' && e.target.closest('button, a')))
        ) {
          return;
        }
        this.scrollToComments(targetDoc);
      });

      if (typeof globalScope.addEventListener === 'function') {
        globalScope.addEventListener(
          'scroll',
          () => {
            if (app.currentView === 'reader') {
              if (app.reader && app.reader.mode === 'webtoon') {
                this.updateWebtoonScrollPage(app.reader, targetDoc);
              }
              this.checkCommentsEndVisibility(targetDoc);
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
