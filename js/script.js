/* ══════════════════════════════════════════════════════════════════════
   script.js — ванильный JS, без зависимостей.

   1. Появление первого экрана — один раз, после готовности шрифтов.
   2. Шапка: светлая тема за пределами hero + автоскрытие при скролле вниз.
   3. Параллакс фигуры на первом экране.
   4. Появление секций при скролле.
   5. Счёт цифр в блоке фактов.
   6. Заглушка, если файл портрета не найден.

   Всё, что двигается, отключается при prefers-reduced-motion.
   Скролл-обработчики объединены в один rAF-цикл: отдельные слушатели
   на каждую задачу заставляли браузер считать layout по нескольку раз
   за кадр.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  /* Появление первого экрана делает CSS-анимация, скрипт в этом
     больше не участвует: раньше экран ждал от него класс, и при
     любом сбое оставался пустым. */

  /* ── 2. Шапка ───────────────────────────────────────────────────── */
  var head = document.getElementById('head');
  var hero = document.getElementById('top');

  // Светлая подложка за пределами тёмного первого экрана
  if (head && hero && hasIO) {
    var headH = head.offsetHeight || 72;
    new IntersectionObserver(
      function (entries) {
        head.classList.toggle('is-light', !entries[0].isIntersecting);
      },
      { rootMargin: '-' + headH + 'px 0px 0px 0px', threshold: 0 }
    ).observe(hero);
  }

  /* ── 3–5. Единый цикл прокрутки ─────────────────────────────────── */
  var media = document.getElementById('heroMedia');
  var picture = media && media.querySelector('img');   // трансформ живёт на самой картинке

  var lastY = window.pageYOffset;
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset;

    // Шапка прячется при движении вниз, возвращается при движении вверх.
    // Порог в 8px гасит дребезг на тачпадах и инерционном скролле.
    if (head) {
      var delta = y - lastY;
      if (y > 220 && delta > 8) head.classList.add('is-hidden');
      else if (delta < -8 || y < 120) head.classList.remove('is-hidden');
    }

    // Параллакс: фигура отстаёт от страницы примерно на 12%.
    // Считаем только пока первый экран в кадре — дальше это мёртвая работа.
    if (picture && y < window.innerHeight * 1.2) {
      picture.style.setProperty('--py', (y * 0.12).toFixed(1) + 'px');
    }

    lastY = y;
    ticking = false;
  }

  if (!calm) {
    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(onScroll);
      },
      { passive: true }
    );
  }

  /* ── 4. Появление секций ────────────────────────────────────────────
     Элементы внутри одного родителя получают небольшую задержку по
     очереди — движение читается как одно, а не как восемь отдельных. */
  var items = document.querySelectorAll('[data-rv]');

  if (calm || !hasIO) {
    Array.prototype.forEach.call(items, function (el) {
      el.classList.add('is-in');
    });
  } else {
    var groups = new Map();
    Array.prototype.forEach.call(items, function (el) {
      var key = el.parentNode;
      var n = groups.get(key) || 0;
      // Каскад ограничен: после шестого элемента задержка не растёт,
      // иначе низ длинного списка ждёт слишком долго.
      el.style.setProperty('--rd', Math.min(n, 6) * 65 + 'ms');
      groups.set(key, n + 1);
    });

    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          obs.unobserve(e.target); // один раз, без повторов при скролле вверх
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );

    Array.prototype.forEach.call(items, function (el) {
      io.observe(el);
    });
  }

  /* ── 5. Счёт цифр ───────────────────────────────────────────────────
     Числа в блоке фактов набегают от нуля. easeOutExpo: быстрый старт
     и мягкая остановка — иначе счётчик выглядит механическим.       */
  var counters = document.querySelectorAll('[data-count]');

  function runCount(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    var dur = 1100;
    var start = performance.now();

    (function step(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  if (counters.length) {
    if (calm || !hasIO) {
      Array.prototype.forEach.call(counters, function (el) {
        el.textContent = el.getAttribute('data-count');
      });
    } else {
      var cio = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            runCount(e.target);
            obs.unobserve(e.target);
          });
        },
        { threshold: 0.6 }
      );
      Array.prototype.forEach.call(counters, function (el) {
        el.textContent = '0';
        cio.observe(el);
      });
    }
  }

  /* ── 6. Заглушка портрета ───────────────────────────────────────────
     Если файла нет, вместо иконки битой картинки показываем
     размеченный слот.                                                */
  var img = media && media.querySelector('img');

  if (img) {
    var markEmpty = function () {
      media.classList.add('is-empty');
    };
    img.addEventListener('error', markEmpty);
    // Скрипт отложенный: ошибка могла произойти до его выполнения.
    if (img.complete && img.naturalWidth === 0) markEmpty();
  }

  /* ── Бургер ─────────────────────────────────────────────────────────
     Атрибут hidden снимается только при открытии: пока меню закрыто,
     его ссылки не должны попадать в обход с клавиатуры.              */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');

  if (burger && menu) {
    var setMenu = function (open) {
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.hidden = !open;
    };

    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });

    // Клик по пункту — переход к разделу, меню закрывается
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setMenu(false);
    });

    // Escape закрывает и возвращает фокус на кнопку
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        burger.focus();
      }
    });

    // При переходе на десктопную ширину меню закрываем: там своя навигация
    var wide = window.matchMedia('(min-width: 1024px)');
    var onWide = function (m) { if (m.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
  }

  /* ── Год в подвале ──────────────────────────────────────────────── */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
