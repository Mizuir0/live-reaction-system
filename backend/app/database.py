"""
データベース接続の抽象化レイヤー
SQLiteとPostgreSQLの両方に対応
"""
import os
from pathlib import Path
from contextlib import contextmanager
from typing import Optional
from dotenv import load_dotenv

# 環境変数を読み込み
load_dotenv()

# DATABASE_URL環境変数を取得
DATABASE_URL = os.getenv("DATABASE_URL")

# データベースタイプを判定
if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
    DB_TYPE = "postgresql"
    import psycopg2
    from psycopg2.extras import RealDictCursor
else:
    DB_TYPE = "sqlite"
    import sqlite3
    # SQLite用のパス設定
    DB_DIR = Path(__file__).parent.parent / "data"
    DB_PATH = DB_DIR / "live_reaction.db"
    DB_DIR.mkdir(exist_ok=True)

print(f"🔧 データベースタイプ: {DB_TYPE}")
if DB_TYPE == "sqlite":
    print(f"   パス: {DB_PATH}")
else:
    print(f"   URL: {DATABASE_URL[:30]}...")


@contextmanager
def get_db_connection():
    """データベース接続のコンテキストマネージャー"""
    if DB_TYPE == "postgresql":
        conn = psycopg2.connect(DATABASE_URL)
        try:
            yield conn
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(DB_PATH)
        try:
            yield conn
        finally:
            conn.close()


def execute_query(query: str, params: tuple = (), fetch: str = None):
    """
    クエリを実行するヘルパー関数

    Args:
        query: SQL文（プレースホルダーは%sを使用）
        params: パラメータのタプル
        fetch: 'one', 'all', None
    """
    # SQLiteの場合は%sを?に変換
    if DB_TYPE == "sqlite":
        query = query.replace("%s", "?")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)

        if fetch == "one":
            result = cursor.fetchone()
        elif fetch == "all":
            result = cursor.fetchall()
        else:
            result = None
            conn.commit()

        return result


def init_database():
    """データベースとテーブルを初期化"""
    print("=" * 60)
    print("📊 データベース初期化開始")
    print("=" * 60)

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # usersテーブル
        if DB_TYPE == "postgresql":
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    experiment_group TEXT NOT NULL,
                    created_at BIGINT NOT NULL
                )
            """)
        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    experiment_group TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                )
            """)
        print("✅ usersテーブルを作成しました")

        # reactions_logテーブル
        if DB_TYPE == "postgresql":
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reactions_log (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    timestamp BIGINT NOT NULL,
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
        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reactions_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
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
        if DB_TYPE == "postgresql":
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS effects_log (
                    id SERIAL PRIMARY KEY,
                    timestamp BIGINT NOT NULL,
                    effect_type TEXT NOT NULL,
                    intensity REAL NOT NULL,
                    duration_ms INTEGER NOT NULL
                )
            """)
        else:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS effects_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL,
                    effect_type TEXT NOT NULL,
                    intensity REAL NOT NULL,
                    duration_ms INTEGER NOT NULL
                )
            """)
        print("✅ effects_logテーブルを作成しました")

        conn.commit()

    print("=" * 60)
    print("✨ データベース初期化完了!")
    print("=" * 60)


if __name__ == "__main__":
    init_database()
