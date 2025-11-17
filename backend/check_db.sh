#!/bin/bash
# データベース確認用スクリプト

DB_PATH="./data/live_reaction.db"

echo "=========================================="
echo "📊 Live Reaction System - DB確認"
echo "=========================================="
echo ""

# データベースが存在するか確認
if [ ! -f "$DB_PATH" ]; then
    echo "⚠️ データベースファイルが見つかりません: $DB_PATH"
    exit 1
fi

echo "データベースパス: $DB_PATH"
echo ""

# 各テーブルのレコード数を表示
echo "=========================================="
echo "📈 テーブルごとのレコード数"
echo "=========================================="
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'reactions_log', COUNT(*) FROM reactions_log
UNION ALL
SELECT 'effects_log', COUNT(*) FROM effects_log;
EOF
echo ""

# ユーザー一覧
echo "=========================================="
echo "👥 登録ユーザー一覧"
echo "=========================================="
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT
    id,
    experiment_group,
    datetime(created_at / 1000, 'unixepoch', 'localtime') as created_at
FROM users;
EOF
echo ""

# 最新のリアクションログ（5件）
echo "=========================================="
echo "📝 最新のリアクションログ（5件）"
echo "=========================================="
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT
    datetime(timestamp / 1000, 'unixepoch', 'localtime') as time,
    user_id,
    is_smiling,
    is_surprised,
    is_hand_up,
    nod_count,
    sway_vertical_count
FROM reactions_log
ORDER BY timestamp DESC
LIMIT 5;
EOF
echo ""

# 最新のエフェクトログ（5件）
echo "=========================================="
echo "✨ 最新のエフェクトログ（5件）"
echo "=========================================="
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT
    datetime(timestamp / 1000, 'unixepoch', 'localtime') as time,
    effect_type,
    ROUND(intensity, 2) as intensity,
    duration_ms
FROM effects_log
ORDER BY timestamp DESC
LIMIT 5;
EOF
echo ""

# エフェクトタイプ別の統計
echo "=========================================="
echo "📊 エフェクトタイプ別の統計"
echo "=========================================="
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT
    effect_type,
    COUNT(*) as count,
    ROUND(AVG(intensity), 3) as avg_intensity,
    ROUND(MIN(intensity), 3) as min_intensity,
    ROUND(MAX(intensity), 3) as max_intensity
FROM effects_log
GROUP BY effect_type
ORDER BY count DESC;
EOF
echo ""

echo "=========================================="
echo "✅ 確認完了"
echo "=========================================="
