# AoBoBo 3D Globe - 哪吒探针可视化面板

基于 **Vue 3 + Vite + globe.gl** 构建的哪吒探针 3D 地球监控面板，在全球 3D 地球上直观展示各地 VPS 的实时运行状态。

## 特性

- **3D 地球可视化** — 使用 globe.gl 渲染真实地球，VPS 位置以脉冲光点标注
- **哪吒探针双版本兼容** — 支持哪吒 v0（页面抓取+WS）和 v1（REST API+WS）
- **实时状态更新** — WebSocket 推送，数据秒级同步
- **服务器列表** — 参考 cvm.im 风格，展示状态/名称/地区/系统/规格/在线时长/网速/流量/连接/负载/CPU/内存/硬盘
- **响应式布局** — 大屏左右分栏、小屏纵向堆叠，适配桌面/平板/手机
- **深色主题** — 沉浸式暗色界面，护眼且具科技感

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Vue 3.5 (Composition API) + Vue Router 4 + Vuex 4 |
| 构建工具 | Vite 6.4 |
| 3D 地球 | globe.gl + Three.js |
| HTTP 客户端 | Axios |
| 时间处理 | Day.js |
| 样式 | SCSS (Sass Modern Compiler) |
| 图标 | RemixIcon + flag-icons |

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发环境

1. 复制环境变量示例：
```bash
cp .env.development.local.example .env.development.local
```

2. 编辑 `.env.development.local`，填入你的哪吒探针地址：
```
API_HOST=http://your-nezha-host:8080
WS_HOST=ws://your-nezha-host:8080
NEZHA_HOST=http://your-nezha-host:8080
```

3. 启动开发服务器：
```bash
npm run dev
```

### 生产构建

```bash
npm run build
```

构建产物位于 `dist/` 目录。

## 项目结构

```
src/
├── components/
│   ├── globe-earth/          # 3D地球核心组件
│   │   └── globe-earth.vue
│   └── server-panel/         # 服务器信息面板
│       ├── server-table.vue  # 表格列表
│       └── server-card.vue   # 卡片详情
├── views/
│   ├── home.vue              # 主页面（地球+列表）
│   └── detail.vue            # 服务器详情页
├── store/
│   └── index.js              # Vuex 状态管理
├── ws/
│   ├── index.js              # WebSocket 入口
│   └── service.js            # WebSocket 服务
├── utils/
│   ├── request.js            # HTTP 请求队列
│   ├── transform-v1-2-v0.js  # v1→v0 数据转换
│   ├── load-nezha-v0-config.js
│   ├── load-nezha-v1-config.js
│   ├── world-map.js          # 地理位置映射
│   ├── host.js               # 主机信息工具
│   └── date.js               # 时间工具
├── data/
│   └── code-maps.js          # 全球城市经纬度码表
├── config/
│   └── index.js              # 运行时配置
├── router/
│   └── index.js              # 路由配置
├── assets/
│   └── scss/
│       └── global.scss       # 全局样式
└── main.js                   # 应用入口
```

## 响应式断点

| 断点 | 布局 |
|------|------|
| `> 1280px` | 左右分栏：地球 60% + 列表 40% |
| `768px - 1280px` | 纵向布局：地球占主要区域 |
| `< 768px` | 纵向布局：地球缩小为 35vh，列表可滚动 |

## 地理位置码表

`src/data/code-maps.js` 中预定义了全球主要城市的经纬度坐标，支持通过以下方式定位 VPS：

1. **PublicNote 自定义位置** — 在哪吒探针的公开备注中设置 `{"customData": {"location": "TYO"}}`
2. **CountryCode 自动映射** — 根据 `Host.CountryCode` 自动匹配国家中心坐标

支持的城市覆盖：中国、日本、韩国、新加坡、马来西亚、泰国、越南、印度、阿联酋、土耳其、美国、加拿大、墨西哥、巴西、智利、英国、德国、法国、荷兰、俄罗斯、澳大利亚等 50+ 城市。

## 许可证

MIT
