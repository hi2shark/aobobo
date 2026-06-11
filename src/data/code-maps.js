/**
 * 全球城市地理位置码表
 * 包含经纬度(lat, lng)用于3D地球定位
 * 保留原有2D坐标(x, y)用于降级2D地图
 */

const codeMaps = {
  // 中国
  PEK: {
    x: 1025, y: 178,
    lat: 39.9042, lng: 116.4074,
    name: '北京', country: '中国',
  },
  PVG: {
    x: 1057, y: 225,
    lat: 31.2304, lng: 121.4737,
    name: '上海', country: '中国',
  },
  CKG: {
    x: 1010, y: 235,
    lat: 29.5630, lng: 106.5516,
    name: '重庆', country: '中国',
  },
  TFU: {
    x: 1000, y: 230,
    lat: 30.5728, lng: 104.0668,
    name: '成都', country: '中国',
  },
  HKG: {
    x: 1039, y: 263,
    lat: 22.3193, lng: 114.1694,
    name: '香港', country: '中国',
  },
  MFM: {
    x: 1035, y: 264,
    lat: 22.1987, lng: 113.5439,
    name: '澳门', country: '中国',
  },
  TPE: {
    x: 1067, y: 253,
    lat: 25.0330, lng: 121.5654,
    name: '台北', country: '中国',
  },
  // 日本
  OSA: {
    x: 1109, y: 207,
    lat: 34.6937, lng: 135.5023,
    name: '大阪', country: '日本',
  },
  TYO: {
    x: 1124, y: 199,
    lat: 35.6762, lng: 139.6503,
    name: '东京', country: '日本',
  },
  // 韩国
  SEL: {
    x: 1077, y: 198,
    lat: 37.5665, lng: 126.9780,
    name: '首尔', country: '韩国',
  },
  // 东南亚
  SIN: {
    x: 1000, y: 354,
    lat: 1.3521, lng: 103.8198,
    name: '新加坡', country: '新加坡',
  },
  JHB: {
    x: 997, y: 350,
    lat: 1.4927, lng: 103.7414,
    name: '新山', country: '马来西亚',
  },
  KUL: {
    x: 990, y: 345,
    lat: 3.1390, lng: 101.6869,
    name: '吉隆坡', country: '马来西亚',
  },
  BKK: {
    x: 985, y: 296,
    lat: 13.7563, lng: 100.5018,
    name: '曼谷', country: '泰国',
  },
  HAN: {
    x: 998, y: 274,
    lat: 21.0278, lng: 105.8342,
    name: '河内', country: '越南',
  },
  SGN: {
    x: 1015, y: 314,
    lat: 10.8231, lng: 106.6297,
    name: '胡志明市', country: '越南',
  },
  // 南亚
  BOM: {
    x: 874, y: 284,
    lat: 19.0760, lng: 72.8777,
    name: '孟买', country: '印度',
  },
  DEL: {
    x: 886, y: 246,
    lat: 28.6139, lng: 77.2090,
    name: '新德里', country: '印度',
  },
  // 中东
  DXB: {
    x: 794.5, y: 252,
    lat: 25.2048, lng: 55.2708,
    name: '迪拜', country: '阿联酋',
  },
  IST: {
    x: 676, y: 176,
    lat: 41.0082, lng: 28.9784,
    name: '伊斯坦布尔', country: '土耳其',
  },
  // 美国
  LAX: {
    x: 95, y: 207,
    lat: 34.0522, lng: -118.2437,
    name: '洛杉矶', country: '美国',
  },
  LAS: {
    x: 98, y: 198,
    lat: 36.1699, lng: -115.1398,
    name: '拉斯维加斯', country: '美国',
  },
  SLC: {
    x: 111, y: 189,
    lat: 40.7608, lng: -111.8910,
    name: '盐湖城', country: '美国',
  },
  SJC: {
    x: 87, y: 193,
    lat: 37.3382, lng: -121.8863,
    name: '圣何塞', country: '美国',
  },
  SEA: {
    x: 118, y: 143,
    lat: 47.6062, lng: -122.3321,
    name: '西雅图', country: '美国',
  },
  MIA: {
    x: 237, y: 249,
    lat: 25.7617, lng: -80.1918,
    name: '迈阿密', country: '美国',
  },
  ORD: {
    x: 233, y: 175,
    lat: 41.8781, lng: -87.6298,
    name: '芝加哥', country: '美国',
  },
  NYC: {
    x: 280, y: 179,
    lat: 40.7128, lng: -74.0060,
    name: '纽约', country: '美国',
  },
  IAD: {
    x: 265, y: 186,
    lat: 39.0438, lng: -77.4874,
    name: '阿什本', country: '美国',
  },
  DFW: {
    x: 172, y: 211,
    lat: 32.7767, lng: -96.7970,
    name: '达拉斯', country: '美国',
  },
  ATL: {
    x: 225, y: 205,
    lat: 33.7490, lng: -84.3880,
    name: '亚特兰大', country: '美国',
  },
  HNL: {
    x: 28, y: 270,
    lat: 21.3099, lng: -157.8581,
    name: '檀香山', country: '美国',
  },
  // 北美
  YYZ: {
    x: 267, y: 161,
    lat: 43.6532, lng: -79.3832,
    name: '多伦多', country: '加拿大',
  },
  MEX: {
    x: 158, y: 280,
    lat: 19.4326, lng: -99.1332,
    name: '墨西哥城', country: '墨西哥',
  },
  // 南美
  SCQ: {
    x: 289, y: 513,
    lat: -33.4489, lng: -70.6693,
    name: '圣地亚哥', country: '智利',
  },
  GRU: {
    x: 370, y: 473,
    lat: -23.5505, lng: -46.6333,
    name: '圣保罗', country: '巴西',
  },
  // 大洋洲
  SYD: {
    x: 1167, y: 519,
    lat: -33.8688, lng: 151.2093,
    name: '悉尼', country: '澳大利亚',
  },
  // 欧洲
  AMS: {
    x: 595, y: 125,
    lat: 52.3676, lng: 4.9041,
    name: '阿姆斯特丹', country: '荷兰',
  },
  LON: {
    x: 571, y: 127,
    lat: 51.5074, lng: -0.1278,
    name: '伦敦', country: '英国',
  },
  FRA: {
    x: 603, y: 137,
    lat: 50.1109, lng: 8.6821,
    name: '法兰克福', country: '德国',
  },
  BER: {
    x: 620, y: 130,
    lat: 52.5200, lng: 13.4050,
    name: '柏林', country: '德国',
  },
  LUX: {
    x: 591, y: 140,
    lat: 49.6116, lng: 6.1319,
    name: '卢森堡', country: '卢森堡',
  },
  CDG: {
    x: 579, y: 145,
    lat: 49.0097, lng: 2.5479,
    name: '巴黎', country: '法国',
  },
  WAW: {
    x: 649, y: 123,
    lat: 52.2297, lng: 21.0122,
    name: '华沙', country: '波兰',
  },
  MAD: {
    x: 554, y: 180,
    lat: 40.4168, lng: -3.7038,
    name: '马德里', country: '西班牙',
  },
  MXP: {
    x: 604, y: 153,
    lat: 45.4642, lng: 9.1900,
    name: '米兰', country: '意大利',
  },
  SVO: {
    x: 704, y: 115,
    lat: 55.7558, lng: 37.6173,
    name: '莫斯科', country: '俄罗斯',
  },
  OTP: {
    x: 673, y: 160,
    lat: 44.4268, lng: 26.1025,
    name: '布加勒斯特', country: '罗马尼亚',
  },
  SOF: {
    x: 662.5, y: 167,
    lat: 42.6977, lng: 23.3219,
    name: '索菲亚', country: '保加利亚',
  },
  VNO: {
    x: 657.5, y: 110.5,
    lat: 54.6872, lng: 25.2797,
    name: '维尔纽斯', country: '立陶宛',
  },
  OSL: {
    x: 615.5, y: 93,
    lat: 59.9139, lng: 10.7522,
    name: '奥斯陆', country: '挪威',
  },
  // 非洲
  RBA: {
    x: 545, y: 212,
    lat: 34.0209, lng: -6.8416,
    name: '拉巴特', country: '摩洛哥',
  },
  // 补充城市
  JKT: {
    lat: -6.2088, lng: 106.8456,
    name: '雅加达', country: '印度尼西亚',
  },
  MNL: {
    lat: 14.5995, lng: 120.9842,
    name: '马尼拉', country: '菲律宾',
  },
  HEL: {
    lat: 60.1699, lng: 24.9384,
    name: '赫尔辛基', country: '芬兰',
  },
  STO: {
    lat: 59.3293, lng: 18.0686,
    name: '斯德哥尔摩', country: '瑞典',
  },
  CPH: {
    lat: 55.6761, lng: 12.5683,
    name: '哥本哈根', country: '丹麦',
  },
  VIE: {
    lat: 48.2082, lng: 16.3738,
    name: '维也纳', country: '奥地利',
  },
  PRG: {
    lat: 50.0755, lng: 14.4378,
    name: '布拉格', country: '捷克',
  },
  BUD: {
    lat: 47.4979, lng: 19.0402,
    name: '布达佩斯', country: '匈牙利',
  },
  ATH: {
    lat: 37.9838, lng: 23.7275,
    name: '雅典', country: '希腊',
  },
  ZRH: {
    lat: 47.3769, lng: 8.5417,
    name: '苏黎世', country: '瑞士',
  },
  BRU: {
    lat: 50.8503, lng: 4.3517,
    name: '布鲁塞尔', country: '比利时',
  },
  DUB: {
    lat: 53.3498, lng: -6.2603,
    name: '都柏林', country: '爱尔兰',
  },
  LIS: {
    lat: 38.7223, lng: -9.1393,
    name: '里斯本', country: '葡萄牙',
  },
  KBP: {
    lat: 50.4501, lng: 30.5234,
    name: '基辅', country: '乌克兰',
  },
  TBS: {
    lat: 41.7151, lng: 44.8271,
    name: '第比利斯', country: '格鲁吉亚',
  },
  TEL: {
    lat: 32.0853, lng: 34.7818,
    name: '特拉维夫', country: '以色列',
  },
  JNB: {
    lat: -26.2041, lng: 28.0473,
    name: '约翰内斯堡', country: '南非',
  },
  CAI: {
    lat: 30.0444, lng: 31.2357,
    name: '开罗', country: '埃及',
  },
  NBO: {
    lat: -1.2921, lng: 36.8219,
    name: '内罗毕', country: '肯尼亚',
  },
  AKL: {
    lat: -36.8485, lng: 174.7633,
    name: '奥克兰', country: '新西兰',
  },
  YVR: {
    lat: 49.2827, lng: -123.1207,
    name: '温哥华', country: '加拿大',
  },
  DEN: {
    lat: 39.7392, lng: -104.9903,
    name: '丹佛', country: '美国',
  },
  PHX: {
    lat: 33.4484, lng: -112.0740,
    name: '凤凰城', country: '美国',
  },
  SFO: {
    lat: 37.7749, lng: -122.4194,
    name: '旧金山', country: '美国',
  },
  BOS: {
    lat: 42.3601, lng: -71.0589,
    name: '波士顿', country: '美国',
  },
  PHL: {
    lat: 39.9526, lng: -75.1652,
    name: '费城', country: '美国',
  },
  CLT: {
    lat: 35.2271, lng: -80.8431,
    name: '夏洛特', country: '美国',
  },
  MSP: {
    lat: 44.9778, lng: -93.2650,
    name: '明尼阿波利斯', country: '美国',
  },
  PDX: {
    lat: 45.5152, lng: -122.6784,
    name: '波特兰', country: '美国',
  },
  SAN: {
    lat: 32.7157, lng: -117.1611,
    name: '圣迭戈', country: '美国',
  },
  BOG: {
    lat: 4.7110, lng: -74.0721,
    name: '波哥大', country: '哥伦比亚',
  },
  LIM: {
    lat: -12.0464, lng: -77.0428,
    name: '利马', country: '秘鲁',
  },
  BUE: {
    lat: -34.6037, lng: -58.3816,
    name: '布宜诺斯艾利斯', country: '阿根廷',
  },
};

