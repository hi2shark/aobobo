import config from '@/config';
import MessageSubscribe from '@/utils/subscribe';
import v1TransformV0 from '@/utils/transform-v1-2-v0';
import WSService, { WS_CONNECTION_STATUS } from './service';

function getWsApiPath() {
  let url = config?.aobobo?.wsPath;
  if (config?.aobobo?.nezhaVersion === 'v1') {
    url = config?.aobobo?.v1WsPath;
  }
  const a = document.createElement('a');
  a.href = url;
  return a.href.replace(/^http/, 'ws');
}

const msg = new MessageSubscribe();
const wsService = new WSService({
  wsUrl: getWsApiPath(),
  onConnect: () => msg.emit('connect'),
  onClose: () => msg.emit('close'),
  onError: (error) => msg.emit('error', error),
  onMessage: (data) => {
    if (data?.now && data?.servers) {
      if (config.aobobo.nezhaVersion === 'v1') {
        msg.emit('servers', {
          now: data.now,
          servers: data?.servers?.map?.((server) => v1TransformV0(server)) || [],
        });
      } else {
        msg.emit('servers', data);
      }
    } else {
      msg.emit('message', data);
    }
  },
});

export function restart() {
  if (wsService.connected !== WS_CONNECTION_STATUS.DISCONNECTED) {
    wsService.close();
  }
  wsService.active();
}

export { wsService, msg };

export default (actived) => {
  if (wsService.connected === WS_CONNECTION_STATUS.CONNECTED) {
    if (actived) actived();
    return;
  }
  msg.once('connect', () => {
    if (actived) actived();
  });
  if (wsService.connected === WS_CONNECTION_STATUS.CONNECTING) return;
  wsService.active();
};
