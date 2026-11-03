/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-icon-feature (zollwebstore.com home "support policy" strip).
 * Source: .support-policy > .col > [a >] .col-icon + .col-text > .support-info > .info-title + span
 * Model: one row per box; cell 1 = icon image (source uses an icon font, so usually empty),
 * cell 2 = bold title (linked when the box is linked) + description paragraph.
 */
export default function parse(element, { document }) {
  const cells = [];

  const root = element.querySelector('.support-policy') || element;
  const cols = [...root.querySelectorAll('.col')].filter((col) => !col.parentElement.closest('.col'));

  cols.forEach((col) => {
    // Icon cell: emit an image only if the source actually has one (icon font otherwise).
    const iconImg = col.querySelector('.col-icon img, .col-icon svg');
    let iconCell = '';
    if (iconImg && iconImg.tagName.toLowerCase() === 'img') {
      const img = document.createElement('img');
      img.src = iconImg.getAttribute('src') || iconImg.src;
      img.alt = iconImg.getAttribute('alt') || '';
      iconCell = img;
    }

    const body = [];
    const link = col.querySelector('a[href]');
    const titleEl = col.querySelector('.info-title');
    const titleText = titleEl ? titleEl.textContent.trim() : '';
    if (titleText) {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      const href = link ? link.getAttribute('href') : '';
      if (href && href.trim() && href.trim() !== '#') {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = titleText;
        strong.append(a);
      } else {
        strong.textContent = titleText;
      }
      p.append(strong);
      body.push(p);
    }

    // html2md unwraps <span> before parsing, so the description may be loose
    // text nodes beside .info-title rather than a span; collect either form.
    const descEl = col.querySelector('.support-info > span') || col.querySelector('.col-text span');
    const info = col.querySelector('.support-info');
    const descNodes = descEl
      ? [...descEl.childNodes]
      : [...(info ? info.childNodes : [])].filter((node) => node !== titleEl);
    if (descNodes.some((node) => node.textContent.trim())) {
      const p = document.createElement('p');
      // keep line breaks (<br>) from the source description
      descNodes.forEach((node) => p.append(node.cloneNode(true)));
      body.push(p);
    }

    if (!body.length && !iconCell) return;
    cells.push([iconCell, body.length ? body : '']);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-icon-feature', cells });
  element.replaceWith(block);
}
