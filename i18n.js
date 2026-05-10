// i18n.js
// Runtime for translating UI strings. Reads window.I18N_ZH_HANT / window.I18N_EN
// (loaded by i18n/zh-Hant.js and i18n/en.js) and exposes window.I18N.

window.I18N = (function () {
  const SUPPORTED = ['zh-Hant', 'en'];
  const DEFAULT_LANG = 'zh-Hant';
  const STORAGE_KEY = 'iconmachine.lang';

  const TABLES = {
    'zh-Hant': window.I18N_ZH_HANT,
    'en':      window.I18N_EN,
  };

  let currentLang = DEFAULT_LANG;

  function readLangFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('lang');
      if (v && SUPPORTED.includes(v)) return v;
    } catch (_) {}
    return null;
  }

  function readLangFromStorage() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && SUPPORTED.includes(v)) return v;
    } catch (_) {}
    return null;
  }

  function readLangFromNavigator() {
    try {
      const nav = (navigator.language || '').toLowerCase();
      if (nav.startsWith('zh')) return 'zh-Hant';
      if (nav.startsWith('en')) return 'en';
    } catch (_) {}
    return null;
  }

  function resolveInitialLang() {
    // URL 命中時,順手把它寫進 localStorage(讓分享連結進來後會被記住)
    const urlLang = readLangFromURL();
    if (urlLang) {
      try { localStorage.setItem(STORAGE_KEY, urlLang); } catch (_) {}
      return urlLang;
    }
    return readLangFromStorage()
        || readLangFromNavigator()
        || DEFAULT_LANG;
  }

  function validateTables() {
    const langs = Object.keys(TABLES);
    if (langs.length < 2) return; // single lang 沒得比

    const allKeys = new Set();
    for (const lang of langs) {
      const tbl = TABLES[lang];
      if (!tbl) continue;
      Object.keys(tbl).forEach((k) => allKeys.add(k));
    }

    const missing = {};
    let anyMissing = false;
    for (const lang of langs) {
      const tbl = TABLES[lang] || {};
      const lacks = [];
      allKeys.forEach((k) => { if (!(k in tbl)) lacks.push(k); });
      if (lacks.length > 0) {
        missing[lang] = lacks;
        anyMissing = true;
      }
    }

    if (anyMissing) {
      const lines = ['[i18n] table mismatch:'];
      for (const lang of langs) {
        lines.push(`  Missing in ${lang}: [${(missing[lang] || []).join(', ')}]`);
      }
      console.error(lines.join('\n'));
    }
  }

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

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    if (lang === currentLang) return;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    applyI18n();
  }

  function init() {
    currentLang = resolveInitialLang();
    validateTables();
    applyI18n();
  }

  return {
    SUPPORTED,
    getLang: () => currentLang,
    t,
    applyI18n,
    setLang,
    init,
  };
})();
