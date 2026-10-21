/**
 * @fileoverview Tum serileri kategorilerine ve durumlarina gore sade sekilde filtreleyen,
 * kapak gorsellerini standart tema karti formatinda sunan statik sayfa denetleyici modulu.
 */

(function (globalScope) {
  'use strict';

  /**
   * Turkce karakterleri siralama ve filtreleme icin kucuk harfe donusturur.
   * @param {string} str - Girdi metni.
   * @returns {string} Normalize edilmis metin.
   */
  function normalizeText(str) {
    if (!str) return '';
    return String(str)
      .trim()
      .toLocaleLowerCase('tr-TR')
      .replace(/i̇/g, 'i')
      .replace(/ı/g, 'i');
  }

  /**
   * HTML karakterlerini guvenlik amaciyla kacar.
   * @param {string} str - Girdi metni.
   * @returns {string} Guvenli HTML metni.
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Kategorik seri dizini ve statik sayfa gorunumunu yoneten sinif.
   */
  class DirectoryPageController {
    /**
     * DirectoryPageController nesnesini baslatir.
     * @param {Object} [options={}] - Yapilandirma secenekleri.
     * @param {Object} [options.catalog] - CatalogController ornegi.
     * @param {Object} [options.logger] - Logger nesnesi.
     * @param {Object} [options.library] - UserLibrary ornegi.
     * @param {Function} [options.computeUrlFn] - URL hesaplama fonksiyonu.
     * @param {Function} [options.onSelectSeries] - Seri secildiginde cagrilacak geri cagirim.
     */
    constructor(options = {}) {
      this.catalog = options.catalog || null;
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.library = options.library || null;
      this.computeUrlFn = typeof options.computeUrlFn === 'function' ? options.computeUrlFn : null;
      this.onSelectSeries = typeof options.onSelectSeries === 'function' ? options.onSelectSeries : null;

      // Sade filtreleme durumlari: Yalnizca Kategori ve Durum
      this.selectedGenre = 'ALL'; // 'ALL' | Ozel Kategori Adi (orn. 'Aksiyon')
      this.selectedStatus = 'ALL'; // 'ALL' | 'Devam Ediyor' | 'Tamamlandı'
      this.activeContainer = null;

      this._log('debug', 'DirectoryPageController baslatildi.');
    }

    /**
     * Ic log kaydi yazar.
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
     * Katalog serilerini yalnizca secilen kategori ve duruma gore suzer.
     * @returns {Array<Object>} Filtrelenmis seriler.
     */
    getFilteredSeries() {
      if (!this.catalog || !Array.isArray(this.catalog.seriesList)) {
        return [];
      }

      const list = this.catalog.seriesList.filter((series) => {
        // Durum filtresi
        if (this.selectedStatus !== 'ALL') {
          if ((series.status || '').toLowerCase() !== this.selectedStatus.toLowerCase()) {
            return false;
          }
        }

        // Kategori / Tur filtresi
        if (this.selectedGenre !== 'ALL') {
          const targetGenre = normalizeText(this.selectedGenre);
          const hasGenre = (series.genres || []).some(
            (g) => normalizeText(g) === targetGenre
          );
          if (!hasGenre) return false;
        }

        return true;
      });

      // Isme gore alfabetik sirala
      return list.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'tr'));
    }

    /**
     * Katalogda bulunan tum benzersiz kategorileri ve adetlerini dondurur.
     * @returns {Array<{ name: string, count: number }>} Kategori listesi.
     */
    getAllAvailableGenres() {
      if (!this.catalog || !Array.isArray(this.catalog.seriesList)) return [];
      const counts = {};
      this.catalog.seriesList.forEach((s) => {
        (s.genres || []).forEach((g) => {
          const name = String(g).trim();
          if (name) {
            counts[name] = (counts[name] || 0) + 1;
          }
        });
      });
      return Object.keys(counts)
        .sort((a, b) => a.localeCompare(b, 'tr'))
        .map((name) => ({ name, count: counts[name] }));
    }

    /**
     * Geriye donuk test uyumlulugu icin gruplanmis veriyi dondurur.
     * @returns {Array<{ key: string, title: string, count: number, series: Array<Object> }>} Gruplanmis veri.
     */
    getGroupedData() {
      const filtered = this.getFilteredSeries();
      return [
        {
          key: this.selectedGenre === 'ALL' ? 'all' : this.selectedGenre.toLowerCase(),
          title: this.selectedGenre === 'ALL' ? 'Tüm Seriler' : this.selectedGenre,
          count: filtered.length,
          series: filtered
        }
      ];
    }

    /**
     * Dizin arayuzunu DOM uzerine cizer.
     * @param {HTMLElement} container - Cizimin yapilacagi kapsayici eleman.
     * @returns {void}
     */
    render(container) {
      if (!container) return;
      this.activeContainer = container;

      const filteredSeries = this.getFilteredSeries();
      const allGenres = this.getAllAvailableGenres();
      const totalSeriesCount = this.catalog && this.catalog.seriesList ? this.catalog.seriesList.length : 0;
      const matchedSeriesCount = filteredSeries.length;

      container.innerHTML = `
        <div class="directory-container" id="directory-main-wrap">
          <!-- UST BASLIK VE ISTATISTIK PANELI -->
          <header class="directory-header">
            <div class="directory-header-content">
              <h1 class="directory-title">
                <svg aria-hidden="true" class="ui-icon" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                Tüm Seriler &amp; Kategorik Dizin
              </h1>
              <p class="directory-subtitle">
                İstediğiniz kategoriyi ve yayın durumunu seçerek ilgili çeviri serilerine doğrudan ulaşabilirsiniz.
              </p>
            </div>
            <div class="directory-stats-badge" aria-label="Görüntülenen Seri Sayısı">
              <span class="stats-number" id="directory-stat-count">${matchedSeriesCount}</span>
              <span class="stats-label">/ ${totalSeriesCount} Seri</span>
            </div>
          </header>

          <!-- SADE KONTROL KARTI: SADECE KATEGORILER VE SERI DURUMLARI -->
          <div class="directory-controls-card">
            <!-- 1. SATIR: KATEGORILER FILTRE SERIDI -->
            <div class="directory-control-row">
              <span class="dir-filter-label">Kategoriler:</span>
              <div class="directory-pills-wrap" id="dir-genre-pills">
                <button type="button" class="dir-pill ${this.selectedGenre === 'ALL' ? 'active' : ''}" data-genre="ALL">
                  Tüm Kategoriler
                </button>
                ${allGenres.map((g) => `
                  <button type="button" class="dir-pill ${this.selectedGenre === g.name ? 'active' : ''}" data-genre="${escapeHtml(g.name)}">
                    ${escapeHtml(g.name)} <span class="tag-count">(${g.count})</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 2. SATIR: SERI DURUMLARI FILTRE SERIDI -->
            <div class="directory-control-row">
              <span class="dir-filter-label">Seri Durumu:</span>
              <div class="directory-pills-wrap" id="dir-status-pills">
                <button type="button" class="dir-pill ${this.selectedStatus === 'ALL' ? 'active' : ''}" data-status="ALL">
                  Tümü
                </button>
                <button type="button" class="dir-pill ${this.selectedStatus === 'Devam Ediyor' ? 'active' : ''}" data-status="Devam Ediyor">
                  Devam Ediyor
                </button>
                <button type="button" class="dir-pill ${this.selectedStatus === 'Tamamlandı' ? 'active' : ''}" data-status="Tamamlandı">
                  Tamamlandı
                </button>
              </div>
            </div>
          </div>

          <!-- ALT KISIM: SECILEN KATEGORIYE AIT SERILER (DOGRUDAN STANDART KART IZGARASI) -->
          <div class="directory-content" id="directory-content-grid-wrap">
            ${filteredSeries.length === 0 ? `
              <div class="directory-empty-state">
                <svg aria-hidden="true" class="ui-icon" fill="none" height="48" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" viewBox="0 0 24 24" width="48" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <h3 class="empty-title">Bu Kategoride Seri Bulunamadı</h3>
                <p class="empty-desc">Seçtiğiniz filtreye uygun seri bulunmuyor. Farklı bir kategori veya durum seçebilirsiniz.</p>
                <button type="button" class="primary-btn" id="btn-dir-reset-filters">Filtreleri Sıfırla</button>
              </div>
            ` : `
              <div class="catalog-grid directory-grid" id="directory-cards-grid">
                ${filteredSeries.map((series) => this.renderSeriesCardHtml(series)).join('')}
              </div>
            `}
          </div>
        </div>
      `;

      this.setupEventListeners(container);
    }

    /**
     * Standart cards.css ile %100 uyumlu, kapak gorselini net gosteren seri karti HTML kodunu uretir.
     * @param {Object} series - Seri nesnesi.
     * @returns {string} Kart HTML ciktisi.
     */
    renderSeriesCardHtml(series) {
      if (!series) return '';
      const coverUrl = series.cover || 'https://placehold.co/600x800/1e1b4b/ffffff?text=Kapak';
      const title = escapeHtml(series.title || 'Başlıksız');
      const type = escapeHtml(series.type || 'Manhwa');
      const lang = escapeHtml(String(series.sourceLang || 'KR').toUpperCase());
      const status = escapeHtml(series.status || 'Devam Ediyor');
      const chapters = Array.isArray(series.chapters) ? series.chapters : [];
      const chCount = chapters.length > 0 ? `${chapters.length} Bölüm` : 'Bölüm Yok';
      const seriesHref = typeof this.computeUrlFn === 'function'
        ? this.computeUrlFn('series', series.id)
        : `#seri/${encodeURIComponent(series.id)}`;

      // Son 2 bolum butonu
      const latestChapters = chapters.slice(0, 2);
      const chaptersHtml = latestChapters.length > 0
        ? latestChapters.map((ch) => {
            const chHref = typeof this.computeUrlFn === 'function'
              ? this.computeUrlFn('reader', series.id, ch.id)
              : `#oku/${encodeURIComponent(series.id)}/${encodeURIComponent(ch.id)}`;
            return `<a class="chapter-mini-btn" href="${chHref}" data-action="read" data-series="${escapeHtml(series.id)}" data-chapter="${escapeHtml(ch.id)}"><span>Bölüm ${ch.number}</span><span>${escapeHtml(ch.date || '')}</span></a>`;
          }).join('')
        : `<a class="chapter-mini-btn" href="${seriesHref}" data-action="detail" data-series="${escapeHtml(series.id)}"><span>Seri Sayfası</span><span>Detay</span></a>`;

      return `
        <article class="series-card directory-series-card" data-series-id="${escapeHtml(series.id)}">
          <div class="card-cover-wrap shimmer">
            <a href="${seriesHref}" data-action="detail" data-series="${escapeHtml(series.id)}" style="display:block;width:100%;height:100%;">
              <img class="card-cover" src="${escapeHtml(coverUrl)}" alt="${title}" loading="lazy" onload="this.classList.add('is-loaded');var w=this.closest('.card-cover-wrap');if(w)w.classList.remove('shimmer');" onerror="this.onerror=null;this.src='https://placehold.co/600x800/1e1b4b/ffffff?text=${encodeURIComponent(title)}';" />
            </a>
            <span class="lang-badge lang-${lang}">${lang}</span>
            <span class="type-badge">${type}</span>
          </div>
          <div class="card-body">
            <a class="card-title" href="${seriesHref}" data-action="detail" data-series="${escapeHtml(series.id)}" title="${title}">${title}</a>
            <div class="card-meta">
              <span>${chCount}</span>
              <span>${status}</span>
            </div>
            <div class="card-chapters">${chaptersHtml}</div>
          </div>
        </article>
      `;
    }

    /**
     * Dizin arayuzundeki buton ve filtreleme olaylarini dinler.
     * @param {HTMLElement} container - Kapsayici eleman.
     * @returns {void}
     */
    setupEventListeners(container) {
      if (!container) return;

      // Kategori haplarina tiklama
      const genrePills = container.querySelectorAll('#dir-genre-pills .dir-pill');
      genrePills.forEach((pill) => {
        pill.addEventListener('click', () => {
          const g = pill.getAttribute('data-genre') || 'ALL';
          if (this.selectedGenre !== g) {
            this.selectedGenre = g;
            this.render(container);
          }
        });
      });

      // Seri durumu haplarina tiklama
      const statusPills = container.querySelectorAll('#dir-status-pills .dir-pill');
      statusPills.forEach((pill) => {
        pill.addEventListener('click', () => {
          const st = pill.getAttribute('data-status') || 'ALL';
          if (this.selectedStatus !== st) {
            this.selectedStatus = st;
            this.render(container);
          }
        });
      });

      // Filtreleri sifirla butonu
      const resetBtn = container.querySelector('#btn-dir-reset-filters');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          this.selectedGenre = 'ALL';
          this.selectedStatus = 'ALL';
          this.render(container);
        });
      }
    }

    /**
     * Blogger Statik Sayfa editörüne (HTML modu) yapıştırılacak SEO ve arama motoru uyumlu HTML üretir.
     * @returns {string} Blogger statik sayfa HTML icerigi.
     */
    generateStaticPageHtml() {
      return `<!-- MANOWA_SERIES_DIRECTORY_START -->
<div id="manowa-series-directory" class="manowa-directory-placeholder" data-auto-render="true">
  <div class="directory-static-seo-wrap">
    <h2>Manowa Çeviri Serileri Kataloğu ve Kategorik Dizin</h2>
    <p>Sitemizde yayınlanan tüm Manga, Manhwa, Manhua ve Web Romanı serileri aşağıda kategorilerine göre listelenmiştir. Dinamik filtreleme ve hızlı arama için tarayıcınızda JavaScript'i etkinleştiriniz.</p>
  </div>
</div>
<!-- MANOWA_SERIES_DIRECTORY_END -->`;
    }
  }

  globalScope.DirectoryPageController = DirectoryPageController;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DirectoryPageController };
  }
})(typeof window !== 'undefined' ? window : globalThis);
