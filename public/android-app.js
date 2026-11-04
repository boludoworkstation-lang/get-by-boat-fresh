/* Mobile Android app shell. Only active for the signed Android app's launch URL. */
(() => {
  const search = new URLSearchParams(location.search);
  const explicitApp = search.get('android_app') === '1';
  if (explicitApp) {
    try { sessionStorage.setItem('gbb-android-app','1'); } catch {}
  }
  let inApp = explicitApp;
  try { inApp ||= sessionStorage.getItem('gbb-android-app') === '1'; } catch {}
  if (!inApp) return;

  document.documentElement.classList.add('gbb-android-app');
  const icons = {
    explore: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
    boat: '<path d="m3 17 2 3 7 2 7-2 2-3-9-3-9 3ZM12 14V2l6 8h-6"/>'
  };
  const icon = key => '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[key]+'</svg>';
  const tabs = role => role === 'owner'
    ? [
      {label:'Home',hash:'#/',icon:'explore'},
      {label:'My boats',hash:'#/owner',icon:'boat'},
      {label:'Messages',hash:'#/messages',icon:'message'},
      {label:'Account',hash:'#/account',icon:'user'}
    ]
    : [
      {label:'Explore',hash:'#/boats',icon:'explore'},
      {label:'Saved',hash:'#/favourites',icon:'heart'},
      {label:'Bookings',hash:'#/bookings',icon:'calendar'},
      {label:'Inbox',hash:'#/messages',icon:'message'},
      {label:'Profile',hash:'#/account',icon:'user'}
    ];
  const nav = document.createElement('nav');
  nav.className = 'gbb-android-bottom-nav';
  nav.setAttribute('aria-label','App navigation');
  document.body.append(nav);
  let previousRole = '';
  function update() {
    const role = window.GBB_ACCOUNT_ROLE === 'owner' ? 'owner' : 'customer';
    const entries = tabs(role);
    if (role !== previousRole) {
      previousRole = role;
      nav.innerHTML = entries.map(t => '<a href="'+t.hash+'" data-path="'+t.hash+'" aria-label="'+t.label+'">'+icon(t.icon)+'<span>'+t.label+'</span></a>').join('');
    }
    const path = location.hash.split('?')[0] || '#/';
    for (const link of nav.querySelectorAll('a')) {
      const target = link.getAttribute('data-path');
      const match = target === path || (path === '#/' && target === '#/boats');
      if (match) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
  }
  window.addEventListener('hashchange', update);
  const app = document.getElementById('app');
  if (app) {
    let scheduled = false;
    new MutationObserver(() => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; update(); });
      }
    }).observe(app,{childList:true});
  }
  update();
})();
