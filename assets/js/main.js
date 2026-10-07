(function () {
  'use strict';

  // Mobile navigation
  var toggle = document.querySelector('.nav-toggle');
  var links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Highlight the section in view
  var navAnchors = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  if ('IntersectionObserver' in window && navAnchors.length) {
    var byId = {};
    navAnchors.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navAnchors.forEach(function (a) { a.classList.remove('active'); });
        var a = byId[entry.target.id];
        if (a) a.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  // Opening video: plays muted on a loop while on screen, with a button to stop it.
  // Visitors who ask for reduced motion get the poster until they press Play.
  var hero = document.querySelector('.hero-video');
  var heroVideo = document.getElementById('hero-video');
  var pauseBtn = document.querySelector('.hero-pause');
  var topbar = document.querySelector('.topbar-overlay');
  if (hero && heroVideo && pauseBtn) {
    var stopped = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var onScreen = true;
    var sync = function () {
      pauseBtn.textContent = stopped ? 'Play' : 'Pause';
      pauseBtn.setAttribute('aria-pressed', String(stopped));
      pauseBtn.setAttribute('aria-label', (stopped ? 'Play' : 'Pause') + ' the background video');
      if (stopped || !onScreen) { heroVideo.pause(); return; }
      var playing = heroVideo.play();
      if (playing && playing.catch) playing.catch(function () {});
    };
    pauseBtn.hidden = false;
    pauseBtn.addEventListener('click', function () { stopped = !stopped; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        sync();
      }).observe(hero);
    }
    sync();
  }
  if (hero && topbar && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      topbar.classList.toggle('at-top', entries[0].isIntersecting);
    }, { rootMargin: '-' + topbar.offsetHeight + 'px 0px 0px 0px' }).observe(hero);
  }

  // Figure lightbox
  var box = document.getElementById('lightbox');
  if (!box) return;
  var boxImg = box.querySelector('img');
  var lastFocus = null;

  function open(img) {
    lastFocus = document.activeElement;
    boxImg.src = img.currentSrc || img.src;
    boxImg.alt = img.alt;
    boxImg.className = img.classList.contains('pixel') ? 'pixel' : '';
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    box.querySelector('.lightbox-close').focus();
  }

  function close() {
    box.hidden = true;
    boxImg.removeAttribute('src');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.fig img'), function (img) {
    img.tabIndex = 0;
    img.addEventListener('click', function () { open(img); });
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); }
    });
  });

  box.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !box.hidden) close();
  });
})();
