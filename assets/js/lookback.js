(function () {
  'use strict';

  // Look spots (section VI): a button over each callout of the staircase figure; pointing at one, or
  // focusing it, shows its pair of frames and their captions enlarged. One card is shared by all.
  var spots = Array.prototype.slice.call(document.querySelectorAll('.look-spot'));
  if (!spots.length) return;

  var pop = document.createElement('div');
  pop.className = 'look-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'tooltip');
  pop.id = 'look-pop';
  document.body.appendChild(pop);

  var current = null;

  // The card goes above the callout, or below it, whichever has the room, so the callout stays in
  // view; where neither has, it is centred on the window.
  function place(spot) {
    var r = spot.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight, gap = 10;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), document.documentElement.clientWidth - w - 8);
    var top = r.top - h - gap;
    if (top < 8) top = r.bottom + gap;
    if (top + h > window.innerHeight - 8) top = Math.max(8, (window.innerHeight - h) / 2);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function show(spot) {
    if (current === spot) return;
    if (current) hide();
    var card = spot.nextElementSibling;
    if (!card || !card.classList.contains('look-card')) return;
    current = spot;
    pop.innerHTML = card.innerHTML;
    Array.prototype.forEach.call(pop.querySelectorAll('img'), function (img) {
      img.removeAttribute('loading');
      img.addEventListener('load', function () { if (current === spot) place(spot); });
    });
    pop.hidden = false;
    spot.classList.add('on');
    spot.setAttribute('aria-describedby', pop.id);
    place(spot);
  }

  function hide() {
    if (!current) return;
    current.classList.remove('on');
    current.removeAttribute('aria-describedby');
    current = null;
    pop.hidden = true;
  }

  spots.forEach(function (spot) {
    spot.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') show(spot); });
    spot.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') hide(); });
    spot.addEventListener('focus', function () { show(spot); });
    spot.addEventListener('blur', hide);
    // touch: a tap opens the card, a second tap closes it
    spot.addEventListener('click', function (e) {
      e.preventDefault();
      if (current === spot && e.detail && spot.dataset.tapped === '1') { spot.dataset.tapped = ''; hide(); }
      else { spot.dataset.tapped = '1'; show(spot); }
    });
    spot.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  });
  window.addEventListener('scroll', function () { if (current) place(current); }, { passive: true });
  window.addEventListener('resize', hide);
  document.addEventListener('pointerdown', function (e) {
    if (current && !e.target.closest('.look-spot')) hide();
  });
})();