export const aliasMapping = {
  SGP: 'SIN',
  ICN: 'SEL',
  NRT: 'TYO',
  HND: 'TYO',
  KIX: 'OSA',
  PAR: 'CDG',
  MOW: 'SVO',
  CHI: 'ORD',
  SHA: 'PVG',
  CAN: 'CKG',
  CTU: 'TFU',
  BJS: 'PEK',
  HK: 'HKG',
  MO: 'MFM',
  TW: 'TPE',
  ASH: 'IAD',
};

export const countryCodeMapping = {
  CN: 'PEK',
  JP: 'TYO',
  SG: 'SIN',
  KR: 'SEL',
  MY: 'KUL',
  VN: 'HAN',
  IN: 'DEL',
  TH: 'BKK',
  AE: 'DXB',
  TR: 'IST',
  RO: 'OTP',
  LU: 'LUX',
  FR: 'CDG',
  RU: 'SVO',
  DE: 'FRA',
  NL: 'AMS',
  UK: 'LON',
  GB: 'LON',
  AU: 'SYD',
  US: 'LAX',
  CA: 'YYZ',
  MX: 'MEX',
  CL: 'SCQ',
  BR: 'GRU',
  IT: 'MXP',
  ES: 'MAD',
  PL: 'WAW',
  BG: 'SOF',
  LT: 'VNO',
  NO: 'OSL',
  MA: 'RBA',
  ID: 'JKT',
  PH: 'MNL',
  FI: 'HEL',
  SE: 'STO',
  DK: 'CPH',
  AT: 'VIE',
  CZ: 'PRG',
  HU: 'BUD',
  GR: 'ATH',
  CH: 'ZRH',
  BE: 'BRU',
  IE: 'DUB',
  PT: 'LIS',
  UA: 'KBP',
  GE: 'TBS',
  IL: 'TEL',
  ZA: 'JNB',
  EG: 'CAI',
  KE: 'NBO',
  NZ: 'AKL',
  CO: 'BOG',
  PE: 'LIM',
  AR: 'BUE',
};

export default codeMaps;
