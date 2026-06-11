import config from '@/config';

function getNezhaConfigUrl() {
  const { nezhaPath } = config.nazhua;
  if (nezhaPath.startsWith('http')) {
    return nezhaPath;
  }
  const a = document.createElement('a');
  if (nezhaPath === '/nezha/' && (import.meta.env.VITE_BASE_PATH && import.meta.env.VITE_BASE_PATH !== '/')) {
    [a.href] = window.location.href.split(import.meta.env.VITE_BASE_PATH);
  } else {
    a.href = nezhaPath;
  }
  return a.href;
}

const configReg = (type) => new RegExp(`(?:var\\s+|const\\s+|let\\s+)?${type}\\s*=\\s*JSON.parse\\('([^']+)'\\)`);
const unescaped = (str) => {
  let str2 = str.replace(/\\u([\d\w]{4})/gi, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
  str2 = str2.replace(/\\\\r/g, '');
  str2 = str2.replace(/\\\\n/g, '');
  str2 = str2.replace(/\\\\/g, '\\');
  return str2;
};
export default async () => fetch(getNezhaConfigUrl()).then((res) => res.text()).then((res) => {
  let resMatch = res?.match?.(configReg(config.nazhua.nezhaV0ConfigType));
  if (!resMatch) {
    resMatch = res?.match?.(configReg('initData'));
  }
  const configStr = resMatch?.[1];
  if (!configStr) {
    return null;
  }
  let remoteConfig;
  try {
    remoteConfig = JSON.parse(unescaped(configStr));
  } catch (error) {
    console.error('Failed to parse nezha config:', error);
    return null;
  }
  if (remoteConfig?.servers) {
    remoteConfig.servers = remoteConfig.servers.map((i) => {
      const item = { ...i };
      try {
        item.PublicNote = JSON.parse(i.PublicNote);
      } catch (error) {
        item.PublicNote = {};
      }
      return item;
    });
    return remoteConfig;
  }
  return null;
}).catch((error) => {
  console.error('Failed to load nezha config:', error);
  return null;
});

export const loadServerGroup = (services) => {
  const tagMap = {};
  services.forEach((i) => {
    if (i.Tag) {
      if (!tagMap[i.Tag]) {
        tagMap[i.Tag] = [];
      }
      tagMap[i.Tag].push(i);
    }
  });
  const tagList = [];
  Object.entries(tagMap).forEach(([tag, serviceList]) => {
    tagList.push({
      name: tag,
      count: serviceList.length,
      servers: serviceList.map((i) => i.ID),
      group: { name: tag },
    });
  });
  return tagList;
};
