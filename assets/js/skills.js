(function () {
  'use strict';

  // Skill chips (section VII): an icon and a name; pointing at one, or focusing it, plays a short
  // clip of that skill being run. One card is shared by all chips and its video is loaded on demand.
  var chips = Array.prototype.slice.call(document.querySelectorAll('.skill-chip[data-clip]'));
  if (!chips.length) return;

  var DIR = 'assets/video/skills/hover/';
  var pop = document.createElement('div');
  pop.className = 'skill-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'tooltip');
  pop.id = 'skill-pop';
  var video = document.createElement('video');
  video.muted = true; video.loop = true; video.playsInline = true;
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  video.width = 640; video.height = 360;
  var cap = document.createElement('p');
  pop.appendChild(video); pop.appendChild(cap);
  document.body.appendChild(pop);

  var current = null;

  function place(chip) {
    var r = chip.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight, gap = 10;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    var top = r.top - h - gap;
    if (top < 8) top = r.bottom + gap;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function show(chip) {
    if (current === chip) return;
    current = chip;
    var name = chip.getAttribute('data-clip');
    video.poster = DIR + name + '.jpg';
    video.src = DIR + name + '.mp4';
    cap.textContent = chip.getAttribute('data-cap') || '';
    pop.hidden = false;
    chip.setAttribute('aria-describedby', pop.id);
    place(chip);
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function hide() {
    if (!current) return;
    current.removeAttribute('aria-describedby');
    current = null;
    video.pause();
    video.removeAttribute('src');
    video.load();
    pop.hidden = true;
  }

  chips.forEach(function (chip) {
    chip.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') show(chip); });
    chip.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') hide(); });
    chip.addEventListener('focus', function () { show(chip); });
    chip.addEventListener('blur', hide);
    // touch: a tap opens the clip, a second tap closes it
    chip.addEventListener('click', function (e) {
      e.preventDefault();
      if (current === chip && e.detail && chip.dataset.tapped === '1') { chip.dataset.tapped = ''; hide(); }
      else { chip.dataset.tapped = '1'; show(chip); }
    });
    chip.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  });
  window.addEventListener('scroll', function () { if (current) place(current); }, { passive: true });
  window.addEventListener('resize', hide);
  document.addEventListener('pointerdown', function (e) {
    if (current && !e.target.closest('.skill-chip')) hide();
  });
})();
