#!/usr/bin/env bash
# Script khởi chạy nhanh toàn bộ dự án GeoAI Tourism
# Bao gồm: Database Docker + Backend (FastAPI reload) + Frontend (Vite HMR)

set -e

# Chuyển về thư mục gốc của script
CDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$CDIR"

echo "🚀 [1/3] Khởi động PostgreSQL/PostGIS Container..."
docker compose up -d

echo "⚡ [2/3] Kiểm tra môi trường Python backend..."
if [ ! -f "backend/venv/bin/uvicorn" ]; then
  echo "📦 Chưa thấy venv backend, đang khởi tạo & cài thư viện..."
  python3 -m venv backend/venv
  ./backend/venv/bin/pip install -r backend/requirements.txt
fi

if [ ! -d "web/node_modules" ]; then
  echo "📦 Chưa thấy node_modules web, đang cài npm packages..."
  (cd web && npm install)
fi

# Kiểm tra inotify watcher limit trên Linux
if [ -f "/proc/sys/fs/inotify/max_user_watches" ]; then
  WATCH_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches 2>/dev/null || echo 65536)
  if [ "$WATCH_LIMIT" -lt 524288 ]; then
    echo "⚠️  Cảnh báo: Giới hạn sysctl max_user_watches hiện tại là $WATCH_LIMIT (khá thấp)."
    echo "    Nếu gặp lỗi ENOSPC, hãy chạy lệnh sau một lần để tăng giới hạn:"
    echo "    sudo sysctl fs.inotify.max_user_watches=524288"
  fi
fi

echo "🔥 [3/3] Khởi chạy Backend & Frontend song song (Watch mode)..."
echo "------------------------------------------------------------"
echo "  • Backend API : http://localhost:8000 (Auto reload khi sửa code Python)"
echo "  • Frontend Web: http://localhost:5173 (Vite HMR khi sửa code React)"
echo "------------------------------------------------------------"

npx -y concurrently \
  --names "BACKEND,FRONTEND" \
  --prefix-colors "cyan.bold,green.bold" \
  --kill-others-on-fail \
  "cd backend && ./venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" \
  "cd web && npm run dev"
