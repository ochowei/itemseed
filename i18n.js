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

  return {
    SUPPORTED,
    getLang: () => currentLang,
    t,
  };
})();
