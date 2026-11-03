/* eslint-disable */
/* global WebImporter */

import carouselHeroParser from "./parsers/carousel-hero.js";
import cardsIconFeatureParser from "./parsers/cards-icon-feature.js";
import cardsProductSliderParser from "./parsers/cards-product-slider.js";
import zollwebstoreCleanupTransformer from "./transformers/zollwebstore-cleanup.js";
import zollwebstoreSectionsTransformer from "./transformers/zollwebstore-sections.js";

const PAGE_TEMPLATE = {
  "name": "home",
  "urls": [
    "https://zollwebstore.com/"
  ],
  "representativeUrl": "https://zollwebstore.com/",
  "description": "ZOLL WebStore homepage: hero image slider, support policy boxes, bestseller and featured product sliders",
  "blocks": [
    {
      "name": "carousel-hero",
      "instances": [
        ".section-element.row .home-slider",
        ".home-slider"
      ]
    },
    {
      "name": "cards-icon-feature",
      "instances": [
        ".policy.home .support-policy"
      ]
    },
    {
      "name": "cards-product-slider",
      "instances": [
        ".home-best-seller .slider-products-grid",
        ".featured-item-home .slider-products-grid",
        ".slider-products-grid"
      ]
    }
  ],
  "urlPattern": "/",
  "sections": [
    {
      "id": "section-1",
      "name": "Hero banner slider",
      "selector": [
        ".column.main .section-element.row"
      ],
      "style": null,
      "blocks": [
        "carousel-hero"
      ],
      "defaultContent": []
    },
    {
      "id": "section-2",
      "name": "Support policy strip",
      "selector": [
        ".column.main .policy.home"
      ],
      "style": null,
      "blocks": [
        "cards-icon-feature"
      ],
      "defaultContent": []
    },
    {
      "id": "section-3",
      "name": "Bestseller Products",
      "selector": [
        ".home-slider-section .cms-category.section-category:has(.home-best-seller)",
        ".home-best-seller"
      ],
      "style": null,
      "blocks": [
        "cards-product-slider"
      ],
      "defaultContent": [
        ".home-best-seller > .slider-grid-title"
      ]
    },
    {
      "id": "section-4",
      "name": "Featured Products",
      "selector": [
        ".home-slider-section .cms-category.section-category:has(.featured-item-home)",
        ".featured-item-home"
      ],
      "style": null,
      "blocks": [
        "cards-product-slider"
      ],
      "defaultContent": [
        ".featured-item-home > .accor-title"
      ]
    }
  ]
};

const parsers = {
  "carousel-hero": carouselHeroParser,
  "cards-icon-feature": cardsIconFeatureParser,
  "cards-product-slider": cardsProductSliderParser,
};

const transformers = [zollwebstoreCleanupTransformer, zollwebstoreSectionsTransformer];

function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((fn) => {
    try { fn(hookName, element, enhancedPayload); }
    catch (e) { console.error(`Transformer failed at ${hookName}:`, e); }
  });
}

function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  const seen = new Set();
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (seen.has(element)) return;
        seen.add(element);
        pageBlocks.push({ name: blockDef.name, selector, element });
      });
    });
  });
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;

    executeTransformers("beforeTransform", main, payload);

    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (!parser) return;
      try { parser(block.element, { document, url, params }); }
      catch (e) { console.error(`Failed to parse ${block.name} (${block.selector}):`, e); }
    });

    executeTransformers("afterTransform", main, payload);

    main.appendChild(document.createElement("hr"));
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, "")
      .replace(/\.html?$/, "");
    const path = WebImporter.FileUtils.sanitizePath(rawPath === "" ? "/index" : rawPath);

    return [{
      element: main,
      path,
      report: { title: document.title, template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) },
    }];
  },
};
