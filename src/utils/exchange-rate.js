const CACHE_KEY = 'aobobo:exchange-rates:v1';
const DEFAULT_TARGET_CURRENCY = 'CNY';
const DEFAULT_API_BASE = 'https://api.frankfurter.dev/v2';
const DEFAULT_CACHE_HOURS = 24;

const CURRENCY_ALIASES = {
  CNY: 'CNY',
  RMB: 'CNY',
  'CN¥': 'CNY',
  '¥': 'CNY',
  '￥': 'CNY',
  元: 'CNY',
  人民币: 'CNY',
  USD: 'USD',
  US$: 'USD',
  $: 'USD',
  美元: 'USD',
  EUR: 'EUR',
  '€': 'EUR',
  欧元: 'EUR',
  HKD: 'HKD',
  HK$: 'HKD',
  港币: 'HKD',
  SGD: 'SGD',
  S$: 'SGD',
  新币: 'SGD',
  新加坡元: 'SGD',
  JPY: 'JPY',
  'JP¥': 'JPY',
  円: 'JPY',
  日元: 'JPY',
  GBP: 'GBP',
  '£': 'GBP',
  英镑: 'GBP',
  AUD: 'AUD',
  A$: 'AUD',
  AU$: 'AUD',
  CAD: 'CAD',
  C$: 'CAD',
  CA$: 'CAD',
  TWD: 'TWD',
  NT$: 'TWD',
  台币: 'TWD',
  KRW: 'KRW',
  '₩': 'KRW',
  韩元: 'KRW',
};

const CURRENCY_SYMBOLS = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  HKD: 'HK$',
  SGD: 'S$',
  JPY: '¥',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  TWD: 'NT$',
  KRW: '₩',
};

