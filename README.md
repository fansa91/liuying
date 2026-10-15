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

每次 push 到 main 会自动构建, 并把部署包发布到
[Release (tag: latest)](https://github.com/fansa91/liuying/releases/tag/latest),
包含: `liuying-web-dist.tar.gz`、`liuying-api-dist.tar.gz`、`deploy.sh`、
`liuying-api.service`、`Caddyfile`、`sources.json.example`。

```bash
# 在服务器上: 一次下载齐
mkdir -p ~/release/{web-dist,api-dist,deploy,api} && cd ~/release
base=https://github.com/fansa91/liuying/releases/download/latest
curl -sL -o web-dist.tar.gz $base/liuying-web-dist.tar.gz
curl -sL -o api-dist.tar.gz  $base/liuying-api-dist.tar.gz
curl -sL -o deploy/deploy.sh $base/deploy.sh
curl -sL -o deploy/liuying-api.service $base/liuying-api.service
curl -sL -o deploy/Caddyfile $base/Caddyfile
curl -sL -o api/sources.json.example $base/sources.json.example
tar -xzf web-dist.tar.gz -C web-dist
tar -xzf api-dist.tar.gz -C api-dist
chmod +x deploy/deploy.sh

# 一键部署 (Caddy 手动配置, 参考 deploy/Caddyfile)
sudo ./deploy/deploy.sh --dir /srv/liuying \
  --web-dist ~/release/web-dist \
  --api-dist ~/release/api-dist
# 填源: 编辑 /srv/liuying/api/sources.json, 然后
sudo systemctl restart liuying-api
```

脚本会: 拷贝前端到 `<dir>/web`, 后端到 `<dir>/api` 并 `npm ci --omit=dev`,
首次生成 `sources.json` (不覆盖已有), 按 `--dir/--user/--port` 生成 systemd
单元并启动。查看状态: `systemctl status liuying-api`, 日志: `journalctl -u liuying-api -f`。
