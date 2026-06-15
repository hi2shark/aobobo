const LOCATION_TIMEZONE_MAP = {};

function assignTimeZone(codes, timeZone) {
  codes.forEach((code) => {
    LOCATION_TIMEZONE_MAP[code] = timeZone;
  });
}

assignTimeZone(['PEK', 'PVG', 'CKG', 'TFU'], 'Asia/Shanghai');
assignTimeZone(['HKG'], 'Asia/Hong_Kong');
assignTimeZone(['MFM'], 'Asia/Macau');
assignTimeZone(['TPE'], 'Asia/Taipei');
assignTimeZone(['TYO', 'OSA'], 'Asia/Tokyo');
assignTimeZone(['SEL'], 'Asia/Seoul');
assignTimeZone(['SIN'], 'Asia/Singapore');
assignTimeZone(['JHB', 'KUL'], 'Asia/Kuala_Lumpur');
assignTimeZone(['BKK'], 'Asia/Bangkok');
assignTimeZone(['HAN', 'SGN'], 'Asia/Ho_Chi_Minh');
assignTimeZone(['BOM', 'DEL'], 'Asia/Kolkata');
assignTimeZone(['DXB'], 'Asia/Dubai');
assignTimeZone(['IST'], 'Europe/Istanbul');
assignTimeZone(['LAX', 'LAS', 'SJC', 'SEA', 'SFO', 'PDX', 'SAN'], 'America/Los_Angeles');
assignTimeZone(['SLC', 'DEN'], 'America/Denver');
assignTimeZone(['PHX'], 'America/Phoenix');
assignTimeZone(['ORD', 'DFW', 'MSP'], 'America/Chicago');
assignTimeZone(['NYC', 'IAD', 'MIA', 'ATL', 'BOS', 'PHL', 'CLT'], 'America/New_York');
assignTimeZone(['HNL'], 'Pacific/Honolulu');
assignTimeZone(['YYZ'], 'America/Toronto');
assignTimeZone(['YVR'], 'America/Vancouver');
assignTimeZone(['MEX'], 'America/Mexico_City');
assignTimeZone(['SCQ'], 'America/Santiago');
assignTimeZone(['GRU'], 'America/Sao_Paulo');
assignTimeZone(['BOG'], 'America/Bogota');
assignTimeZone(['LIM'], 'America/Lima');
assignTimeZone(['BUE'], 'America/Argentina/Buenos_Aires');
assignTimeZone(['SYD'], 'Australia/Sydney');
assignTimeZone(['AKL'], 'Pacific/Auckland');
assignTimeZone(['AMS'], 'Europe/Amsterdam');
assignTimeZone(['LON'], 'Europe/London');
assignTimeZone(['FRA', 'BER'], 'Europe/Berlin');
assignTimeZone(['LUX'], 'Europe/Luxembourg');
assignTimeZone(['CDG'], 'Europe/Paris');
assignTimeZone(['WAW'], 'Europe/Warsaw');
assignTimeZone(['MAD'], 'Europe/Madrid');
assignTimeZone(['MXP'], 'Europe/Rome');
assignTimeZone(['SVO'], 'Europe/Moscow');
assignTimeZone(['OTP'], 'Europe/Bucharest');
assignTimeZone(['SOF'], 'Europe/Sofia');
assignTimeZone(['VNO'], 'Europe/Vilnius');
assignTimeZone(['OSL'], 'Europe/Oslo');
assignTimeZone(['HEL'], 'Europe/Helsinki');
assignTimeZone(['STO'], 'Europe/Stockholm');
assignTimeZone(['CPH'], 'Europe/Copenhagen');
assignTimeZone(['VIE'], 'Europe/Vienna');
assignTimeZone(['PRG'], 'Europe/Prague');
assignTimeZone(['BUD'], 'Europe/Budapest');
assignTimeZone(['ATH'], 'Europe/Athens');
assignTimeZone(['ZRH'], 'Europe/Zurich');
assignTimeZone(['BRU'], 'Europe/Brussels');
assignTimeZone(['DUB'], 'Europe/Dublin');
assignTimeZone(['LIS'], 'Europe/Lisbon');
assignTimeZone(['KBP'], 'Europe/Kiev');
assignTimeZone(['TBS'], 'Asia/Tbilisi');
assignTimeZone(['TEL'], 'Asia/Jerusalem');
assignTimeZone(['RBA'], 'Africa/Casablanca');
assignTimeZone(['JKT'], 'Asia/Jakarta');
assignTimeZone(['MNL'], 'Asia/Manila');
assignTimeZone(['JNB'], 'Africa/Johannesburg');
assignTimeZone(['CAI'], 'Africa/Cairo');
assignTimeZone(['NBO'], 'Africa/Nairobi');

