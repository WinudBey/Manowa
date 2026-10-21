/**
 * @fileoverview Sadelestirilmis tum seriler kategorik dizin (directory-page.js) modulu birim testleri.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { CatalogController } = require('../src/scripts/catalog-controller');
const { DirectoryPageController } = require('../src/scripts/directory-page');
const { RouterController } = require('../src/scripts/router-controller');
const { PostGenerator } = require('../src/scripts/post-generator');

test('DirectoryPageController: Varsayilan kategori ve durum ile baslatilmali', () => {
  const catalog = new CatalogController();
  const dir = new DirectoryPageController({ catalog });

  assert.equal(dir.selectedGenre, 'ALL');
  assert.equal(dir.selectedStatus, 'ALL');

  const series = dir.getFilteredSeries();
  assert.ok(Array.isArray(series));
  assert.equal(series.length, catalog.seriesList.length);
});

test('DirectoryPageController: Kategori secildiginde yalnizca o kategoriye ait seriler donmeli', () => {
  const catalog = new CatalogController();
  const dir = new DirectoryPageController({ catalog });

  dir.selectedGenre = 'Aksiyon';
  const filtered = dir.getFilteredSeries();

  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((s) => (s.genres || []).some((g) => g.toLowerCase() === 'aksiyon')));
});

test('DirectoryPageController: Durum secildiginde yalnizca o durumdaki seriler donmeli', () => {
  const catalog = new CatalogController();
  const dir = new DirectoryPageController({ catalog });

  dir.selectedStatus = 'Tamamlandı';
  const filtered = dir.getFilteredSeries();

  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((s) => s.status === 'Tamamlandı'));
});

test('DirectoryPageController: renderSeriesCardHtml kart HTML kodunu uretmeli', () => {
  const catalog = new CatalogController();
  const dir = new DirectoryPageController({ catalog });

  const cardHtml = dir.renderSeriesCardHtml(catalog.seriesList[0]);
  assert.ok(cardHtml.includes('directory-series-card'));
  assert.ok(cardHtml.includes(catalog.seriesList[0].title));

  const seoHtml = dir.generateStaticPageHtml();
  assert.ok(seoHtml.includes('manowa-series-directory'));
});

test('PostGenerator: generateDirectoryPageHtml statik sayfa SEO kodunu uretmeli', () => {
  const gen = new PostGenerator();
  const res = gen.generateDirectoryPageHtml();

  assert.ok(res.html.includes('manowa-series-directory'));
  assert.ok(res.labels.includes('Dizin'));
});

test('RouterController: #seriler, ?gorunum=seriler ve /p/seriler.html directory rotasina cozulmeli', () => {
  const catalog = new CatalogController();
  const router = new RouterController();

  const resHash = router.resolveUrlRoute(catalog, 'https://example.blogspot.com/#seriler');
  assert.equal(resHash.view, 'directory');
  assert.equal(resHash.matched, true);

  const resQuery = router.resolveUrlRoute(catalog, 'https://example.blogspot.com/?gorunum=seriler');
  assert.equal(resQuery.view, 'directory');
  assert.equal(resQuery.matched, true);

  const resPath = router.resolveUrlRoute(catalog, 'https://example.blogspot.com/p/seriler.html');
  assert.equal(resPath.view, 'directory');
  assert.equal(resPath.matched, true);

  const targetUrl = router.computeTargetUrl(catalog, 'directory');
  assert.ok(targetUrl.includes('seriler'));
});
