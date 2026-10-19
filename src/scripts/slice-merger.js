/**
 * @fileoverview Coklu parcalara (dilimlere) bolunmus Manga sayfalarini
 * tek bir HTML5 Canvas uzerinde kesintisiz birlestiren ve onbellege alan modul.
 */

(function (globalScope) {
  'use strict';

  /**
   * Bolunmus sayfa dilimlerini tek bir Canvas uzerinde birlestiren sinif.
   */
  class SliceMerger {
    /**
     * SliceMerger nesnesini baslatir.
     * @param {Object} [options={}] - Yapilandirma secenekleri.
     * @param {Object} [options.logger=null] - Loglama nesnesi.
     */
    constructor(options = {}) {
      this.logger = options.logger || null;
      this.cache = new Map();
      this.inProgress = new Map();
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
     * Gorsel URL'sinden "01_01", "01_02", "02-01" gibi bolunmus sayfa grup anahtarini cikarir.
     * @param {string} rawUrl - Gorsel URL dizgesi.
     * @returns {string|null} Mantiksal sayfa grup anahtari veya null.
     */
    static extractSliceGroupKey(rawUrl) {
      const rawStr = String(rawUrl || '');
      const cleanPath = rawStr.split(/[?#]/)[0];
      const hashPath = rawStr.includes('#') ? rawStr.split('#').pop() : '';
      const candidates = [cleanPath, hashPath, rawStr];

      for (const candidate of candidates) {
        const lastSegMatch = String(candidate || '').match(/([^/?#&]+)$/);
        if (!lastSegMatch) continue;
        let fileName = lastSegMatch[1];
        try { fileName = decodeURIComponent(fileName); } catch (_err) {}
        const baseName = fileName.replace(/\.(?:webp|jpe?g|png|gif|avif|bmp|svg)$/i, '').trim();
        const sliceMatch =
          baseName.match(/^(?:sayfa[_-]?|page[_-]?|p)?(\d+)[_](\d+)$/i) ||
          baseName.match(/^(\d{2,})[-_](\d{2,})$/);
        if (sliceMatch) return `page:${Number(sliceMatch[1])}`;
      }
      return null;
    }

    /**
     * Ham URL listesini ardisik mantiksal tam sayfa gruplarina donusturur.
     * @param {Array<string>} [rawPages=[]] - Ham URL dizisi.
     * @returns {Array<Array<string>>} Gruplanmis sayfa dilimleri.
     */
    static groupSlicedPages(rawPages = []) {
      if (!Array.isArray(rawPages) || rawPages.length === 0) return [];
      const groups = [];
      let currentGroup = [];
      let currentKey = null;

      rawPages.forEach((url) => {
        const key = SliceMerger.extractSliceGroupKey(url);
        if (key && key === currentKey && currentGroup.length > 0) {
          currentGroup.push(url);
        } else {
          currentGroup = [url];
          currentKey = key;
          groups.push(currentGroup);
        }
      });

      return groups;
    }

    /**
     * Dilim URL dizisinden onbellek anahtari olusturur.
     * @param {Array<string>} sliceUrls - Gorsel dilim URL dizisi.
     * @returns {string} Onbellek anahtari.
     */
    getCacheKey(sliceUrls) {
      if (!Array.isArray(sliceUrls)) return '';
      return sliceUrls.join('|');
    }

    /**
     * Tek bir gorseli yukler.
     * @param {string} url - Gorsel URL'si.
     * @returns {Promise<HTMLImageElement>} Yuklenen Image nesnesi.
     */
    loadImage(url) {
      return new Promise((resolve, reject) => {
        if (typeof Image === 'undefined') {
          return reject(new Error('Image constructor bulunamadi (Node ortami)'));
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          if (img.crossOrigin) {
            const fallbackImg = new Image();
            fallbackImg.onload = () => resolve(fallbackImg);
            fallbackImg.onerror = () => reject(new Error(`Gorsel yuklenemedi: ${url}`));
            fallbackImg.src = url;
          } else {
            reject(new Error(`Gorsel yuklenemedi: ${url}`));
          }
        };
        img.src = url;
      });
    }

    /**
     * Verilen tum dilimleri paralel yukler ve birlesik boyutlari hesaplar.
     * @param {Array<string>} sliceUrls - Dilim URL dizisi.
     * @returns {Promise<{ images: Array<HTMLImageElement>, width: number, height: number }>}
     */
    async loadAllSlices(sliceUrls) {
      const images = await Promise.all(sliceUrls.map((url) => this.loadImage(url)));
      let maxWidth = 0;
      let totalHeight = 0;

      for (const img of images) {
        const w = img.naturalWidth || img.width || 800;
        const h = img.naturalHeight || img.height || 600;
        if (w > maxWidth) maxWidth = w;
        totalHeight += h;
      }

      return {
        images,
        width: Math.max(1, maxWidth),
        height: Math.max(1, totalHeight)
      };
    }

    /**
     * DOM uzerindeki canvas elemanina dilimleri cizer.
     * @param {HTMLCanvasElement} canvas - Hedef canvas elemani.
     * @param {Array<string>} sliceUrls - Birlestirilecek dilim URL dizisi.
     * @returns {Promise<boolean>} Basarili ise true.
     */
    async stitchCanvas(canvas, sliceUrls) {
      if (!canvas || !Array.isArray(sliceUrls) || sliceUrls.length === 0) {
        return false;
      }
      if (typeof canvas.getContext !== 'function') {
        return false;
      }

      const cacheKey = this.getCacheKey(sliceUrls);
      this._log('debug', 'Parca birlestirme baslatildi', {
        sliceCount: sliceUrls.length,
        cacheKey
      });

      try {
        let loadPromise = this.inProgress.get(cacheKey);
        if (!loadPromise) {
          loadPromise = this.loadAllSlices(sliceUrls);
          this.inProgress.set(cacheKey, loadPromise);
        }

        const data = await loadPromise;
        this.inProgress.delete(cacheKey);

        canvas.width = data.width;
        canvas.height = data.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        let currentY = 0;
        for (const img of data.images) {
          const imgW = img.naturalWidth || img.width || data.width;
          const imgH = img.naturalHeight || img.height || 0;
          const offsetX = Math.max(0, Math.round((data.width - imgW) / 2));
          ctx.drawImage(img, offsetX, currentY, imgW, imgH);
          currentY += imgH;
        }

        canvas.setAttribute('data-stitched', 'true');
        canvas.classList.add('stitched-ready');
        this._log('info', 'Parcalar basariyla birlestirildi', {
          width: data.width,
          height: data.height,
          sliceCount: sliceUrls.length
        });
        return true;
      } catch (err) {
        this.inProgress.delete(cacheKey);
        this._log('warn', 'Parca birlestirme basarisiz oldu, fallback devrede', {
          error: err.message
        });
        return false;
      }
    }
  }

  globalScope.SliceMerger = SliceMerger;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SliceMerger };
  }
})(typeof window !== 'undefined' ? window : global);
