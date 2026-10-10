/**
 * @fileoverview Disqus yorum sistemini seri ve bolum sayfalarina dinamik yukleyen modul.
 * Sayfa gecislerinde DISQUS.reset() kullanarak yorum basligini gunceller.
 */

(function (globalScope) {
  'use strict';

  /**
   * Disqus yorum entegrasyonunu yoneten sinif.
   */
  class DisqusLoader {
    /**
     * DisqusLoader nesnesini yapilandirir.
     * @param {Object} [options={}] - Yapilandirma secenekleri.
     * @param {string} [options.shortname='manhawon'] - Disqus forum kisa adi.
     * @param {Object} [options.logger=null] - Loglama nesnesi.
     */
    constructor(options = {}) {
      const defaultShortname =
        options.shortname !== undefined ? String(options.shortname) : 'manhawon';
      this.shortname = defaultShortname.trim().toLowerCase();
      this.logger = options.logger || globalScope.ManowaLogger || null;
      this.isScriptInjected = false;
      this.currentIdentifier = null;
      this._log('debug', 'DisqusLoader baslatildi.', { shortname: this.shortname });
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
     * Disqus shortname degerini gunceller.
     * @param {string} shortname - Yeni Disqus kisa adi.
     * @returns {boolean} Gecerli ise true doner.
     */
    setShortname(shortname) {
      this.shortname = String(shortname || '').trim().toLowerCase();
      this._log('info', 'Disqus shortname guncellendi.', { shortname: this.shortname });
      return this.isValidShortname();
    }

    /**
     * Shortname formatinin gecerliligini kontrol eder.
     * @returns {boolean} Gecerli ise true.
     */
    isValidShortname() {
      return /^[a-z0-9-]{2,64}$/.test(this.shortname) && this.shortname !== 'your-disqus-shortname';
    }

    /**
     * Disqus embed.js betik URL'sini uretir.
     * @returns {string} Betik URL'si veya bos dizge.
     */
    getEmbedScriptUrl() {
      if (!this.isValidShortname()) {
        return '';
      }
      return `https://${this.shortname}.disqus.com/embed.js`;
    }

    /**
     * Belirtilen sayfa kimligi icin Disqus yorumlarini yukler veya sifirlar.
     * @param {Object} [pageInfo={}] - Sayfa bilgileri.
     * @param {string} [pageInfo.identifier] - Benzersiz konu kimligi.
     * @param {string} [pageInfo.url] - Sayfa tam URL'si.
     * @param {string} [pageInfo.title] - Sayfa basligi.
     * @param {HTMLElement|null} [statusElement=null] - Durum bilgisinin yazilacagi DOM elemani.
     * @returns {boolean} Yukleme baslatildiysa true.
     */
    loadThread(pageInfo = {}, statusElement = null) {
      const identifier = pageInfo.identifier || 'manowa-default';
      const pageUrl =
        pageInfo.url ||
        (typeof location !== 'undefined' && location.href.startsWith('http')
          ? location.href
          : `https://manhwaarsiv.blogspot.com/#!/${identifier}`);
      const pageTitle = pageInfo.title || 'Manhwa Arşiv';

      this.currentIdentifier = identifier;
      this._log('debug', 'Disqus loadThread cagrildi.', { identifier, pageUrl, pageTitle });

      if (!this.isValidShortname()) {
        this._log('warn', 'Disqus shortname ayarlanmamis veya gecersiz. Onizleme bilgisi gosteriliyor.');
        if (statusElement) {
          statusElement.innerHTML =
            `<strong>Disqus Yorum Sistemi Hazır:</strong> Konu Kimliği: <code>${identifier}</code>. ` +
            `Canlı yorumları başlatmak için üst kısımdan Disqus Shortname girin.`;
        }
        return false;
      }

      if (statusElement) {
        statusElement.textContent = `${this.shortname}.disqus.com üzerinden "${pageTitle}" yorumları yükleniyor...`;
      }

      if (globalScope.DISQUS && typeof globalScope.DISQUS.reset === 'function') {
        globalScope.DISQUS.reset({
          reload: true,
          config: function () {
            this.page.identifier = identifier;
            this.page.url = pageUrl;
            this.page.title = pageTitle;
          }
        });
        this._log('info', 'Mevcut Disqus oturumu yeni sayfa icin sifirlandi.', { identifier });
        return true;
      }

      globalScope.disqus_config = function () {
        this.page.url = pageUrl;
        this.page.identifier = identifier;
        this.page.title = pageTitle;
      };

      if (typeof document !== 'undefined' && !this.isScriptInjected) {
        const script = document.createElement('script');
        script.src = this.getEmbedScriptUrl();
        script.setAttribute('data-timestamp', String(+new Date()));
        script.async = true;
        (document.head || document.body).appendChild(script);
        this.isScriptInjected = true;
        this._log('info', 'Disqus embed.js DOM icine eklendi.', { src: script.src });
      }

      return true;
    }
  }

  globalScope.DisqusLoader = DisqusLoader;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DisqusLoader };
  }
})(typeof window !== 'undefined' ? window : globalThis);
