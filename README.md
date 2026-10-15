# 流影 LiuYing

多源 VOD 聚合 Web 播放器。前端 Vue 3 + Vuetify 3 (Material 3) + ArtPlayer,
后端 Node (Hono) 做源聚合与跨域代理, GitHub Actions 打包, Caddy + systemd 部署。

## 目录结构

```
liuying/
├── web/                        # 前端 (Vite + Vue3 + Vuetify3 + ArtPlayer)
│   └── src/
│       ├── views/              # 首页(分类) / 搜索(多源) / 详情页 / 播放页 / 历史 / 源管理 / 设置
│       ├── components/
│       │   ├── Player.vue      # ArtPlayer + hls.js 封装 (断点续播/进度上报)
│       │   └── QueuedImage.vue # 图片队列加载 (并发限制6 + 滚动懒加载)
│       ├── settings.ts         # 全局设置 (localStorage 持久化)
│       ├── theme.ts            # M3 seed color 生成完整 light/dark 配色
│       ├── history.ts          # 播放历史 (localStorage, 断点续播)
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
也可以直接在 web 端「源管理」页面增删改查 (支持测试连接), 改完即时生效, 无需重启。

前端功能:
- 设置页: 图片/播放链接是否经服务器代理, 主题模式 (浅色/深色/跟随系统),
  M3 主题色 (seed color 生成完整配色)
- 详情页: 海报/简介/线路/分集, 有历史记录时显示「继续播放」
- 播放历史: 记录看到第几集及集内进度, 打开自动断点续播

> 安全提示: 写接口 (增/删/改/测试) 默认无鉴权。如果 `api` 会被公网直接访问,
> 建议在 systemd 的 `Environment=` 里加 `ADMIN_TOKEN=xxx`, 之后 web 端「源管理」
> 页顶部填入同样的密钥才能操作 (存在浏览器 localStorage)。

## 账号与同步

- 右上角账号按钮可注册/登录 (用户名 2-20 位, 密码至少 4 位, bcrypt 加密存储)。
- 登录后: **源列表**存在账号下, 多端天然一致; **播放历史**和**设置**自动同步
  (本地改动防抖 2 秒推送, 启动/每 5 分钟/回前台自动拉取, last-write-wins)。
- 注册时自动继承服务端当前全局源列表。
- 未登录时保持原来的单机模式 (全局 `sources.json` + ADMIN_TOKEN)。

## 数据库 (MySQL)

账号、源、历史、设置都存在 MySQL。连接信息走环境变量
(`DB_HOST` 默认 127.0.0.1, `DB_PORT` 默认 3306, `DB_USER` 默认 root,
`DB_PASSWORD` 默认空, `DB_NAME` 默认 liuying), 库和表不存在会自动创建,
只需要 MySQL 用户有建库建表权限。

推荐把敏感配置写进 `/srv/liuying/api/.env` (部署脚本不会覆盖它):

```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=liuying
DB_PASSWORD=yourpassword
DB_NAME=liuying
ADMIN_TOKEN=xxx
```

然后 `sudo systemctl restart liuying-api` 生效。

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
[Release (tag: latest)](https://github.com/fansa91/liuying/releases/tag/latest)。

```bash
# 在服务器上: 下载部署脚本, 一键部署 (包会自动从 Release 下载)
curl -sSL -o deploy.sh https://github.com/fansa91/liuying/releases/download/latest/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh --dir /srv/liuying --download
# 填源: 编辑 /srv/liuying/api/sources.json, 然后
sudo systemctl restart liuying-api
```

也可以用本地包: `sudo ./deploy.sh --dir /srv/liuying --web-dist ./web-dist --api-dist ./api-dist`,
或指定仓库/标签: `--repo owner/name --tag v1.0.0`。Caddy 手动配置, 参考 `deploy/Caddyfile`。

脚本会: 拷贝前端到 `<dir>/web`, 后端到 `<dir>/api` 并 `npm ci --omit=dev`,
首次生成 `sources.json` (不覆盖已有), 按 `--dir/--user/--port` 生成 systemd
单元并启动。查看状态: `systemctl status liuying-api`, 日志: `journalctl -u liuying-api -f`。
