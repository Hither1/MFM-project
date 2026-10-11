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

  // Highlight the section in view, in the top bar and in the contents rail
  var navAnchors = Array.prototype.slice.call(document.querySelectorAll('.nav-links a, .toc a'));
  if ('IntersectionObserver' in window && navAnchors.length) {
    var byId = {};
    navAnchors.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      (byId[id] = byId[id] || []).push(a);
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navAnchors.forEach(function (a) { a.classList.remove('active'); a.removeAttribute('aria-current'); });
        (byId[entry.target.id] || []).forEach(function (a) {
          a.classList.add('active');
          if (a.closest('.toc')) a.setAttribute('aria-current', 'location');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  // Opening video: plays muted on a loop while on screen, with a button to stop it.
  // Visitors who ask for reduced motion get the poster until they press Play.
  var hero = document.querySelector('.hero');
  var heroVideo = document.getElementById('hero-video');
  var pauseBtn = document.querySelector('.hero-pause');
  var topbar = document.querySelector('.topbar-overlay');
  if (hero && heroVideo && pauseBtn) {
    var stopped = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var onScreen = true;
    var sync = function () {
      pauseBtn.textContent = stopped ? 'Play' : 'Pause';
      pauseBtn.setAttribute('aria-pressed', String(stopped));
      pauseBtn.setAttribute('aria-label', (stopped ? 'Play' : 'Pause') + ' the video');
      if (stopped || !onScreen) { heroVideo.pause(); return; }
      var playing = heroVideo.play();
      if (playing && playing.catch) playing.catch(function () {});
    };
    pauseBtn.hidden = false;
    pauseBtn.addEventListener('click', function () { stopped = !stopped; sync(); });
    // a milestone pressed while stopped plays from there
    heroVideo.addEventListener('play', function () { if (stopped) { stopped = false; sync(); } });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        sync();
      }).observe(heroVideo);
    }
    sync();
  }
  // Milestones beside a video (.ms, naming the video in data-video): each one with data-t is lit
  // once the video passes that second, the latest of them is marked, and pressing one jumps the
  // video to just before it and plays. .ms-count shows how many are lit, .ms-now the latest's name.
  Array.prototype.forEach.call(document.querySelectorAll('.ms[data-video]'), function (rail) {
    var video = document.getElementById(rail.dataset.video);
    var marks = Array.prototype.slice.call(rail.querySelectorAll('[data-t]'));
    var count = rail.querySelector('.ms-count'), latest = rail.querySelector('.ms-now');
    if (!video || !marks.length) return;
    var mark = function () {
      var t = video.currentTime, last = null, n = 0;
      marks.forEach(function (b) {
        var done = Number(b.dataset.t) <= t;
        b.classList.toggle('done', done);
        if (!done) return;
        n++;
        if (!last || Number(b.dataset.t) >= Number(last.dataset.t)) last = b;
      });
      marks.forEach(function (b) { b.classList.toggle('now', b === last); });
      if (count) count.textContent = n;
      if (latest) latest.textContent = last ? 'latest: ' + last.dataset.name : '';
    };
    marks.forEach(function (b) {
      b.addEventListener('click', function () {
        video.currentTime = Math.max(0, Number(b.dataset.t) - 0.4);
        var playing = video.play();
        if (playing && playing.catch) playing.catch(function () {});
      });
    });
    video.addEventListener('timeupdate', mark);
    video.addEventListener('seeked', mark);
    mark();
  });

  if (hero && topbar && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      topbar.classList.toggle('at-top', entries[0].isIntersecting);
    }, { rootMargin: '-' + topbar.offsetHeight + 'px 0px 0px 0px' }).observe(hero);
  }

  // The memory figure: each operation button lights the parts it lists in data-parts and shows its
  // paragraph; pressing it again shows the whole figure.
  var mfig = document.getElementById('mfig');
  if (mfig) {
    var ops = Array.prototype.slice.call(mfig.querySelectorAll('.mfig-steps button'));
    var parts = Array.prototype.slice.call(mfig.querySelectorAll('[data-part]'));
    var texts = Array.prototype.slice.call(mfig.querySelectorAll('.mfig-text [data-op]'));
    var show = function (op) {
      var on = op ? op.dataset.parts.split(' ') : [];
      ops.forEach(function (b) { b.setAttribute('aria-pressed', String(b === op)); });
      parts.forEach(function (el) { el.classList.toggle('on', on.indexOf(el.dataset.part) >= 0); });
      mfig.classList.toggle('focus', !!op);
      texts.forEach(function (p) { p.hidden = p.dataset.op !== (op ? op.dataset.op : ''); });
    };
    ops.forEach(function (b) {
      b.addEventListener('click', function () { show(b.getAttribute('aria-pressed') === 'true' ? null : b); });
    });
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
