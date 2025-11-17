"""
データベース初期化スクリプト
Step 7: ログ記録機能用のテーブルを作成
"""
import sqlite3
import os
from pathlib import Path

# データベースファイルのパス
DB_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DB_DIR / "live_reaction.db"

def init_database():
    """データベースとテーブルを初期化"""

    # dataディレクトリが存在しない場合は作成
    DB_DIR.mkdir(exist_ok=True)

    # データベース接続
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("=" * 60)
    print("📊 データベース初期化開始")
    print("=" * 60)
    print(f"データベースパス: {DB_PATH}")

    # usersテーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            experiment_group TEXT NOT NULL,  -- 'experimental' / 'placebo' / 'control'
            created_at INTEGER NOT NULL      -- ms
        )
    """)
    print("✅ usersテーブルを作成しました")

    # reactions_logテーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reactions_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,      -- ms (サーバー受信時)
            is_smiling BOOLEAN,
            is_surprised BOOLEAN,
            is_concentrating BOOLEAN,
            is_hand_up BOOLEAN,
            nod_count INTEGER DEFAULT 0,
            sway_vertical_count INTEGER DEFAULT 0,
            cheer_count INTEGER DEFAULT 0,
            clap_count INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    print("✅ reactions_logテーブルを作成しました")

    # effects_logテーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS effects_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,      -- ms
            effect_type TEXT NOT NULL,
            intensity REAL NOT NULL,
            duration_ms INTEGER NOT NULL
        )
    """)
    print("✅ effects_logテーブルを作成しました")

    # コミットして接続を閉じる
    conn.commit()
    conn.close()

    print("=" * 60)
    print("✨ データベース初期化完了!")
    print("=" * 60)

def check_database():
    """データベースの状態を確認"""
    if not DB_PATH.exists():
        print("⚠️ データベースファイルが存在しません")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("\n📊 データベース状態:")
    print("-" * 60)

    # 各テーブルのレコード数を確認
    tables = ['users', 'reactions_log', 'effects_log']
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"  {table}: {count} レコード")

    conn.close()
    print("-" * 60)

if __name__ == "__main__":
    init_database()
    check_database()
