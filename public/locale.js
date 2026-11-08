(() => {
  const languages = {en:'English', de:'Deutsch', fr:'Français', it:'Italiano', es:'Español', pl:'Polski', hu:'Magyar', el:'Ελληνικά'};
  const countryCurrencies = {
    'united states':'USD', usa:'USD', us:'USD', australia:'AUD', au:'AUD',
    bahamas:'BSD', bs:'BSD', albania:'ALL', al:'ALL', turkey:'TRY', türkiye:'TRY', tr:'TRY',
    germany:'EUR', france:'EUR', italy:'EUR', spain:'EUR', poland:'PLN', hungary:'HUF', greece:'EUR'
  };
  let language = 'en';
  try {
    const saved = localStorage.getItem('gbb.language');
    if (Object.hasOwn(languages, saved)) language = saved;
  } catch {}
  const picker = () => `<select class="site-language-picker" data-site-language aria-label="Website language">${Object.entries(languages).map(([code,label])=>`<option value="${code}"${code===language?' selected':''}>${label}</option>`).join('')}</select>`;
  const rates = {EUR:1};
  const businessCurrency = code => ({US:'USD', AU:'AUD', BS:'BSD', AL:'ALL', TR:'TRY', PL:'PLN', HU:'HUF'}[code] || 'EUR');
  const supportedCurrencies = ['EUR','USD','AUD','BSD','ALL','TRY','PLN','HUF'];
  const registeredPricing = boat => {
    const entry = boat?.specifications?.registered_pricing;
    return supportedCurrencies.includes(entry?.currency) && Number.isFinite(entry.eur_rate) && entry.eur_rate > 0 ? entry : null;
  };
  const nativeMoney = (value,currency) => new Intl.NumberFormat(language === 'en' ? 'en-IE' : language,{style:'currency',currency,currencyDisplay:currency === 'EUR' ? 'symbol' : 'code',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  const format = (amount, currency) => {
    const rate = currency !== 'EUR' && rates[currency];
    const displayCurrency = rate ? currency : 'EUR';
    return (rate ? '≈ ' : '') + new Intl.NumberFormat(language === 'en' ? 'en-IE' : language, {
      style:'currency', currency:displayCurrency, currencyDisplay:displayCurrency === 'EUR' ? 'symbol' : 'code'
    }).format(amount * (rate || 1));
  };
  const price = (value, country) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '';
    const key = String(country).trim().toLowerCase();
    const currency = Object.hasOwn(countryCurrencies,key) ? countryCurrencies[key] : 'EUR';
    return `<span data-local-price="${amount}" data-local-currency="${currency}">${format(amount, currency)}</span>`;
  };
  const fixedPrice = (value,currency) => `<span data-local-price="${Number(value)}" data-local-currency="${currency}" data-fixed-price>${nativeMoney(value,currency)}</span>`;
  const refreshPrices = () => document.querySelectorAll('[data-local-price]').forEach(node => {
    const amount=Number(node.dataset.localPrice),currency=node.dataset.localCurrency;
    const label = node.hasAttribute('data-fixed-price') ? nativeMoney(amount,currency) : format(amount,currency);
    if (node.textContent !== label) node.textContent = label;
  });

  const originals = new WeakMap();
  const attributes = new WeakMap();
  const countries={Croatia:'HR',Greece:'GR',Spain:'ES',France:'FR',Italy:'IT',Malta:'MT',Portugal:'PT',Cyprus:'CY',Montenegro:'ME',Turkey:'TR',Albania:'AL',Australia:'AU',Bahamas:'BS','United States':'US'};
  let regions;
  const translate = key => {
    if(language==='en')return key;
    if(Object.hasOwn(countries,key))return (regions ||= new Intl.DisplayNames(language,{type:'region'})).of(countries[key]);
    return window.GBB_TRANSLATIONS?.[key]?.[Object.keys(languages).indexOf(language)-1] || key;
  };
  function localize(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement?.closest('script, style, textarea, option:not([value]), [data-site-language], [data-local-price], [data-user-content], .booking-message, .rental-card h3, .listing-title')) return;
      const current = root.data;
      const previous = originals.get(root);
      const source = previous?.translated === current ? previous.source : current;
      const translated = source.replace(/\S(?:.*\S)?/s, value => translate(value));
      originals.set(root, {source, translated});
      if (translated !== current) root.data = translated;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.closest('[data-user-content]')) return;
    for (const attr of ['aria-label','placeholder','title','alt']) {
      const current = root.getAttribute(attr);
      if (current === null) continue;
      const entries = attributes.get(root) || {};
      const source = entries[attr]?.translated === current ? entries[attr].source : current;
      const translated = translate(source);
      entries[attr] = {source, translated};
      attributes.set(root, entries);
      if (translated !== current) root.setAttribute(attr, translated);
    }
    root.childNodes.forEach(localize);
  }
  const ready = fetch('/api/display-exchange-rates').then(response => response.ok ? response.json() : null).then(data => {
    for (const currency of supportedCurrencies.slice(1)) {
      if (Number.isFinite(data?.[currency]) && data[currency] > 0) rates[currency] = data[currency];
    }
    refreshPrices();
  }).catch(() => {});
  window.GBB_LOCALE = {picker, price, fixedPrice, businessCurrency, registeredPricing, nativeMoney, ready, rate:currency=>rates[currency], translate, dateLocale:()=>language==='en'?'en-GB':language};
  document.documentElement.lang = language;
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-site-language]') || !Object.hasOwn(languages,event.target.value)) return;
    language = event.target.value;
    regions = undefined;
    try { localStorage.setItem('gbb.language', language); } catch {}
    document.documentElement.lang = language;
    document.querySelectorAll('[data-site-language]').forEach(select => { select.value = language; });
    localize(document.body);
    refreshPrices();
  });
  document.addEventListener('DOMContentLoaded', () => {
    if (language !== 'en') localize(document.body);
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData' && (language !== 'en' || originals.has(record.target))) localize(record.target);
        for (const node of record.addedNodes) if (language !== 'en') localize(node);
      }
    }).observe(document.body, {subtree:true, childList:true, characterData:true});
  });
})();
