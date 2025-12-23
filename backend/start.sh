#!/bin/bash

# データベース初期化
echo "🔧 Initializing database..."
python -c "from app.database import init_database; init_database()"

# サーバー起動
echo "🚀 Starting server..."
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}
