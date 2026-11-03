/**
 * Fetches the footer fragment. Tries the local preview path first, then the
 * site root (DA / EDS). Metadata-independent on purpose.
 * @returns {Promise<{root: HTMLElement, base: string}|null>}
 */
async function fetchFooterFragment() {
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) resp = await fetch('/footer.plain.html');
  if (!resp.ok) return null;
  const root = document.createElement('div');
  root.innerHTML = await resp.text();
  return { root, base: resp.url };
}

/** Resolves relative image paths against the fragment URL. */
function resolveImages(root, base) {
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !/^(https?:|data:|\/)/.test(src)) img.src = new URL(src, base).href;
  });
}

/** External links open in a new tab, as on the source site. */
function openInNewTab(scope) {
  scope.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener';
  });
}

/** A column is a section with a heading and a list of links. */
function buildColumn(section) {
  const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
  const list = section.querySelector('ul');
  const column = document.createElement('div');
  column.className = 'footer-column';
  if (heading) {
    const title = document.createElement('div');
    title.className = 'footer-column-title';
    title.textContent = heading.textContent.trim();
    column.append(title);
  }
  if (list) {
    // a list whose links only contain images is the social icon list
    const iconOnly = [...list.querySelectorAll('a')].every((a) => a.querySelector('img') && !a.textContent.trim());
    list.className = iconOnly ? 'footer-social' : 'footer-links';
    if (iconOnly) {
      column.classList.add('footer-column-social');
      list.querySelectorAll('a').forEach((a) => {
        const img = a.querySelector('img');
        a.title = img.alt;
        img.alt = '';
        a.setAttribute('aria-label', a.title);
      });
    }
    column.append(list);
  }
  return column;
}

/** Bottom row: copyright text + back-to-top control. */
function buildBottom(section) {
  const bottom = document.createElement('div');
  bottom.className = 'footer-bottom';
  [...section.querySelectorAll('p')].forEach((p) => {
    const link = p.querySelector('a[href="#"]');
    if (link) {
      link.className = 'footer-back-to-top';
      link.setAttribute('aria-label', link.textContent.trim());
      link.innerHTML = `<span class="footer-back-to-top-label">${link.textContent.trim()}</span>`;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      bottom.append(link);
    } else {
      // small > span mirrors the source copyright line box
      const copyright = document.createElement('p');
      copyright.className = 'footer-copyright';
      const small = document.createElement('small');
      const span = document.createElement('span');
      span.textContent = p.textContent.trim();
      small.append(span);
      copyright.append(small);
      bottom.prepend(copyright);
    }
  });
  return bottom;
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const fragment = await fetchFooterFragment();
  block.textContent = '';
  if (!fragment) return;
  const { root, base } = fragment;
  resolveImages(root, base);

  const main = document.createElement('div');
  main.className = 'footer-main';
  let bottom = null;

  [...root.children].forEach((section) => {
    const hasList = section.querySelector('ul');
    const hasHeading = section.querySelector('h1, h2, h3, h4, h5, h6');
    if (hasList && hasHeading) {
      main.append(buildColumn(section));
    } else if (section.querySelector('img') && !hasList) {
      const brand = document.createElement('div');
      brand.className = 'footer-brand';
      const link = section.querySelector('a') || section.querySelector('img');
      brand.append(link);
      main.append(brand);
    } else if (section.querySelector('p')) {
      bottom = buildBottom(section);
    }
  });

  openInNewTab(main);
  block.append(main);
  if (bottom) block.append(bottom);
}
