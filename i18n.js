// i18n.js
// Runtime for translating UI strings. Reads window.I18N_ZH_HANT / window.I18N_EN
// (loaded by i18n/zh-Hant.js and i18n/en.js) and exposes window.I18N.

window.I18N = (function () {
  const SUPPORTED = ['zh-Hant', 'en'];
  const DEFAULT_LANG = 'zh-Hant';

  const TABLES = {
    'zh-Hant': window.I18N_ZH_HANT,
    'en':      window.I18N_EN,
  };

  let currentLang = DEFAULT_LANG;

  function t(key) {
    const table = TABLES[currentLang];
    if (table && key in table) return table[key];
    if (currentLang !== 'zh-Hant' && TABLES['zh-Hant'] && key in TABLES['zh-Hant']) {
      return TABLES['zh-Hant'][key];
    }
    console.warn(`[i18n] missing key: ${key} (lang=${currentLang})`);
    return key;
  }

  // MVP 只處理 placeholder / title / aria-label;新增屬性在這個 array 加一筆即可
  const ATTR_NAMES = ['placeholder', 'title', 'aria-label'];

  function applyI18n(root) {
    root = root || document;

    // 1. <html lang>
    document.documentElement.lang = currentLang;

    // 2. textContent
    root.querySelectorAll('[data-i18n-key]').forEach((el) => {
      el.textContent = t(el.dataset.i18nKey);
    });

    // 3. attribute
    for (const attr of ATTR_NAMES) {
      const datasetProp = 'i18nAttr' + attr.replace(/(^|-)([a-z])/g, (_, _dash, ch) => ch.toUpperCase());
      // attr='placeholder' → datasetProp='i18nAttrPlaceholder'
      // attr='aria-label' → datasetProp='i18nAttrAriaLabel'
      const sel = `[data-i18n-attr-${attr}]`;
      root.querySelectorAll(sel).forEach((el) => {
        const key = el.dataset[datasetProp];
        if (key) el.setAttribute(attr, t(key));
      });
    }
  }

  function init() {
    // Task 5 將擴充為 resolveInitialLang chain;Task 4 暫時固定 zh-Hant
    currentLang = DEFAULT_LANG;
    applyI18n();
  }

  return {
    SUPPORTED,
    getLang: () => currentLang,
    t,
    applyI18n,
    init,
  };
})();
