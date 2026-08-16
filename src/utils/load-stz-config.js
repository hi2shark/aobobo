import config from '@/config';
import request from '@/utils/request';
import stzTransformV0 from '@/utils/transform-stz-2-v0';

/**
 * 加载 santaizi 公开 bootstrap 配置（GET /api/v2/public/bootstrap）
 * @param {boolean} check 为 true 时仅探测后端是否为 santaizi（用于版本自动探测）
 * @returns {Promise<object|boolean|null>}
 */
export default async function loadBootstrap(check) {
  return request({
    url: config.aobobo.stzBootstrapPath,
    method: 'GET',
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

/**
 * 加载 santaizi 公开服务器列表快照（GET /api/v2/public/servers）
 * @returns {Promise<object[]|null>}
 */
export async function loadStzServers() {
  try {
    const res = await request({
      url: config.aobobo.stzApiServersPath,
      method: 'GET',
    });
    if (res?.status !== 200) {
      return null;
    }
    const list = res?.data?.data;
    if (!Array.isArray(list)) {
      return null;
    }
    return list.map((item) => stzTransformV0(item));
  } catch {
    return null;
  }
}

/**
 * 校验站点查看密码并建立会话（POST /api/v2/public/view-password/session）
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function verifyStzViewPassword(password) {
  const res = await request({
    url: config.aobobo.stzViewPasswordPath,
    method: 'POST',
    data: { password },
    headers: {
      'Content-Type': 'application/json',
    },
    validateStatus: (status) => status === 204 || status === 200 || status === 403,
  });
  if (res?.status === 204 || res?.status === 200) {
    return true;
  }
  const error = new Error('查看密码不正确');
  error.code = 'invalid_view_password';
  throw error;
}
