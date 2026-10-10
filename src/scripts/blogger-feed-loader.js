/**
 * @fileoverview Blogger JSON Feed API (/feeds/posts/default?alt=json) ve DOM uzerinden
 * Seri ve Bolum gonderilerini dinamik olarak ayristiran veri katmani modulu.
 */
(function (globalScope) {
  'use strict';
  const KNOWN_STATUSES = ['Devam Ediyor', 'Tamamlandı', 'Güncel', 'Askıda', 'İptal Edildi', 'Yakında'];
  const KNOWN_TYPES = ['Manhwa', 'Manga', 'Manhua', 'Novel', 'Webcomic'];
  /**
   * Metni URL ve kimlik dostu slug formatina donusturur.
   * @param {string} text - Giris metni.
   * @returns {string} Slug dizgesi.
   */
  function toSlug(text) {
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
   * HTML etiketlerini temizleyip duz metin dondurur.
   * @param {string} html - HTML dizgesi.
   * @returns {string} Temizlenmis metin.
   */
  function stripTags(html) {
    return String(html || '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
  /**
   * Verilen gonderi HTML'inin bir Novel (metin) bolumu olup olmadigini tespit eder.
   * Icinde 1-2 kapak/illustrasyon resmi olsa bile metin agirlikli ise true doner.
   * @param {string} html - Bolum HTML icerigi.
   * @param {Array<string>} pages - Cikarilan gorsel URL listesi.
   * @param {string} [seriesType=''] - Bagli oldugu serinin turu ('Novel' vb.).
   * @returns {boolean} Novel bolumu ise true.
   */
  function detectNovelChapter(html, pages = [], seriesType = '') {
    const rawHtml = String(html || '');
    const plainText = stripTags(rawHtml);
    if (String(seriesType).toLowerCase() === 'novel' && plainText.length > 20) {
      return true;
    }
    if (/class=["'][^"']*orv_(?:title|line|quote|notice|wordcount)/i.test(rawHtml)) {
      return true;
    }
    if (pages.length === 0 && plainText.length > 20) {
      return true;
    }
    if (pages.length <= 2 && plainText.length > 250) {
      return true;
    }
    return false;
  }
  /**
   * Blogger JSON Feed ve DOM verilerini okuyan ve seri/bolum nesnelerine donusturen sinif.
   */
  class BloggerFeedLoader {
    /**
     * BloggerFeedLoader nesnesini yapilandirir.
     * @param {Object} [options={}] - Ayarlar.
     * @param {Object} [options.logger=null] - Logger nesnesi.
     * @param {Function} [options.fetchFn=null] - Ozel fetch fonksiyonu (testler icin).
     */
    constructor(options = {}) {
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.fetchFn = options.fetchFn || (typeof fetch === 'function' ? fetch.bind(globalScope) : null);
      this._log('debug', 'BloggerFeedLoader baslatildi.');
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
     * HTML icerigindeki tum img src URL'lerini cikarir.
     * @param {string} html - Gonderi HTML icerigi.
     * @returns {Array<string>} Resim URL listesi.
     */
    extractImages(html) {
      const urls = [];
      const regex = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
      let match;
      while ((match = regex.exec(String(html || ''))) !== null) {
        const src = match[1].trim();
        if (src) {
          urls.push(src);
        }
      }
      return urls;
    }
    /**
     * Gonderi HTML'inden [Slug: ...] veya #actual-series-tag bilgisini cikarir.
     * @param {string} html - Gonderi HTML icerigi.
     * @returns {string} Seri etiketi veya bos dizge.
     */
    extractSeriesTagFromHtml(html) {
      const str = String(html || '');
      const divMatch = str.match(/<div[^>]*id=["']actual-series-tag["'][^>]*>([\s\S]*?)<\/div>/i);
      if (divMatch && divMatch[1].trim()) {
        return stripTags(divMatch[1]);
      }
      const slugMatch = str.match(/\[Slug:\s*([^\]]+)\]/i);
      if (slugMatch && slugMatch[1].trim()) {
        return slugMatch[1].trim();
      }
      const dataAttrMatch = str.match(/data-series-id=["']([^"']+)["']/i);
      if (dataAttrMatch && dataAttrMatch[1].trim()) {
        return dataAttrMatch[1].trim();
      }
      return '';
    }
    /**
     * Seri tanitim HTML'inden Yazar, Cizer, Diger Isimler ve Ozet bilgilerini cikarir.
     * @param {string} html - Seri gonderisi HTML icerigi.
     * @returns {{ altTitle: string, author: string, artist: string, year: string, synopsis: string }}
     */
    extractSeriesMetadata(html) {
      const str = String(html || '');
      const meta = {
        altTitle: '',
        author: '',
        artist: '',
        year: '',
        synopsis: ''
      };
      const infoRegex = /<strong>\s*([^<]+?)\s*<\/strong>\s*<span>\s*([\s\S]*?)\s*<\/span>/gi;
      let match;
      while ((match = infoRegex.exec(str)) !== null) {
        const key = stripTags(match[1]).toLowerCase();
        const val = stripTags(match[2]);
        if (!val) continue;
        if (key.includes('diğer') || key.includes('alternatif')) {
          if (!/isteğe bağlı|alternatif isimler/i.test(val)) {
            meta.altTitle = val;
          }
        } else if (key.includes('yazar')) {
          if (!/yazar adı/i.test(val)) {
            meta.author = val;
          }
        } else if (key.includes('çizer')) {
          if (!/çizer adı/i.test(val)) {
            meta.artist = val;
          }
        } else if (key.includes('yıl') || key.includes('stüdyo')) {
          meta.year = val;
        }
      }
      const synMatch =
        str.match(/<div[^>]*class=["'][^"']*synopsis-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
        str.match(/<div[^>]*class=["'][^"']*synopsis-box[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ||
        str.match(/<p[^>]*class=["'][^"']*manowa-synopsis[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
      if (synMatch && synMatch[1]) {
        const cleaned = stripTags(synMatch[1].replace(/<h3[^>]*>[\s\S]*?<\/h3>/gi, ''));
        meta.synopsis = cleaned;
      }
      return meta;
    }
    /**
     * Basliktan bolum numarasini cikarir (orn: "Gölge Hükümdarı Bölüm 279" -> 279).
     * @param {string} title - Gonderi basligi.
     * @param {string} [html=''] - Gonderi HTML icerigi.
     * @returns {number} Bolum numarasi.
     */
    extractChapterNumber(title, html = '') {
      const dataMatch = String(html || '').match(/data-chapter-number=["'](\d+(?:\.\d+)?)["']/i);
      if (dataMatch) {
        return Number(dataMatch[1]);
      }
      const trMatch = String(title || '').match(/b[öo]l[üu]m\s*(\d+(?:[.,]\d+)?)/i);
      if (trMatch) {
        return Number(trMatch[1].replace(',', '.'));
      }
      const chMatch = String(title || '').match(/\bch(?:apter)?\.?\s*(\d+(?:[.,]\d+)?)/i);
      if (chMatch) {
        return Number(chMatch[1].replace(',', '.'));
      }
      const trailingNum = String(title || '').match(/(\d+)\s*$/);
      if (trailingNum) {
        return Number(trailingNum[1]);
      }
      return 1;
    }
    /**
     * Bolum basligindan seri adini tahmin eder (orn: "Kuzeyin Kılıcı Bölüm 1" -> "Kuzeyin Kılıcı").
     * @param {string} title - Bolum gonderisi basligi.
     * @returns {string} Tahmin edilen seri adi.
     */
    inferSeriesNameFromChapterTitle(title) {
      return String(title || '')
        .replace(/\s*[-–—:]?\s*b[öo]l[üu]m\s*\d+[\s\S]*$/i, '')
        .replace(/\s*[-–—:]?\s*ch(?:apter)?\.?\s*\d+[\s\S]*$/i, '')
        .trim();
    }
    /**
     * Etiket listesine gore seri turunu, kaynak dili, okuma modunu, durumu ve turleri belirler.
     * @param {Array<string>} categories - Gonderi etiketleri.
     * @param {string} seriesTitle - Seri basligi.
     * @returns {{ type: string, sourceLang: string, defaultReaderMode: string, status: string, genres: Array<string> }}
     */
    classifyLabels(categories = [], seriesTitle = '') {
      let type = 'Manhwa';
      let sourceLang = 'KR';
      let defaultReaderMode = 'webtoon';
      let status = 'Devam Ediyor';
      const genres = [];
      const titleLower = String(seriesTitle || '').trim().toLowerCase();
      categories.forEach((rawCat) => {
        const cat = String(rawCat || '').trim();
        if (!cat) return;
        const lower = cat.toLowerCase();
        if (lower === 'seri' || lower === 'bölüm' || lower === 'bolum' || lower === titleLower) {
          return;
        }
        if (lower.startsWith('dil:')) {
          sourceLang = cat.slice(4).trim().toUpperCase() || sourceLang;
          return;
        }
        const matchedType = KNOWN_TYPES.find((t) => t.toLowerCase() === lower);
        if (matchedType) {
          type = matchedType;
          if (matchedType === 'Manga') {
            sourceLang = 'JP';
            defaultReaderMode = 'single';
          } else if (matchedType === 'Manhua') {
            sourceLang = 'CN';
            defaultReaderMode = 'webtoon';
          } else if (matchedType === 'Novel') {
            sourceLang = 'KR';
            defaultReaderMode = 'novel';
          } else if (matchedType === 'Webcomic') {
            sourceLang = 'EN';
            defaultReaderMode = 'single';
          }
          return;
        }
        const matchedStatus = KNOWN_STATUSES.find((s) => s.toLowerCase() === lower);
        if (matchedStatus) {
          status = matchedStatus;
          return;
        }
        genres.push(cat);
      });
      return {
        type,
        sourceLang,
        defaultReaderMode,
        status,
        genres: genres.length > 0 ? genres : ['Genel']
      };
    }
    /**
     * Normalize edilmis gonderi kayitlarini (entries) Seri ve Bolum agacina donusturur.
     * @param {Array<Object>} rawPosts - Normalize edilmis gonderi dizisi.
     * @returns {Array<Object>} Katalog seri listesi.
     */
    buildCatalogFromPosts(rawPosts = []) {
      const seriesMap = new Map();
      const chapterItems = [];
      rawPosts.forEach((post) => {
        const title = String(post.title || '').trim();
        const html = String(post.content || '');
        const categories = Array.isArray(post.categories) ? post.categories : [];
        const catsLower = categories.map((c) => String(c).toLowerCase());
        const publishedDate = String(post.published || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
        const postUrl = post.url || '';
        const isSeriesPost =
          catsLower.includes('seri') ||
          html.includes('manowa-series-post') ||
          html.includes('actual-series-tag') ||
          /\[Slug:/i.test(html);
        const isChapterPost =
          catsLower.includes('bölüm') ||
          catsLower.includes('bolum') ||
          html.includes('manowa-chapter-post') ||
          (!isSeriesPost && /b[öo]l[üu]m\s*\d+/i.test(title));
        if (isSeriesPost && !catsLower.includes('bölüm')) {
          const tagFromHtml = this.extractSeriesTagFromHtml(html);
          const seriesTag = tagFromHtml || title;
          const seriesId = toSlug(seriesTag);
          const images = this.extractImages(html);
          const meta = this.extractSeriesMetadata(html);
          const labelInfo = this.classifyLabels(categories, seriesTag);
          seriesMap.set(seriesId, {
            id: seriesId,
            title: title || seriesTag,
            altTitle: meta.altTitle,
            author: meta.author,
            artist: meta.artist,
            year: meta.year,
            sourceLang: labelInfo.sourceLang,
            type: labelInfo.type,
            defaultReaderMode: labelInfo.defaultReaderMode,
            status: labelInfo.status,
            translator: meta.author || 'Manowa Çeviri',
            rating: '9.6',
            genres: labelInfo.genres,
            cover: images[0] || 'https://placehold.co/600x800/1e1b4b/ffffff?text=Kapak',
            synopsis: meta.synopsis || `${title} serisi tüm bölümleriyle arşivimizde.`,
            url: postUrl,
            publishedDate,
            chapters: []
          });
        } else if (isChapterPost) {
          chapterItems.push({
            title,
            html,
            categories,
            publishedDate,
            url: postUrl
          });
        }
      });
      chapterItems.forEach((chPost) => {
        const htmlSeriesTag = this.extractSeriesTagFromHtml(chPost.html);
        const matchingExistingCat = chPost.categories.find((c) => seriesMap.has(toSlug(c)));
        const nonGenericLabel = chPost.categories.find((c) => {
          const lower = String(c).toLowerCase();
          if (['bölüm', 'bolum', 'seri'].includes(lower)) return false;
          if (KNOWN_TYPES.some((t) => t.toLowerCase() === lower)) return false;
          if (KNOWN_STATUSES.some((s) => s.toLowerCase() === lower)) return false;
          return true;
        });
        const inferredSeriesTitle =
          htmlSeriesTag ||
          matchingExistingCat ||
          nonGenericLabel ||
          this.inferSeriesNameFromChapterTitle(chPost.title) ||
          'Genel Seri';
        const seriesId = toSlug(inferredSeriesTitle);
        if (!seriesMap.has(seriesId)) {
          const imgs = this.extractImages(chPost.html);
          const isNovelChapter = detectNovelChapter(chPost.html, imgs, '');
          seriesMap.set(seriesId, {
            id: seriesId,
            title: inferredSeriesTitle,
            altTitle: '',
            author: '',
            artist: '',
            year: '',
            sourceLang: 'KR',
            type: isNovelChapter ? 'Novel' : 'Manhwa',
            defaultReaderMode: isNovelChapter ? 'novel' : 'webtoon',
            status: 'Devam Ediyor',
            translator: 'Manowa Çeviri',
            rating: '9.5',
            genres: ['Genel'],
            cover: imgs[0] || 'https://placehold.co/600x800/1e1b4b/ffffff?text=Kapak',
            synopsis: `${inferredSeriesTitle} çeviri bölümleri.`,
            url: '',
            publishedDate: chPost.publishedDate,
            chapters: []
          });
        }
        const series = seriesMap.get(seriesId);
        const number = this.extractChapterNumber(chPost.title, chPost.html);
        const chapterId = `${seriesId}-bolum-${number}`;
        const pages = this.extractImages(chPost.html);
        const isNovel = detectNovelChapter(chPost.html, pages, series.type);
        const noteMatch = chPost.html.match(/data-translator-note=["']([^"']*)["']/i);
        const translatorNote = noteMatch ? noteMatch[1] : '';
        if (!series.chapters.some((existing) => existing.id === chapterId)) {
          series.chapters.push({
            id: chapterId,
            number,
            title: chPost.title || `Bölüm ${number}`,
            date: chPost.publishedDate,
            translatorNote,
            pages,
            isNovel,
            htmlContent: isNovel ? chPost.html : '',
            url: chPost.url
          });
        }
        if (
          (!series.cover || series.cover.includes('placehold.co')) &&
          pages.length > 0
        ) {
          series.cover = pages[0];
        }
      });
      const result = Array.from(seriesMap.values());
      this._log('info', 'Blogger gonderileri katalog yapisina donusturuldu.', {
        seriesCount: result.length,
        chapterCount: chapterItems.length
      });
      return result;
    }
    /**
     * Blogger JSON Feed API yanit nesnesini (feed.entry) ayristirir.
     * @param {Object} feedJson - Blogger ?alt=json yaniti.
     * @returns {Array<Object>} Katalog seri listesi.
     */
    parseBloggerFeedJson(feedJson) {
      if (!feedJson || !feedJson.feed) {
        this._log('warn', 'Gecersiz Blogger JSON verisi alindi.');
        return [];
      }
      const entries = Array.isArray(feedJson.feed.entry) ? feedJson.feed.entry : [];
      const normalized = entries.map((entry) => {
        const categories = Array.isArray(entry.category)
          ? entry.category.map((c) => c.term).filter(Boolean)
          : [];
        const altLink = Array.isArray(entry.link)
          ? entry.link.find((l) => l.rel === 'alternate')
          : null;
        return {
          id: entry.id ? entry.id.$t : '',
          title: entry.title ? entry.title.$t : '',
          published: entry.published ? entry.published.$t : '',
          categories,
          url: altLink ? altLink.href : '',
          content: entry.content ? entry.content.$t : (entry.summary ? entry.summary.$t : '')
        };
      });
      return this.buildCatalogFromPosts(normalized);
    }
    /**
     * Sayfa DOM icindeki .post-entry veya .manowa-* dugumlerini yedek olarak ayristirir.
     * @param {Document} [doc=document] - Tarayici document nesnesi.
     * @returns {Array<Object>} Katalog seri listesi.
     */
    parseDomEntries(doc = typeof document !== 'undefined' ? document : null) {
      if (!doc) return [];
      const rawPosts = [];
      const postEntries = doc.querySelectorAll('.post-entry');
      postEntries.forEach((node) => {
        const titleEl = node.querySelector('.post-title');
        const bodyEl = node.querySelector('.post-body');
        const labelEls = node.querySelectorAll('.post-label-item');
        const categories = Array.from(labelEls).map((el) => el.textContent.trim()).filter(Boolean);
        const html = bodyEl ? bodyEl.innerHTML : node.innerHTML;
        const title = titleEl ? titleEl.textContent.trim() : '';
        if (categories.length === 0) {
          if (html.includes('actual-series-tag') || /\[Slug:/i.test(html)) {
            categories.push('Seri');
          } else if (/b[öo]l[üu]m\s*\d+/i.test(title)) {
            categories.push('Bölüm');
          }
        }
        rawPosts.push({
          id: node.getAttribute('data-post-id') || '',
          title,
          published: new Date().toISOString(),
          categories,
          url: node.getAttribute('data-post-url') || '',
          content: html
        });
      });
      const customSeries = doc.querySelectorAll('.manowa-series-post');
      customSeries.forEach((node) => {
        rawPosts.push({
          id: node.getAttribute('data-series-id') || '',
          title: node.getAttribute('data-title') || '',
          published: new Date().toISOString(),
          categories: ['Seri', node.getAttribute('data-type') || 'Manhwa'],
          url: '',
          content: node.outerHTML
        });
      });
      const customChapters = doc.querySelectorAll('.manowa-chapter-post');
      customChapters.forEach((node) => {
        rawPosts.push({
          id: node.getAttribute('data-chapter-id') || '',
          title: node.getAttribute('data-chapter-title') || 'Bölüm 1',
          published: new Date().toISOString(),
          categories: ['Bölüm', node.getAttribute('data-series-id') || ''],
          url: '',
          content: node.outerHTML
        });
      });
      if (rawPosts.length === 0) {
        return [];
      }
      return this.buildCatalogFromPosts(rawPosts);
    }
    /**
     * JSONP (alt=json-in-script) kullanarak Blogger beslemesini ceker (CORS ve yerel onizleme yedegi).
     * @param {string} [blogOrigin=''] - Blog kök adresi.
     * @returns {Promise<Array<Object>>} Dinamik seri listesi.
     */
    fetchViaJsonp(blogOrigin = '') {
      return new Promise((resolve) => {
        const resolvedOrigin =
          blogOrigin ||
          globalScope.MANOWA_BLOG_ORIGIN ||
          (typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')
            ? location.origin
            : '');
        if (typeof document === 'undefined' || !resolvedOrigin) {
          resolve([]);
          return;
        }
        const cbName = '__manowaFeedCb_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const script = document.createElement('script');
        const cleanup = () => {
          try {
            delete globalScope[cbName];
          } catch (_e) {
            globalScope[cbName] = undefined;
          }
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
        };
        const timer = setTimeout(() => {
          cleanup();
          resolve([]);
        }, 6000);
        globalScope[cbName] = (json) => {
          clearTimeout(timer);
          cleanup();
          const parsed = this.parseBloggerFeedJson(json);
          this._log('info', 'Blogger JSONP beslemesi basariyla yuklendi.', { count: parsed.length });
          resolve(parsed);
        };
        script.onerror = () => {
          clearTimeout(timer);
          cleanup();
          resolve([]);
        };
        script.src = `${resolvedOrigin}/feeds/posts/default?alt=json-in-script&max-results=500&callback=${cbName}`;
        (document.head || document.body).appendChild(script);
      });
    }
    /**
     * Blogger JSON Feed API'sinden (/feeds/posts/default?alt=json&max-results=500) tum verileri ceker.
     * @param {string} [feedUrl='/feeds/posts/default?alt=json&max-results=500'] - Besleme URL'si.
     * @returns {Promise<Array<Object>>} Dinamik seri listesi.
     */
    async fetchDynamicCatalog(feedUrl = '/feeds/posts/default?alt=json&max-results=500') {
      const isFileProtocol =
        typeof location !== 'undefined' && location.protocol === 'file:' && feedUrl.startsWith('/');
      if (this.fetchFn && !isFileProtocol) {
        try {
          this._log('debug', 'Blogger JSON Feed istegi gonderiliyor.', { feedUrl });
          const response = await this.fetchFn(feedUrl);
          if (!response || !response.ok) {
            throw new Error(`HTTP ${response ? response.status : 'NO_RESPONSE'}`);
          }
          const json = await response.json();
          const seriesList = this.parseBloggerFeedJson(json);
          if (seriesList.length > 0) {
            this._log('info', 'Blogger JSON Feed basariyla yuklendi.', { count: seriesList.length });
            return seriesList;
          }
        } catch (err) {
          this._log('warn', 'Blogger JSON Feed alinamadi, yedek yontemler deneniyor.', {
            error: err.message
          });
        }
      }
      if (typeof document !== 'undefined') {
        const origin =
          typeof location !== 'undefined' && location.origin && location.origin.startsWith('http')
            ? location.origin
            : globalScope.MANOWA_BLOG_ORIGIN || '';
        if (origin) {
          const jsonpSeries = await this.fetchViaJsonp(origin);
          if (jsonpSeries.length > 0) {
            return jsonpSeries;
          }
        }
      }
      return this.parseDomEntries();
    }
  }
  globalScope.BloggerFeedLoader = BloggerFeedLoader;
  globalScope.ManowaSlugify = toSlug;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      BloggerFeedLoader,
      toSlug,
      stripTags,
      detectNovelChapter
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
