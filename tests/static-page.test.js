/**
 * @fileoverview Blogger Statik Sayfa (/p/*.html) yonlendirme ve gorunum birim testleri.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { RouterController } = require('../src/scripts/router-controller');
const { BloggerThemeBridge } = require('../src/scripts/blogger-theme-bridge');
const { CatalogController } = require('../src/scripts/catalog-controller');
const { AppController } = require('../src/scripts/app-init');

test('RouterController: Blogger statik sayfa URL ve meta durumlarini dogru algilamali', () => {
  const router = new RouterController();
  const catalog = new CatalogController();

  // 1. /p/ altindaki Blogger statik sayfa URL'si
  const res1 = router.resolveUrlRoute(catalog, 'https://manowa-demo.blogspot.com/p/hakkimizda.html');
  assert.equal(res1.matched, true);
  assert.equal(res1.view, 'page');

  // 2. Hash bazli sayfa rotasi
  const res2 = router.resolveUrlRoute(catalog, 'https://manowa-demo.blogspot.com/#sayfa');
  assert.equal(res2.matched, true);
  assert.equal(res2.view, 'page');

  // 3. Sorgu parametresi bazli sayfa rotasi
  const res3 = router.resolveUrlRoute(catalog, 'https://manowa-demo.blogspot.com/?gorunum=sayfa');
  assert.equal(res3.matched, true);
  assert.equal(res3.view, 'page');
});

test('RouterController: Statik sayfa icin computeTargetUrl gecerli sayfa yolunu korumali', () => {
  const mockLocation = {
    protocol: 'https:',
    origin: 'https://manowa-demo.blogspot.com',
    pathname: '/p/gizlilik-politikasi.html',
    search: '',
    hash: ''
  };
  const router = new RouterController({ locationObj: mockLocation });
  const catalog = new CatalogController();

  const targetUrl = router.computeTargetUrl(catalog, 'page');
  assert.equal(targetUrl, '/p/gizlilik-politikasi.html');
});

test('BloggerThemeBridge: renderStaticPage statik icerigi DOM uzerine dogru aktarmali', () => {
  const bridge = new BloggerThemeBridge();

  const titleEl = { textContent: '' };
  const breadcrumbEl = { textContent: '' };
  const bodyEl = { innerHTML: '' };

  const mockPostData = {
    getAttribute(name) {
      if (name === 'data-title') return 'Hakkımızda';
      return null;
    },
    innerHTML: '<p>Manowa mangaseverler topluluğu tanıtım sayfası.</p>'
  };

  const mockRaw = {
    querySelector(sel) {
      if (sel === '.static-post-data') return mockPostData;
      return null;
    },
    innerHTML: '<p>Yedek içerik</p>'
  };

  const mockDoc = {
    title: 'Hakkımızda - Manowa',
    getElementById(id) {
      if (id === 'static-page-title') return titleEl;
      if (id === 'page-breadcrumb-title') return breadcrumbEl;
      if (id === 'static-page-body') return bodyEl;
      if (id === 'blogger-static-page-raw') return mockRaw;
      return null;
    },
    querySelector() {
      return null;
    }
  };

  const info = bridge.renderStaticPage(mockDoc);
  assert.equal(info.title, 'Hakkımızda');
  assert.equal(info.hasContent, true);
  assert.equal(titleEl.textContent, 'Hakkımızda');
  assert.equal(breadcrumbEl.textContent, 'Hakkımızda');
  assert.equal(bodyEl.innerHTML.includes('Manowa mangaseverler topluluğu'), true);
});

test('AppController: Statik sayfa URL sine girildiginde sayfa gorunumunu acmali ve ana sayfaya atmamali', () => {
  const catalog = new CatalogController();
  const historyCalls = [];
  const mockHistory = {
    state: null,
    pushState(state, title, url) {
      this.state = state;
      historyCalls.push({ type: 'push', state, title, url });
    },
    replaceState(state, title, url) {
      this.state = state;
      historyCalls.push({ type: 'replace', state, title, url });
    }
  };
  const mockLocation = {
    protocol: 'https:',
    origin: 'https://manowa-demo.blogspot.com',
    pathname: '/p/kunye.html',
    search: '',
    hash: ''
  };

  const app = new AppController({
    catalog,
    historyObj: mockHistory,
    locationObj: mockLocation
  });

  const routed = app.handleUrlRouting('https://manowa-demo.blogspot.com/p/kunye.html', {
    replaceInitialState: true
  });

  assert.equal(routed, true);
  assert.equal(app.currentView, 'page');
  assert.equal(mockHistory.state.view, 'page');
});
