/**
 * @fileoverview Faz 2 birim testleri: BloggerFeedLoader, CatalogController ve DisqusLoader dogrulamasi.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { BloggerFeedLoader } = require('../src/scripts/blogger-feed-loader');
const { CatalogController } = require('../src/scripts/catalog-controller');
const { DisqusLoader } = require('../src/scripts/disqus-loader');

const SAMPLE_BLOGGER_FEED = {
  feed: {
    entry: [
      {
        id: { $t: 'post-1' },
        title: { $t: 'Kuzeyin Kılıcı' },
        published: { $t: '2026-09-26T08:28:25.353-07:00' },
        category: [
          { term: 'Manga' },
          { term: 'Orta Çağ' },
          { term: 'Seri' },
          { term: 'Tamamlandı' },
          { term: 'Kuzeyin Kılıcı' }
        ],
        link: [{ rel: 'alternate', href: 'https://example.blogspot.com/2026/09/kuzeyin-kilici.html' }],
        content: {
          $t: `<img src="https://example.com/kuzey-cover.png" alt="Seri Adı" />
               [Slug: Kuzeyin Kılıcı]
               <div id="actual-series-tag" style="display:none;">Kuzeyin Kılıcı</div>
               <div class="modern-synopsis"><div class="synopsis-content"><p>Kuzeyin Kılıcı özet metni.</p></div></div>`
        }
      },
      {
        id: { $t: 'post-2' },
        title: { $t: 'Kuzeyin Kılıcı Bölüm 1' },
        published: { $t: '2026-09-29T09:03:32.205-07:00' },
        category: [{ term: 'Bölüm' }, { term: 'Kuzeyin Kılıcı' }],
        link: [{ rel: 'alternate', href: 'https://example.blogspot.com/2026/09/kuzeyin-kilici-bolum-1.html' }],
        content: {
          $t: `<div class="separator"><img src="https://example.com/k1.webp"></div>
               <div class="separator"><img src="https://example.com/k2.webp"></div>`
        }
      },
      {
        id: { $t: 'post-3' },
        title: { $t: "Omniscient Reader's Viewpoint Novel" },
        published: { $t: '2026-09-26T08:31:43.871-07:00' },
        category: [
          { term: 'Askıda' },
          { term: 'Geri Dönüş' },
          { term: 'Novel' },
          { term: "Omniscient Reader's Viewpoint Novel" },
          { term: 'Seri' }
        ],
        link: [{ rel: 'alternate', href: 'https://example.blogspot.com/2026/09/omniscient-readers-viewpoint-novel.html' }],
        content: {
          $t: `<div id="actual-series-tag" style="display:none;">Omniscient Reader's Viewpoint Novel</div>
               <img src="https://example.com/orv.jpg" />
               <div class="synopsis-box"><h3>Özet</h3><p>ORV roman özeti.</p></div>`
        }
      },
      {
        id: { $t: 'post-4' },
        title: { $t: "Omniscient Reader's Viewpoint Novel Bölüm 3" },
        published: { $t: '2026-09-26T09:05:51.646-07:00' },
        category: [{ term: 'Bölüm' }, { term: "Omniscient Reader's Viewpoint Novel" }],
        link: [{ rel: 'alternate', href: 'https://example.blogspot.com/2026/09/omniscient-readers-viewpoint-novel-bolum-3.html' }],
        content: {
          $t: `<div class="orv_title"><h1>Ch 3: Ep. 1</h1></div><p class="orv_line">Dokkaebi appeared in the subway train.</p>`
        }
      },
      {
        id: { $t: 'post-5' },
        title: { $t: "Omniscient Reader's Viewpoint Novel Bölüm 2" },
        published: { $t: '2026-09-26T09:02:00.000-07:00' },
        category: [{ term: 'Bölüm' }, { term: "Omniscient Reader's Viewpoint Novel" }],
        link: [{ rel: 'alternate', href: 'https://example.blogspot.com/2026/09/omniscient-readers-viewpoint-novel-bolum-2.html' }],
        content: {
          $t: `<p><img src="https://orv.pages.dev/assets/images/Cover.jpg" /></p><div class="orv_title"><h1>Ch 2: Ep. 1</h1></div><p class="orv_line">"I'm Dokja."</p>`
        }
      }
    ]
  }
};

test('BloggerFeedLoader: Gercek Blogger JSON verisini Seri ve Bolum nesnelerine ayristirmali', () => {
  const loader = new BloggerFeedLoader();
  const seriesList = loader.parseBloggerFeedJson(SAMPLE_BLOGGER_FEED);

  assert.equal(seriesList.length, 2);

  const kuzey = seriesList.find((s) => s.id === 'kuzeyin-kilici');
  assert.ok(kuzey);
  assert.equal(kuzey.type, 'Manga');
  assert.equal(kuzey.sourceLang, 'JP');
  assert.equal(kuzey.status, 'Tamamlandı');
  assert.equal(kuzey.cover, 'https://example.com/kuzey-cover.png');
  assert.equal(kuzey.synopsis, 'Kuzeyin Kılıcı özet metni.');
  assert.equal(kuzey.chapters.length, 1);
  assert.equal(kuzey.chapters[0].number, 1);
  assert.equal(kuzey.chapters[0].pages.length, 2);

  const orv = seriesList.find((s) => s.id === 'omniscient-reader-s-viewpoint-novel');
  assert.ok(orv);
  assert.equal(orv.type, 'Novel');
  assert.equal(orv.status, 'Askıda');
  assert.equal(orv.chapters.length, 2);
  const ch2 = orv.chapters.find((c) => c.number === 2);
  assert.ok(ch2);
  assert.equal(ch2.isNovel, true, 'Icinde kapak resmi olan Novel bolumu de isNovel=true olmali');
  assert.equal(ch2.htmlContent.includes('Dokja'), true);
});

test('CatalogController: Dinamik seri listesini filtrelemeli ve aramali', () => {
  const loader = new BloggerFeedLoader();
  const dynamicSeries = loader.parseBloggerFeedJson(SAMPLE_BLOGGER_FEED);
  const catalog = new CatalogController();

  catalog.setSeriesList(dynamicSeries);
  assert.equal(catalog.getFilteredSeries().length, 2);

  // Tur filtresi: Manga
  const mangaOnly = catalog.setLanguageFilter('Manga');
  assert.equal(mangaOnly.length, 1);
  assert.equal(mangaOnly[0].id, 'kuzeyin-kilici');

  // Tur filtresi: Novel
  const novelOnly = catalog.setLanguageFilter('Novel');
  assert.equal(novelOnly.length, 1);
  assert.equal(novelOnly[0].id, 'omniscient-reader-s-viewpoint-novel');

  // Tumu ve arama
  catalog.setLanguageFilter('ALL');
  const searched = catalog.setSearchQuery('orta çağ');
  assert.equal(searched.length, 1);
  assert.equal(searched[0].id, 'kuzeyin-kilici');

  // Siralama kontrolu (A-Z ve Bolum Sayisi)
  catalog.setSearchQuery('');
  const sortedTitle = catalog.setSortOrder('title_asc');
  assert.equal(sortedTitle[0].id, 'kuzeyin-kilici');

  const sortedChapters = catalog.setSortOrder('chapters_desc');
  assert.equal(sortedChapters[0].id, 'omniscient-reader-s-viewpoint-novel');
  assert.equal(sortedChapters[0].chapters.length, 2);
});

test('DisqusLoader: Varsayilan olarak anonim baslamali ve shortname atandiginda konu yuklemeli', () => {
  const defaultDisqus = new DisqusLoader();
  assert.equal(defaultDisqus.shortname, '');
  assert.equal(defaultDisqus.isValidShortname(), false);

  const configuredDisqus = new DisqusLoader({ shortname: 'ornek-forum' });
  assert.equal(configuredDisqus.shortname, 'ornek-forum');
  assert.equal(configuredDisqus.isValidShortname(), true);
  assert.equal(configuredDisqus.getEmbedScriptUrl(), 'https://ornek-forum.disqus.com/embed.js');

  const statusMock = { innerHTML: '', textContent: '' };
  const loadedWithoutShortname = defaultDisqus.loadThread(
    { identifier: 'series-kuzey', title: 'Kuzeyin Kılıcı' },
    statusMock
  );
  assert.equal(loadedWithoutShortname, false);
  assert.equal(statusMock.innerHTML.includes('series-kuzey'), true);
});
