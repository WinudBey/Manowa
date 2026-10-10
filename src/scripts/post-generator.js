/**
 * @fileoverview Blogger uzerinde yeni seri tanitimi ve bolum yayinlarken kullanilacak
 * uyumlu HTML kodunu ve etiket onerilerini ureten modul.
 */

(function (globalScope) {
  'use strict';

  /**
   * Özel HTML karakterlerini güvenli hale getirir.
   * @param {string} str - Giris metni.
   * @returns {string} Kacisli metin.
   */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Metni URL dostu kimlige (slug) cevirir.
   * @param {string} text - Giris metni.
   * @returns {string} Slug.
   */
  function slugify(text) {
    const trMap = {
      ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
      Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u'
    };
    const replaced = String(text || '')
      .replace(/[çğıöşüÇĞİÖŞÜ]/g, (ch) => trMap[ch] || ch)
      .toLowerCase();
    return replaced.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seri';
  }

  /**
   * Blogger seri ve bolum gonderi kodlarini olusturan sinif.
   */
  class PostGenerator {
    /**
     * PostGenerator nesnesini baslatir.
     * @param {Object|null} [logger=null] - Logger nesnesi.
     */
    constructor(logger = null) {
      this.logger = logger || globalScope.ManowaLogger || null;
      this._log('debug', 'PostGenerator baslatildi.');
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
     * Satir veya virgulle ayrilmis sayfa URL'lerini diziye donusturur.
     * @param {string|Array<string>} rawPages - Ham URL girdisi.
     * @returns {Array<string>} Temizlenmis URL listesi.
     */
    parsePageUrls(rawPages) {
      if (Array.isArray(rawPages)) {
        return rawPages.map((u) => String(u).trim()).filter(Boolean);
      }
      return String(rawPages || '')
        .split(/[\r\n,]+/)
        .map((u) => u.trim())
        .filter(Boolean);
    }

    /**
     * Blogger Seri Tanitim gonderisi icin hem mevcut [Slug: ...] yapisiyla hem de
     * veri nitelikleriyle uyumlu HTML uretir.
     * @param {Object} [data={}] - Seri verileri.
     * @returns {{ html: string, labels: string, seriesObject: Object }}
     */
    generateSeriesPost(data = {}) {
      const title = data.title || 'İsimsiz Seri';
      const id = data.id || slugify(title);
      const altTitle = data.altTitle || '';
      const sourceLang = (data.sourceLang || 'KR').toUpperCase();
      const type = data.type || (sourceLang === 'JP' ? 'Manga' : 'Manhwa');
      const defaultReaderMode =
        data.defaultReaderMode || (sourceLang === 'JP' ? 'single' : 'webtoon');
      const status = data.status || 'Devam Ediyor';
      const translator = data.translator || 'Manhwa Arşiv';
      const cover = data.cover || 'https://placehold.co/600x800/1e1b4b/ffffff?text=Kapak';
      const genreList = Array.isArray(data.genres)
        ? data.genres
        : String(data.genres || 'Aksiyon, Fantastik')
            .split(',')
            .map((g) => g.trim())
            .filter(Boolean);
      const synopsis = data.synopsis || 'Seri özeti yakında eklenecektir.';

      const seriesObject = {
        id,
        title,
        altTitle,
        sourceLang,
        type,
        defaultReaderMode,
        status,
        translator,
        rating: '9.5',
        genres: genreList,
        cover,
        synopsis,
        chapters: []
      };

      const html = [
        `<!-- MANOWA SERI TANITIM KODU -->`,
        `<div id="actual-series-tag" style="display:none;">${escapeHtml(title)}</div>`,
        `<div class="manowa-series-post"`,
        `  data-series-id="${escapeHtml(id)}"`,
        `  data-title="${escapeHtml(title)}"`,
        `  data-alt-title="${escapeHtml(altTitle)}"`,
        `  data-source-lang="${escapeHtml(sourceLang)}"`,
        `  data-type="${escapeHtml(type)}"`,
        `  data-reader-mode="${escapeHtml(defaultReaderMode)}"`,
        `  data-status="${escapeHtml(status)}"`,
        `  data-translator="${escapeHtml(translator)}"`,
        `  data-genres="${escapeHtml(genreList.join(','))}"`,
        `  data-cover="${escapeHtml(cover)}">`,
        `  <img src="${escapeHtml(cover)}" alt="${escapeHtml(title)}" />`,
        `  <div class="synopsis-box">`,
        `    <h3>Özet</h3>`,
        `    <p class="manowa-synopsis">${escapeHtml(synopsis)}</p>`,
        `  </div>`,
        `</div>`
      ].join('\n');

      const labels = ['Seri', type, status, ...genreList, title].join(', ');
      this._log('info', 'Seri gonderi HTML kodu uretildi.', { id, labels });
      return { html, labels, seriesObject };
    }

    /**
     * Blogger Bolum Okuma gonderisi icin HTML kodu ve etiketleri uretir.
     * @param {Object} [data={}] - Bolum verileri.
     * @returns {{ html: string, labels: string, chapterObject: Object }}
     */
    generateChapterPost(data = {}) {
      const seriesTitle = data.seriesTitle || data.seriesId || 'Seri';
      const seriesId = slugify(seriesTitle);
      const number = Number(data.chapterNumber) || 1;
      const chapterId = `${seriesId}-bolum-${number}`;
      const title = data.chapterTitle || `${seriesTitle} Bölüm ${number}`;
      const readerMode = data.readerMode || 'webtoon';
      const translatorNote = data.translatorNote || '';
      const pages = this.parsePageUrls(data.pages);

      const pageImgsHtml = pages
        .map(
          (url, idx) =>
            `    <div class="separator" data-carousel-item=""><img class="manowa-page-img" data-index="${idx}" src="${escapeHtml(url)}" alt="${escapeHtml(title)} - Sayfa ${idx + 1}" loading="lazy" /></div>`
        )
        .join('\n');

      const html = [
        `<!-- MANOWA BOLUM OKUMA KODU -->`,
        `<div class="manowa-chapter-post"`,
        `  data-series-id="${escapeHtml(seriesId)}"`,
        `  data-chapter-id="${escapeHtml(chapterId)}"`,
        `  data-chapter-number="${number}"`,
        `  data-chapter-title="${escapeHtml(title)}"`,
        `  data-reader-mode="${escapeHtml(readerMode)}"`,
        `  data-translator-note="${escapeHtml(translatorNote)}">`,
        `  <div class="manowa-pages-data">`,
        pageImgsHtml,
        `  </div>`,
        `</div>`
      ].join('\n');

      const chapterObject = {
        id: chapterId,
        number,
        title,
        date: new Date().toISOString().slice(0, 10),
        translatorNote,
        pages
      };

      const labels = ['Bölüm', seriesTitle].join(', ');
      this._log('info', 'Bolum gonderi HTML kodu uretildi.', {
        chapterId,
        pageCount: pages.length
      });
      return { html, labels, chapterObject };
    }
  }

  globalScope.PostGenerator = PostGenerator;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PostGenerator,
      escapeHtml,
      slugify
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);

