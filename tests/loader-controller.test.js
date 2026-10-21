/**
 * @fileoverview LoaderController birim testleri (Node.js Test Runner).
 * Ust ilerleme cubugu, tam ekran preloader ve gorsel lazy loading iskeletlerini test eder.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const LoaderController = require('../src/scripts/loader-controller.js');

// Mock DOM ortami
function createMockElement(id = '', className = '') {
  const classes = new Set(className ? className.split(' ') : []);
  return {
    id,
    classList: {
      add: (...cls) => cls.forEach((c) => classes.add(c)),
      remove: (...cls) => cls.forEach((c) => classes.delete(c)),
      contains: (c) => classes.has(c)
    },
    style: {},
    textContent: '',
    children: [],
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

describe('LoaderController Birim Testleri', () => {
  let controller;
  let mockProgressBar;
  let mockPreloader;

  beforeEach(() => {
    mockProgressBar = createMockElement('top-progress-bar');
    mockPreloader = createMockElement('fullscreen-preloader');

    controller = new LoaderController({
      progressBarId: 'top-progress-bar',
      preloaderId: 'fullscreen-preloader',
      initialPreloaderMinDuration: 50
    });

    controller.progressBarEl = mockProgressBar;
    controller.preloaderEl = mockPreloader;
  });

  test('Varsayilan yapilandirma ve durumlar dogru baslatilmali', () => {
    assert.equal(controller.progressBarId, 'top-progress-bar');
    assert.equal(controller.preloaderId, 'fullscreen-preloader');
    assert.equal(controller.currentProgress, 0);
    assert.equal(controller.isProgressRunning, false);
  });

  test('startProgress cubugu aktiflestirmeli ve ilk ilerlemeyi atamali', () => {
    controller.startProgress();

    assert.equal(controller.isProgressRunning, true);
    assert.ok(mockProgressBar.classList.contains('active'));
    assert.equal(mockProgressBar.classList.contains('done'), false);
    assert.equal(mockProgressBar.style.width, '15%');

    // Temizle
    if (controller.progressTimer) clearInterval(controller.progressTimer);
  });

  test('setProgress belirtilen yuzdeyi sinirlar icinde atamali', () => {
    controller.setProgress(45);
    assert.equal(controller.currentProgress, 45);
    assert.equal(mockProgressBar.style.width, '45%');

    controller.setProgress(150);
    assert.equal(controller.currentProgress, 100);
    assert.equal(mockProgressBar.style.width, '100%');

    controller.setProgress(-10);
    assert.equal(controller.currentProgress, 0);
    assert.equal(mockProgressBar.style.width, '0%');
  });

  test('finishProgress cubugu 100% yapmali ve done sinifini eklemeli', async () => {
    controller.startProgress();
    controller.finishProgress();

    assert.equal(controller.currentProgress, 100);
    assert.equal(mockProgressBar.style.width, '100%');
    assert.ok(mockProgressBar.classList.contains('done'));

    // 350ms sonrasinda sifirlanmali
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(mockProgressBar.classList.contains('active'), false);
    assert.equal(mockProgressBar.classList.contains('done'), false);
    assert.equal(mockProgressBar.style.width, '0%');
  });

  test('showPreloader ve hidePreloader tam ekran preloader durumunu yonetmeli', () => {
    controller.showPreloader('Test yükleniyor...');
    assert.equal(mockPreloader.classList.contains('hidden'), false);
    assert.equal(mockPreloader.style.display, 'flex');

    controller.hidePreloader();
    assert.ok(mockPreloader.classList.contains('hidden'));
  });

  test('initLazyImages wrap elemanlarina shimmer eklemeli ve yuklenen gorselleri acmali', () => {
    const wrap = createMockElement('', 'card-cover-wrap');
    let loadedClassAdded = false;

    const mockImg = {
      complete: true,
      naturalWidth: 400,
      classList: {
        add: (c) => {
          if (c === 'is-loaded') loadedClassAdded = true;
        }
      },
      addEventListener: () => {}
    };

    wrap.querySelector = (sel) => (sel === 'img' ? mockImg : null);

    const mockRoot = {
      querySelectorAll: (sel) => [wrap]
    };

    controller.initLazyImages(mockRoot);

    assert.equal(loadedClassAdded, true, 'Onbellegi hazir gorsel is-loaded almali');
    assert.equal(wrap.classList.contains('shimmer'), false, 'Yuklenen gorselde shimmer kaldirilmali');
  });
});
