import { createOptimizedPicture } from '../../scripts/aem.js';

/*
 * Line-icon glyphs (IcoMoon-Free font) used by the source strip, in box order:
 * Free Shipping = box, Customer Service = user-profile, Register = cursor.
 * Used only when the authored icon cell is empty or missing.
 */
const GLYPHS = ['box', 'user-profile', 'cursor'];

/**
 * Icon feature boxes: each row is one box with an icon cell and a
 * title + description cell. A single link in the body makes the whole
 * box clickable (the link keeps its own text for accessibility).
 */
export default function decorate(block) {
  const ul = document.createElement('ul');

  [...block.children].forEach((row, index) => {
    const li = document.createElement('li');
    li.className = 'cards-icon-feature-card';
    while (row.firstElementChild) li.append(row.firstElementChild);

    let icon = null;
    [...li.children].forEach((cell) => {
      const hasText = !!cell.textContent.trim();
      if (!hasText && cell.querySelector('picture, img, .icon')) {
        cell.className = 'cards-icon-feature-icon';
        icon = icon || cell;
      } else if (!hasText) {
        cell.remove();
      } else {
        cell.className = 'cards-icon-feature-body';
      }
    });

    // no authored icon: render the source's font glyph for this box position
    if (!icon && GLYPHS[index]) {
      icon = document.createElement('div');
      icon.className = `cards-icon-feature-icon cards-icon-feature-glyph cards-icon-feature-glyph-${GLYPHS[index]}`;
      icon.setAttribute('aria-hidden', 'true');
      li.prepend(icon);
    }

    const body = li.querySelector('.cards-icon-feature-body');
    if (body) {
      // links in the boxes are plain text links, not auto-decorated buttons
      // (decorateButtons turns an authored bold link into a.button.primary)
      body.querySelectorAll('.button-wrapper').forEach((p) => {
        p.classList.remove('button-wrapper');
        p.classList.add('cards-icon-feature-was-button');
      });
      body.querySelectorAll('a.button').forEach((a) => {
        a.classList.remove('button', 'primary', 'secondary', 'accent');
        if (!a.classList.length) a.removeAttribute('class');
      });

      // first heading / bold paragraph (or formerly bold link) becomes the title
      const title = body.querySelector('h1, h2, h3, h4, h5, h6, strong, b, .cards-icon-feature-was-button');
      title?.closest('p, h1, h2, h3, h4, h5, h6')?.classList.add('cards-icon-feature-title');
      body.querySelectorAll('.cards-icon-feature-was-button').forEach((p) => {
        p.classList.remove('cards-icon-feature-was-button');
        if (!p.classList.length) p.removeAttribute('class');
      });

      const links = body.querySelectorAll('a[href]');
      if (links.length === 1) li.classList.add('cards-icon-feature-linked');
    }

    if (li.children.length) ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '200' }]));
  });

  block.replaceChildren(ul);
}
