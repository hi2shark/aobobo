import validate from '@/utils/validate';

/**
 * santaizi v2 公开 API 服务器对象 → aobobo 内部 v0 结构
 * v2 的 host/state 内部字段本身即为 v0 PascalCase 结构，原样透传；
 * 仅需映射顶层 snake_case 字段。public_note 在 v2 中已是解析后的对象，无需 JSON.parse。
 */
export default function (stzData) {
  if (!stzData || typeof stzData !== 'object') {
    return stzData;
  }
  const state = stzData.state && typeof stzData.state === 'object' ? { ...stzData.state } : {};
  ['Load1', 'Load5', 'Load15', 'NetInTransfer', 'NetOutTransfer', 'NetInSpeed', 'NetOutSpeed']
    .forEach((k) => {
      if (!validate.isSet(state[k])) {
        state[k] = 0;
      }
    });
  let publicNote = stzData.public_note;
  if (!publicNote || typeof publicNote !== 'object' || Array.isArray(publicNote) || !Object.keys(publicNote).length) {
    publicNote = null;
  }
  return {
    ID: stzData.id,
    Name: stzData.name,
    Tag: stzData.tag || '',
    DisplayIndex: stzData.display_index,
    Host: stzData.host,
    State: state,
    LastActive: stzData.last_active,
    PublicNote: publicNote,
  };
}
