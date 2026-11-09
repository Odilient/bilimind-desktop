/* The course page's words in the visitor's language: ?lang=ru loads i18n/ru.js, a map from each English
   string to its translation. English stays inline in the page and its scripts; this finds it again.
   Loaded before dates.js, which translates every HTML string on its way in, then moves the dates. */
(() => {
  const lang = new URLSearchParams(location.search).get('lang') || 'en';
  window.BILI_LANG = lang;
  if (lang === 'en' || !/^[a-z]{2}$/.test(lang)) { window.BILI_LANG = 'en'; return; }
  document.write('<script src="i18n/' + lang + '.js"><\/script><script src="js/i18n-run.js"><\/script>');
})();
