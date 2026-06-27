function chineseNumberToArabic(str) {
  const map = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    百: 100,
    千: 1000,
    万: 10000,
  };
  let section = 0;
  let number = 0;
  for (let i = 0; i < str.length; i += 1) {
    const digit = map[str[i]];
    if (digit === undefined) {
      return 0;
    }
    if (digit === 10000) {
      section = (section + number) * 10000;
      number = 0;
    } else if (digit >= 10) {
      section += (number || 1) * digit;
      number = 0;
    } else {
      number = number * 10 + digit;
    }
  }
  return section + number;
}

const ONE_TIME_CYCLE_MARKS = new Set([
  '一次性',
  '一次性付费',
  '一次性付款',
  '一次性购买',
  '买断',
  'onetime',
  'one-time',
  'one time',
]);

function normalizeCycleString(cycle) {
  if (cycle === null || cycle === undefined) {
    return '';
  }
  return String(cycle).trim();
}

function getCycleMonths(cycle) {
  const cycleStr = normalizeCycleString(cycle);
  if (!cycleStr) {
    return 1;
  }
  // 兼容以数字表示的周期月数（如 1/3/6/12/36）
  if (typeof cycle === 'number' && Number.isFinite(cycle) && cycle > 0) {
    return cycle;
  }
  const cycleNum = Number(cycleStr);
  if (String(cycleNum) === cycleStr && Number.isFinite(cycleNum) && cycleNum > 0) {
    return cycleNum;
  }

  const lower = cycleStr.toLowerCase();

  // 阿拉伯数字前缀 + 单位，支持 2年/3Y/1.5yr/10year/1年半 等
  const yearMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(?:年|y(?:r)?|year(?:s)?|annual)(?:付)?$/);
  if (yearMatch) {
    const n = Number(yearMatch[1]);
    if (Number.isFinite(n) && n > 0) {
      return Math.round(n * 12);
    }
  }
  const yearHalfMatch = lower.match(/^(\d+(?:\.\d+)?)\s*年\s*半(?:付)?$/);
  if (yearHalfMatch) {
    const n = Number(yearHalfMatch[1]);
    if (Number.isFinite(n) && n > 0) {
      return Math.round(n * 12) + 6;
    }
  }
  const quarterMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(?:季|quarter(?:ly)?)(?:付)?$/);
  if (quarterMatch) {
    const n = Number(quarterMatch[1]);
    if (Number.isFinite(n) && n > 0) {
      return Math.round(n * 3);
    }
  }
  const halfYearMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(?:半年|half|semi-annually)(?:付)?$/);
  if (halfYearMatch) {
    const n = Number(halfYearMatch[1]);
    if (Number.isFinite(n) && n > 0) {
      return Math.round(n * 6);
    }
  }
  const monthMatch = lower.match(/^(\d+(?:\.\d+)?)\s*(?:个?)(?:月|m(?:o)?|month(?:ly)?)(?:付)?$/);
  if (monthMatch) {
    const n = Number(monthMatch[1]);
    if (Number.isFinite(n) && n > 0) {
      return Math.round(n);
    }
  }

  // 中文数字前缀，支持 三年/两年/十年/一年半 等
  const chineseYearHalfMatch = cycleStr.match(/^([一二两三四五六七八九十百千万]+)\s*年\s*半/);
  if (chineseYearHalfMatch) {
    const n = chineseNumberToArabic(chineseYearHalfMatch[1]);
    if (n > 0) {
      return n * 12 + 6;
    }
  }
  const chineseYearMatch = cycleStr.match(/^([一二两三四五六七八九十百千万]+)\s*年/);
  if (chineseYearMatch) {
    const n = chineseNumberToArabic(chineseYearMatch[1]);
    if (n > 0) {
      return n * 12;
    }
  }
  const chineseMonthMatch = cycleStr.match(/^([一二两三四五六七八九十百千万]+)\s*(?:个?)月/);
  if (chineseMonthMatch) {
    const n = chineseNumberToArabic(chineseMonthMatch[1]);
    if (n > 0) {
      return n;
    }
  }

  switch (lower) {
    case '年':
    case 'y':
    case 'yr':
    case 'year':
    case 'annual':
      return 12;
    case '季':
    case 'quarterly':
      return 3;
    case '半':
    case '半年':
    case 'h':
    case 'half':
    case 'semi-annually':
      return 6;
    case '月':
    case 'm':
    case 'mo':
    case 'month':
    case 'monthly':
    default:
      return 1;
  }
}

function isOneTimeCycle(cycle) {
  const cycleStr = normalizeCycleString(cycle);
  if (!cycleStr) {
    return false;
  }
  return ONE_TIME_CYCLE_MARKS.has(cycleStr.toLowerCase());
}

function getCycleLabel(cycle) {
  const cycleStr = normalizeCycleString(cycle);
  if (!cycleStr) {
    return '';
  }
  if (isOneTimeCycle(cycleStr)) {
    return cycleStr;
  }

  const lower = cycleStr.toLowerCase();
  switch (lower) {
    case '月':
    case 'm':
    case 'mo':
    case 'month':
    case 'monthly':
      return '月';
    case '年':
    case 'y':
    case 'yr':
    case 'year':
    case 'annual':
      return '年';
    case '季':
    case 'quarterly':
      return '季';
    case '半':
    case '半年':
    case 'h':
    case 'half':
    case 'semi-annually':
      return '半年';
    default:
      break;
  }

  const cycleNum = Number(cycleStr);
  if (String(cycleNum) === cycleStr && Number.isFinite(cycleNum) && cycleNum > 0) {
    switch (cycleNum) {
      case 1:
        return '月';
      case 3:
        return '季';
      case 6:
        return '半年';
      case 12:
        return '年';
      default:
        return cycleStr;
    }
  }

  if (
    /^(\d+(?:\.\d+)?)\s*(?:年|y(?:r)?|year(?:s)?|annual)(?:付)?$/i.test(cycleStr)
    || /^(\d+(?:\.\d+)?)\s*年\s*半(?:付)?$/i.test(cycleStr)
  ) {
    return '年';
  }
  if (/^(\d+(?:\.\d+)?)\s*(?:季|quarter(?:ly)?)(?:付)?$/i.test(cycleStr)) {
    return '季';
  }
  if (/^(\d+(?:\.\d+)?)\s*(?:半年|half|semi-annually)(?:付)?$/i.test(cycleStr)) {
    return '半年';
  }
  if (/^(\d+(?:\.\d+)?)\s*(?:个?)(?:月|m(?:o)?|month(?:ly)?)(?:付)?$/i.test(cycleStr)) {
    return '月';
  }
  if (/^([一二两三四五六七八九十百千万]+)\s*年(?:\s*半)?/.test(cycleStr)) {
    return '年';
  }
  if (/^([一二两三四五六七八九十百千万]+)\s*(?:个?)月/.test(cycleStr)) {
    return '月';
  }

  return cycleStr;
}

function isAutoRenewalEnabled(value) {
  if (value === true || value === 1) {
    return true;
  }
  if (value === false || value === 0 || value === null || value === undefined) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return [
    '1',
    'true',
    'yes',
    'on',
    'enabled',
  ].includes(normalized);
}

function isInfinityEndDate(endDate) {
  if (endDate === null || endDate === undefined) {
    return false;
  }
  return String(endDate).trim().startsWith('0000-00-00');
}

export default {
  getCycleMonths,
  isOneTimeCycle,
  getCycleLabel,
  isAutoRenewalEnabled,
  isInfinityEndDate,
};
