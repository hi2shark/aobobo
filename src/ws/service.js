export const WS_CONNECTION_STATUS = {
  DISCONNECTED: 0,
  CONNECTING: 1,
  CONNECTED: 2,
  CLOSED: -1,
};

class WSService {
  constructor(options) {
    const {
      wsUrl, onConnect, onClose, onError, onMessage, onMessageError,
    } = options || {};
    this.debug = options?.debug || false;

    if (!wsUrl.startsWith('ws')) {
      throw new Error('WebSocket URL must start with ws:// or wss://');
    }
    this.$wsUrl = wsUrl;
    this.$on = {
      close: onClose || (() => {}),
      error: onError || (() => {}),
      connect: onConnect || (() => {}),
      message: onMessage || (() => {}),
      messageError: onMessageError || (() => {}),
    };

    if (WSService.instance) {
      this.$on.error(new Error('WebSocket connection already exists'));
      return;
    }

    WSService.instance = this;
    this.connected = WS_CONNECTION_STATUS.DISCONNECTED;
    this.ws = undefined;
    this.evt = (event) => {
      if (this.debug) console.log('Message from server ', event.data);
      try {
        const data = JSON.parse(event.data);
        this.$on.message(data, event);
      } catch (error) {
        console.error('socket message error', error);
        if (this.debug) console.log('message', event.data);
        this.$on.messageError(error, event);
      }
    };
  }

  get isConnected() {
    return this.connected === WS_CONNECTION_STATUS.CONNECTED;
  }

  active() {
    if (this.connected > WS_CONNECTION_STATUS.DISCONNECTED) {
      console.warn('WebSocket connection already exists or is connecting');
      return;
    }
    this.connected = WS_CONNECTION_STATUS.CONNECTING;
    this.ws = new WebSocket(this.$wsUrl);
    this.ws.addEventListener('open', (event) => {
      if (this.debug) console.log('socket connected', event);
      this.connected = WS_CONNECTION_STATUS.CONNECTED;
      this.$on.connect(event);
    });
    this.ws.addEventListener('close', (event) => {
      if (this.debug) console.log('socket closed', event);
      this.connected = WS_CONNECTION_STATUS.CLOSED;
      WSService.instance = null;
      this.$on.close(event);
    });
    this.ws.addEventListener('message', this.evt);
    this.ws.addEventListener('error', (event) => {
      console.log('socket error', event);
      WSService.instance = null;
      this.$on.error(event);
    });
  }

  send(data) {
    this?.ws?.send?.(JSON.stringify(data));
  }

  close() {
    this.ws?.close?.();
  }
}

export default WSService;
