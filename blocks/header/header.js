// media query match that indicates desktop width
const isDesktop = window.matchMedia('(min-width: 900px)');

/**
 * Fetches the nav fragment. Tries the local preview path first, then the
 * site root (DA / EDS). Metadata-independent on purpose.
 * @returns {Promise<{root: HTMLElement, base: string}|null>}
 */
async function fetchNavFragment() {
  let resp = await fetch('/content/nav.plain.html');
  if (!resp.ok) resp = await fetch('/nav.plain.html');
  if (!resp.ok) return null;
  const root = document.createElement('div');
  root.innerHTML = await resp.text();
  return { root, base: resp.url };
}

/**
 * Resolves relative image paths against the fragment URL so images work
 * from any page depth.
 */
function resolveImages(root, base) {
  root.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !/^(https?:|data:|\/)/.test(src)) img.src = new URL(src, base).href;
    img.loading = 'eager';
  });
}

/** Returns the direct child element of `el` matching `tag`. */
function child(el, tag) {
  return el ? [...el.children].find((c) => c.tagName === tag.toUpperCase()) : null;
}

/** Returns the label text of a list item, excluding any nested list. */
function ownText(li) {
  return [...li.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && n.tagName !== 'UL'))
    .map((n) => n.textContent)
    .join('')
    .trim();
}

