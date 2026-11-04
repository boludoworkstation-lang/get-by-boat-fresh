/* Mobile-first presentation for the existing Get By Boat site.
   Live search, filters, routes and authentication remain owned by app.js/backend.js. */
(function () {
  'use strict';

  const icon = name => {
    const paths = {
      search: '<circle cx="10.7" cy="10.7" r="6.6"/><path d="m16 16 5 5"/>',
      compass: '<circle cx="12" cy="12" r="9"/><path d="m15.7 8.3-2.2 5.2-5.2 2.2 2.2-5.2z"/>',
      heart: '<path d="M20.8 8c0-5.2-6.4-6.7-8.8-2.8C9.6 1.3 3.2 2.8 3.2 8c0 4.3 6.4 9.2 8.8 11.8C14.4 17.2 20.8 12.3 20.8 8Z"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-9 16-9 16 0"/>',
      sliders: '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="9" cy="5" r="2" fill="white"/><circle cx="16" cy="12" r="2" fill="white"/><circle cx="8" cy="19" r="2" fill="white"/>',
      chevron: '<path d="m6 9 6 6 6-6"/>',
      ship: '<path d="M4 15h16l-2.5 5h-11L4 15Zm4-8h8v8H8V7Zm-3 0h14M12 3v4"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.search}</svg>`;
  };

  const escapeText = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const mobile = () => window.matchMedia('(max-width: 640px)').matches;
  const activeRoute = () => window.location.hash.split('?')[0] || '#/';
  let movedForm = null;
  let oldFormParent = null;
  let oldFormSibling = null;
  let scheduled = false;
  let sheetKind = '';
  const boatTypes = ['Motorboat','RIB','Sailboat','Catamaran','Yacht','Jetski'];
  const getParams = () => new URLSearchParams(window.location.hash.split('?')[1] || '');
  const skipperFromParams = params => params.get('skipper') || (params.get('with_skipper_only') === '1' ? 'with' : '');

  function ensureBackdrop() {
    if (document.getElementById('gbb-mobile-search-backdrop')) return;
    const div = document.createElement('div');
    div.id = 'gbb-mobile-search-backdrop';
    div.className = 'gbb-mobile-search-backdrop';
    div.addEventListener('click', closeSearch);
    document.body.appendChild(div);
  }

  function modalHeading() {
    return '<div class="gbb-mobile-modal-title"><strong>Find your escape</strong><button type="button" data-gbb-close-search aria-label="Close search">×</button></div>';
  }

  function searchTrigger(extraClass = '') {
    return `<button type="button" class="gbb-mobile-search-trigger ${extraClass}" data-gbb-open-search aria-label="Open destination and date search"><span class="gbb-search-icon">${icon('search')}</span><span class="gbb-search-copy"><strong data-gbb-location-summary>Where would you like to go?</strong><small data-gbb-date-summary>Destination · Dates · Boat type</small></span><span class="gbb-search-arrow" aria-hidden="true">›</span></button>`;
  }

  function ensureHome() {
    const hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.gbb-mobile-featured-copy')) return;
    const main = hero.closest('main');
    if (!main) return;

    const intro = document.createElement('section');
    intro.className = 'gbb-mobile-intro';
    intro.innerHTML = `<div class="gbb-mobile-eyebrow">THE SEA IS CALLING</div><h1>A boat day,<br><em>your way.</em></h1>${searchTrigger()}`;
    hero.before(intro);

    const featured = document.createElement('div');
    featured.className = 'gbb-mobile-featured-copy';
    featured.innerHTML = '<small>DISCOVER THE COAST</small><h2>Make room for<br>more moments.</h2><p>Beautiful destinations. Unforgettable days.</p>';
    hero.appendChild(featured);

    const categories = document.createElement('section');
    categories.className = 'gbb-mobile-categories';
    const items = [
      ['Motorboat','https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg?auto=compress&cs=tinysrgb&w=420'],
      ['Sailboat','https://images.pexels.com/photos/273886/pexels-photo-273886.jpeg?auto=compress&cs=tinysrgb&w=420'],
      ['Catamaran','https://images.pexels.com/photos/326410/pexels-photo-326410.jpeg?auto=compress&cs=tinysrgb&w=420']
    ];
    categories.innerHTML = `<div class="gbb-mobile-section-head"><h2>Find your kind of escape</h2><a href="#/boats">View all →</a></div><div class="gbb-mobile-type-scroll">${items.map(([type,photo]) => `<a class="gbb-mobile-type" href="#/boats?type=${encodeURIComponent(type)}"><span class="gbb-mobile-type-photo" style="background-image:url('${photo}')" role="img" aria-label="${type}"></span><span>${type} <b>→</b></span></a>`).join('')}</div>`;
    hero.after(categories);

    const destinations = document.querySelector('#destinations');
    if (destinations && !destinations.querySelector('.gbb-mobile-destinations-toggle')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gbb-mobile-destinations-toggle';
      button.textContent = 'Show all destinations ↓';
      button.addEventListener('click', () => {
        const expanded = destinations.classList.toggle('gbb-destinations-expanded');
        button.textContent = expanded ? 'Show fewer destinations ↑' : 'Show all destinations ↓';
        button.setAttribute('aria-expanded', String(expanded));
      });
      button.setAttribute('aria-expanded', 'false');
      destinations.appendChild(button);
    }
    updateTriggerSummaries();
  }

  function filterHref(changes) {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '');
    params.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      params.delete(key);
      if (value) params.append(key, value);
    }
    const query = params.toString();
    return '#/boats' + (query ? '?' + query : '');
  }

  function ensureSkipperPicker(container, beforeNode, selected) {
    if (!container || container.querySelector('.gbb-mobile-skipper-picker')) return;
    const field = document.createElement('fieldset');
    field.className = 'gbb-mobile-skipper-picker';
    field.innerHTML = `<legend>${icon('compass')} Skipper</legend><div class="gbb-mobile-skipper-options">${[
      ['','Any'],['with','With skipper'],['without','Without skipper']
    ].map(([value,label]) => `<label><input type="radio" name="skipper" value="${value}" ${selected===value?'checked':''}><span>${label}</span></label>`).join('')}</div>`;
    if (beforeNode) container.insertBefore(field,beforeNode);
    else container.appendChild(field);
  }

  function updateSelectedChips() {
    const params = getParams();
    const skipper = skipperFromParams(params);
    const types = params.getAll('type').filter(type => boatTypes.includes(type));
    const skipperLabel = skipper === 'with' ? 'With skipper' : skipper === 'without' ? 'Without skipper' : 'Skipper';
    const typeLabel = types.length === 1 ? types[0] : types.length > 1 ? types.length + ' boat types' : 'Boat type';
    document.querySelectorAll('[data-gbb-skipper-chip]').forEach(node => {
      const span = node.querySelector('span');
      if (span && span.textContent !== skipperLabel) span.textContent = skipperLabel;
      node.classList.toggle('is-selected',Boolean(skipper));
      if (node.getAttribute('aria-label') !== 'Skipper filter: '+skipperLabel) node.setAttribute('aria-label','Skipper filter: '+skipperLabel);
    });
    document.querySelectorAll('[data-gbb-type-chip]').forEach(node => {
      const span = node.querySelector('span');
      if (span && span.textContent !== typeLabel) span.textContent = typeLabel;
      node.classList.toggle('is-selected',types.length > 0);
      if (node.getAttribute('aria-label') !== 'Boat type filter: '+typeLabel) node.setAttribute('aria-label','Boat type filter: '+typeLabel);
    });
  }

  function ensureFilterSheets() {
    if (!document.getElementById('gbb-mobile-sheet-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'gbb-mobile-sheet-backdrop';
      backdrop.addEventListener('click',closeFilterPanels);
      document.body.appendChild(backdrop);
    }
    if (!document.getElementById('gbb-mobile-options-sheet')) {
      const sheet = document.createElement('section');
      sheet.id = 'gbb-mobile-options-sheet';
      sheet.setAttribute('role','dialog');
      sheet.setAttribute('aria-modal','true');
      sheet.setAttribute('aria-label','Boat search filter');
      document.body.appendChild(sheet);
    }
  }

  function openOptionsSheet(kind) {
    if (!mobile()) return;
    closeFilterPanels();
    ensureFilterSheets();
    sheetKind = kind;
    const params = getParams();
    const selected = kind === 'skipper' ? skipperFromParams(params) : params.getAll('type')[0] || '';
    const options = kind === 'skipper'
      ? [['','Any skipper','Show boats with and without a skipper.'],['with','With skipper','Enjoy your day with a professional skipper.'],['without','Without skipper','Drive yourself (a valid licence may be required).']]
      : [['','All boat types','Explore every boat type.'],...boatTypes.map(type=>[type,type,''])];
    const heading = kind === 'skipper' ? 'Skipper' : 'Boat type';
    const sheet = document.getElementById('gbb-mobile-options-sheet');
    sheet.setAttribute('aria-label',heading);
    sheet.innerHTML = `<div class="gbb-sheet-handle" aria-hidden="true"></div><div class="gbb-sheet-heading"><h2>${heading}</h2><button type="button" data-gbb-close-sheet aria-label="Close ${heading} filter">×</button></div><div class="gbb-sheet-options ${kind==='type'?'gbb-sheet-boat-types':''}">${options.map(([value,label,description]) => `<label class="gbb-sheet-option"><input type="radio" name="gbb-sheet-choice" value="${escapeText(value)}" ${selected===value?'checked':''}><span class="gbb-sheet-option-copy"><strong>${escapeText(label)}</strong>${description?`<small>${escapeText(description)}</small>`:''}</span><span class="gbb-sheet-check" aria-hidden="true"></span></label>`).join('')}</div><div class="gbb-sheet-actions"><button type="button" class="gbb-sheet-reset" data-gbb-clear-sheet>Clear</button><button type="button" class="gbb-sheet-save" data-gbb-save-sheet>Save</button></div>`;
    document.body.classList.add('gbb-mobile-sheet-open');
    sheet.querySelector('input:checked')?.closest('label')?.scrollIntoView?.({block:'nearest'});
  }

  function saveOptionsSheet(clear = false) {
    const sheet = document.getElementById('gbb-mobile-options-sheet');
    const chosen = clear ? '' : (sheet?.querySelector('input[name="gbb-sheet-choice"]:checked')?.value || '');
    const form = document.querySelector('.rental-page .rental-search-form');
    if (!form) { closeFilterPanels(); return; }
    if (sheetKind === 'skipper') {
      const picker = form.querySelector('.rental-search-bar .gbb-mobile-skipper-picker');
      const radio = [...(picker?.querySelectorAll('input[name="skipper"]') || [])].find(input => input.value === chosen);
      if (radio) radio.checked = true;
      const legacy = form.querySelector('input[name="with_skipper_only"]');
      if (legacy) legacy.checked = false;
    } else if (sheetKind === 'type') {
      form.querySelectorAll('.rental-sidebar input[name="type"]').forEach(input => {input.checked = Boolean(chosen && input.value === chosen);});
    }
    closeFilterPanels();
    form.requestSubmit();
  }

  function openMoreFilters() {
    if (!mobile()) return;
    closeFilterPanels();
    ensureFilterSheets();
    const sidebar = document.querySelector('.rental-page .rental-sidebar');
    if (!sidebar) return;
    if (!sidebar.querySelector('[data-gbb-close-more-filters]')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'gbb-more-filters-close';
      close.setAttribute('aria-label','Close more filters');
      close.setAttribute('data-gbb-close-more-filters','');
      close.textContent = '×';
      sidebar.querySelector('.rental-sidebar-head')?.prepend(close);
    }
    if (!sidebar.querySelector('.gbb-more-filters-done')) {
      const done = document.createElement('button');
      done.type = 'button';
      done.className = 'gbb-more-filters-done';
      done.setAttribute('data-gbb-close-more-filters','');
      done.textContent = 'Show matching boats';
      sidebar.appendChild(done);
    }
    sidebar.classList.add('is-open');
    document.body.classList.add('gbb-more-filters-open');
  }

  function closeFilterPanels() {
    document.body.classList.remove('gbb-mobile-sheet-open','gbb-more-filters-open');
    document.querySelector('.rental-page .rental-sidebar')?.classList.remove('is-open');
    sheetKind = '';
  }

  function ensureRental() {
    const page = document.querySelector('.rental-page');
    if (!page) return;
    if (!page.querySelector('.gbb-mobile-rental-search')) {
      const heading = page.querySelector('.rental-heading');
      if (heading) {
        const container = document.createElement('div');
        container.className = 'gbb-mobile-rental-search';
        container.innerHTML = searchTrigger('');
        heading.after(container);
      }
    }
    const searchBar = page.querySelector('.rental-search-form > .rental-search-bar');
    if (searchBar && !searchBar.querySelector('.gbb-mobile-modal-title')) {
      searchBar.insertAdjacentHTML('afterbegin',modalHeading());
    }
    if (searchBar) {
      if (mobile()) ensureSkipperPicker(searchBar,searchBar.querySelector('.rental-search-button'),skipperFromParams(getParams()));
      searchBar.querySelectorAll('.gbb-mobile-skipper-picker input').forEach(input => {
        if (input.disabled === mobile()) input.disabled = !mobile();
      });
    }
    const results = page.querySelector('.rental-results');
    if (results && !results.querySelector('.gbb-mobile-filter-chips')) {
      const chips = document.createElement('nav');
      chips.className = 'gbb-mobile-filter-chips';
      chips.setAttribute('aria-label','Quick boat filters');
      chips.innerHTML = `<button type="button" class="gbb-filter-icon-button" data-gbb-open-more-filters aria-label="More filters">${icon('sliders')}</button><button type="button" class="gbb-filter-pill" data-gbb-skipper-chip data-gbb-open-sheet="skipper"><span>Skipper</span>${icon('chevron')}</button><button type="button" class="gbb-filter-pill" data-gbb-type-chip data-gbb-open-sheet="type"><span>Boat type</span>${icon('chevron')}</button>`;
      results.insertBefore(chips,results.firstChild);
    }
    updateSelectedChips();
    updateTriggerSummaries();
  }

  function ensureBottomNav() {
    let nav = document.querySelector('.gbb-mobile-bottom-nav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'gbb-mobile-bottom-nav';
      nav.setAttribute('aria-label','Mobile navigation');
      nav.innerHTML = [
        ['#/','Discover','compass'],
        ['#/boats','Explore','search'],
        ['#/favourites','Saved','heart'],
        ['#/account','Profile','user']
      ].map(([href,label,symbol]) => `<a href="${href}">${icon(symbol)}<span>${label}</span></a>`).join('');
      document.body.appendChild(nav);
    }
    const savedLink = nav.querySelectorAll('a')[2];
    if (savedLink) {
      const owner = window.GBB_ACCOUNT_ROLE === 'owner';
      const desiredHref = owner ? '#/owner' : '#/favourites';
      if (savedLink.getAttribute('href') !== desiredHref) {
        savedLink.setAttribute('href',desiredHref);
        savedLink.innerHTML = `${icon(owner ? 'compass' : 'heart')}<span>${owner ? 'My boats' : 'Saved'}</span>`;
      }
    }
    const route = activeRoute();
    const publicPage = route === '#/' || route === '#/boats';
    document.body.classList.toggle('gbb-mobile-public-page',publicPage);
    nav.querySelectorAll('a').forEach(a => {
      const current = a.getAttribute('href') === (route === '#/boats' ? '#/boats' : route === '#/' ? '#/' : '');
      if (current) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
  }

  function updateTriggerSummaries() {
    const locationInput = document.querySelector('.rental-page .rental-where input, .hero .search-location input');
    const location = locationInput && locationInput.value.trim();
    const dateInputs = document.querySelectorAll('.rental-page .rental-search-bar input[name=start], .hero .search-widget input[name=start]');
    const startDate = dateInputs.length ? dateInputs[0].value : '';
    document.querySelectorAll('[data-gbb-location-summary]').forEach(node => {
      const text = location || 'Where would you like to go?';
      if (node.textContent !== text) node.textContent = text;
    });
    document.querySelectorAll('[data-gbb-date-summary]').forEach(node => {
      const text = startDate ? 'From ' + startDate.split('-').reverse().join('/') + ' · Choose your boat' : 'Destination · Dates · Boat type';
      if (node.textContent !== text) node.textContent = text;
    });
  }

  function openSearch() {
    if (!mobile()) return;
    ensureBackdrop();
    if (document.body.classList.contains('gbb-search-open')) return;
    let form = document.querySelector('.hero .search-widget');
    if (form) {
      oldFormParent = form.parentNode;
      oldFormSibling = form.nextSibling;
      movedForm = form;
      if (!form.querySelector('.gbb-mobile-modal-title')) form.insertAdjacentHTML('afterbegin',modalHeading());
      document.body.appendChild(form);
      form.classList.add('gbb-mobile-search-dialog');
      ensureSkipperPicker(form,form.querySelector('.btn-search'),skipperFromParams(getParams()));
    } else {
      form = document.querySelector('.rental-page .rental-search-bar');
      if (!form) return;
      form.classList.add('gbb-mobile-search-dialog');
    }
    document.body.classList.add('gbb-search-open');
    const locationInput = form.querySelector('input[name=location]');
    if (locationInput) setTimeout(() => locationInput.focus({preventScroll:true}),80);
  }

  function closeSearch() {
    document.body.classList.remove('gbb-search-open');
    if (movedForm) {
      movedForm.classList.remove('gbb-mobile-search-dialog');
      if (oldFormParent && oldFormParent.isConnected) {
        if (oldFormSibling && oldFormSibling.parentNode === oldFormParent) oldFormParent.insertBefore(movedForm,oldFormSibling);
        else oldFormParent.appendChild(movedForm);
      } else movedForm.remove();
      movedForm = oldFormParent = oldFormSibling = null;
    }
    document.querySelectorAll('.rental-search-bar.gbb-mobile-search-dialog').forEach(bar => bar.classList.remove('gbb-mobile-search-dialog'));
    updateTriggerSummaries();
  }

  function enhance() {
    scheduled = false;
    ensureBackdrop();
    ensureFilterSheets();
    ensureHome();
    ensureRental();
    ensureBottomNav();
  }
  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(enhance,60);
  }

  document.addEventListener('click',event => {
    if (event.target.closest('[data-gbb-open-search]')) { event.preventDefault(); openSearch(); }
    if (event.target.closest('[data-gbb-close-search]')) { event.preventDefault(); closeSearch(); }
    if (event.target.closest('[data-gbb-open-sheet]')) { event.preventDefault(); openOptionsSheet(event.target.closest('[data-gbb-open-sheet]').dataset.gbbOpenSheet); }
    if (event.target.closest('[data-gbb-close-sheet]')) { event.preventDefault(); closeFilterPanels(); }
    if (event.target.closest('[data-gbb-save-sheet]')) { event.preventDefault(); saveOptionsSheet(); }
    if (event.target.closest('[data-gbb-clear-sheet]')) { event.preventDefault(); saveOptionsSheet(true); }
    if (event.target.closest('[data-gbb-open-more-filters]')) { event.preventDefault(); openMoreFilters(); }
    if (event.target.closest('[data-gbb-close-more-filters]')) { event.preventDefault(); closeFilterPanels(); }
  });
  document.addEventListener('keydown',event => {
    if (event.key==='Escape' && document.body.classList.contains('gbb-search-open')) closeSearch();
    if (event.key==='Escape') closeFilterPanels();
  });
  document.addEventListener('submit',event => {
    if (event.target.classList?.contains('search-widget') || event.target.classList?.contains('rental-search-form')) {
      setTimeout(closeSearch,0);
    }
  });
  window.addEventListener('hashchange',() => { closeSearch(); closeFilterPanels(); scheduleEnhance(); });
  window.addEventListener('resize',() => { if (!mobile()) closeSearch(); scheduleEnhance(); });
  const app = document.getElementById('app');
  if (app) new MutationObserver(scheduleEnhance).observe(app,{childList:true,subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',enhance,{once:true});
  else enhance();
})();
