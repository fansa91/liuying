# 流影 LiuYing

多源 VOD 聚合 Web 播放器。前端 Vue 3 + Vuetify 3 (Material 3) + ArtPlayer,
后端 Node (Hono) 做源聚合与跨域代理, GitHub Actions 打包, Caddy + systemd 部署。

## 目录结构

```
liuying/
├── web/                        # 前端 (Vite + Vue3 + Vuetify3 + ArtPlayer)
│   └── src/
│       ├── views/              # 首页(分类) / 搜索(多源) / 播放页
│       ├── components/Player.vue  # ArtPlayer + hls.js 封装
│       └── api.ts              # 后端接口调用
├── api/                        # 后端 (Hono + TypeScript)
│   └── src/index.ts            # /api/sources|types|list|search|detail|proxy
├── .github/workflows/build.yml # CI: 分别打出 web-dist / api-dist
└── deploy/
    ├── Caddyfile               # 静态托管 + /api 反代
    └── liuying-api.service     # systemd 单元
```

## 后端接口

| 接口 | 说明 |
| --- | --- |
| `GET /api/sources` | 源列表 |
| `GET /api/types?source=` | 某源的分类 (缓存 1h) |
| `GET /api/list?source=&t=&pg=` | 按分类取影片列表 |
| `GET /api/search?wd=&sources=a,b` | 聚合搜索, 不传 sources = 搜全部 |
| `GET /api/detail?source=&ids=` | 详情 + 线路/分集播放地址解析 |
| `GET /api/proxy?url=` | 通用代理, m3u8 会重写分片地址回本代理 |

源配置: `api/sources.json` (AppleCMS 采集接口格式), 见 `sources.json.example`。

## 本地开发

```bash
# 后端 :3000
cd api && cp sources.json.example sources.json  # 填入你的源
npm install && npm run dev

# 前端 (vite 已配好 /api 代理到 localhost:3000)
cd web && npm install && npm run dev
```

## 部署

```bash
# 1. 从 Actions 下载 web-dist / api-dist
# 2. 前端
sudo mkdir -p /srv/liuying/web && sudo cp -r web-dist/* /srv/liuying/web/
# 3. 后端
sudo mkdir -p /srv/liuying/api && sudo cp -r api-dist/* /srv/liuying/api/
cd /srv/liuying/api && sudo npm ci --omit=dev
sudo cp sources.json.example sources.json  # 填入你的源
sudo useradd -r -s /usr/sbin/nologin liuying
sudo chown -R liuying:liuying /srv/liuying/api
# 4. systemd
sudo cp deploy/liuying-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now liuying-api
# 5. Caddy (改好 deploy/Caddyfile 里的域名)
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
```
