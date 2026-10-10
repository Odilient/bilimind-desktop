// The icon sprite (one 2px stroke family, from hackathon/research/player-proto.html / the landing sprite).
// Injected once at boot; use <Icon name="i-play"/> or <svg><use href="#i-play"/></svg>.
export const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>
<symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-2.2z" fill="currentColor"/></symbol>
<symbol id="i-path" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 19c0-4 4-4 7-7s7-3 7-7"/></g><circle cx="5" cy="19" r="2.4" fill="currentColor"/><circle cx="19" cy="5" r="2.4" fill="currentColor"/></symbol>
<symbol id="i-book" viewBox="0 0 24 24"><path d="M3.5 5.5c3-1 6-1 8.5.6 2.5-1.6 5.5-1.6 8.5-.6v13c-3-1-6-1-8.5.6-2.5-1.6-5.5-1.6-8.5-.6z M12 6.1v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
<symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path d="M6 3.8v16.4a1 1 0 0 0 1.5.86l13.6-8.2a1 1 0 0 0 0-1.72L7.5 2.94A1 1 0 0 0 6 3.8z" fill="currentColor"/></symbol>
<symbol id="i-pause" viewBox="0 0 24 24"><g fill="currentColor"><rect x="6" y="4" width="4.2" height="16" rx="1.3"/><rect x="13.8" y="4" width="4.2" height="16" rx="1.3"/></g></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-arrow-up" viewBox="0 0 24 24"><path d="M12 20V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-clip" viewBox="0 0 24 24"><path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.7-7.7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-mic" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></g></symbol>
<symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 5.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2.5L15.5 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></symbol>
<symbol id="i-pencil" viewBox="0 0 24 24"><path d="M15.5 4.5l4 4L8 20H4v-4zM13 7l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
<symbol id="i-flow" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3.5" width="7" height="5" rx="1.5"/><rect x="14" y="15.5" width="7" height="5" rx="1.5"/><path d="M6.5 8.5v4.5h11v2.5"/></g></symbol>
<symbol id="i-sliders" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></g></symbol>
<symbol id="i-steps" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/></g><g fill="currentColor"><circle cx="4.5" cy="6" r="1.6"/><circle cx="4.5" cy="12" r="1.6"/><circle cx="4.5" cy="18" r="1.6"/></g></symbol>
<symbol id="i-list" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6.5l1.6 1.6 3-3M3.5 13.5l1.6 1.6 3-3M11 7h9.5M11 14h9.5M11 20h9.5"/></g></symbol>
<symbol id="i-quiz" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.6"/></g><circle cx="12" cy="17" r="1.2" fill="currentColor"/></symbol>
<symbol id="i-image" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M3.5 16l5-5 4 4 3-3 5 5"/></g><circle cx="15.5" cy="9" r="1.6" fill="currentColor"/></symbol>
<symbol id="i-time" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g></symbol>
<symbol id="i-rocket" viewBox="0 0 24 24"><path d="M12 3c3.5 2 5 5.5 5 9.5L15 15H9l-2-2.5C7 8.5 8.5 5 12 3zM9 15l-2.5 4M15 15l2.5 4M12 15v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="12" cy="9.5" r="1.7" fill="currentColor"/></symbol>
<symbol id="i-folder" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.2h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor"/></symbol>
<symbol id="i-dots" viewBox="0 0 24 24"><g fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></g></symbol>
<symbol id="i-cal" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g></symbol>
<symbol id="i-tree" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="8.5" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/><rect x="14" y="16" width="7" height="5" rx="1.5"/><path d="M12 8v4M6.5 16v-4h11v4"/></g></symbol>
<symbol id="i-cards" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="7" y="3.5" width="13" height="16" rx="2.5" transform="rotate(8 13.5 11.5)"/><rect x="4" y="5" width="12" height="15.5" rx="2.5"/></g></symbol>
<symbol id="i-code" viewBox="0 0 24 24"><path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-speaker" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></g></symbol>
<symbol id="i-timer" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M18.5 6.5l1.5-1.5"/></g></symbol>
<symbol id="i-scales" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6a2.8 2.8 0 0 0 5 0zM19 7l-2.5 6a2.8 2.8 0 0 0 5 0z"/></g></symbol>
<symbol id="i-warning" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5" stroke-linecap="round"/></g><circle cx="12" cy="17.3" r="1.2" fill="currentColor"/></symbol>
<symbol id="i-bulb" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17.5h5.2V15.8c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></g></symbol>
<symbol id="i-target" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></g><circle cx="12" cy="12" r="1.6" fill="currentColor"/></symbol>
<symbol id="i-table" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 10h18M3 15h18M9.5 4.5v15"/></g></symbol>
<symbol id="i-link" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3.3-3.3a4 4 0 0 0-5.7-5.7L12 6.3"/><path d="M14 10a4 4 0 0 0-5.7 0L5 13.3a4 4 0 0 0 5.7 5.7l1.3-1.3"/></g></symbol>
<symbol id="i-video" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="6" width="13.5" height="12" rx="2.5"/><path d="M16 10.5l5.5-3v9l-5.5-3z"/></g></symbol>
<symbol id="i-wand" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20L15 9M13 7l2-2 4 4-2 2z"/></g><path d="M7 3.5l.7 1.8 1.8.7-1.8.7L7 8.5l-.7-1.8L4.5 6l1.8-.7zM19 14.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="currentColor"/></symbol>
<symbol id="i-sign" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 3v18M5 6h11l3 2.5-3 2.5H5zM19 13H8l-3 2.5L8 18h11z"/></g></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></g></symbol>
<symbol id="i-circles" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="8" r="3.5"/><circle cx="17" cy="8" r="3.5"/><circle cx="12" cy="16.5" r="3.5"/></g></symbol>
<symbol id="i-file" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 2.8h8l4.5 4.5v13a1.2 1.2 0 0 1-1.2 1.2H6a1.2 1.2 0 0 1-1.2-1.2V4A1.2 1.2 0 0 1 6 2.8z"/><path d="M14 2.8v4.5h4.5"/></g></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></g></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3" stroke-linecap="round"/></g></symbol>
<symbol id="i-send" viewBox="0 0 24 24"><path d="M21 3.5L10.5 13.5M21 3.5l-6.5 17-4-7-7-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></symbol>
<symbol id="i-flame" viewBox="0 0 24 24"><path d="M12 21.5c-4 0-7-2.7-7-6.6 0-3.2 2.1-5.4 3.8-7.3.4 1.6 1.2 2.7 2.4 3.3C11 7.6 12.3 4.8 14.7 2.5c.6 3.4 4.3 6.1 4.3 11.4 0 4.3-3 7.6-7 7.6z" fill="currentColor"/></symbol>
<symbol id="i-bell" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></g></symbol>
<symbol id="i-school" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c1.5 1.6 3.4 2.4 5.5 2.4s4-.8 5.5-2.4v-5M21.5 9v5.5"/></g></symbol>
<symbol id="mark" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#2340E6"/><path d="M28.6 13.4A11 11 0 1 0 31 20" fill="none" stroke="#fff" stroke-width="5.2" stroke-linecap="round"/><circle cx="20" cy="20" r="4.4" fill="#0B0D10"/><circle cx="29.6" cy="14.9" r="3.6" fill="#C6F24E"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/></g></symbol>
<symbol id="i-home" viewBox="0 0 24 24"><path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
<symbol id="i-panel" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/></g></symbol>
<symbol id="i-panel-r" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M14.5 4.5v15"/></g></symbol>
<symbol id="i-chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-back" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-ext" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h7v7M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/></g></symbol>
<symbol id="i-fork" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 4v5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V4M12 12v8"/></g></symbol>
<symbol id="i-download" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></g></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4.5V11h-6.5"/></g></symbol>
<symbol id="i-type" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 18.5l5-13 5 13M5.4 13.5h6.2M15 18.5l3-7.5 3 7.5M16 16h4"/></g></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
<symbol id="i-screen" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/></g></symbol>
</defs></svg>`;

export function injectSprite(doc: Document = document): void {
  if (doc.getElementById('bm-sprite')) return;
  const box = doc.createElement('div');
  box.id = 'bm-sprite';
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  box.innerHTML = SPRITE;
  doc.body.prepend(box);
}
