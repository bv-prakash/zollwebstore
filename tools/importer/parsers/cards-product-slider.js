/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-product-slider (zollwebstore.com Bestseller + Featured product sliders).
 * Source (both instances): .slider-products-grid .slick-slide li.product-item > .product-item-info >
 *   a.product-item-photo > img  +  .product-item-details > strong.product-item-name > a.product-item-link
 *   + p.sku ("Item Number: ...")
 * Bestseller uses <ol>, Featured uses <ul> and an extra class/title on the photo link; actions
 * markup differs; both become authored button links (cart = strong, favorites = em).
 * Model: one row per product; cell 1 = linked product image, cell 2 = linked product name (strong)
 * + optional "Item Number" / price paragraphs + cart and favorites button links.
 */
export default function parse(element, { document }) {
  const cells = [];

  let items = [...element.querySelectorAll('li.product-item')];
  if (!items.length) items = [...element.querySelectorAll('.product-item-info')];
  items = items.filter((item) => !item.closest('.slick-cloned'));

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  items.forEach((item) => {
    const nameLink = item.querySelector('.product-item-name a[href], a.product-item-link');
    const photoLink = item.querySelector('a.product-item-photo');
    const img = item.querySelector('.product-item-photo img, img');
    const href = (nameLink && nameLink.getAttribute('href'))
      || (photoLink && photoLink.getAttribute('href'))
      || '';
    const name = clean(nameLink ? nameLink.textContent : '')
      || clean(nameLink && nameLink.getAttribute('title'))
      || clean(photoLink && photoLink.getAttribute('title'))
      || clean(img && img.getAttribute('alt'));

    // Cell 1: product image linked to the product page
    let imageCell = '';
    if (img) {
      const image = document.createElement('img');
      image.src = img.getAttribute('src') || img.src;
      image.alt = img.getAttribute('alt') || name;
      if (href) {
        const a = document.createElement('a');
        a.href = href;
        a.append(image);
        imageCell = a;
      } else {
        imageCell = image;
      }
    }

    // Cell 2: linked product name (strong) + item number + optional price
    const body = [];
    if (name) {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      if (href) {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = name;
        strong.append(a);
      } else {
        strong.textContent = name;
      }
      p.append(strong);
      body.push(p);
    }

    const skuEl = item.querySelector('.sku');
    const sku = clean(skuEl && skuEl.textContent);
    if (sku) {
      const p = document.createElement('p');
      p.textContent = sku;
      body.push(p);
    }

    const priceEl = item.querySelector('.price-box .price, .price-box');
    const price = clean(priceEl && priceEl.textContent);
    if (price) {
      const p = document.createElement('p');
      p.textContent = price;
      body.push(p);
    }

    // Store actions: cart = primary button (<strong><a>), favorites = secondary (<em><a>).
    // Logged-out, both require signing in; the favorites link has no usable href on the
    // source (it posts via JS), so it points to the same sign-in page as the cart button.
    const cart = item.querySelector('a.tocart');
    const fav = item.querySelector('a.towishlist, a.btn-wishlist');
    const signIn = cart ? cart.getAttribute('href') : '';
    [[cart, 'strong'], [fav, 'em']].forEach(([el, wrap]) => {
      const label = clean(el && (el.getAttribute('title') || el.textContent));
      if (!el || !label) return;
      const target = el.getAttribute('href') && el.getAttribute('href') !== '#' ? el.getAttribute('href') : signIn;
      if (!target) return;
      const p = document.createElement('p');
      const w = document.createElement(wrap);
      const a = document.createElement('a');
      a.href = target;
      a.textContent = label;
      w.append(a);
      p.append(w);
      body.push(p);
    });

    if (!imageCell && !body.length) return;
    cells.push([imageCell, body.length ? body : '']);
  });

  // the Featured slider gets its own variant: its images go full width on small screens
  const featured = !!element.closest('.featured-item-home');
  const name = featured ? 'cards-product-slider (featured)' : 'cards-product-slider';
  const block = WebImporter.Blocks.createBlock(document, { name, cells });
  element.replaceWith(block);
}
