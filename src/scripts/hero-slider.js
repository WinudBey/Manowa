/**
 * @fileoverview Minimalist ana sayfa vitrin kaydiricisi (HeroSlider) modulu.
 * Sadece arka plan, baslik, tek buton, kenar gecis oklari ve sade nokta gostergeleri sunar.
 */

(function (globalScope) {
  'use strict';

  /**
   * Ana sayfa vitrin kaydiricisini (Hero Slider) yoneten sinif.
   */
  class HeroSlider {
    /**
     * HeroSlider nesnesini yapilandirir.
     * @param {Object} [options={}] - Kaydirici secenekleri.
     * @param {Object} [options.logger] - Istemci loglayici nesnesi.
     * @param {number} [options.maxSlides=6] - Vitrinde gosterilecek maksimum seri sayisi.
     * @param {number} [options.autoPlayMs=6000] - Otomatik gecis suresi (ms). 0 ise kapali.
     */
    constructor(options = {}) {
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.maxSlides = typeof options.maxSlides === 'number' ? options.maxSlides : 6;
      this.autoPlayMs = typeof options.autoPlayMs === 'number' ? options.autoPlayMs : 6000;
      this.slides = [];
      this.currentIndex = 0;
      this.isPaused = false;
      this.timerId = null;
      this.touchStartX = null;

      this._log('debug', 'Minimalist HeroSlider baslatildi.', {
        maxSlides: this.maxSlides,
        autoPlayMs: this.autoPlayMs
      });
    }

    /**
     * Ic loglama yardimcisi.
     * @param {'debug'|'info'|'warn'|'error'} level - Log seviyesi.
     * @param {string} msg - Log mesaji.
     * @param {Object} [meta={}] - Ek veri.
     * @returns {void}
     */
    _log(level, msg, meta = {}) {
      if (this.logger && typeof this.logger[level] === 'function') {
        this.logger[level](msg, meta);
      }
    }

    /**
     * Sablondan kalan yer tutucu ozet metinlerini temizler.
     * @param {string} rawSynopsis - Ham ozet metni.
     * @param {Object} [series={}] - Seri nesnesi.
     * @returns {string} Temizlenmis ozet metni.
     */
    cleanSynopsis(rawSynopsis, series = {}) {
      const text = String(rawSynopsis || '').trim();
      const isPlaceholder =
        !text ||
        /buraya serinin özet hikayesini|yepyeni tasarımla çok profesyonel|serisi tüm bölümleriyle arşivimizde/i.test(
          text
        );
      if (!isPlaceholder) {
        return text;
      }
      const typeLabel = series.type || 'Manhwa';
      const statusLabel = series.status || 'Devam Ediyor';
      const chapterCount = Array.isArray(series.chapters) ? series.chapters.length : 0;
      const genresText =
        Array.isArray(series.genres) && series.genres.length > 0
          ? `${series.genres.slice(0, 3).join(', ')} kategorilerinde `
          : '';
      return `${series.title || 'Seri'} (${typeLabel}) — ${genresText}${statusLabel.toLowerCase()} durumunda, ${chapterCount} Türkçe çeviri bölümüyle arşivde.`;
    }

    /**
     * Katalogdan one cikan serileri secerek slayt listesini gunceller.
     * @param {Object} catalog - CatalogController nesnesi.
     * @returns {Array<Object>} Secilen slayt dizisi.
     */
    setSlidesFromCatalog(catalog) {
      if (!catalog || !Array.isArray(catalog.seriesList)) {
        this.slides = [];
        this.currentIndex = 0;
        return this.slides;
      }

      const all = catalog.seriesList.slice();
      const withChapters = all.filter((s) => Array.isArray(s.chapters) && s.chapters.length > 0);
      const withoutChapters = all.filter((s) => !Array.isArray(s.chapters) || s.chapters.length === 0);

      this.slides = [...withChapters, ...withoutChapters].slice(0, this.maxSlides);
      if (this.currentIndex >= this.slides.length) {
        this.currentIndex = 0;
      }

      this._log('debug', 'HeroSlider slayt listesi guncellendi.', {
        slideCount: this.slides.length
      });
      return this.slides;
    }

    /**
     * Aktif slayt nesnesini dondurur.
     * @returns {Object|null} Aktif seri nesnesi veya null.
     */
    getCurrentSlide() {
      if (this.slides.length === 0) {
        return null;
      }
      return this.slides[this.currentIndex] || this.slides[0];
    }

    /**
     * Belirtilen indeksteki slayta gecis yapar (dairesel sarma destekli).
     * @param {number} targetIndex - Hedef slayt indeksi.
     * @returns {Object|null} Yeni aktif slayt nesnesi.
     */
    goToSlide(targetIndex) {
      const len = this.slides.length;
      if (len === 0) {
        this.currentIndex = 0;
        return null;
      }
      const normalized = ((Number(targetIndex) % len) + len) % len;
      this.currentIndex = normalized;
      const active = this.slides[this.currentIndex];
      this._log('debug', 'HeroSlider slayt degisti.', {
        currentIndex: this.currentIndex,
        seriesId: active ? active.id : ''
      });
      return active;
    }

    /**
     * Bir sonraki slayta gecer.
     * @returns {Object|null} Yeni aktif slayt nesnesi.
     */
    nextSlide() {
      return this.goToSlide(this.currentIndex + 1);
    }

    /**
     * Bir onceki slayta gecer.
     * @returns {Object|null} Yeni aktif slayt nesnesi.
     */
    prevSlide() {
      return this.goToSlide(this.currentIndex - 1);
    }

    /**
     * Fare uzerine geldiginde veya ayrildiginda duraklatma durumunu degistirir.
     * @param {boolean} paused - Duraklatildi mi?
     * @returns {void}
     */
    setPaused(paused) {
      this.isPaused = Boolean(paused);
    }

    /**
     * Dokunmatik ekranda kaydirma hareketini (swipe) degerlendirir.
     * @param {number} startX - Dokunma baslangic X koordinati.
     * @param {number} endX - Dokunma bitis X koordinati.
     * @param {number} [threshold=45] - Minimum piksel esigi.
     * @returns {'next'|'prev'|'none'} Tetiklenen hareket yonu.
     */
    handleTouchGesture(startX, endX, threshold = 45) {
      const diff = Number(endX) - Number(startX);
      if (Math.abs(diff) < threshold) {
        return 'none';
      }
      if (diff < 0) {
        this.nextSlide();
        return 'next';
      }
      this.prevSlide();
      return 'prev';
    }

    /**
     * Otomatik slayt gecis zamanlayicisini baslatir.
     * @param {Function} [onTick] - Her geciste cagrilacak geri bildirim fonksiyonu.
     * @returns {void}
     */
    startAutoPlay(onTick) {
      this.stopAutoPlay();
      if (this.autoPlayMs <= 0 || this.slides.length <= 1) {
        return;
      }
      this.timerId = setInterval(() => {
        if (this.isPaused || this.slides.length <= 1) {
          return;
        }
        this.nextSlide();
        if (typeof onTick === 'function') {
          onTick(this.getCurrentSlide(), this.currentIndex);
        }
      }, this.autoPlayMs);
    }

    /**
     * Otomatik slayt gecis zamanlayicisini durdurur.
     * @returns {void}
     */
    stopAutoPlay() {
      if (this.timerId !== null) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }

    /**
     * Aktif slayt icin HTML kodunu uretir (arka plan, baslik, baslik alti seri ayrintilari, butonlar ve noktalar).
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object} [_library=null] - UserLibrary nesnesi (arayuz uyumu icin).
     * @param {Function} [urlBuilder=null] - URL olusturucu fonksiyon.
     * @returns {string} Uretilen HTML dizgesi.
     */
    buildSliderHtml(catalog, _library = null, urlBuilder = null) {
      const featured = this.getCurrentSlide();
      if (!featured) {
        return '';
      }

      const resolveUrl = typeof urlBuilder === 'function' ? urlBuilder : () => '#';
      const sortedAsc = catalog ? catalog.getSortedChapters(featured.id, 'asc') : [];
      const firstChapter = sortedAsc[0] || null;
      const chapterCount = Array.isArray(featured.chapters) ? featured.chapters.length : 0;

      const detailHref = resolveUrl('series', featured.id);
      const firstReadHref = firstChapter
        ? resolveUrl('reader', featured.id, firstChapter.id)
        : detailHref;
      const firstReadAction = firstChapter ? 'read' : 'detail';
      const firstReadChapterAttr = firstChapter ? `data-chapter="${firstChapter.id}"` : '';

      const coverSrc = featured.cover || 'https://placehold.co/600x800/1e1b4b/ffffff?text=Kapak';
      const typeLabel = featured.type || 'Manhwa';
      const statusLabel = featured.status || 'Devam Ediyor';
      const synopsis = this.cleanSynopsis(featured.synopsis, featured);

      const genresList = (Array.isArray(featured.genres) ? featured.genres : [])
        .filter((g) => String(g).toLowerCase() !== typeLabel.toLowerCase())
        .slice(0, 5);
      const genresHtml = genresList
        .map((g) => `<span class="hero-detail-genre">${g}</span>`)
        .join('');
      const genresBlockHtml = genresHtml
        ? `<div class="hero-genres" id="hero-genres">${genresHtml}</div>`
        : '';

      const iconFn =
        (globalScope.ManowaIcons && globalScope.ManowaIcons.get) ||
        (typeof require === 'function' ? require('./svg-icons').getSvgIcon : () => '');
      const authorHtml = featured.author
        ? `<span class="hero-detail-item">${iconFn('pen')} ${featured.author}</span>`
        : '';

      const dotsHtml = this.slides
        .map((slide, idx) => {
          const isActive = idx === this.currentIndex;
          return `<button class="hero-dot ${isActive ? 'active' : ''}" type="button" data-hero-index="${idx}" aria-label="${slide.title}" title="${slide.title}"></button>`;
        })
        .join('');

      return `
        <div class="hero-backdrop" style="background-image: url('${coverSrc}');"></div>
        <div class="hero-backdrop-overlay"></div>

        <button class="hero-arrow-btn hero-arrow-prev" id="btn-hero-prev" type="button" data-hero-nav="prev" aria-label="Önceki Slayt" title="Önceki">‹</button>
        <button class="hero-arrow-btn hero-arrow-next" id="btn-hero-next" type="button" data-hero-nav="next" aria-label="Sonraki Slayt" title="Sonraki">›</button>

        <div class="hero-slide-grid">
          <div class="hero-content">
            <h1 class="hero-title" id="hero-title">
              <a class="hero-title-link" href="${detailHref}" data-action="detail" data-series="${featured.id}">${featured.title}</a>
            </h1>
            ${genresBlockHtml}
            <div class="hero-details" id="hero-details">
              <span class="hero-detail-item hero-detail-type">${typeLabel}</span>
              <span class="hero-detail-item">${statusLabel}</span>
              <span class="hero-detail-item">${iconFn('layers')} ${chapterCount} Bölüm</span>
              ${authorHtml}
            </div>
            <p class="hero-desc" id="hero-desc">${synopsis}</p>
            <div class="hero-actions">
              <a class="primary-btn hero-primary-cta" href="${firstReadHref}" id="btn-hero-read" data-action="${firstReadAction}" data-series="${featured.id}" ${firstReadChapterAttr}>Hemen Oku →</a>
              <a class="hero-detail-btn" href="${detailHref}" id="btn-hero-detail" data-action="detail" data-series="${featured.id}">Seri Ayrıntıları</a>
            </div>
          </div>

          <div class="hero-cover-wrap">
            <a class="hero-poster-card" href="${detailHref}" data-action="detail" data-series="${featured.id}" title="${featured.title}">
              <img alt="${featured.title}" class="hero-cover-img" id="hero-cover-img" src="${coverSrc}" />
            </a>
          </div>
        </div>

        <div class="hero-dots-bar" id="hero-dots-track">
          ${dotsHtml}
        </div>
      `.trim();
    }

    /**
     * Tarayici DOM icindeki #hero-showcase kapsayicisini gunceller.
     * @param {Object} catalog - CatalogController nesnesi.
     * @param {Object} [library=null] - UserLibrary nesnesi.
     * @param {Function} [urlBuilder=null] - URL olusturucu fonksiyon.
     * @returns {boolean} Guncelleme yapildiysa true.
     */
    renderIntoDom(catalog, library = null, urlBuilder = null) {
      if (typeof document === 'undefined') {
        return false;
      }
      const container = document.getElementById('hero-showcase');
      if (!container) {
        return false;
      }
      if (this.slides.length === 0 && catalog) {
        this.setSlidesFromCatalog(catalog);
      }
      const html = this.buildSliderHtml(catalog, library, urlBuilder);
      if (!html) {
        return false;
      }
      container.innerHTML = html;
      return true;
    }

    /**
     * #hero-showcase uzerindeki tiklama, uzerine gelme ve dokunmatik kaydirma olaylarini baglar.
     * @param {Function} onChange - Slayt degistiginde cagrilacak guncelleme fonksiyonu.
     * @returns {void}
     */
    bindDomEvents(onChange) {
      if (typeof document === 'undefined') {
        return;
      }
      const heroBox = document.getElementById('hero-showcase');
      if (!heroBox) {
        return;
      }
      const refresh = () => {
        if (typeof onChange === 'function') {
          onChange();
        }
      };
      heroBox.addEventListener('click', (ev) => {
        const heroNav = ev.target.closest('[data-hero-nav], [data-hero-index]');
        if (!heroNav) {
          return;
        }
        ev.preventDefault();
        const dir = heroNav.getAttribute('data-hero-nav');
        const idx = heroNav.getAttribute('data-hero-index');
        if (dir === 'next') this.nextSlide();
        else if (dir === 'prev') this.prevSlide();
        else if (idx !== null) this.goToSlide(Number(idx));
        refresh();
        this.startAutoPlay(refresh);
      });
      heroBox.addEventListener('mouseenter', () => this.setPaused(true));
      heroBox.addEventListener('mouseleave', () => this.setPaused(false));
      heroBox.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches && e.touches[0]) {
            this.touchStartX = e.touches[0].clientX;
          }
        },
        { passive: true }
      );
      heroBox.addEventListener(
        'touchend',
        (e) => {
          if (this.touchStartX !== null && e.changedTouches && e.changedTouches[0]) {
            const moved = this.handleTouchGesture(this.touchStartX, e.changedTouches[0].clientX);
            this.touchStartX = null;
            if (moved !== 'none') refresh();
          }
        },
        { passive: true }
      );
    }
  }

  globalScope.HeroSlider = HeroSlider;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HeroSlider };
  }
})(typeof window !== 'undefined' ? window : globalThis);
