import { createOptimizedPicture } from '../../scripts/aem.js';
import { fetchPlaceholders } from '../../scripts/commerce.js';

// placeholder key for the localized "Carousel" role description
const ROLE_PLACEHOLDER = 'carousel';

// timings measured on the source slick slider (autoplaySpeed / speed / cssEase)
const AUTOPLAY_SPEED = 6000;
const TRANSITION_SPEED = 400;
const TRANSITION_EASE = 'ease';
// slick touchThreshold: a swipe must cover 1/5 of the slider width
const SWIPE_THRESHOLD = 5;

function optimizeImages(root) {
  root.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, true, [{ width: '2000' }]));
  });
}

function updateActiveSlide(block, slideIndex) {
  block.dataset.activeSlide = slideIndex;
  block.querySelectorAll('.carousel-hero-slide:not(.carousel-hero-slide-clone)').forEach((slide, idx) => {
    const active = idx === slideIndex;
    slide.setAttribute('aria-hidden', !active);
    slide.querySelectorAll('a').forEach((link) => {
      if (active) link.removeAttribute('tabindex');
      else link.setAttribute('tabindex', '-1');
    });
  });
  block.querySelectorAll('.carousel-hero-indicator').forEach((indicator, idx) => {
    const button = indicator.querySelector('button');
    indicator.classList.toggle('active', idx === slideIndex);
    if (idx === slideIndex) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}

/**
 * Builds one slide from an authored row. The first cell holds the image;
 * a link in any cell (wrapping the image or standing alone) becomes the
 * slide target. Optional text in further cells is kept as slide content.
 */
function createSlide(row, idx, blockId) {
  const slide = document.createElement('li');
  slide.className = 'carousel-hero-slide';
  slide.dataset.slideIndex = idx;
  slide.id = `carousel-hero-${blockId}-slide-${idx}`;

  const cells = [...row.children];
  const picture = row.querySelector('picture');
  const link = row.querySelector('a[href]');

  const media = document.createElement('div');
  media.className = 'carousel-hero-slide-image';
  if (picture) {
    if (link && !link.contains(picture)) {
      const a = document.createElement('a');
      a.href = link.href;
      if (link.title) a.title = link.title;
      a.setAttribute('aria-label', link.textContent.trim() || picture.querySelector('img')?.alt || '');
      a.append(picture);
      media.append(a);
      // drop the now-redundant text link (and its empty paragraph)
      const p = link.closest('p');
      link.remove();
      if (p && !p.textContent.trim() && !p.children.length) p.remove();
    } else {
      media.append(link && link.contains(picture) ? link : picture);
    }
  }
  slide.append(media);

  const content = document.createElement('div');
  content.className = 'carousel-hero-slide-content';
  cells.forEach((cell) => {
    while (cell.firstChild) content.append(cell.firstChild);
  });
  [...content.children].forEach((child) => {
    if (!child.textContent.trim() && !child.querySelector('img, picture')) child.remove();
  });
  if (content.children.length) slide.append(content);

  return slide;
}

/** Non-interactive copy used at either end of the track for the infinite loop. */
function cloneSlide(slide) {
  const clone = slide.cloneNode(true);
  clone.classList.add('carousel-hero-slide-clone');
  clone.removeAttribute('id');
  clone.removeAttribute('data-slide-index');
  clone.setAttribute('aria-hidden', 'true');
  clone.inert = true;
  clone.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
  return clone;
}

/**
 * Slick-style slider: the track is translated one slide at a time with a
 * 400ms ease transition, wraps forward/backward through cloned end slides,
 * autoplays every 6s after the previous transition, pauses while the slides
 * are hovered or anything inside the block has focus, and supports swipe/drag.
 */
function initSlider(block, track, count) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const speed = reducedMotion ? 0 : TRANSITION_SPEED;
  const autoplay = !reducedMotion;

  track.prepend(cloneSlide(track.children[count - 1]));
  track.append(cloneSlide(track.children[1]));

  // track positions: 0 = clone of last, 1..count = real slides, count + 1 = clone of first
  let position = 1;
  let animating = false;
  let hovered = false;
  let focused = false;
  let autoplayTimer;
  let drag = null;
  let suppressClick = false;

  const realIndex = (pos) => (pos - 1 + count) % count;

  const setTransform = (pos, offset = 0, animate = false) => {
    track.style.transition = animate && speed ? `transform ${speed}ms ${TRANSITION_EASE}` : 'none';
    track.style.transform = offset
      ? `translate3d(calc(${-pos * 100}% + ${offset}px), 0, 0)`
      : `translate3d(${-pos * 100}%, 0, 0)`;
  };

  const stopAutoplay = () => clearTimeout(autoplayTimer);

  let slideTo;
  const scheduleAutoplay = () => {
    stopAutoplay();
    if (!autoplay || animating || hovered || focused || document.hidden) return;
    autoplayTimer = setTimeout(() => slideTo(position + 1), AUTOPLAY_SPEED);
  };

  const finishSlide = () => {
    animating = false;
    if (position === 0) position = count;
    if (position === count + 1) position = 1;
    setTransform(position);
    scheduleAutoplay();
  };

  slideTo = (pos) => {
    if (animating) return; // slick waitForAnimate
    stopAutoplay();
    animating = true;
    position = pos;
    updateActiveSlide(block, realIndex(pos));
    setTransform(pos, 0, true);
    setTimeout(finishSlide, speed);
  };

  setTransform(position);

  block.querySelectorAll('.carousel-hero-indicator button').forEach((button, idx) => {
    button.addEventListener('click', () => {
      if (idx !== realIndex(position)) slideTo(idx + 1);
    });
  });

  // pause on hover over the slides only (dots hover does not pause, as on the source)
  track.addEventListener('mouseenter', () => { hovered = true; stopAutoplay(); });
  track.addEventListener('mouseleave', () => { hovered = false; scheduleAutoplay(); });
  // pause while anything inside the block has focus (including a clicked dot)
  block.addEventListener('focusin', () => { focused = true; stopAutoplay(); });
  block.addEventListener('focusout', (e) => {
    if (block.contains(e.relatedTarget)) return;
    focused = false;
    scheduleAutoplay();
  });
  document.addEventListener('visibilitychange', scheduleAutoplay);

  // swipe / mouse drag
  track.addEventListener('dragstart', (e) => e.preventDefault());
  track.addEventListener('pointerdown', (e) => {
    suppressClick = false;
    if (animating || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = {
      id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, moved: false,
    };
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(drag.dx) < 4 || Math.abs(drag.dx) < Math.abs(e.clientY - drag.y)) return;
      drag.moved = true;
      track.setPointerCapture(e.pointerId);
      stopAutoplay();
    }
    setTransform(position, drag.dx);
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dx, moved } = drag;
    drag = null;
    if (!moved) return;
    suppressClick = true;
    const threshold = track.offsetWidth / SWIPE_THRESHOLD;
    if (dx <= -threshold) slideTo(position + 1);
    else if (dx >= threshold) slideTo(position - 1);
    else slideTo(position);
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('click', (e) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  scheduleAutoplay();
}

let blockCount = 0;
export default async function decorate(block) {
  blockCount += 1;
  const blockId = blockCount;
  const rows = [...block.children].filter((row) => row.querySelector('picture, img') || row.textContent.trim());
  const placeholders = await fetchPlaceholders();

  block.id = `carousel-hero-${blockId}`;
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', placeholders[ROLE_PLACEHOLDER] || 'Carousel');

  const container = document.createElement('div');
  container.className = 'carousel-hero-slides-container';
  const slidesList = document.createElement('ul');
  slidesList.className = 'carousel-hero-slides';
  container.append(slidesList);

  let indicators;
  if (rows.length > 1) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', placeholders.carouselSlideControls || 'Carousel Slide Controls');
    indicators = document.createElement('ol');
    indicators.className = 'carousel-hero-indicators';
    nav.append(indicators);
    container.append(nav);
  }

  rows.forEach((row, idx) => {
    slidesList.append(createSlide(row, idx, blockId));
    if (indicators) {
      const li = document.createElement('li');
      li.className = 'carousel-hero-indicator';
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `${placeholders.showSlide || 'Show Slide'} ${idx + 1} ${placeholders.of || 'of'} ${rows.length}`);
      button.setAttribute('aria-controls', `carousel-hero-${blockId}-slide-${idx}`);
      li.append(button);
      indicators.append(li);
    }
  });

  optimizeImages(slidesList);
  block.replaceChildren(container);
  updateActiveSlide(block, 0);

  if (rows.length > 1) initSlider(block, slidesList, rows.length);
}