function closeAll(scope, except) {
  scope.querySelectorAll('.is-open').forEach((el) => {
    if (el !== except && !el.contains(except)) {
      el.classList.remove('is-open');
      const trigger = el.querySelector(':scope > a, :scope > button');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

/**
 * Hover/focus open behaviour for a desktop dropdown item.
 * Mobile uses click handlers wired in setupMobileToggles.
 */
function bindHoverOpen(item, scope) {
  const trigger = item.querySelector(':scope > a, :scope > .nav-utility-label');
  const open = () => {
    if (!isDesktop.matches) return;
    closeAll(scope, item);
    item.classList.add('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    if (!isDesktop.matches) return;
    item.classList.remove('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  };
  item.addEventListener('mouseenter', open);
  item.addEventListener('mouseleave', close);
  item.addEventListener('focusin', open);
  item.addEventListener('focusout', (e) => {
    if (!item.contains(e.relatedTarget)) close();
  });
}

/** Classifies a utility link by its URL so the matching icon can be shown. */
function utilityKind(li) {
  const a = child(li, 'a');
  const href = a ? a.getAttribute('href') || '' : '';
  if (/cart/.test(href)) return 'cart';
  if (child(li, 'ul')) return 'account';
  if (/login/.test(href) && /sign in/i.test(a.textContent)) return 'signin';
  return 'link';
}

function buildUtility(section, scope) {
  const list = section ? section.querySelector('ul') : null;
  if (!list) return null;
  list.className = 'nav-utility';
  [...list.children].forEach((li) => {
    const kind = utilityKind(li);
    li.className = `nav-utility-item nav-utility-${kind}`;
    if (kind === 'account') {
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'nav-utility-label';
      label.setAttribute('aria-haspopup', 'true');
      label.classList.add('nav-popup-trigger');
      label.setAttribute('aria-expanded', 'false');
      label.textContent = ownText(li);
      [...li.childNodes].forEach((n) => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
      li.prepend(label);
      const dropdown = child(li, 'ul');
      dropdown.className = 'nav-utility-dropdown';
      bindHoverOpen(li, scope);
      label.addEventListener('click', () => {
        // desktop: hover already opened it, a click keeps it open
        const expanded = isDesktop.matches ? true : !li.classList.contains('is-open');
        li.classList.toggle('is-open', expanded);
        label.setAttribute('aria-expanded', expanded);
      });
    }
    const cartPanel = kind === 'cart' ? child(li, 'ul') : null;
    if (cartPanel) {
      // desktop: the cart link toggles a mini-cart panel instead of navigating
      const link = child(li, 'a');
      cartPanel.className = 'nav-cart-panel';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'nav-cart-close';
      close.setAttribute('aria-label', 'Close');
      li.append(close);
      link.setAttribute('aria-haspopup', 'true');
      link.classList.add('nav-popup-trigger');
      link.setAttribute('aria-expanded', 'false');
      const setOpen = (open) => {
        li.classList.toggle('is-open', open);
        link.setAttribute('aria-expanded', open);
      };
      link.addEventListener('click', (e) => {
        if (!isDesktop.matches) return;
        e.preventDefault();
        setOpen(!li.classList.contains('is-open'));
      });
      close.addEventListener('click', () => setOpen(false));
    }
  });
  return list;
}

/** Builds a mega panel from the nested list of a top-level menu item. */
function buildPanel(li) {
  const list = child(li, 'ul');
  if (!list) return null;
  const panel = document.createElement('div');
  panel.className = 'nav-megamenu';
  const items = [...list.children];
  const hasCards = items.some((item) => item.querySelector('img'));
  if (hasCards) {
    panel.classList.add('nav-megamenu-cards');
    list.className = 'nav-cards';
    items.forEach((item) => {
      item.className = 'nav-card';
      const a = child(item, 'a');
      const img = a && a.querySelector('img');
      if (!img) return;
      const label = document.createElement('span');
      label.className = 'nav-card-title';
      label.textContent = a.textContent.trim();
      [...a.childNodes].forEach((n) => { if (n.nodeType === Node.TEXT_NODE) n.remove(); });
      const media = document.createElement('span');
      media.className = 'nav-card-image';
      media.append(img);
      a.append(media, label);
    });
  } else {
    panel.classList.add('nav-megamenu-columns');
    list.className = `nav-columns nav-columns-${items.length > 4 ? 'wrap' : 'row'}`;
    items.forEach((col) => {
      col.className = 'nav-column';
      const heading = child(col, 'a');
      if (heading) heading.className = 'nav-column-heading';
      const links = child(col, 'ul');
      if (!links) return;
      links.className = 'nav-column-links';
      [...links.children].forEach((link) => {
        const flyout = child(link, 'ul');
        if (!flyout) return;
        link.classList.add('has-flyout');
        flyout.className = 'nav-flyout';
        const a = child(link, 'a');
        if (a) {
          a.setAttribute('aria-haspopup', 'true');
          a.classList.add('nav-popup-trigger');
          a.setAttribute('aria-expanded', 'false');
        }
        link.addEventListener('mouseenter', () => { if (a) a.setAttribute('aria-expanded', 'true'); });
        link.addEventListener('mouseleave', () => { if (a) a.setAttribute('aria-expanded', 'false'); });
      });
    });
  }
  list.remove();
  panel.append(list);
  return panel;
}

function buildMenu(section, scope) {
  const list = section ? section.querySelector('ul') : null;
  if (!list) return null;
  list.className = 'nav-menu';
  list.id = 'nav-menu';
  [...list.children].forEach((li) => {
    li.className = 'nav-menu-item';
    const a = child(li, 'a');
    if (a) a.className = 'nav-menu-link';
    const panel = buildPanel(li);
    if (panel) {
      li.classList.add('has-panel');
      li.append(panel);
      if (a) {
        a.setAttribute('aria-haspopup', 'true');
        a.classList.add('nav-popup-trigger');
        a.setAttribute('aria-expanded', 'false');
      }
      bindHoverOpen(li, scope);
    }
  });
  return list;
}

function buildSearch(section, nav) {
  const paragraphs = section ? [...section.querySelectorAll('p')] : [];
  const placeholder = paragraphs[0] ? paragraphs[0].textContent.trim() : '';
  const submitLink = paragraphs[1] ? paragraphs[1].querySelector('a') : null;
  const submitLabel = paragraphs[1] ? paragraphs[1].textContent.trim() : '';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-search-toggle';
  toggle.setAttribute('aria-label', placeholder || 'Search');
  toggle.setAttribute('aria-controls', 'nav-search-overlay');
  toggle.setAttribute('aria-expanded', 'false');

  const overlay = document.createElement('div');
  overlay.className = 'nav-search-overlay';
  overlay.id = 'nav-search-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.hidden = true;

  const form = document.createElement('form');
  form.className = 'nav-search-form';
  form.setAttribute('role', 'search');
  form.method = 'get';
  if (submitLink) form.action = submitLink.href;

  const label = document.createElement('label');
  label.className = 'nav-search-label';
  label.htmlFor = 'nav-search-input';
  label.textContent = placeholder;

  const input = document.createElement('input');
  input.type = 'search';
  input.name = 'q';
  input.id = 'nav-search-input';
  input.placeholder = placeholder;
  input.autocomplete = 'off';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'nav-search-submit';
  submit.textContent = submitLabel;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'nav-search-close';
  close.setAttribute('aria-label', 'Close');

  form.append(label, input, submit);
  overlay.append(form, close);

  const setOpen = (open) => {
    overlay.hidden = !open;
    nav.classList.toggle('search-open', open);
    toggle.setAttribute('aria-expanded', open);
    if (open) input.focus();
    else toggle.focus();
  };
  toggle.addEventListener('click', () => setOpen(overlay.hidden));
  close.addEventListener('click', () => setOpen(false));
  overlay.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') setOpen(false);
  });

  return { toggle, overlay };
}

function buildBreadcrumbs(section) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-breadcrumbs';
  const list = document.createElement('ul');
  [...(section ? section.querySelectorAll('a') : [])].forEach((a, i) => {
    const li = document.createElement('li');
    if (i === 0) li.className = 'nav-breadcrumbs-home';
    li.append(a);
    list.append(li);
  });
  wrapper.append(list);
  return wrapper;
}

/** Mobile-only utility links rendered at the bottom of the drawer. */
function buildMobileUtility(section) {
  const list = section ? section.querySelector('ul') : null;
  if (!list) return null;
  list.className = 'nav-mobile-utility';
  [...list.children].forEach((li) => {
    const a = child(li, 'a');
    let kind = utilityKind(li);
    if (kind === 'link' && a && /account/i.test(a.textContent)) kind = 'account';
    li.className = `nav-mobile-utility-item nav-mobile-utility-${kind}`;
  });
  return list;
}

/** Animates an element's height open or closed (slide-down / slide-up). */
function slide(el, open, onDone) {
  el.style.overflow = 'hidden';
  el.style.display = 'block';
  const from = open ? 0 : el.scrollHeight;
  const to = open ? el.scrollHeight : 0;
  el.style.height = `${from}px`;
  // force layout so the start height is applied before transitioning
  el.getBoundingClientRect();
  el.style.transition = 'height 0.4s ease';
  el.style.height = `${to}px`;
  const finish = () => {
    el.removeAttribute('style');
    if (onDone) onDone();
  };
  el.addEventListener('transitionend', finish, { once: true });
}

/**
 * Mobile accordion: each expandable row gets a +/- button next to its link.
 * The link itself still navigates (split link), as on the source site.
 */
function addExpandButtons(nav) {
  const rows = [
    ['.nav-menu-item.has-panel', '.nav-megamenu-columns'],
    ['.nav-column', '.nav-column-links'],
    ['.nav-column-links .has-flyout', '.nav-flyout'],
  ];
  rows.forEach(([rowSel, panelSel]) => {
    nav.querySelectorAll(rowSel).forEach((li) => {
      const panel = li.querySelector(`:scope > ${panelSel}`);
      if (!panel) return;
      const label = child(li, 'a');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-expand';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', `Expand ${label ? label.textContent.trim() : ''}`);
      if (label) label.after(button);
      else li.prepend(button);
      button.addEventListener('click', () => {
        const open = !li.classList.contains('is-expanded');
        button.setAttribute('aria-expanded', open);
        if (open) {
          li.classList.add('is-expanded');
          slide(panel, true);
        } else {
          slide(panel, false, () => li.classList.remove('is-expanded'));
        }
      });
    });
  });
}

/**
 * Hover/click popups only exist on desktop; on mobile those links are plain
 * links (the +/- buttons carry the expanded state), so drop the popup ARIA.
 */
function syncPopupAria(nav) {
  nav.querySelectorAll('.nav-popup-trigger').forEach((t) => {
    if (isDesktop.matches) {
      t.setAttribute('aria-haspopup', 'true');
      if (!t.hasAttribute('aria-expanded')) t.setAttribute('aria-expanded', 'false');
    } else {
      t.removeAttribute('aria-haspopup');
      t.removeAttribute('aria-expanded');
    }
  });
}

/** Mobile: hamburger toggles the drawer. */
function setupMobileToggles(nav, hamburger) {
  const setMenuOpen = (open) => {
    nav.classList.toggle('menu-open', open);
    hamburger.setAttribute('aria-expanded', open);
    hamburger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.body.style.overflowY = open && !isDesktop.matches ? 'hidden' : '';
  };
  hamburger.addEventListener('click', () => setMenuOpen(!nav.classList.contains('menu-open')));
  addExpandButtons(nav);

  // crossing the breakpoint resets both layouts
  isDesktop.addEventListener('change', () => {
    setMenuOpen(false);
    closeAll(nav, null);
    nav.querySelectorAll('.is-expanded').forEach((li) => li.classList.remove('is-expanded'));
    nav.querySelectorAll('.nav-expand').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    syncPopupAria(nav);
  });
  syncPopupAria(nav);
  return setMenuOpen;
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await fetchNavFragment();
  block.textContent = '';
  if (!fragment) return;
  const { root, base } = fragment;
  resolveImages(root, base);

  const sections = [...root.children];
  const [
    brandSection, utilitySection, menuSection, searchSection, breadcrumbSection, mobileSection,
  ] = sections;

  const nav = document.createElement('div');
  nav.className = 'nav-root';
  nav.id = 'nav';

  const bar = document.createElement('div');
  bar.className = 'nav-bar';

  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = 'nav-hamburger';
  hamburger.setAttribute('aria-controls', 'nav-menu');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'Open navigation');
  hamburger.innerHTML = '<span class="nav-hamburger-bars"><span></span><span></span><span></span></span>';

  const brand = document.createElement('div');
  brand.className = 'nav-brand';
  const brandLink = brandSection ? brandSection.querySelector('a') : null;
  if (brandLink) brand.append(brandLink);

  const right = document.createElement('div');
  right.className = 'nav-right';
  const utility = buildUtility(utilitySection, nav);

  const main = document.createElement('div');
  main.className = 'nav-main';
  const menu = buildMenu(menuSection, nav);
  const { toggle, overlay } = buildSearch(searchSection, nav);

  // the nav landmark wraps the primary menu; on mobile it is the slide-in drawer
  const drawer = document.createElement('nav');
  drawer.className = 'nav-sections';
  drawer.setAttribute('aria-label', 'Main navigation');
  if (menu) drawer.append(menu);
  const mobileUtility = buildMobileUtility(mobileSection);
  if (mobileUtility) drawer.append(mobileUtility);

  main.append(drawer, toggle);
  if (utility) right.append(utility);
  right.append(main);
  bar.append(brand, right, hamburger);
  nav.append(bar, buildBreadcrumbs(breadcrumbSection), overlay);

  setupMobileToggles(nav, hamburger);

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') closeAll(nav, null);
  });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) closeAll(nav, null);
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.append(nav);
  block.append(wrapper);
}
