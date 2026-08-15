/* eslint-env node */

function normalizeTarget(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }
  let value = url.trim();
  if (!value) {
    return '';
  }
  if (value.startsWith('wss://')) {
    value = `https://${value.slice(6)}`;
  } else if (value.startsWith('ws://')) {
    value = `http://${value.slice(5)}`;
  }
  return value.replace(/\/$/, '');
}

function isLoopback(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  } catch {
    return false;
  }
}

function isRemote(url) {
  return Boolean(url) && !isLoopback(url);
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function stripCookieFlags(cookie) {
  return cookie.replace(/;\s*Secure/gi, '').replace(/;\s*Domain=[^;]*/gi, '');
}

function headerValue(headers, name) {
  const raw = headers[name];
  if (Array.isArray(raw)) {
    return raw[0] || '';
  }
  return raw || '';
}

function isAccessLoginRedirect(status, location) {
  if (!location || ![301, 302, 303, 307, 308].includes(status)) {
    return false;
  }
  try {
    if (new URL(location).hostname.endsWith('.cloudflareaccess.com')) {
      return true;
    }
  } catch {
    // fall through
  }
  return location.includes('/cdn-cgi/access/');
}

function accessHeaders(env) {
  const headers = {};
  const accessId = env.CF_ACCESS_CLIENT_ID?.trim();
  const accessSecret = env.CF_ACCESS_CLIENT_SECRET?.trim();
  if (accessId && accessSecret) {
    headers['CF-Access-Client-Id'] = accessId;
    headers['CF-Access-Client-Secret'] = accessSecret;
  }
  const jwt = env.CF_AUTHORIZATION?.trim();
  if (jwt) {
    headers.Cookie = `CF_Authorization=${jwt}`;
  }
  return headers;
}

const accessDeniedBody = JSON.stringify({
  type: 'https://aobobo.dev/problems/cloudflare_access',
  title: 'Unauthorized',
  status: 401,
  code: 'cloudflare_access',
  detail: 'Cloudflare Access 拒绝了服务令牌。应用策略需要单独一条 Action = Service Auth，或在 .env.development.local 提供 CF_AUTHORIZATION。',
});

function attachOutgoingHeaders(proxy, headers, origin) {
  const apply = (proxyReq) => {
    Object.entries(headers).forEach(([name, value]) => {
      if (name.toLowerCase() === 'cookie') {
        const existing = proxyReq.getHeader('cookie');
        const parts = [existing, value].flatMap((item) => (item == null ? [] : String(item))).filter(Boolean);
        proxyReq.setHeader('cookie', parts.join('; '));
        return;
      }
      proxyReq.setHeader(name, value);
    });
    if (origin) {
      proxyReq.setHeader('Origin', origin);
    }
  };
  proxy.on('proxyReq', apply);
  proxy.on('proxyReqWs', apply);
  proxy.on('error', (error, _req, socket) => {
    if (error.code === 'EPIPE' || error.code === 'ECONNRESET') {
      if (socket && !socket.destroyed) {
        socket.destroy?.();
      }
      return;
    }
    console.error('[aobobo-dev-proxy]', error.message);
  });
}

function interceptAccessRedirects(proxy) {
  proxy.on('proxyRes', (proxyRes, _req, res) => {
    const location = headerValue(proxyRes.headers, 'location');
    if (isAccessLoginRedirect(proxyRes.statusCode || 0, location)) {
      res.writeHead(401, { 'content-type': 'application/problem+json' });
      res.end(accessDeniedBody);
      proxyRes.resume();
      return;
    }
    const cookies = proxyRes.headers['set-cookie'];
    if (cookies) {
      const list = Array.isArray(cookies) ? cookies : [cookies];
      proxyRes.headers['set-cookie'] = list.map(stripCookieFlags);
    }
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
}

function httpEntry(target, headers, extra = {}) {
  const remoteTarget = isRemote(target);
  return {
    target,
    changeOrigin: true,
    headers,
    selfHandleResponse: remoteTarget,
    configure: (proxy) => {
      attachOutgoingHeaders(proxy, headers, remoteTarget ? originOf(target) : undefined);
      if (remoteTarget) {
        interceptAccessRedirects(proxy);
      }
    },
    ...extra,
  };
}

function wsEntry(target, headers, rewrite) {
  const remoteTarget = isRemote(target);
  return httpEntry(target, headers, {
    ws: true,
    selfHandleResponse: false,
    configure: (proxy) => {
      attachOutgoingHeaders(proxy, headers, remoteTarget ? originOf(target) : undefined);
    },
    rewrite,
  });
}

export function createAoboboDevProxy(env) {
  const apiHost = normalizeTarget(env.API_HOST);
  const wsHost = normalizeTarget(env.WS_HOST);
  const nezhaHost = normalizeTarget(env.NEZHA_HOST);
  const proxyWsHost = normalizeTarget(env.PROXY_WS_HOST);
  const headers = accessHeaders(env);
  const useAccess = Boolean(headers['CF-Access-Client-Id'] || headers.Cookie);

  if (useAccess && proxyWsHost) {
    console.warn('[aobobo-dev-proxy] CF Access is configured; ignoring PROXY_WS_HOST');
  }

  const useWsRelay = Boolean(proxyWsHost) && !useAccess;
  const wsTarget = useWsRelay ? proxyWsHost : wsHost;
  const remote = isRemote(apiHost) || isRemote(wsTarget) || isRemote(nezhaHost);

  if (remote) {
    const access = headers['CF-Access-Client-Id'] ? 'on' : 'off';
    const cookie = headers.Cookie ? 'on' : 'off';
    console.info(`[aobobo-dev-proxy] remote=on access=${access} cookie=${cookie}`);
  }

  const wsRewrite = (requestPath) => {
    if (useWsRelay) {
      return `/proxy?wsPath=${env.WS_HOST}`;
    }
    return requestPath;
  };

  const proxy = {};

  // 更具体的 WS 路径必须写在 /api 之前，避免被 /api 前缀抢走
  if (wsTarget) {
    proxy['/api/v1/ws/server'] = wsEntry(wsTarget, headers, wsRewrite);
    proxy['/ws'] = wsEntry(wsTarget, headers, wsRewrite);
  }
  if (apiHost) {
    proxy['/api'] = httpEntry(apiHost, headers);
  }

  const basePath = env.VITE_BASE_PATH;
  if (nezhaHost && (basePath === '/' || !basePath)) {
    proxy['/nezha/'] = httpEntry(nezhaHost, headers, {
      rewrite: (requestPath) => requestPath.replace(/^\/nezha/, ''),
    });
  }

  return proxy;
}

export {
  normalizeTarget,
  isRemote,
  accessHeaders,
};
