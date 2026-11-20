// Runs synchronously in <head>, before the stylesheet paints, so the page never flashes
// the wrong theme. It sets data-theme on <html> from the persisted choice, falling back to
// the OS preference. The Alpine store in main.js reads this same attribute on init.
(function initTheme () {
  var stored = null;
  try {
    stored = localStorage.getItem('theme');
  } catch (error) {
    stored = null;
  }

  var systemPrefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = stored === 'dark' || stored === 'light' ? stored : (systemPrefersDark ? 'dark' : 'light');

  document.documentElement.dataset.theme = theme;
})();
