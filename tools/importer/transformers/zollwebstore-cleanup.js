/* eslint-disable */
/* global WebImporter */

/**
 * Cleanup transformer for zollwebstore.com (Magento 2 / Alothemes theme).
 * Selectors taken from migration-work/cleaned.html and page-structure.json "excluded".
 */
export default function transform(hookName, element, payload) {
  if (hookName === 'beforeTransform') {
    // Popups/modals and Magento message containers that can interfere with block matching
    WebImporter.DOMUtils.remove(element, [
      '#authenticationPopup',
      'div.block.newsletter.popup',
      '#popup-newsletter',
      '.modals-wrapper',
      '.page.messages',
    ]);

    // Slick carousel artifacts: cloned slides duplicate content; arrows/dots are UI chrome
    WebImporter.DOMUtils.remove(element, [
      '.slick-cloned',
      '.slick-arrow',
      '.slick-prev',
      '.slick-next',
      '.slick-dots',
    ]);

    // Product action buttons ("Login to Add to Cart" / "Add To Favorites") are kept:
    // the cards-product-slider parser turns them into authored button links.
  }

  if (hookName === 'afterTransform') {
    // Global chrome
    WebImporter.DOMUtils.remove(element, [
      'header.page-header',
      'footer.page-footer',
      'div.breadcrumbs',
      'main.page-main',
      '.modals-wrapper',
      '#authenticationPopup',
      'div.block.newsletter.popup',
    ]);

    // Non-authorable elements (reCAPTCHA iframes, stray inputs, scripts/styles)
    WebImporter.DOMUtils.remove(element, [
      'script',
      'style',
      'noscript',
      'link',
      'iframe',
      'input',
    ]);

    // Strip tracking / framework attributes
    element.querySelectorAll('[data-mage-init], [data-bind], [data-role], [onclick]').forEach((el) => {
      el.removeAttribute('data-mage-init');
      el.removeAttribute('data-bind');
      el.removeAttribute('data-role');
      el.removeAttribute('onclick');
    });
  }
}
