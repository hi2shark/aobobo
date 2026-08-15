import config from '@/config';
import request from '@/utils/request';

/**
 * 加载 santaizi 公开 bootstrap 配置（GET /api/v2/public/bootstrap）
 * @param {boolean} check 为 true 时仅探测后端是否为 santaizi（用于版本自动探测）
 * @returns {Promise<object|boolean|null>}
 */
export default async function loadBootstrap(check) {
  return request({
    url: config.aobobo.stzBootstrapPath,
    type: 'GET',
  }).then((res) => {
    // 防范 SPA 回退返回 index.html 造成的误判：必须是 JSON 且 data 为对象
    const data = res?.data?.data;
    if (res?.status !== 200 || !data || typeof data !== 'object' || Array.isArray(data)) {
      return check ? false : null;
    }
    if (check) {
      return typeof data.version === 'string' || typeof data.brand === 'string';
    }
    return data;
  }).catch(() => (check ? false : null));
}
