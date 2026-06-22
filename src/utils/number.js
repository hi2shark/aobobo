/**
 * 截断数字到指定小数位数（不做四舍五入）
 * @param {number|string} value
 * @param {number} digits 小数位数，默认 1
 * @returns {number}
 */
export default function truncateDecimal(value, digits = 1) {
  const num = Number(value);
  if (Number.isNaN(num)) return NaN;
  const multiplier = 10 ** digits;
  return Math.trunc(num * multiplier) / multiplier;
}
