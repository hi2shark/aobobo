/**
 * 主机匹配信息工具
 */

export function getCPUInfo(text = '') {
  const cpuInfo = {
    company: '', model: '', modelNum: '', core: '', cores: '',
  };
  const companyReg = /Intel|AMD|ARM|Qualcomm|Apple|Samsung|IBM|NVIDIA/;
  const modelReg = /Xeon|Threadripper|Athlon|Pentium|Celeron|Opteron|Phenom|Turion|Sempron|FX|A-Series|R-Series|EPYC|Ryzen/;
  const coresReg = /(\d+) (Virtual|Physics|Physical) Core/;
  const companyMatch = text.match(companyReg);
  const modelMatch = text.match(modelReg);
  const coresMatch = text.match(coresReg);
  if (companyMatch) [cpuInfo.company] = companyMatch;
  if (modelMatch) [cpuInfo.model] = modelMatch;

  if (text.includes('Ryzen')) {
    const modelNumReg = /Ryzen\s*(?:\d|(?:TR))\s*(?:\d{4}(?:[A-Z]{1,2})?)/;
    const modelNumMatch = text.match(modelNumReg);
    if (modelNumMatch) {
      cpuInfo.modelNum = modelNumMatch[0].replace(/Ryzen\s*(?:\d|(?:TR))\s*/, '');
    } else {
      const altModelNumReg = /Ryzen.*?(\d{3,4}(?:[A-Z]{0,2}))/;
      const altModelNumMatch = text.match(altModelNumReg);
      if (altModelNumMatch) [, cpuInfo.modelNum] = altModelNumMatch;
    }
  }
  if (text.includes('EPYC')) {
    const modelNumReg = /EPYC\s+(\d[A-Z0-9]{2,4})/i;
    const modelNumMatch = text.match(modelNumReg);
    if (modelNumMatch) [, cpuInfo.modelNum] = modelNumMatch;
  }
  if (text.includes('Xeon')) {
    if (text.includes(' E')) {
      const modelNumReg = /(E\d-\d{4}(?:\s?v\d)?)/;
      const modelNumMatch = text.match(modelNumReg);
      if (modelNumMatch) [, cpuInfo.modelNum] = modelNumMatch;
    } else if (text.includes('Platinum')) {
      const modelNumReg = /(?:Platinum\s+)(\d{4}(?:\w)?)/;
      const modelNumMatch = text.match(modelNumReg);
      if (modelNumMatch) [, cpuInfo.modelNum] = modelNumMatch;
    } else if (text.includes('Gold')) {
      const modelNumReg = /(?:Gold\s+)(\d{4}(?:\w)?)/;
      const modelNumMatch = text.match(modelNumReg);
      if (modelNumMatch) [, cpuInfo.modelNum] = modelNumMatch;
    }
  }
  if (coresMatch) {
    [cpuInfo.core, cpuInfo.cores] = coresMatch;
  }
  return cpuInfo;
}

export function calcBinary(bytes) {
  const k = bytes / 1024;
  const m = k / 1024;
  const g = m / 1024;
  const t = g / 1024;
  let p = null;
  if (t > 1000) p = t / 1024;
  return { k, m, g, t, p };
}

export function calcTransfer(bytes) {
  const stats = calcBinary(bytes);
  const result = { value: '', unit: '', stats };
  if (stats.t > 1) {
    result.value = (stats.t).toFixed(2) * 1;
    result.unit = 'T';
  } else if (stats.g > 1) {
    result.value = (stats.g).toFixed(2) * 1;
    result.unit = 'G';
  } else if (stats.m > 1) {
    result.value = (stats.m).toFixed(1) * 1;
    result.unit = 'M';
  } else {
    result.value = (stats.k).toFixed(1) * 1;
    result.unit = 'K';
  }
  return result;
}

export function getSystemOSLabel(platform) {
  const platformStr = (platform || '').toLowerCase();
  const map = {
    windows: 'Windows',
    linux: 'Linux',
    darwin: 'MacOS',
    debian: 'Debian',
    ubuntu: 'Ubuntu',
    centos: 'CentOS',
    fedora: 'Fedora',
    alpine: 'Alpine',
    arch: 'Arch',
    freebsd: 'FreeBSD',
  };
  return map[platformStr] || platform;
}

export function getPlatformLogoIconClassName(platform) {
  const platformStr = (platform || '').toLowerCase();
  if (platformStr.includes('windows') || platformStr.includes('microsoft')) {
    return 'ri-microsoft-fill';
  }
  switch (platformStr) {
    case 'darwin':
    case 'macos':
      return 'fl-apple';
    default:
      break;
  }
  if (platform) {
    return `fl-${platformStr}`;
  }
  return 'ri-server-line';
}
