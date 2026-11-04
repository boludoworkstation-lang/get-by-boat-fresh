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
      ship: '<path d="M4 15h16l-2.5 5h-11L4 15Zm4-8h8v8H8V7Zm-3 0h14M12 3v4"/>',
      // Boat silhouettes show the actual hull/propulsion differences at small sizes.
      motorboat: '<path d="M2 17h20l-3.5 4H5.5L2 17Zm5-1 1.4-4h7l3 4M9 12V8.5h5l3 3.5M18.5 15h2v3M4 22h16"/>',
      rib: '<path d="M2.5 16c.6-2 2.1-3.2 4.5-3.2h10c2.7 0 4.5 1.4 4.5 3.2 0 3-4 5-9.5 5s-9.5-2-9.5-5ZM4 16h16M8 12.8 9.2 9H14l2 3.8M17.5 12V6h3M18 8h2.5"/>',
      sailboat: '<path d="M12 2v16M10 5 4 17h6V5Zm4 1 6 11h-6V6ZM3 19h18l-3 3H6l-3-3Z"/>',
      catamaran: '<path d="M12 2v15M10 5 4 16h6V5Zm4 1 6 10h-6V6ZM8 17h8M2 19h8l-2 3H4l-2-3Zm12 0h8l-2 3h-4l-2-3Z"/>',
      yacht: '<path d="M2 17h20l-3.5 4h-13L2 17ZM5 17l2-6h12l2 6M9 11V7h7l2 4M12 7V4h4v3M8 14h3m3 0h3"/>',
      jetski: '<path d="M3 17.5c3.5-.3 6-3.4 10.6-3.4h4.2l3.2 3.4-4.4 3H8L3 17.5ZM9.6 14l2.2-4.4h4.5l2.1 4.4M14.4 9.6l-2-2.1M18.5 9.5h3M6 22h13"/>',
      // Equipment matches the line-icon language already used on listing pages.
      gps: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 6-5 2 2-5z"/>',
      speakers: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><circle cx="6.5" cy="14" r="2"/><circle cx="17.5" cy="14" r="2"/>',
      bimini: '<path d="M2 12c3.5-7 16.5-7 20 0H2ZM5 12v9m14-9v9M4 21h16M8 12l-1.5-2M16 12l1.5-2"/>',
      anchor: '<path d="M12 3v15M8 7h8M4 13a8 8 0 0 0 16 0M4 13l-2 3M20 13l2 3M10 21h4"/>',
      shower: '<path d="M4 22V9a5 5 0 0 1 10 0M11 9h7l2 3H9zM12 15v2M16 15v3M20 15v2"/>',
      skis: '<path d="M7 3 3 21h4l4-18H7Zm9 0-4 18h4l4-18h-4ZM5.5 12h4M14.5 12h4"/>',
      banana: '<path d="M2.5 10c5.5 11 13.5 11 19 0-2 10-8 12-13.5 8-3-2.3-5.3-5.4-5.5-8ZM7 11l1-3m4 5 1-3m3 3 1-3"/>',
      tube: '<circle cx="12" cy="11" r="8"/><circle cx="12" cy="11" r="3"/><path d="M3 22c3-3 5-3 8 0s5-3 10 0"/>',
      wakeboard: '<path d="M3 15c3-9 15-9 18 0-3 6-15 6-18 0ZM9 11l5 8m0-9-5 8"/>',
      snowflake: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/>',
      autopilot: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M8 16l4-9 4 9-4-2-4 2Z"/>',
      dinghy: '<path d="M3 13h18l-3 6H7l-4-6ZM8 13l3-7h4l3 7M3 21c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
      thruster: '<circle cx="12" cy="12" r="9"/><path d="m12 12 4-5-1 6-3-1ZM12 12l5 4-6-1 1-3ZM12 12l-4 5 1-6 3 1ZM12 12 7 8l6 1-1 3Z"/>'
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
  const equipmentIcons = {gps:'gps',outdoor_speakers:'speakers',bimini:'bimini',electric_windlass:'anchor',outdoor_shower:'shower',water_skis:'skis',banana:'banana',towable_tube:'tube',wakeboard:'wakeboard',air_conditioning:'snowflake',autopilot:'autopilot',dinghy:'dinghy',bow_thruster:'thruster'};
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
    field.innerHTML = `<legend>${icon('compass')} Skipper</legend><input type="hidden" name="skipper" value="${selected}"><div class="gbb-mobile-skipper-options">${[
      ['with','With skipper'],['without','Without skipper']
    ].map(([value,label]) => `<button type="button" data-gbb-pick-skipper="${value}" aria-pressed="${selected===value}">${label}</button>`).join('')}</div>`;
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
    const selected = kind === 'skipper' ? skipperFromParams(params) :
      [...new Set(params.getAll('type').filter(type => boatTypes.includes(type)))];
    const options = kind === 'skipper'
      ? [['with','With skipper','Enjoy your day with a professional skipper.'],['without','Without skipper','Drive yourself (a valid licence may be required).']]
      : [['','All boats','Explore every boat type.'],...boatTypes.map(type=>[type,type,''])];
    const heading = kind === 'skipper' ? 'Skipper' : 'Boat type';
    const sheet = document.getElementById('gbb-mobile-options-sheet');
    sheet.setAttribute('aria-label',heading);
    sheet.innerHTML = `<div class="gbb-sheet-handle" aria-hidden="true"></div><div class="gbb-sheet-heading"><h2>${heading}</h2><button type="button" data-gbb-close-sheet aria-label="Close ${heading} filter">×</button></div><div class="gbb-sheet-options ${kind==='type'?'gbb-sheet-boat-types':''}">${options.map(([value,label,description]) => `<label class="gbb-sheet-option ${kind==='type'&&!value?'gbb-sheet-option-all':''}"><input type="${kind==='type'?'checkbox':'radio'}" name="gbb-sheet-choice" value="${escapeText(value)}" ${(kind==='type'?(value?selected.includes(value):selected.length===0):selected===value)?'checked':''}><span class="gbb-sheet-option-copy"><strong>${escapeText(label)}</strong>${description?`<small>${escapeText(description)}</small>`:''}</span><span class="gbb-sheet-check" aria-hidden="true"></span></label>`).join('')}</div><div class="gbb-sheet-actions"><button type="button" class="gbb-sheet-reset" data-gbb-clear-sheet>Clear</button><button type="button" class="gbb-sheet-save" data-gbb-save-sheet>Save</button></div>`;
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
      const field = picker?.querySelector('input[name="skipper"]');
      if (field) field.value = chosen;
      picker?.querySelectorAll('[data-gbb-pick-skipper]').forEach(button => {
        button.setAttribute('aria-pressed',String(button.dataset.gbbPickSkipper === chosen));
      });
      const legacy = form.querySelector('input[name="with_skipper_only"]');
      if (legacy) legacy.checked = false;
    } else if (sheetKind === 'type') {
      const selectedTypes = clear ? [] : [...(sheet?.querySelectorAll('input[name="gbb-sheet-choice"]:checked') || [])]
        .map(input => input.value).filter(value => boatTypes.includes(value));
      form.querySelectorAll('.rental-sidebar input[name="type"]').forEach(input => {
        input.checked = selectedTypes.includes(input.value);
      });
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
    // The sidebar already contains a working submit button. Never add a second one.
    sidebar.querySelector('.gbb-more-filters-done')?.remove();
    sidebar.classList.add('is-open');
    document.body.classList.add('gbb-more-filters-open');
  }

  function decorateSidebarChoices(page) {
    if (!mobile()) {
      page.querySelectorAll('.rental-sidebar .gbb-filter-choice-icon').forEach(node => node.remove());
      return;
    }
    page.querySelectorAll('.rental-sidebar .rental-check input[name="type"]').forEach(input => {
      input.closest('label')?.querySelector('.gbb-filter-choice-icon')?.remove();
    });
    page.querySelectorAll('.rental-sidebar .rental-check input[name="equipment"]').forEach(input => {
      const label = input.closest('label');
      if (!label || label.querySelector('.gbb-filter-choice-icon')) return;
      const name = equipmentIcons[input.value];
      if (!name) return;
      const wrapper = document.createElement('span');
      wrapper.className = 'gbb-filter-choice-icon';
      wrapper.setAttribute('aria-hidden','true');
      wrapper.innerHTML = icon(name);
      input.after(wrapper);
    });
  }

  function closeFilterPanels() {
    document.body.classList.remove('gbb-mobile-sheet-open','gbb-more-filters-open');
    document.querySelector('.rental-page .rental-sidebar')?.classList.remove('is-open');
    sheetKind = '';
  }

  function ensureRental() {
    const page = document.querySelector('.rental-page');
    if (!page) return;
    decorateSidebarChoices(page);
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

  function hideGuestBookingsFromMenu() {
    const menu = document.querySelector('.site-head .mobile-menu');
    if (!menu) return;
    const isGuest = Boolean(menu.querySelector('a[href="#/login"]'));
    const bookings = menu.querySelector('a[href="#/bookings"]');
    if (bookings) bookings.hidden = mobile() && isGuest;
  }

  function arrangeMobileFooter() {
    const columns = document.querySelector('.footer .footer-columns');
    const brand = columns?.firstElementChild;
    const social = columns?.querySelector('.footer-social');
    const apps = columns?.querySelector('.footer-apps');
    if (!brand || !social || !apps) return;
    const members = columns.querySelector('.footer-members-column');
    const links = columns.querySelector('.gbb-footer-links') || [...columns.children].find(section =>
      section.querySelector(':scope > h4')?.textContent.trim() === 'Get By Boat');
    const destinations = columns.querySelector('.gbb-footer-destinations') || [...columns.children].find(section =>
      section.querySelector(':scope > h4')?.textContent.trim() === 'Say hello to summer');
    if (!links || !destinations) return;
    links.classList.add('gbb-footer-links');
    destinations.classList.add('gbb-footer-destinations');
    const countries = columns.querySelector('.footer-countries');
    if (countries && !countries.querySelector('.gbb-mobile-country-grid')) {
      // The desktop separator text nodes must not become anonymous grid cells.
      const grid = document.createElement('nav');
      grid.className = 'gbb-mobile-country-grid';
      grid.setAttribute('aria-label','Destinations');
      countries.querySelectorAll(':scope > a').forEach(link => grid.appendChild(link.cloneNode(true)));
      countries.appendChild(grid);
    }
    // Keep "Follow us" under the brand slogan on every screen size.
    if (social.parentElement !== brand) brand.insertBefore(social, apps.parentElement === brand ? apps : null);
    const onPhone = mobile();
    if (onPhone && apps.parentElement !== columns) columns.appendChild(apps);
    if (!onPhone && apps.parentElement !== brand) brand.appendChild(apps);

    // Restore the desktop order when resizing. Only move nodes when necessary,
    // because the footer is observed for dynamic app renders.
    const desired = onPhone
      ? [brand, members, destinations, links, apps]
      : [brand, members, links, destinations];
    desired.filter(Boolean).forEach((node, index) => {
      if (columns.children[index] !== node) {
        columns.insertBefore(node, columns.children[index] || null);
      }
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
    hideGuestBookingsFromMenu();
    arrangeMobileFooter();
  }
  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(enhance,60);
  }

  document.addEventListener('click',event => {
    const skipperButton = event.target.closest('[data-gbb-pick-skipper]');
    if (skipperButton) {
      event.preventDefault();
      const picker = skipperButton.closest('.gbb-mobile-skipper-picker');
      const field = picker?.querySelector('input[name="skipper"]');
      if (field) {
        const next = field.value === skipperButton.dataset.gbbPickSkipper ? '' : skipperButton.dataset.gbbPickSkipper;
        field.value = next;
        picker.querySelectorAll('[data-gbb-pick-skipper]').forEach(button => {
          button.setAttribute('aria-pressed',String(button.dataset.gbbPickSkipper === next));
        });
      }
    }
    if (event.target.closest('[data-gbb-open-search]')) { event.preventDefault(); openSearch(); }
    if (event.target.closest('[data-gbb-close-search]')) { event.preventDefault(); closeSearch(); }
    if (event.target.closest('[data-gbb-open-sheet]')) { event.preventDefault(); openOptionsSheet(event.target.closest('[data-gbb-open-sheet]').dataset.gbbOpenSheet); }
    if (event.target.closest('[data-gbb-close-sheet]')) { event.preventDefault(); closeFilterPanels(); }
    if (event.target.closest('[data-gbb-save-sheet]')) { event.preventDefault(); saveOptionsSheet(); }
    if (event.target.closest('[data-gbb-clear-sheet]')) { event.preventDefault(); saveOptionsSheet(true); }
    if (event.target.closest('[data-gbb-open-more-filters]')) { event.preventDefault(); openMoreFilters(); }
    if (event.target.closest('[data-gbb-close-more-filters]')) { event.preventDefault(); closeFilterPanels(); }
  });
  document.addEventListener('change',event => {
    const input = event.target;
    if (!input.matches?.('#gbb-mobile-options-sheet .gbb-sheet-boat-types input[name="gbb-sheet-choice"]')) return;
    const sheet = input.closest('.gbb-sheet-boat-types');
    const allBoats = sheet.querySelector('input[value=""]');
    if (input === allBoats) {
      allBoats.checked = true;
      sheet.querySelectorAll('input[name="gbb-sheet-choice"]').forEach(choice => {
        if (choice !== allBoats) choice.checked = false;
      });
    } else {
      allBoats.checked = !sheet.querySelector('input[name="gbb-sheet-choice"]:checked:not([value=""])');
    }
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