const SORTED_ALIAS_KEYS = Object.keys(CURRENCY_ALIASES)
  .sort((a, b) => b.length - a.length);

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function readCache() {
  const storage = getStorage();
  if (!storage) {
    return {};
  }
  try {
    const data = JSON.parse(storage.getItem(CACHE_KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage can be unavailable in private mode; exchange still works without cache.
  }
}

function pairKey(base, target) {
  return `${base}->${target}`;
}

function toCacheHours(value) {
  const hours = Number(value);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_CACHE_HOURS;
}

function trimApiBase(apiBase) {
  return String(apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
}

function getCachedPair(cache, base, target, cacheHours) {
  const item = cache[pairKey(base, target)];
  if (!item || !Number.isFinite(Number(item.rate))) {
    return null;
  }
  const fetchedAt = Number(item.fetchedAt) || 0;
  const age = Date.now() - fetchedAt;
  return {
    ...item,
    rate: Number(item.rate),
    fetchedAt,
    stale: age > toCacheHours(cacheHours) * 60 * 60 * 1000,
  };
}

function compactCurrencyToken(token) {
  return String(token || '')
    .trim()
    .replace(/[()（）]/g, '')
    .replace(/\/.*$/, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function findCurrencyToken(text) {
  const compact = compactCurrencyToken(text);
  if (!compact) {
    return '';
  }

  const alias = SORTED_ALIAS_KEYS.find((key) => compact.includes(key.toUpperCase()));
  if (alias) {
    return alias;
  }

  const iso = compact.match(/[A-Z]{3}/);
  return iso ? iso[0] : '';
}

export function normalizeCurrencyCode(token, fallback = DEFAULT_TARGET_CURRENCY) {
  const compact = compactCurrencyToken(token);
  if (!compact) {
    return fallback !== undefined ? fallback : DEFAULT_TARGET_CURRENCY;
  }

  if (CURRENCY_ALIASES[compact]) {
    return CURRENCY_ALIASES[compact];
  }

  if (/^[A-Z]{3}$/.test(compact)) {
    return compact;
  }

  return fallback !== undefined ? fallback : DEFAULT_TARGET_CURRENCY;
}

export function getCurrencySymbol(currency) {
  const code = normalizeCurrencyCode(currency, DEFAULT_TARGET_CURRENCY);
  return CURRENCY_SYMBOLS[code] || `${code} `;
}

export function parseBillingCostAmount(amount, defaultCurrency = DEFAULT_TARGET_CURRENCY) {
  if (amount === null || amount === undefined) {
    return { type: 'empty', raw: '' };
  }

  const raw = String(amount).trim();
  if (!raw) {
    return { type: 'empty', raw };
  }

  if (raw === '-1' || /^(按量|按需|usage|metered)$/i.test(raw)) {
    return { type: 'metered', raw };
  }

  if (raw === '0' || /^(免费|free)$/i.test(raw)) {
    return {
      type: 'free',
      raw,
      value: 0,
      currency: normalizeCurrencyCode(defaultCurrency, DEFAULT_TARGET_CURRENCY),
    };
  }

  const normalized = raw.replace(/,/g, '');
  const match = normalized.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) {
    return { type: 'invalid', raw };
  }

  const value = Number(match[0]);
  if (!Number.isFinite(value)) {
    return { type: 'invalid', raw };
  }

  if (value === 0) {
    return {
      type: 'free',
      raw,
      value: 0,
      currency: normalizeCurrencyCode(defaultCurrency, DEFAULT_TARGET_CURRENCY),
    };
  }

  if (value < 0) {
    return { type: 'metered', raw };
  }

  const prefix = normalized.slice(0, match.index).trim();
  const suffix = normalized.slice(match.index + match[0].length).trim();
  const token = findCurrencyToken(prefix) || findCurrencyToken(suffix);
  const defaultCurrencyCode = normalizeCurrencyCode(defaultCurrency, DEFAULT_TARGET_CURRENCY);
  const currency = normalizeCurrencyCode(token, defaultCurrencyCode);

  return {
    type: 'fixed',
    raw,
    value,
    currency,
  };
}

export function formatCurrencyValue(value, currency = DEFAULT_TARGET_CURRENCY) {
  if (!Number.isFinite(Number(value))) {
    return '-';
  }

  const code = normalizeCurrencyCode(currency, DEFAULT_TARGET_CURRENCY);
  const symbol = getCurrencySymbol(code);
  const number = Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${number}`;
}

async function fetchExchangeRate(base, target, apiBase) {
  const url = `${trimApiBase(apiBase)}/rate/${encodeURIComponent(base)}/${encodeURIComponent(target)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Exchange rate request failed: ${response.status}`);
  }
  const data = await response.json();
  const rate = Number(data?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Exchange rate response missing rate');
  }
  return {
    rate,
    date: data?.date || '',
  };
}

export async function loadExchangeRatesForCurrencies(currencies, targetCurrency, options = {}) {
  const target = normalizeCurrencyCode(targetCurrency, DEFAULT_TARGET_CURRENCY);
  const enabled = options.enabled !== false;
  const cacheHours = toCacheHours(options.cacheHours);
  const apiBase = options.apiBase || DEFAULT_API_BASE;
  const now = Date.now();
  const cache = readCache();
  const rates = {
    [target]: {
      rate: 1,
      fetchedAt: now,
      source: 'base',
      date: '',
      stale: false,
    },
  };
  const missingCurrencies = [];
  const staleCurrencies = [];
  const fetchedCurrencies = [];
  const cachedCurrencies = [];

  const sourceCurrencies = [...new Set((currencies || [])
    .map((currency) => normalizeCurrencyCode(currency, ''))
    .filter((currency) => currency && currency !== target))]
    .sort();

  if (!enabled) {
    return {
      targetCurrency: target,
      rates,
      missingCurrencies: sourceCurrencies,
      staleCurrencies,
      fetchedCurrencies,
      cachedCurrencies,
      updatedAt: 0,
      disabled: true,
      error: '',
    };
  }

  await Promise.all(sourceCurrencies.map(async (base) => {
    const cached = getCachedPair(cache, base, target, cacheHours);
    if (cached && !cached.stale) {
      rates[base] = {
        ...cached,
        source: 'cache',
      };
      cachedCurrencies.push(base);
      return;
    }

    try {
      const remote = await fetchExchangeRate(base, target, apiBase);
      const item = {
        rate: remote.rate,
        fetchedAt: Date.now(),
        source: 'frankfurter',
        date: remote.date,
      };
      cache[pairKey(base, target)] = item;
      rates[base] = {
        ...item,
        stale: false,
      };
      fetchedCurrencies.push(base);
    } catch {
      if (cached) {
        rates[base] = {
          ...cached,
          source: 'stale-cache',
          stale: true,
        };
        staleCurrencies.push(base);
      } else {
        missingCurrencies.push(base);
      }
    }
  }));

  writeCache(cache);

  const updatedAt = Object.values(rates)
    .filter((item) => item.source !== 'base')
    .reduce((max, item) => Math.max(max, Number(item.fetchedAt) || 0), 0);

  return {
    targetCurrency: target,
    rates,
    missingCurrencies,
    staleCurrencies,
    fetchedCurrencies,
    cachedCurrencies,
    updatedAt,
    disabled: false,
    error: '',
  };
}
