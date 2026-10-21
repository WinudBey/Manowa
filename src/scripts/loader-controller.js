/**
 * @fileoverview Manowa Blogger Temasi - Hibrit Yukleme ve Lazy Loading Kontrolcusu.
 * Sayfa ilk acilisinda tam ekran preloader, SPA rota gecislerinde ust ilerleme cubugu
 * ve kart/okuyucu gorselleri icin iskelet shimmer efektlerini yonetir.
 */

class LoaderController {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.progressBarId='top-progress-bar']
   * @param {string} [options.preloaderId='fullscreen-preloader']
   * @param {string} [options.storageKey='manowa_preloader_seen']
   * @param {number} [options.initialPreloaderMinDuration=600]
   * @param {boolean} [options.enableSessionBypass=true]
   */
  constructor(options = {}) {
    this.progressBarId = options.progressBarId || 'top-progress-bar';
    this.preloaderId = options.preloaderId || 'fullscreen-preloader';
    this.storageKey = options.storageKey || 'manowa_preloader_seen';
    this.initialPreloaderMinDuration = options.initialPreloaderMinDuration !== undefined ? options.initialPreloaderMinDuration : 600;
    this.enableSessionBypass = options.enableSessionBypass !== undefined ? options.enableSessionBypass : false;

    this.progressBarEl = null;
    this.preloaderEl = null;
    this.progressTimer = null;
    this.currentProgress = 0;
    this.isProgressRunning = false;

    this.log('LoaderController baslatilmaya hazir.');
  }

  /**
   * Kontrolcuyu DOM uzerine baglar ve ilk acilis akisini tetikler.
   */
  init() {
    if (typeof document !== 'undefined') {
      this.progressBarEl = document.getElementById(this.progressBarId);
      this.preloaderEl = document.getElementById(this.preloaderId);
    }

    this.handleInitialPreloader();
    this.initLazyImages();

    this.log('LoaderController DOM baglantilari tamamlandi.');
  }

  /**
   * Ilk sayfa acilisindaki tam ekran preloader mantigini yonetir.
   */
  handleInitialPreloader() {
    if (!this.preloaderEl) return;

    const hasSeenInSession = this.enableSessionBypass && this.checkSessionSeen();

    if (hasSeenInSession) {
      // Bu oturumda daha once gorulduyse dogrudan kaldir
      this.preloaderEl.classList.add('hidden');
      this.preloaderEl.style.display = 'none';
      return;
    }

    const startTime = Date.now();
    const dismiss = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, this.initialPreloaderMinDuration - elapsed);
      setTimeout(() => {
        this.hidePreloader();
      }, remaining);
    };

    if (typeof document !== 'undefined' && (document.readyState === 'complete' || document.readyState === 'interactive')) {
      dismiss();
    } else if (typeof window !== 'undefined') {
      window.addEventListener('load', dismiss, { once: true });
      // Guvenlik zaman asimi: Sayfa kaynaklari takilsa bile en gec 2s sonra preloader kapanir
      setTimeout(dismiss, 2000);
    } else {
      dismiss();
    }
  }

  /**
   * Oturumda preloader gorulup gorulmedigini denetler.
   * @returns {boolean}
   */
  checkSessionSeen() {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(this.storageKey) === 'true';
      }
    } catch (e) {
      // sessionStorage erisim engeli (gizli mod vb.)
    }
    return false;
  }

  /**
   * Tam ekran preloader'i acar.
   * @param {string} [statusText]
   */
  showPreloader(statusText) {
    if (!this.preloaderEl) return;
    if (statusText) {
      const textEl = this.preloaderEl.querySelector('.preloader-status-text');
      if (textEl) textEl.textContent = statusText;
    }
    this.preloaderEl.style.display = 'flex';
    this.preloaderEl.classList.remove('hidden');
  }

  /**
   * Tam ekran preloader'i yumusak sekilde kapatir.
   */
  hidePreloader() {
    if (!this.preloaderEl) return;
    this.preloaderEl.classList.add('hidden');
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(this.storageKey, 'true');
      }
    } catch (e) {
      // ignore
    }
    setTimeout(() => {
      if (this.preloaderEl && this.preloaderEl.classList.contains('hidden')) {
        this.preloaderEl.style.display = 'none';
      }
    }, 450);
  }

  /**
   * Ust ilerleme cubugunu baslatir (SPA / rota gecisleri icin).
   */
  startProgress() {
    if (!this.progressBarEl && typeof document !== 'undefined') {
      this.progressBarEl = document.getElementById(this.progressBarId);
    }
    if (!this.progressBarEl) return;

    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    this.isProgressRunning = true;
    this.progressBarEl.classList.remove('done');
    this.progressBarEl.classList.add('active');
    this.currentProgress = 15;
    this.progressBarEl.style.width = this.currentProgress + '%';

    this.progressTimer = setInterval(() => {
      if (this.currentProgress < 85) {
        // Yumusak adimlarla rastgele ilerle
        const step = Math.floor(Math.random() * 12) + 5;
        this.currentProgress = Math.min(85, this.currentProgress + step);
        if (this.progressBarEl) {
          this.progressBarEl.style.width = this.currentProgress + '%';
        }
      } else {
        clearInterval(this.progressTimer);
        this.progressTimer = null;
      }
    }, 120);
  }

  /**
   * Ilerleme cubugunu yuzde degerine ceker.
   * @param {number} pct
   */
  setProgress(pct) {
    if (!this.progressBarEl) return;
    this.currentProgress = Math.min(100, Math.max(0, pct));
    this.progressBarEl.style.width = this.currentProgress + '%';
  }

  /**
   * Ust ilerleme cubugunu %100 yapip yumusakca kapatir.
   */
  finishProgress() {
    if (!this.progressBarEl) return;
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    this.currentProgress = 100;
    this.progressBarEl.classList.add('done');
    this.progressBarEl.style.width = '100%';

    setTimeout(() => {
      if (this.progressBarEl) {
        this.progressBarEl.classList.remove('active', 'done');
        this.progressBarEl.style.width = '0%';
        this.isProgressRunning = false;
        this.currentProgress = 0;
      }
    }, 350);
  }

  /**
   * Belirtilen DOM kokundeki gorseller icin lazy loading iskelet pariltisini yonetir.
   * Gorsel yuklendiginde .is-loaded sinifini ekler ve kapsayicinin .shimmer sinifini kaldirir.
   * @param {HTMLElement|Document} [root=null]
   */
  initLazyImages(root = null) {
    const targetRoot = root || (typeof document !== 'undefined' ? document : null);
    if (!targetRoot || typeof targetRoot.querySelectorAll !== 'function') return;

    const cards = targetRoot.querySelectorAll('.card-cover-wrap, .directory-series-card .card-cover-wrap, .series-card-wrap');
    if (!cards || !cards.length) return;

    cards.forEach((wrap) => {
      const img = wrap.querySelector ? wrap.querySelector('img') : null;
      if (!img) return;

      // Wrap elemanina shimmer yer tutucusu ata
      wrap.classList.add('shimmer');

      const onImageLoaded = () => {
        if (img.classList && img.classList.add) img.classList.add('is-loaded');
        if (wrap.classList && wrap.classList.remove) wrap.classList.remove('shimmer');
      };

      if (img.complete && img.naturalWidth > 0) {
        // Gorsel zaten tarayici onbelleginden yuklenmis
        onImageLoaded();
      } else if (img.addEventListener) {
        img.addEventListener('load', onImageLoaded, { once: true });
        img.addEventListener(
          'error',
          () => {
            // Hata durumunda da shimmer sonsuza kadar donmesin
            if (wrap.classList && wrap.classList.remove) wrap.classList.remove('shimmer');
            if (img.classList && img.classList.add) img.classList.add('is-loaded');
          },
          { once: true }
        );
      }
    });
  }

  /**
   * Iclerdeki hata ayiklama kayitlarini iletir.
   * @param {string} msg
   */
  log(msg) {
    if (typeof ClientLogger !== 'undefined' && ClientLogger.debug) {
      ClientLogger.debug(`[LoaderController] ${msg}`);
    }
  }
}

// Global tarayici ve Node.js disari aktarimlari
if (typeof window !== 'undefined') {
  window.LoaderController = LoaderController;
}
if (typeof globalThis !== 'undefined') {
  globalThis.LoaderController = LoaderController;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoaderController;
}
