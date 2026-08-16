import config from '@/config';
import request from '@/utils/request';

function toAvailabilityMap(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const map = {};

  if (Array.isArray(payload)) {
    payload.forEach((item) => {
      const serverId = item?.server_id ?? item?.id ?? item?.serverId;
      const percent = item?.availability_percent ?? item?.availability;
      const hasServerId = serverId !== undefined && serverId !== null;
      const hasPercent = percent !== undefined && percent !== null;
      if (hasServerId && hasPercent) {
        const num = Number(percent);
        if (Number.isFinite(num)) {
          map[String(serverId)] = num;
        }
      }
    });
  } else {
    Object.entries(payload).forEach(([key, value]) => {
      const num = Number(value);
      if (value !== undefined && value !== null && Number.isFinite(num)) {
        map[key] = num;
      }
    });
  }

  return Object.keys(map).length > 0 ? map : null;
}

async function loadStzServerAvailability(serverId) {
  const baseUrl = config.aobobo.stzApiAvailabilityPath.replace('{id}', serverId);
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}days=30`;
  const res = await request({
    url,
    method: 'GET',
    validateStatus: (status) => status === 200 || status === 403 || status === 404,
  });
  if (res?.status === 403) {
    return { hidden: true };
  }
  if (res?.status !== 200) {
    return null;
  }
  const item = res?.data?.data;
  const percent = item?.availability_percent ?? item?.availability;
  if (percent === undefined || percent === null) {
    return null;
  }
  const num = Number(percent);
  if (!Number.isFinite(num)) {
    return null;
  }
  return {
    id: String(item?.server_id ?? serverId),
    percent: num,
  };
}

async function loadStzAvailability(serverList = []) {
  const ids = [...new Set(
    (serverList || [])
      .map((server) => server?.ID)
      .filter((id) => id !== undefined && id !== null && id !== ''),
  )];
  if (!ids.length) {
    return null;
  }

  const results = await Promise.all(ids.map((id) => (
    loadStzServerAvailability(id).catch(() => null)
  )));

  if (results.some((item) => item?.hidden)) {
    return { hidden: true };
  }

  const map = {};
  results.forEach((item) => {
    if (item?.id && Number.isFinite(item.percent)) {
      map[item.id] = item.percent;
    }
  });
  return Object.keys(map).length > 0 ? map : null;
}

/**
 * 加载服务器可用性数据
 * v0/v1：config.aobobo.apiAvailabilityPath
 * santaizi：逐台请求 /api/v2/public/servers/{id}/availability
 * 支持两种返回格式：
 *   1. 数组形式：{ result: [{ server_id: 1, availability_percent: 99.9 }] }
 *   2. 对象形式：{ "1": 99.9, "2": 98.5 }
 */
export default async function loadAvailability(serverList = []) {
  try {
    if (config.aobobo.nezhaVersion === 'santaizi') {
      return loadStzAvailability(serverList);
    }

    const res = await request({
      url: config.aobobo.apiAvailabilityPath,
      method: 'GET',
    });

    const payload = res?.data?.data ?? res?.data?.result ?? res?.data;
    return toAvailabilityMap(payload);
  } catch {
    // 接口不可用时不影响主流程
    return null;
  }
}
