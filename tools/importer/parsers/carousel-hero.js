/* eslint-disable */
/* global WebImporter */

/**
 * Parser for carousel-hero (zollwebstore.com home slider, Slick carousel).
 * Source: .home-slider > .slick-list > .slick-track > .slick-slide > div > .item.alo-item > a > img
 * Model: one row per slide; cell 1 = image wrapped in its link, cell 2 = optional text (empty).
 */
export default function parse(element, { document }) {
  const cells = [];

  // Prefer the stable inner item wrapper; skip any Slick clones that survived cleanup.
  let items = [...element.querySelectorAll('.item.alo-item')];
  if (!items.length) items = [...element.querySelectorAll('.slick-slide')];
  items = items.filter((item) => !item.closest('.slick-cloned'));

  items.forEach((item) => {
    const img = item.querySelector('img');
    if (!img) return;
    const link = item.querySelector('a[href]');

    const image = document.createElement('img');
    image.src = img.getAttribute('src') || img.src;
    image.alt = img.getAttribute('alt') || '';

    let mediaCell = image;
    const href = link ? link.getAttribute('href') : '';
    if (href && href.trim() && href.trim() !== '#') {
      const a = document.createElement('a');
      a.href = href;
      if (link.getAttribute('title')) a.title = link.getAttribute('title');
      a.append(image);
      mediaCell = a;
    }

    // Overlay text is baked into the slide images; keep any real text if present.
    const textCell = [];
    const text = item.textContent.trim();
    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      textCell.push(p);
    }

    cells.push([mediaCell, textCell.length ? textCell : '']);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'carousel-hero', cells });
  element.replaceWith(block);
}
