import config from '@/config';
import request from '@/utils/request';

export const loadServerGroup = async () => request({
  url: config.nazhua.v1GroupPath || config.nazhua.v1ApiGroupPath,
  type: 'GET',
}).then((res) => {
  if (res.status === 200 && res.data?.success) {
    const list = res.data?.data || [];
    return list.map((i) => ({
      ...i,
      name: i?.group?.name,
      count: i?.servers?.length,
    }));
  }
  return null;
}).catch((error) => {
  console.error('Failed to load server group:', error);
  return null;
});

export const loadSetting = async () => request({
  url: config.nazhua.v1ApiSettingPath,
  type: 'GET',
}).then((res) => {
  if (res.status === 200 && res.data?.success) {
    return res.data?.data || {};
  }
  return null;
}).catch((error) => {
  console.error('Failed to load setting:', error);
  return null;
});

export const loadProfile = async (check) => request({
  url: config.nazhua.v1ApiProfilePath,
  type: 'GET',
}).then((res) => {
  if (check) {
    return res.status === 200 && res.data?.success === true;
  }
  if (res.status === 200 && res.data?.success) {
    return res.data?.data || {};
  }
  return null;
}).catch((error) => {
  console.error('Failed to load profile:', error);
  return null;
});
