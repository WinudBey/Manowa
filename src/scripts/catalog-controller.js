/**
 * @fileoverview Katalog verilerini, dil/tur filtrelemesini, aramayi ve bolum siralamasini yoneten modul.
 */

(function (globalScope) {
  'use strict';

  const LANGUAGE_LABELS = {
    KR: 'Korece (Manhwa)',
    JP: 'Japonca (Manga)',
    CN: 'Çince (Manhua)',
    EN: 'İngilizce (Comic)'
  };

  /**
   * Yerel onizleme (preview.html) icin ornek SVG sayfa gorseli uretir.
   * @param {string} title - Baslik.
   * @param {number} pageNo - Sayfa numarasi.
   * @param {string} colorHex - Tema rengi.
   * @returns {string} Data URI formatinda SVG.
   */
  function createSamplePageSvg(title, pageNo, colorHex) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
      <defs>
        <linearGradient id="bg${pageNo}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#141824"/>
          <stop offset="100%" stop-color="${colorHex}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="1200" fill="url(#bg${pageNo})"/>
      <rect x="40" y="40" width="720" height="340" rx="12" fill="#0f1117" stroke="#ffffff" stroke-width="4" opacity="0.85"/>
      <text x="400" y="180" fill="#ffffff" font-family="sans-serif" font-size="34" font-weight="bold" text-anchor="middle">${title}</text>
      <text x="400" y="240" fill="#94a3b8" font-family="sans-serif" font-size="24" text-anchor="middle">PANEL 1 - Çeviri Önizleme</text>
      <rect x="40" y="800" width="720" height="350" rx="12" fill="#0f1117" stroke="#f97316" stroke-width="4" opacity="0.9"/>
      <text x="400" y="960" fill="#f8fafc" font-family="sans-serif" font-size="48" font-weight="bold" text-anchor="middle">SAYFA ${pageNo}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  /**
   * Yalnizca cevrimdisi (offline) onizleme ortami icin yedek katalog verisi dondurur.
   * @returns {Array<Object>} Ornek seri listesi.
   */
  function getDefaultCatalog() {
    return [
      {
        id: 'kuzeyin-kilici',
        title: 'Kuzeyin Kılıcı',
        altTitle: 'Legend of the Northern Blade',
        author: 'Woo-Gak',
        artist: 'Hae-Min',
        sourceLang: 'JP',
        type: 'Manga',
        defaultReaderMode: 'single',
        status: 'Tamamlandı',
        translator: 'Manowa Çeviri',
        editor: 'Manowa Editör',
        rating: '9.7',
        genres: ['Manga', 'Orta Çağ', 'Fantastik'],
        cover: createSamplePageSvg('Kuzeyin Kılıcı', 1, '#be185d'),
        synopsis: 'Kuzey Göksel Tarikatı yıkıldıktan sonra sessizlik içinde ustalaşan Jin Mu-Won\'un destansı mücadelesi.',
        chapters: [
          {
            id: 'kuzeyin-kilici-bolum-1',
            number: 1,
            title: 'Kuzeyin Kılıcı Bölüm 1',
            date: '2026-09-29',
            translatorNote: '',
            pages: [
              createSamplePageSvg('Kuzeyin Kılıcı - Bölüm 1', 1, '#be185d'),
              createSamplePageSvg('Kuzeyin Kılıcı - Bölüm 1', 2, '#9d174d')
            ]
          }
        ]
      },
      {
        id: 'golge-hukumdari',
        title: 'Gölge Hükümdarı',
        altTitle: 'Shadow Monarch',
        author: 'Chugong',
        artist: 'DUBU',
        sourceLang: 'KR',
        type: 'Manhwa',
        defaultReaderMode: 'webtoon',
        status: 'Devam Ediyor',
        translator: 'Manowa Çeviri',
        editor: 'Manowa Editör',
        rating: '9.6',
        genres: ['Aksiyon', 'Sistem'],
        cover: createSamplePageSvg('Gölge Hükümdarı', 1, '#ea580c'),
        synopsis: 'Gizemli zindanların kapıları açıldığında en zayıf avcının adım adım zirveye yükselişi.',
        chapters: [
          {
            id: 'golge-hukumdari-bolum-1',
            number: 1,
            title: 'Gölge Hükümdarı Bölüm 1',
            date: '2026-09-26',
            translatorNote: '',
            pages: [
              createSamplePageSvg('Gölge Hükümdarı - Bölüm 1', 1, '#ea580c'),
              createSamplePageSvg('Gölge Hükümdarı - Bölüm 1', 2, '#c2410c')
            ]
          },
          {
            id: 'golge-hukumdari-bolum-2',
            number: 2,
            title: 'Gölge Hükümdarı Bölüm 2',
            date: '2026-09-27',
            translatorNote: '',
            pages: [
              createSamplePageSvg('Gölge Hükümdarı - Bölüm 2', 1, '#ea580c'),
              createSamplePageSvg('Gölge Hükümdarı - Bölüm 2', 2, '#c2410c')
            ]
          },
          {
            id: 'golge-hukumdari-bolum-3',
            number: 3,
            title: 'Gölge Hükümdarı Bölüm 3',
            date: '2026-09-28',
            translatorNote: '',
            pages: [
              createSamplePageSvg('Gölge Hükümdarı - Bölüm 3', 1, '#ea580c'),
              createSamplePageSvg('Gölge Hükümdarı - Bölüm 3', 2, '#c2410c')
            ]
          }
        ]
      },
      {
        id: 'goksel-simyaci',
        title: 'Göksel Simyacı',
        altTitle: 'Celestial Alchemist',
        author: 'Lin Feng',
        artist: 'Studio Cloud',
        sourceLang: 'CN',
        type: 'Manhua',
        defaultReaderMode: 'webtoon',
        status: 'Devam Ediyor',
        translator: 'Manowa Çeviri',
        editor: 'Manowa Editör',
        rating: '9.5',
        genres: ['Reenkarnasyon', 'Dövüş Sanatları'],
        cover: createSamplePageSvg('Göksel Simyacı', 1, '#0d9488'),
        synopsis: 'Kadim simya sanatlarının efendisi, bin yıl sonra genç bir bedende yeniden uyanır.',
        chapters: [
          {
            id: 'goksel-simyaci-bolum-1',
            number: 1,
            title: 'Göksel Simyacı Bölüm 1',
            date: '2026-09-20',
            translatorNote: '',
            pages: [
              createSamplePageSvg('Göksel Simyacı - Bölüm 1', 1, '#0d9488')
            ]
          }
        ]
      }
    ];
  }

  /**
   * Seri katalogunu, dil/tur filtrelerini ve aramayi yoneten sinif.
   */
  class CatalogController {
    /**
     * CatalogController nesnesini baslatir.
     * @param {Array<Object>|null} [initialSeries=null] - Baslangic serileri.
     * @param {Object|null} [logger=null] - Logger nesnesi.
     */
    constructor(initialSeries = null, logger = null) {
      this.logger = logger || globalScope.ManowaLogger || null;
      this.seriesList =
        Array.isArray(initialSeries) && initialSeries.length > 0
          ? initialSeries
          : getDefaultCatalog();
      this.activeLang = 'ALL';
      this.activeGenre = 'ALL';
      this.searchQuery = '';
      this.sortBy = 'updated';
      this._log('debug', 'CatalogController baslatildi.', { count: this.seriesList.length });
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
     * Katalog listesini dinamik Blogger verisiyle tamamen degistirir.
     * @param {Array<Object>} newSeriesList - Yeni seri listesi.
     * @returns {Array<Object>} Guncellenmis seri listesi.
     */
    setSeriesList(newSeriesList) {
      if (Array.isArray(newSeriesList)) {
        this.seriesList = newSeriesList.slice();
        this._log('info', 'Katalog dinamik seri listesiyle guncellendi.', {
          count: this.seriesList.length
        });
      } else if (newSeriesList === null) {
        this.seriesList = getDefaultCatalog();
        this._log('info', 'Katalog varsayilan serilerle sifirlandi.', {
          count: this.seriesList.length
        });
      }
      return this.seriesList;
    }

    /**
     * Dil veya tur filtresini ayarlar (orn: 'ALL', 'KR', 'JP', 'Manhwa', 'Manga', 'Novel').
     * @param {string} langOrType - Dil veya tur kodu.
     * @returns {Array<Object>} Filtrelenmis seri listesi.
     */
    setLanguageFilter(langOrType) {
      this.activeLang = String(langOrType || 'ALL').trim().toUpperCase();
      this._log('info', 'Dil/Tur filtresi degistirildi.', { activeLang: this.activeLang });
      return this.getFilteredSeries();
    }

    /**
     * Kategori / etiket filtresini ayarlar (orn: 'ALL', 'Aksiyon', 'Zindan').
     * @param {string} genre - Kategori adi.
     * @returns {Array<Object>} Filtrelenmis seri listesi.
     */
    setGenreFilter(genre) {
      const clean = String(genre || 'ALL').trim();
      this.activeGenre = clean.toUpperCase() === 'ALL' ? 'ALL' : clean;
      this._log('info', 'Kategori filtresi degistirildi.', { activeGenre: this.activeGenre });
      return this.getFilteredSeries();
    }

    /**
     * Arama sorgusunu gunceller.
     * @param {string} query - Arama metni.
     * @returns {Array<Object>} Filtrelenmis seri listesi.
     */
    setSearchQuery(query) {
      this.searchQuery = String(query || '').trim().toLowerCase();
      this._log('debug', 'Arama sorgusu guncellendi.', { searchQuery: this.searchQuery });
      return this.getFilteredSeries();
    }

    /**
     * Katalog siralama olcutunu degistirir ('updated', 'title_asc', 'chapters_desc').
     * @param {string} sortOrder - Siralama tipi.
     * @returns {Array<Object>} Siralanmis ve filtrelenmis seri listesi.
     */
    setSortOrder(sortOrder) {
      const valid = ['updated', 'title_asc', 'chapters_desc'];
      this.sortBy = valid.includes(sortOrder) ? sortOrder : 'updated';
      this._log('info', 'Katalog siralamasi degistirildi.', { sortBy: this.sortBy });
      return this.getFilteredSeries();
    }

    /**
     * Aktif filtre, arama sorgusu ve siralama olcutune uyan serileri dondurur.
     * @returns {Array<Object>} Filtrelenmis ve siralanmis seriler.
     */
    getFilteredSeries() {
      const filtered = this.seriesList.filter((item) => {
        const itemLang = String(item.sourceLang || '').toUpperCase();
        const itemType = String(item.type || '').toUpperCase();
        const matchesLang =
          this.activeLang === 'ALL' ||
          itemLang === this.activeLang ||
          itemType === this.activeLang;

        if (!matchesLang) {
          return false;
        }

        if (this.activeGenre && this.activeGenre !== 'ALL') {
          const targetGenre = this.activeGenre.toLowerCase();
          const hasGenre = (item.genres || []).some(
            (g) => String(g || '').trim().toLowerCase() === targetGenre
          );
          if (!hasGenre) {
            return false;
          }
        }

        if (!this.searchQuery) {
          return true;
        }
        const haystack = [
          item.title,
          item.altTitle || '',
          item.type || '',
          item.status || '',
          (item.genres || []).join(' ')
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(this.searchQuery);
      });

      if (this.sortBy === 'title_asc') {
        return filtered
          .slice()
          .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'tr'));
      }
      if (this.sortBy === 'chapters_desc') {
        return filtered
          .slice()
          .sort((a, b) => (b.chapters || []).length - (a.chapters || []).length);
      }
      return filtered;
    }

    /**
     * ID degerine gore seri bulur.
     * @param {string} seriesId - Seri kimligi.
     * @returns {Object|null} Bulunan seri veya null.
     */
    getSeriesById(seriesId) {
      return this.seriesList.find((s) => s.id === seriesId) || null;
    }

    /**
     * Belirtilen serinin bolumlerini numara sirasina gore dondurur.
     * @param {string} seriesId - Seri kimligi.
     * @param {'asc'|'desc'} [order='desc'] - Siralama yonu.
     * @returns {Array<Object>} Siralanmis bolum listesi.
     */
    getSortedChapters(seriesId, order = 'desc') {
      const series = this.getSeriesById(seriesId);
      if (!series || !Array.isArray(series.chapters)) {
        return [];
      }
      const copy = series.chapters.slice();
      copy.sort((a, b) => (order === 'asc' ? a.number - b.number : b.number - a.number));
      return copy;
    }

    /**
     * Katalog icine yeni seri ekler veya mevcut seriyi gunceller.
     * @param {Object} seriesObj - Seri nesnesi.
     * @returns {void}
     */
    upsertSeries(seriesObj) {
      if (!seriesObj || !seriesObj.id) {
        return;
      }
      const idx = this.seriesList.findIndex((s) => s.id === seriesObj.id);
      if (idx >= 0) {
        this.seriesList[idx] = seriesObj;
      } else {
        this.seriesList.unshift(seriesObj);
      }
      this._log('info', 'Katalog serisi guncellendi.', { id: seriesObj.id });
    }
  }

  globalScope.CatalogController = CatalogController;
  globalScope.MANOWA_LANGUAGE_LABELS = LANGUAGE_LABELS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CatalogController,
      LANGUAGE_LABELS,
      getDefaultCatalog,
      createSamplePageSvg
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);

