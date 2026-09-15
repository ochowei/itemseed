// theme.js
// Runtime for switching dark/light/auto. Mirrors i18n.js structure
// (URL > localStorage > default). Auto resolves via matchMedia and
// reacts live to OS theme changes.

window.THEME = (function () {
  const SUPPORTED = ['auto', 'light', 'dark'];
  const DEFAULT_SETTING = 'auto';
  const STORAGE_KEY = 'itemseed.theme';
  const FALLBACK_STORAGE_KEY = 'iconmachine.theme';

  let currentSetting = DEFAULT_SETTING;
  let mediaQuery = null;

  function readSettingFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('theme');
      if (v && SUPPORTED.includes(v)) return v;
    } catch (_) {}
    return null;
  }

  function readSettingFromStorage() {
    try {
      const primary = localStorage.getItem(STORAGE_KEY);
      if (primary && SUPPORTED.includes(primary)) return primary;
      const fallback = localStorage.getItem(FALLBACK_STORAGE_KEY);
      if (fallback && SUPPORTED.includes(fallback)) return fallback;
    } catch (_) {}
    return null;
  }

  function resolveInitialSetting() {
    const urlSetting = readSettingFromURL();
    if (urlSetting) {
      try { localStorage.setItem(STORAGE_KEY, urlSetting); } catch (_) {}
      return urlSetting;
    }
    return readSettingFromStorage() || DEFAULT_SETTING;
  }

  function resolveEffective(setting) {
    if (setting === 'light' || setting === 'dark') return setting;
    if (mediaQuery && mediaQuery.matches) return 'dark';
    if (mediaQuery) return 'light';
    return 'dark'; // matchMedia unsupported → safe fallback
  }

  function applyTheme() {
    const eff = resolveEffective(currentSetting);
    if (document.body) document.body.setAttribute('data-theme', eff);
  }

  function setTheme(setting) {
    if (!SUPPORTED.includes(setting)) return;
    if (setting === currentSetting) return;
    currentSetting = setting;
    try { localStorage.setItem(STORAGE_KEY, setting); } catch (_) {}
    applyTheme();
  }

  function init() {
    try { mediaQuery = window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) {}
    if (mediaQuery && mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', () => {
        if (currentSetting === 'auto') applyTheme();
      });
    }
    currentSetting = resolveInitialSetting();
    applyTheme();
  }

  return {
    SUPPORTED,
    getSetting: () => currentSetting,
    getEffective: () => resolveEffective(currentSetting),
    setTheme,
    init,
  };
})();
