/* eslint-disable */
/* global WebImporter */

/**
 * Section transformer for zollwebstore.com.
 * Inserts <hr> section breaks between template sections (beforeTransform, while
 * parser targets still exist) and Section Metadata for styled sections (afterTransform).
 */
const MARKER = 'data-excat-section-id';

function findSection(element, section) {
  const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
  for (const sel of selectors) {
    if (!sel) continue;
    try {
      const el = element.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // unsupported selector (e.g. :has in older engines) - try next
    }
  }
  return null;
}

export default function transform(hookName, element, payload) {
  const sections = payload && payload.template && payload.template.sections;
  if (!sections || sections.length < 2) return;
  const document = element.ownerDocument;

  if (hookName === 'beforeTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const el = findSection(element, section);
      if (!el || !el.parentNode) continue;
      if (i === 0 && !section.style) continue;
      const hr = document.createElement('hr');
      if (section.style) hr.setAttribute(MARKER, section.id);
      el.parentNode.insertBefore(hr, el);
    }
  }

  if (hookName === 'afterTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (!section.style) continue;
      const marker = element.querySelector(`hr[${MARKER}="${section.id}"]`);
      const meta = WebImporter.Blocks.createBlock(document, {
        name: 'Section Metadata',
        cells: { style: section.style },
      });
      if (marker) {
        // Place metadata at the end of this section: before the next <hr> or at end
        let next = marker.nextElementSibling;
        while (next && next.tagName !== 'HR') next = next.nextElementSibling;
        if (next) next.parentNode.insertBefore(meta, next);
        else marker.parentNode.appendChild(meta);
        if (i === 0) marker.remove();
        else marker.removeAttribute(MARKER);
      } else {
        const el = findSection(element, section);
        if (el && el.parentNode) el.parentNode.insertBefore(meta, el.nextSibling);
      }
    }
  }
}
