/* Theme: system | light | dark. Kept per viewer; the page renders fine without storage. */
(() => {
  const KEY = 'bilimind-d2-theme';
  const asked = new URLSearchParams(location.search).get('theme');
  const read = () => { if (['light', 'dark', 'system'].includes(asked)) return asked; try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; } };
  const apply = (v) => {
    const html = document.documentElement;
    if (v === 'system') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', v);
    document.querySelectorAll('.theme-switch [data-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === v)));
  };
  apply(read());
  addEventListener('DOMContentLoaded', () => {
    apply(read());
    document.addEventListener('click', (e) => {
      const b = e.target.closest('.theme-switch [data-set]');
      if (!b) return;
      try { localStorage.setItem(KEY, b.dataset.set); } catch {}
      apply(b.dataset.set);
    });
  });
  window.isDark = () => {
    const a = document.documentElement.getAttribute('data-theme');
    return a ? a === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
})();
/* follow the page that embeds us, and other tabs */
addEventListener('storage', (e) => { if (e.key === 'bilimind-d2-theme') { const v = e.newValue || 'system'; if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); } });
addEventListener('message', (e) => { const d = e.data; if (d && d.bilimind === 'theme') { if (d.value === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', d.value); } });
