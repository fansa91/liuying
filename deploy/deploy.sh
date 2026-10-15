#!/usr/bin/env bash
#
# 流影一键部署脚本
#
# 用法:
#   sudo ./deploy.sh --dir /srv/liuying [--web-dist ./web-dist] [--api-dist ./api-dist]
#                    [--user liuying] [--port 3000]
#
# 说明:
#   - --dir      安装目录 (默认 /srv/liuying), 下面会生成 web/ 和 api/
#   - --web-dist 前端 dist 目录 (默认 <repo>/web/dist)
#   - --api-dist 后端目录, 里面需有 dist/ + package.json (默认 <repo>/api)
#   - Caddy 请手动配置, 参考 deploy/Caddyfile (注意把 /api 反代到 --port)
#
set -euo pipefail

DIR="/srv/liuying"
WEB_DIST=""
API_DIST=""
USER="liuying"
PORT="3000"

usage() {
  cat <<'EOF'
流影一键部署脚本

用法:
  sudo ./deploy.sh --dir /srv/liuying [--web-dist ./web-dist] [--api-dist ./api-dist]
                   [--user liuying] [--port 3000]

说明:
  - --dir      安装目录 (默认 /srv/liuying), 下面会生成 web/ 和 api/
  - --web-dist 前端 dist 目录 (默认 <repo>/web/dist)
  - --api-dist 后端目录, 里面需有 dist/ + package.json (默认 <repo>/api)
  - Caddy 请手动配置, 参考 deploy/Caddyfile (注意把 /api 反代到 --port)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)      DIR="$2";      shift 2 ;;
    --web-dist) WEB_DIST="$2"; shift 2 ;;
    --api-dist) API_DIST="$2"; shift 2 ;;
    --user)     USER="$2";     shift 2 ;;
    --port)     PORT="$2";     shift 2 ;;
    -h|--help)  usage; exit 0 ;;
    *) echo "未知参数: $1"; usage; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
[[ -z "$WEB_DIST" ]] && WEB_DIST="$REPO_ROOT/web/dist"
[[ -z "$API_DIST" ]] && API_DIST="$REPO_ROOT/api"

[[ "$EUID" -eq 0 ]] || { echo "请用 root 运行 (需要写 /etc/systemd)"; exit 1; }
[[ -n "$DIR" && "$DIR" != "/" ]] || { echo "--dir 非法"; exit 1; }
[[ -d "$WEB_DIST" ]] || { echo "找不到前端 dist: $WEB_DIST"; exit 1; }
[[ -d "$API_DIST/dist" ]] || { echo "找不到后端构建产物: $API_DIST/dist (先在 api/ 里 npm run build)"; exit 1; }
command -v node >/dev/null || { echo "服务器需要先安装 node"; exit 1; }

echo "==> 部署到 $DIR"

# 运行用户
if ! id "$USER" >/dev/null 2>&1; then
  useradd -r -s /usr/sbin/nologin "$USER"
  echo "创建系统用户 $USER"
fi

# 前端静态文件
mkdir -p "$DIR/web"
rm -rf "${DIR:?}/web"/*
cp -r "$WEB_DIST"/. "$DIR/web"/
echo "前端 -> $DIR/web"

# 后端
mkdir -p "$DIR/api"
rm -rf "${DIR:?}/api/dist"
cp -r "$API_DIST/dist" "$DIR/api/dist"
cp "$API_DIST/package.json" "$API_DIST/package-lock.json" "$DIR/api/"
(cd "$DIR/api" && npm ci --omit=dev --no-audit --no-fund >/dev/null)
if [[ ! -f "$DIR/api/sources.json" ]]; then
  cp "$REPO_ROOT/api/sources.json.example" "$DIR/api/sources.json"
  echo "已生成 $DIR/api/sources.json, 请填入你的源地址"
fi
chown -R "$USER:$USER" "$DIR"
echo "后端 -> $DIR/api (端口 $PORT)"

# systemd
sed -e "s|@DIR@|$DIR|g" -e "s|@USER@|$USER|g" -e "s|@PORT@|$PORT|g" \
  "$SCRIPT_DIR/liuying-api.service" > /etc/systemd/system/liuying-api.service
systemctl daemon-reload
systemctl enable liuying-api.service >/dev/null
systemctl restart liuying-api.service
echo "systemd 服务 liuying-api 已启动"

echo
echo "完成. Caddy 请手动配置 (参考 deploy/Caddyfile), /api 反代到 127.0.0.1:$PORT"
echo "查看状态: systemctl status liuying-api | 日志: journalctl -u liuying-api -f"
