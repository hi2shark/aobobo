# AoBoBo

AoBoBo 是一个为 [哪吒监控](https://nezha.wiki/) 设计的纯前端 3D 可视化主题，基于 **Vue 3 + Vite + globe.gl** 构建，在全球 3D 地球上直观展示各地 VPS 的实时运行状态。

> AoBoBo 仅包含前端展示，不包含哪吒 Dashboard 或 Agent。

## 特性

- **3D 地球可视化** — 使用 globe.gl 渲染真实地球，VPS 位置以脉冲光点标注。
- **哪吒探针双版本兼容** — 支持哪吒 v0（页面抓取 + WS）和 v1（REST API + WS），构建时可通过环境变量指定默认版本，运行时也允许通过 `config.js` 切换。
- **实时状态更新** — WebSocket 推送，数据秒级同步。
- **服务器列表** — 展示状态 / 名称 / 地区 / 系统 / 规格 / 在线时长 / 网速 / 流量 / 连接 / 负载 / CPU / 内存 / 硬盘。
- **服务器详情页** — 支持进度条 / 文本两种状态展示，支持监控图表与周期流量卡片。
- **响应式布局** — 大屏左右分栏、小屏纵向堆叠，适配桌面 / 平板 / 手机。
- **深色主题** — 沉浸式暗色界面，护眼且具科技感。
- **运行时配置** — 通过 `config.js` 修改标题、接口路径、监控图表类型等，无需重新打包。
- **自定义样式** — 通过 `style.css` 覆盖背景图、主题色、局部样式。

## 使用前须知

- AoBoBo 只是前端主题，不包含哪吒 Dashboard 或 Agent。
- v0 部署通常需要代理 `/nezha/`、`/ws`、`/api/v1/monitor/{id}`。
- v1 部署通常需要代理 `/api` 与 `/api/v1/ws/server`。
- 如需启用周期流量展示，v0 还需保证服务页可通过 `nezhaPath/service` 访问。
- H5 路由模式需要 Web 服务将普通页面路径回退到 `index.html`，但静态资源路径应保留真实 404。

## 快速开始

推荐使用 Docker Compose 部署：

```yaml
services:
  aobobo:
    image: ghcr.io/hi2shark/aobobo:latest
    container_name: aobobo
    ports:
      - 80:80
    environment:
      - DOMAIN=_
      - NEZHA=http://nezha-dashboard.example.com/
    volumes:
      # - ./config.js:/home/wwwroot/html/config.js:ro
      # - ./style.css:/home/wwwroot/html/style.css:ro
      # - ./favicon.svg:/home/wwwroot/html/favicon.svg:ro
    restart: unless-stopped
```

`NEZHA` 需要以 `/` 结尾，例如 `http://nezha-dashboard.example.com/`。

### 本地构建镜像

如果你想本地构建：

```bash
npm install
npm run build
docker build -t aobobo:latest .
```

## 配置入口

| 文件 | 用途 |
| --- | --- |
| `config.js` | 运行时配置，例如标题、哪吒版本、接口路径、监控图表类型 |
| `style.css` | 自定义样式，例如背景图、主题色、局部样式覆盖 |
| `favicon.svg` | 自定义站点图标 |

部署时可通过挂载或替换这些文件来自定义，无需重新打包镜像。

### 常用 `config.js` 配置

```js
window.$$aoboboConfig = {
  title: 'AoBoBo',              // 网站标题
  nezhaVersion: 'v1',           // 强制指定哪吒版本：v0 | v1；不填则自动探测
  monitorChartType: 'multi',    // 监控图表类型：single | multi
  monitorChartTypeToggle: true, // 是否允许切换监控图表类型
  monitorRefreshTime: 30,       // 监控刷新间隔（秒），0 为不刷新
  hideDetailCycleTransfer: false, // 是否隐藏详情页周期流量卡片
};
```

> 兼容提示：AoBoBo 同时支持 `window.$$nazhuaConfig`，如果你之前使用过 nazhua-front 的配置文件，可以直接挂载复用。

完整配置项说明见 [`docs/config.md`](./docs/config.md)，示例模板见 [`public/config.js`](./public/config.js)。

## 数据来源

| 数据类型 | v0 | v1 |
| --- | --- | --- |
| 全量配置 | 从 `/nezha/` 页面解析服务器列表与 `PublicNote` | `/api/v1/setting` 等 REST API |
| 实时数据 | `/ws` | `/api/v1/ws/server` |
| 监控数据 | `/api/v1/monitor/{id}` | `/api/v1/server/{id}/service`（兼容 `/api/v1/service/{id}`） |
| 周期流量 | `/service` 页面解析 | `/api/v1/service` |
| 分组数据 | 服务器 `Tag` 字段 | `/api/v1/server-group` |
| 站点配置 | `config.js` / 公开备注 | `config.js` / `/api/v1/setting` 的 `site_name` |

## 本地开发

安装依赖后启动开发服务：

```bash
npm install
npm run dev
```

开发环境可在 `.env.development.local` 中配置代理：

```bash
cp .env.development.local.example .env.development.local
```

```bash
API_HOST=http://your-nezha-host:8080
WS_HOST=ws://your-nezha-host:8080
NEZHA_HOST=http://your-nezha-host:8080
```

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务 |
| `npm run build` | 构建生产版本（默认自动探测哪吒版本） |
| `npm run build:v0` | 构建默认指向哪吒 v0 的版本 |
| `npm run build:v1` | 构建默认指向哪吒 v1 的版本 |
| `npm run build:nazhua` | 构建 v0 同域 `/nazhua/` 子目录版本 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | 运行 ESLint |
| `npm run lint:fix` | 自动修复 ESLint 问题 |

## 项目结构

```
src/
├── components/           # 公共组件
│   ├── app-footer/       # 页脚
│   ├── charts/           # 图表组件
│   ├── globe-earth/      # 3D 地球核心组件
│   ├── icons/            # 图标组件
│   ├── server/           # 服务器通用组件
│   ├── server-detail/    # 服务器详情页组件
│   ├── server-globe/     # 地球与服务器联动组件
│   ├── server-list/      # 服务器列表
│   ├── server-panel/     # 服务器面板
│   └── ui/               # UI 基础组件
├── views/                # 页面
│   ├── home.vue          # 主页面（地球 + 列表）
│   └── detail.vue        # 服务器详情页
├── composables/          # 组合式函数
├── store/                # Vuex 状态管理
├── ws/                   # WebSocket 入口与服务
├── utils/                # 请求、数据转换、工具函数
├── data/                 # 地理位置码表
├── config/               # 运行时默认配置
├── router/               # 路由配置
├── assets/               # 静态资源与全局样式
└── main.js               # 应用入口
```

## 公开备注

哪吒探针的公开备注（PublicNote）可用于自定义节点位置等信息。

### 通过位置代码定位

```json
{
  "customData": {
    "location": "TYO"
  }
}
```

即可让该节点定位到东京。

### 通过手动坐标定位

如果内置码表没有你要的位置，可以直接指定经纬度：

```json
{
  "customData": {
    "latlng": "35.6762,139.6503"
  }
}
```

或分别指定 `lat` 和 `lng`：

```json
{
  "customData": {
    "lat": 35.6762,
    "lng": 139.6503,
    "locationLabel": "东京"
  }
}
```

`latlng` 支持以下格式：

- 字符串：`"35.6762,139.6503"`
- 数组：`[35.6762, 139.6503]`

如果同时提供了 `location`，手动坐标会优先生效，并复用 `location` 对应的名称/国家信息；如提供了 `locationLabel`，则优先显示该标签。

## CI / 发布

仓库内置以下 GitHub Actions 工作流：

| 工作流 | 触发条件 | 说明 |
| --- | --- | --- |
| `eslint.yml` | 涉及 `js/ts/vue` 的 Pull Request | 运行 ESLint 检查 |
| `docker-build.yml` | 推送 `v*.*.*` 标签 / 手动触发 | 构建并推送 Docker 镜像到 GHCR |
| `release.yml` | 推送 `v*.*.*` 标签 / 手动触发 | 构建多版本压缩包并创建 Draft Release |

Release 产物说明：

| 文件名 | 适用场景 |
| --- | --- |
| `v{X.Y.Z}-all.zip` | 默认构建，运行时自动探测哪吒版本 |
| `dist.zip` | 构建时默认锁定为哪吒 v1 |
| `v0-dist.zip` | 构建时默认锁定为哪吒 v0 |
| `v0-nazhua.zip` | 哪吒 v0 同域 `/nazhua/` 子目录部署 |

## 相关链接

- 项目仓库：[https://github.com/hi2shark/aobobo](https://github.com/hi2shark/aobobo)
- 哪吒监控文档：[https://nezha.wiki/](https://nezha.wiki/)
- 同类型前端主题：[https://github.com/hi2shark/nazhua](https://github.com/hi2shark/nazhua)