const COUNTRY_TIMEZONE_MAP = {
  中国: 'Asia/Shanghai',
  日本: 'Asia/Tokyo',
  韩国: 'Asia/Seoul',
  新加坡: 'Asia/Singapore',
  马来西亚: 'Asia/Kuala_Lumpur',
  泰国: 'Asia/Bangkok',
  越南: 'Asia/Ho_Chi_Minh',
  印度: 'Asia/Kolkata',
  阿联酋: 'Asia/Dubai',
  土耳其: 'Europe/Istanbul',
  荷兰: 'Europe/Amsterdam',
  英国: 'Europe/London',
  德国: 'Europe/Berlin',
  卢森堡: 'Europe/Luxembourg',
  法国: 'Europe/Paris',
  波兰: 'Europe/Warsaw',
  西班牙: 'Europe/Madrid',
  意大利: 'Europe/Rome',
  俄罗斯: 'Europe/Moscow',
  罗马尼亚: 'Europe/Bucharest',
  保加利亚: 'Europe/Sofia',
  立陶宛: 'Europe/Vilnius',
  挪威: 'Europe/Oslo',
  摩洛哥: 'Africa/Casablanca',
  印度尼西亚: 'Asia/Jakarta',
  菲律宾: 'Asia/Manila',
  芬兰: 'Europe/Helsinki',
  瑞典: 'Europe/Stockholm',
  丹麦: 'Europe/Copenhagen',
  奥地利: 'Europe/Vienna',
  捷克: 'Europe/Prague',
  匈牙利: 'Europe/Budapest',
  希腊: 'Europe/Athens',
  瑞士: 'Europe/Zurich',
  比利时: 'Europe/Brussels',
  爱尔兰: 'Europe/Dublin',
  葡萄牙: 'Europe/Lisbon',
  乌克兰: 'Europe/Kiev',
  格鲁吉亚: 'Asia/Tbilisi',
  以色列: 'Asia/Jerusalem',
  南非: 'Africa/Johannesburg',
  埃及: 'Africa/Cairo',
  肯尼亚: 'Africa/Nairobi',
  澳大利亚: 'Australia/Sydney',
  新西兰: 'Pacific/Auckland',
  加拿大: 'America/Toronto',
  墨西哥: 'America/Mexico_City',
  美国: 'America/Los_Angeles',
  智利: 'America/Santiago',
  巴西: 'America/Sao_Paulo',
  哥伦比亚: 'America/Bogota',
  秘鲁: 'America/Lima',
  阿根廷: 'America/Argentina/Buenos_Aires',
};

const formatterCache = new Map();

function getFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(timeZone, new Intl.DateTimeFormat('zh-CN', {
      timeZone,
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }));
  }
  return formatterCache.get(timeZone);
}

function findFirstLocationCode(location) {
  const codes = [
    location?.code,
    ...(Array.isArray(location?.codes) ? location.codes : []),
    location?.aliasCode,
  ].filter(Boolean);

  return codes.find((code) => LOCATION_TIMEZONE_MAP[code]) || codes[0] || '';
}

export function resolveLocationTimeZone(location) {
  const code = findFirstLocationCode(location);
  if (code && LOCATION_TIMEZONE_MAP[code]) {
    return LOCATION_TIMEZONE_MAP[code];
  }

  const country = location?.country;
  if (country && COUNTRY_TIMEZONE_MAP[country]) {
    return COUNTRY_TIMEZONE_MAP[country];
  }

  return '';
}

export function formatLocationLocalTime(location, timestamp = Date.now()) {
  const timeZone = resolveLocationTimeZone(location);
  if (!timeZone) {
    return '';
  }

  try {
    const formatter = getFormatter(timeZone);
    const parts = formatter.formatToParts(new Date(timestamp));
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    const hour = parts.find((part) => part.type === 'hour')?.value;
    const minute = parts.find((part) => part.type === 'minute')?.value;
    if (!month || !day || !hour || !minute) {
      return '';
    }
    return `${month}.${day} ${hour}:${minute}`;
  } catch {
    return '';
  }
}
