"""
データベース確認用スクリプト
詳細な統計情報とデータ分析を表示
"""
import sqlite3
from pathlib import Path
from datetime import datetime

DB_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DB_DIR / "live_reaction.db"

def print_header(title):
    """セクションヘッダーを表示"""
    print("\n" + "=" * 60)
    print(f"📊 {title}")
    print("=" * 60)

def check_database():
    """データベースの詳細情報を表示"""

    if not DB_PATH.exists():
        print(f"⚠️ データベースファイルが見つかりません: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("\n" + "=" * 60)
    print("🚀 Live Reaction System - データベース詳細確認")
    print("=" * 60)
    print(f"データベースパス: {DB_PATH}")

    # テーブルごとのレコード数
    print_header("テーブルごとのレコード数")
    cursor.execute("SELECT COUNT(*) FROM users")
    users_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM reactions_log")
    reactions_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM effects_log")
    effects_count = cursor.fetchone()[0]

    print(f"  👥 users          : {users_count:,} レコード")
    print(f"  📝 reactions_log  : {reactions_count:,} レコード")
    print(f"  ✨ effects_log    : {effects_count:,} レコード")

    # ユーザー情報
    print_header("登録ユーザー詳細")
    cursor.execute("""
        SELECT id, experiment_group, created_at
        FROM users
        ORDER BY created_at DESC
    """)
    users = cursor.fetchall()

    for user_id, group, created_at in users:
        created_time = datetime.fromtimestamp(created_at / 1000)
        print(f"\n  ユーザーID: {user_id}")
        print(f"  実験群    : {group}")
        print(f"  登録日時  : {created_time.strftime('%Y-%m-%d %H:%M:%S')}")

    # ユーザーごとのリアクション統計
    if users_count > 0:
        print_header("ユーザーごとのリアクション統計")
        for user_id, _, _ in users:
            cursor.execute("""
                SELECT
                    COUNT(*) as total_samples,
                    SUM(CASE WHEN is_smiling = 1 THEN 1 ELSE 0 END) as smiling_count,
                    SUM(CASE WHEN is_surprised = 1 THEN 1 ELSE 0 END) as surprised_count,
                    SUM(CASE WHEN is_hand_up = 1 THEN 1 ELSE 0 END) as hand_up_count,
                    SUM(nod_count) as total_nods,
                    SUM(sway_vertical_count) as total_sways
                FROM reactions_log
                WHERE user_id = ?
            """, (user_id,))

            stats = cursor.fetchone()
            if stats and stats[0] > 0:
                total, smiling, surprised, hand_up, nods, sways = stats
                print(f"\n  ユーザー: {user_id[:40]}...")
                print(f"    総サンプル数: {total:,}")
                print(f"    😊 笑顔      : {smiling:,} 回 ({smiling/total*100:.1f}%)")
                print(f"    😲 驚き      : {surprised:,} 回 ({surprised/total*100:.1f}%)")
                print(f"    🙌 手を上げる: {hand_up:,} 回 ({hand_up/total*100:.1f}%)")
                print(f"    👍 頷き      : {nods:,} 回")
                print(f"    🎵 縦揺れ    : {sways:,} 回")

    # エフェクトタイプ別の統計
    print_header("エフェクトタイプ別の統計")
    cursor.execute("""
        SELECT
            effect_type,
            COUNT(*) as count,
            ROUND(AVG(intensity), 3) as avg_intensity,
            ROUND(MIN(intensity), 3) as min_intensity,
            ROUND(MAX(intensity), 3) as max_intensity,
            AVG(duration_ms) as avg_duration
        FROM effects_log
        GROUP BY effect_type
        ORDER BY count DESC
    """)

    effect_stats = cursor.fetchall()
    if effect_stats:
        for effect_type, count, avg_int, min_int, max_int, avg_dur in effect_stats:
            print(f"\n  {effect_type}:")
            print(f"    発動回数    : {count:,} 回")
            print(f"    平均強度    : {avg_int:.3f}")
            print(f"    強度範囲    : {min_int:.3f} ~ {max_int:.3f}")
            print(f"    平均持続時間: {avg_dur:.0f} ms")
    else:
        print("  エフェクトログがありません")

    # 時系列統計（最近10秒間）
    print_header("最近のアクティビティ（最新10件のエフェクト）")
    cursor.execute("""
        SELECT
            timestamp,
            effect_type,
            intensity,
            duration_ms
        FROM effects_log
        ORDER BY timestamp DESC
        LIMIT 10
    """)

    recent_effects = cursor.fetchall()
    if recent_effects:
        for timestamp, effect_type, intensity, duration in recent_effects:
            effect_time = datetime.fromtimestamp(timestamp / 1000)
            print(f"  {effect_time.strftime('%H:%M:%S')} | {effect_type:10s} | 強度: {intensity:.2f} | {duration}ms")
    else:
        print("  エフェクトログがありません")

    # 最新のリアクション（5件）
    print_header("最新のリアクションログ（5件）")
    cursor.execute("""
        SELECT
            timestamp,
            user_id,
            is_smiling,
            is_surprised,
            is_hand_up,
            nod_count,
            sway_vertical_count
        FROM reactions_log
        ORDER BY timestamp DESC
        LIMIT 5
    """)

    recent_reactions = cursor.fetchall()
    if recent_reactions:
        for timestamp, user_id, smiling, surprised, hand_up, nods, sways in recent_reactions:
            reaction_time = datetime.fromtimestamp(timestamp / 1000)
            states = []
            if smiling: states.append("😊笑顔")
            if surprised: states.append("😲驚き")
            if hand_up: states.append("🙌手上げ")
            events = []
            if nods > 0: events.append(f"👍頷き×{nods}")
            if sways > 0: events.append(f"🎵縦揺れ×{sways}")

            states_str = ", ".join(states) if states else "なし"
            events_str = ", ".join(events) if events else "なし"

            print(f"\n  {reaction_time.strftime('%H:%M:%S')} | {user_id[:25]}...")
            print(f"    ステート: {states_str}")
            print(f"    イベント: {events_str}")
    else:
        print("  リアクションログがありません")

    conn.close()

    print("\n" + "=" * 60)
    print("✅ 確認完了")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    check_database()
