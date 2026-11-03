import { createOptimizedPicture } from '../../scripts/aem.js';
import { fetchPlaceholders } from '../../scripts/commerce.js';

// placeholder key for the localized "Carousel" role description
const ROLE_PLACEHOLDER = 'carousel';

// source slider (slick) settings: speed 300ms, cssEase "ease"
const SLIDE_DURATION = 300;
// a drag/swipe longer than 1/5 of the viewport width changes page (slick touchThreshold: 5)
const SWIPE_THRESHOLD = 5;
// pointer travel (px) after which a press becomes a drag and link clicks are suppressed
const DRAG_START = 5;

/**
 * CSS cubic-bezier timing function solver.
 * @returns {function(number): number} progress (0..1) -> eased value
 */
function cubicBezier(x1, y1, x2, y2) {
  const coord = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 20; i += 1) {
      const cx = coord(t, x1, x2);
      if (Math.abs(cx - x) < 1e-4) break;
      if (cx < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return coord(t, y1, y2);
  };
}

// CSS "ease"
const ease = cubicBezier(0.25, 0.1, 0.25, 1);

/**
 * Builds one product card from an authored row:
 * cell 1 = product image, cell 2 = linked product name + optional
 * item number / price paragraphs. Cells may be missing or swapped.
 */
function buildCard(row) {
  const li = document.createElement('li');
  li.className = 'cards-product-slider-card';
  while (row.firstElementChild) li.append(row.firstElementChild);

  [...li.children].forEach((cell) => {
    const onlyMedia = cell.querySelector('picture, img') && !cell.textContent.trim();
    cell.className = onlyMedia ? 'cards-product-slider-card-image' : 'cards-product-slider-card-body';
    if (!cell.children.length && !cell.textContent.trim()) cell.remove();
  });

  // product names are plain links, not auto-decorated buttons;
  // remember italic (secondary) links before their button classes are removed
  const secondary = new Set(li.querySelectorAll('em a, a.button.secondary'));
  li.querySelectorAll('a.button').forEach((a) => {
    a.classList.remove('button', 'primary', 'secondary', 'accent');
    if (!a.classList.length) a.removeAttribute('class');
    a.closest('.button-wrapper')?.classList.remove('button-wrapper');
  });

  const body = li.querySelector('.cards-product-slider-card-body');
  const image = li.querySelector('.cards-product-slider-card-image');
  const link = body?.querySelector('a[href]');

  if (body) {
    const titleEl = link?.closest('p, h1, h2, h3, h4, h5, h6') || body.firstElementChild;
    titleEl?.classList.add('cards-product-slider-card-title');
    if (link) link.title = link.title || link.textContent.trim();
    const actions = [];
    [...body.children].forEach((p) => {
      if (p === titleEl) return;
      const only = p.querySelector('a[href]');
      // a paragraph holding just one link after the title is a store action
      // (bold link = primary, e.g. add to cart; italic link = secondary, e.g. favorites)
      if (only && p.textContent.trim() === only.textContent.trim()) {
        only.classList.add('cards-product-slider-action', secondary.has(only) ? 'secondary' : 'primary');
        actions.push(only);
        p.remove();
      } else if (/item\s*(number|no|#)/i.test(p.textContent)) p.classList.add('cards-product-slider-card-sku');
      else if (/[$€£]\s*\d|\d+[.,]\d{2}/.test(p.textContent)) p.classList.add('cards-product-slider-card-price');
    });
    if (actions.length) {
      const wrap = document.createElement('div');
      wrap.className = 'cards-product-slider-card-actions';
      wrap.append(...actions);
      body.append(wrap);
      li.classList.add('has-actions');
    }
  }

  // make the image link to the product page as well
  if (image && link && !image.querySelector('a')) {
    const picture = image.querySelector('picture') || image.querySelector('img');
    if (picture) {
      const a = document.createElement('a');
      a.href = link.href;
      a.tabIndex = -1;
      a.setAttribute('aria-hidden', 'true');
      picture.replaceWith(a);
      a.append(picture);
    }
  }
  image?.querySelectorAll('a').forEach((a) => {
    if (!a.title) a.removeAttribute('title');
  });

  // image first, body second regardless of authoring order
  if (image && body && li.firstElementChild !== image) li.prepend(image);
  return li;
}

export default async function decorate(block) {
  const placeholders = await fetchPlaceholders();

  const track = document.createElement('ul');
  track.className = 'cards-product-slider-track';
  [...block.children].forEach((row) => {
    const card = buildCard(row);
    if (card.children.length) track.append(card);
  });

  track.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '500' }]));
  });
  track.querySelectorAll('img').forEach((img) => { img.draggable = false; });

  const viewport = document.createElement('div');
  viewport.className = 'cards-product-slider-viewport';
  viewport.append(track);

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'cards-product-slider-prev';
  prev.setAttribute('aria-label', placeholders.previousSlide || 'Previous products');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'cards-product-slider-next';
  next.setAttribute('aria-label', placeholders.nextSlide || 'Next products');

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', placeholders[ROLE_PLACEHOLDER] || 'Carousel');
  block.replaceChildren(prev, viewport, next);

  const cards = [...track.children];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let visible = 1;
  let frame = 0;

  const getVisible = () => Math.max(1, parseInt(
    getComputedStyle(block).getPropertyValue('--cards-product-slider-visible'),
    10,
  ) || 1);
  const maxIndex = () => Math.max(0, cards.length - visible);
  const offsetOf = (i) => (cards[i] ? cards[i].offsetLeft - cards[0].offsetLeft : 0);

  function updateControls() {
    const max = maxIndex();
    prev.disabled = index <= 0;
    next.disabled = index >= max;
    block.classList.toggle('cards-product-slider-static', max === 0);
  }

  function animateTo(target) {
    cancelAnimationFrame(frame);
    const from = track.scrollLeft;
    const distance = target - from;
    if (!distance || reduceMotion.matches) {
      track.scrollLeft = target;
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - start) / SLIDE_DURATION);
      track.scrollLeft = from + distance * ease(progress);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  function goTo(i, animate = true) {
    index = Math.min(Math.max(0, i), maxIndex());
    if (animate) animateTo(offsetOf(index));
    else {
      cancelAnimationFrame(frame);
      track.scrollLeft = offsetOf(index);
    }
    updateControls();
  }

  prev.addEventListener('click', () => goTo(index - visible));
  next.addEventListener('click', () => goTo(index + visible));

  // keep state in sync when the browser scrolls the track itself (e.g. focusing a hidden card)
  track.addEventListener('focusin', (e) => {
    const card = e.target.closest('.cards-product-slider-card');
    const i = cards.indexOf(card);
    if (i >= 0 && (i < index || i >= index + visible)) goTo(i < index ? i : i - visible + 1);
  });

  // mouse drag / touch swipe, slick-style: follow the pointer, then settle on a page
  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || maxIndex() === 0) return;
    cancelAnimationFrame(frame);
    drag = {
      id: e.pointerId, x: e.clientX, y: e.clientY, left: track.scrollLeft, moved: false,
    };
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(e.clientY - drag.y)) return;
      drag.moved = true;
      track.setPointerCapture(e.pointerId);
      block.classList.add('cards-product-slider-dragging');
    }
    track.scrollLeft = drag.left - dx;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, x } = drag;
    drag = null;
    block.classList.remove('cards-product-slider-dragging');
    if (!moved) return;
    const dx = e.clientX - x;
    const threshold = track.clientWidth / SWIPE_THRESHOLD;
    if (e.type !== 'pointercancel' && Math.abs(dx) >= threshold) goTo(index + (dx < 0 ? visible : -visible));
    else goTo(index);
    // swallow the click that follows a drag so links are not followed
    const swallow = (ce) => {
      ce.preventDefault();
      ce.stopPropagation();
    };
    track.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => track.removeEventListener('click', swallow, { capture: true }), 0);
  };
  // native link/image drag would cancel the pointer stream
  track.addEventListener('dragstart', (e) => e.preventDefault());
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  function layout() {
    visible = getVisible();
    if (!drag) goTo(index, false);
  }

  new ResizeObserver(layout).observe(track);
  layout();
}
