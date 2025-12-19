from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional
from collections import deque, defaultdict
import json
import asyncio
from datetime import datetime, timedelta
import time
import random
import os

# データベース接続をインポート
from app.database import get_db_connection, init_database, DB_TYPE, DATABASE_URL
try:
    from app.database import DB_PATH
except ImportError:
    DB_PATH = None  # PostgreSQLの場合はNone

app = FastAPI(title="Live Reaction System API - Step 7")

# ========================
# データベース設定
# ========================
# database.pyで管理

def ensure_user_exists(user_id: str, experiment_group: str = 'control2'):
    """ユーザーが存在しない場合はusersテーブルに追加、存在する場合はグループを更新"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # ユーザーが存在するかチェック
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if cursor.fetchone() is None:
            # 新規ユーザーを追加
            created_at = int(time.time() * 1000)
            cursor.execute(
                "INSERT INTO users (id, experiment_group, created_at) VALUES (%s, %s, %s)",
                (user_id, experiment_group, created_at)
            )
            conn.commit()
            print(f"✅ 新規ユーザーをDBに登録: {user_id} (group: {experiment_group})")
        else:
            # 既存ユーザーのグループを更新
            cursor.execute(
                "UPDATE users SET experiment_group = %s WHERE id = %s",
                (experiment_group, user_id)
            )
            conn.commit()
            print(f"✅ ユーザーのグループを更新: {user_id} (group: {experiment_group})")

def create_session(session_id: str, user_id: str, video_id: str, experiment_group: str):
    """新しいセッションをsessionsテーブルに作成"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        started_at = int(time.time() * 1000)

        cursor.execute("""
            INSERT INTO sessions (session_id, user_id, video_id, experiment_group, started_at, is_completed)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (session_id, user_id, video_id, experiment_group, started_at, False))
        conn.commit()
        print(f"✅ セッション作成: {session_id} (user: {user_id}, video: {video_id})")

def complete_session(session_id: str):
    """セッションを完了としてマーク"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        completed_at = int(time.time() * 1000)

        cursor.execute("""
            UPDATE sessions
            SET completed_at = %s, is_completed = %s
            WHERE session_id = %s
        """, (completed_at, True, session_id))
        conn.commit()
        print(f"✅ セッション完了: {session_id}")

def log_reaction(user_id: str, data: dict):
    """リアクションデータをreactions_logに記録"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        timestamp = int(time.time() * 1000)
        states = data.get('states', {})
        events = data.get('events', {})
        video_time = data.get('videoTime')  # 動画の現在時刻を取得
        session_id = data.get('sessionId')  # セッションIDを取得

        cursor.execute("""
            INSERT INTO reactions_log (
                session_id, user_id, timestamp, video_time,
                is_smiling, is_surprised, is_concentrating, is_hand_up,
                nod_count, sway_vertical_count, cheer_count, clap_count
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            session_id,
            user_id,
            timestamp,
            video_time,
            states.get('isSmiling', False),
            states.get('isSurprised', False),
            states.get('isConcentrating', False),
            states.get('isHandUp', False),
            events.get('nod', 0),
            events.get('swayVertical', 0),
            events.get('cheer', 0),
            events.get('clap', 0)
        ))
        conn.commit()

def log_effect(effect_data: dict):
    """エフェクト指示をeffects_logに記録"""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        timestamp = effect_data.get('timestamp', int(time.time() * 1000))
        video_time = effect_data.get('videoTime')  # 動画の現在時刻を取得
        session_id = effect_data.get('sessionId')  # セッションIDを取得

        cursor.execute("""
            INSERT INTO effects_log (
                session_id, timestamp, video_time, effect_type, intensity, duration_ms
            ) VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            session_id,
            timestamp,
            video_time,
            effect_data.get('effectType', ''),
            effect_data.get('intensity', 0.0),
            effect_data.get('durationMs', 0)
        ))
        conn.commit()

# CORS設定
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# 許可するオリジンのリストを作成
allowed_origins = [
    "http://localhost:3000",  # ローカル開発
    "http://localhost:5173",  # Vite開発サーバー
]

# FRONTEND_URLが設定されていれば追加
if FRONTEND_URL and FRONTEND_URL not in allowed_origins:
    allowed_origins.append(FRONTEND_URL)

# CORS設定（本番環境）
print(f"🔧 FRONTEND_URL: {FRONTEND_URL}")
print(f"🔧 許可されたオリジン: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # 指定されたオリジンのみ許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================
# データ構造定義
# ========================

class UserReactionData:
    """ユーザーごとのリアクションデータを管理"""
    def __init__(self, user_id: str, max_samples: int = 3):
        self.user_id = user_id
        self.samples = deque(maxlen=max_samples)  # 最新3秒分のデータ
        
    def add_sample(self, data: dict):
        """新しいサンプルを追加"""
        self.samples.append({
            'timestamp': data.get('timestamp', time.time() * 1000),
            'states': data.get('states', {}),
            'events': data.get('events', {})
        })
    
    def get_recent_samples(self, window_ms: int = 3000) -> List[dict]:
        """指定時間窓内のサンプルを取得"""
        now = time.time() * 1000
        cutoff = now - window_ms
        return [s for s in self.samples if s['timestamp'] > cutoff]

class AggregationEngine:
    """集約エンジン：全ユーザーのデータを集約してエフェクトを決定"""
    def __init__(self):
        self.user_data: Dict[str, UserReactionData] = {}
        self.last_effect_type = None
        self.last_aggregation_time = time.time()
        
    def update_user_data(self, user_id: str, data: dict):
        """ユーザーデータを更新"""
        if user_id not in self.user_data:
            self.user_data[user_id] = UserReactionData(user_id)
        self.user_data[user_id].add_sample(data)
        
    def aggregate(self) -> Optional[dict]:
        """
        3秒窓でデータを集約し、エフェクト判定を行う
        返り値: エフェクト指示データ or None
        """
        now_ms = time.time() * 1000
        window_ms = 3000  # 3秒窓
        
        # 有効ユーザー（3秒以内にデータ送信があったユーザー）を特定
        active_users = {}
        for user_id, user_reaction in self.user_data.items():
            recent_samples = user_reaction.get_recent_samples(window_ms)
            if recent_samples:
                active_users[user_id] = recent_samples
        
        if not active_users:
            print("⚠️ アクティブユーザーなし")
            return None
            
        num_active_users = len(active_users)
        print(f"\n📊 集約処理開始 (アクティブユーザー: {num_active_users})")
        
        # ========================
        # State型の集計（ratio_state）
        # ========================
        state_counts = defaultdict(int)
        
        for user_id, samples in active_users.items():
            # 各ユーザーの最新サンプルのstateを使用
            if samples:
                latest_sample = samples[-1]
                states = latest_sample.get('states', {})
                for state_name, is_active in states.items():
                    if is_active:
                        state_counts[state_name] += 1
        
        # ratio_state計算
        ratio_state = {}
        for state_name, count in state_counts.items():
            ratio_state[state_name] = count / num_active_users
            
        print(f"  📈 ratio_state: {ratio_state}")
        
        # ========================
        # Event型の集計（density_event）
        # ========================
        event_totals = defaultdict(int)
        
        for user_id, samples in active_users.items():
            for sample in samples:
                events = sample.get('events', {})
                for event_name, count in events.items():
                    event_totals[event_name] += count
        
        # density_event計算
        # 密度 = 合計カウント / (有効ユーザー数 * 時間窓[秒])
        density_event = {}
        window_seconds = window_ms / 1000
        for event_name, total in event_totals.items():
            density_event[event_name] = total / (num_active_users * window_seconds)
            
        print(f"  📈 density_event: {density_event}")
        
        # ========================
        # エフェクト判定（優先順位付き）
        # ========================
        effect_type = None
        intensity = 0.0

        # 優先順位: cheer (isHandUp) > excitement > clap > bounce > shimmer > groove > cheer (audio) > wave > sparkle > focus

        # 1. cheer（手を上げている）判定
        if ratio_state.get('isHandUp', 0) >= 0.3:
            effect_type = 'cheer'
            intensity = min(ratio_state['isHandUp'], 1.0)
            print(f"  ✨ Cheer効果発動! (intensity: {intensity:.2f})")

        # 2. excitement（驚き）判定
        elif ratio_state.get('isSurprised', 0) >= 0.3:
            effect_type = 'excitement'
            intensity = min(ratio_state['isSurprised'], 1.0)
            print(f"  ✨ Excitement効果発動! (intensity: {intensity:.2f})")

        # 3. clap（拍手・音声）判定
        elif density_event.get('clap', 0) >= 0.15:
            effect_type = 'clapping_icons'
            intensity = min(density_event['clap'] / 0.3, 1.0)
            print(f"  ✨ Clapping Icons効果発動! (intensity: {intensity:.2f})")

        # 4. bounce（縦揺れ）判定
        elif density_event.get('swayVertical', 0) >= 0.2:
            effect_type = 'bounce'
            intensity = min(density_event['swayVertical'], 1.0)
            print(f"  ✨ Bounce効果発動! (intensity: {intensity:.2f})")

        # 5. shimmer（首を横に振る）判定
        elif density_event.get('shakeHead', 0) >= 0.2:
            effect_type = 'shimmer'
            intensity = min(density_event['shakeHead'], 1.0)
            print(f"  ✨ Shimmer効果発動! (intensity: {intensity:.2f})")

        # 6. groove（横揺れ）判定
        elif density_event.get('swayHorizontal', 0) >= 0.2:
            effect_type = 'groove'
            intensity = min(density_event['swayHorizontal'], 1.0)
            print(f"  ✨ Groove効果発動! (intensity: {intensity:.2f})")

        # 7. cheer（歓声・音声）判定
        elif density_event.get('cheer', 0) >= 0.15:
            effect_type = 'wave'  # 歓声は波のエフェクトを使用
            intensity = min(density_event['cheer'] / 0.3, 1.0)
            print(f"  ✨ Wave効果発動（歓声）! (intensity: {intensity:.2f})")

        # 8. wave（頷き）判定
        elif density_event.get('nod', 0) >= 0.3:
            effect_type = 'wave'
            intensity = min(density_event['nod'] / 0.5, 1.0)
            print(f"  ✨ Wave効果発動! (intensity: {intensity:.2f})")

        # 9. sparkle（笑顔）判定
        elif ratio_state.get('isSmiling', 0) >= 0.35:
            effect_type = 'sparkle'
            intensity = min(ratio_state['isSmiling'], 1.0)
            print(f"  ✨ Sparkle効果発動! (intensity: {intensity:.2f})")

        # 10. focus（集中）判定
        elif ratio_state.get('isConcentrating', 0) >= 0.4:
            effect_type = 'focus'
            intensity = min(ratio_state['isConcentrating'], 1.0)
            print(f"  ✨ Focus効果発動! (intensity: {intensity:.2f})")
        
        if effect_type:
            return {
                "type": "effect",
                "effectType": effect_type,
                "intensity": intensity,
                "durationMs": 2000,
                "timestamp": int(now_ms),
                "debug": {
                    "activeUsers": num_active_users,
                    "ratioState": ratio_state,
                    "densityEvent": density_event
                }
            }
        
        print("  ⏸️ エフェクト発動条件を満たさず")
        return None

# ========================
# 接続管理
# ========================

# ランダムエフェクト用の定数
EFFECT_TYPES = ['sparkle', 'wave', 'excitement', 'bounce', 'cheer', 'shimmer', 'focus', 'groove', 'clapping_icons']
RANDOM_EFFECT_INTERVAL = 5  # ランダムエフェクトの発動間隔（秒）

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_groups: Dict[str, str] = {}  # ユーザーごとの実験グループ
        self.user_is_host: Dict[str, bool] = {}  # ユーザーがホストかどうか
        self.aggregation_engine = AggregationEngine()
        self.aggregation_task = None
        self.random_effect_task = None
        self.last_random_effect_time = time.time()

    async def connect(self, websocket: WebSocket, user_id: str, experiment_group: str = 'control2', is_host: bool = False):
        self.active_connections[user_id] = websocket
        self.user_groups[user_id] = experiment_group
        self.user_is_host[user_id] = is_host
        host_label = " (HOST)" if is_host else ""
        print(f"✅ クライアント接続: {user_id}{host_label} (group: {experiment_group}, 合計: {len(self.active_connections)})")
        
        # 集約タスクを開始（まだ開始していない場合）
        if self.aggregation_task is None:
            self.aggregation_task = asyncio.create_task(self.run_aggregation_loop())
            print("🔄 集約ループを開始しました")
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_groups:
            del self.user_groups[user_id]
        if user_id in self.user_is_host:
            del self.user_is_host[user_id]
        print(f"❌ クライアント切断: {user_id} (合計: {len(self.active_connections)})")
    
    async def send_personal_message(self, message: dict, user_id: str):
        """特定のクライアントにメッセージを送信"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception as e:
                print(f"⚠️ 送信エラー ({user_id}): {e}")
                self.disconnect(user_id)
    
    async def broadcast(self, message: dict):
        """全クライアントにメッセージをブロードキャスト"""
        disconnected_users = []

        for user_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"⚠️ ブロードキャスト送信エラー ({user_id}): {e}")
                disconnected_users.append(user_id)

        # 切断されたクライアントを削除
        for user_id in disconnected_users:
            self.disconnect(user_id)

        if message.get('type') == 'effect':
            print(f"📡 エフェクト指示を{len(self.active_connections)}クライアントに配信")

    async def broadcast_to_group(self, message: dict, target_group: str):
        """特定のグループにのみメッセージをブロードキャスト"""
        disconnected_users = []
        sent_count = 0

        for user_id, connection in self.active_connections.items():
            if self.user_groups.get(user_id) == target_group:
                try:
                    await connection.send_json(message)
                    sent_count += 1
                except Exception as e:
                    print(f"⚠️ グループ送信エラー ({user_id}): {e}")
                    disconnected_users.append(user_id)

        # 切断されたクライアントを削除
        for user_id in disconnected_users:
            self.disconnect(user_id)

        if message.get('type') == 'effect' and sent_count > 0:
            print(f"📡 エフェクト指示を{target_group}グループの{sent_count}クライアントに配信")

    def get_host_user_id(self, group: str) -> Optional[str]:
        """指定されたグループのホストのユーザーIDを取得"""
        for user_id, user_group in self.user_groups.items():
            if user_group == group and self.user_is_host.get(user_id, False):
                return user_id
        return None

    def generate_random_effect(self) -> dict:
        """ランダムなエフェクトを生成（対照群1用）"""
        effect_type = random.choice(EFFECT_TYPES)
        intensity = random.uniform(0.5, 1.0)

        return {
            "type": "effect",
            "effectType": effect_type,
            "intensity": intensity,
            "durationMs": 2000,
            "timestamp": int(time.time() * 1000),
            "debug": {
                "isRandom": True,
                "group": "control1"
            }
        }
    
    def update_reaction_data(self, user_id: str, data: dict):
        """リアクションデータを集約エンジンに渡す"""
        self.aggregation_engine.update_user_data(user_id, data)
    
    async def run_aggregation_loop(self):
        """1秒ごとに集約処理を実行するループ"""
        print("🔄 集約ループ開始")

        while True:
            try:
                # 1秒待機
                await asyncio.sleep(1.0)

                # アクティブな接続がない場合はスキップ
                if not self.active_connections:
                    continue

                current_time = time.time()

                # ========================
                # 実験群（experiment）とデバッグ群（debug）: リアクションベースのエフェクト
                # ========================
                experiment_users = [uid for uid, grp in self.user_groups.items() if grp in ['experiment', 'debug']]
                if experiment_users:
                    # 集約処理を実行
                    effect = self.aggregation_engine.aggregate()

                    # エフェクト指示があれば実験群・デバッグ群クライアントに配信
                    if effect:
                        # DBに記録
                        try:
                            log_effect(effect)
                        except Exception as e:
                            print(f"⚠️ エフェクトDB記録エラー: {e}")

                        # 実験群にブロードキャスト
                        await self.broadcast_to_group(effect, 'experiment')
                        # デバッグ群にもブロードキャスト
                        await self.broadcast_to_group(effect, 'debug')

                # ========================
                # 対照群1（control1）: ランダムエフェクト
                # ========================
                control1_users = [uid for uid, grp in self.user_groups.items() if grp == 'control1']
                if control1_users:
                    # 一定間隔でランダムエフェクトを発動
                    if current_time - self.last_random_effect_time >= RANDOM_EFFECT_INTERVAL:
                        random_effect = self.generate_random_effect()

                        # DBに記録
                        try:
                            log_effect(random_effect)
                        except Exception as e:
                            print(f"⚠️ ランダムエフェクトDB記録エラー: {e}")

                        # 対照群1のみにブロードキャスト
                        await self.broadcast_to_group(random_effect, 'control1')
                        self.last_random_effect_time = current_time
                        print(f"🎲 ランダムエフェクト発動: {random_effect['effectType']}")

                # ========================
                # 対照群2（control2）: エフェクトなし
                # ========================
                # 何も送信しない

                # ========================
                # ホストに接続人数を送信
                # ========================
                for user_id, is_host in self.user_is_host.items():
                    if is_host:
                        # グループ別の接続人数を計算
                        group = self.user_groups.get(user_id, 'control2')
                        group_count = sum(1 for uid, grp in self.user_groups.items() if grp == group and not self.user_is_host.get(uid, False))

                        await self.send_personal_message({
                            "type": "connection_count",
                            "count": group_count,
                            "total": len(self.active_connections) - sum(1 for is_h in self.user_is_host.values() if is_h),
                            "group": group
                        }, user_id)

            except Exception as e:
                print(f"❌ 集約ループエラー: {e}")
                import traceback
                traceback.print_exc()

# グローバルインスタンス
manager = ConnectionManager()

# ========================
# APIエンドポイント
# ========================

@app.get("/")
async def root():
    """ヘルスチェック"""
    db_info = str(DB_PATH) if DB_PATH else f"{DB_TYPE} (DATABASE_URL)"
    return {
        "status": "running",
        "service": "Live Reaction System - Step 7",
        "active_connections": len(manager.active_connections),
        "database": db_info,
        "timestamp": datetime.now().isoformat()
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocketエンドポイント
    Step 4: リアクションデータを受信し、集約してエフェクト判定
    """
    user_id = None
    experiment_group = 'control2'

    try:
        # 接続受け入れ
        await websocket.accept()
        print("🔌 WebSocket接続待機中...")

        # 最初のメッセージでuser_id、experimentGroup、isHostを取得
        first_message = await websocket.receive_text()
        data = json.loads(first_message)
        user_id = data.get("userId")
        experiment_group = data.get("experimentGroup", "control2")
        is_host = data.get("isHost", False)

        # グループ名の検証（debugは実験群と同じ動作）
        if experiment_group not in ['experiment', 'control1', 'control2', 'debug']:
            experiment_group = 'control2'

        if not user_id:
            print("⚠️ user_idがありません。接続を閉じます。")
            await websocket.close()
            return

        # 接続を管理リストに追加
        await manager.connect(websocket, user_id, experiment_group, is_host)

        # ユーザーをDBに登録（存在しない場合）
        ensure_user_exists(user_id, experiment_group)

        # 接続確認メッセージを送信
        await websocket.send_json({
            "type": "connection_established",
            "userId": user_id,
            "experimentGroup": experiment_group,
            "message": f"WebSocket接続が確立されました（グループ: {experiment_group}）",
            "timestamp": datetime.now().isoformat()
        })
        
        # メッセージ受信ループ
        while True:
            # クライアントからメッセージを受信
            text_data = await websocket.receive_text()
            data = json.loads(text_data)

            message_type = data.get('type')

            # ========================
            # セッション作成イベント
            # ========================
            if message_type == 'session_create':
                session_id = data.get('sessionId')
                video_id = data.get('videoId', '')
                if session_id:
                    try:
                        create_session(session_id, user_id, video_id, experiment_group)
                        await websocket.send_json({
                            "type": "session_created",
                            "sessionId": session_id,
                            "timestamp": int(time.time() * 1000)
                        })
                    except Exception as e:
                        print(f"⚠️ セッション作成エラー: {e}")
                continue

            # ========================
            # セッション完了イベント
            # ========================
            if message_type == 'session_completed':
                session_id = data.get('sessionId')
                if session_id:
                    try:
                        complete_session(session_id)
                        await websocket.send_json({
                            "type": "session_completion_confirmed",
                            "sessionId": session_id,
                            "timestamp": int(time.time() * 1000)
                        })
                    except Exception as e:
                        print(f"⚠️ セッション完了エラー: {e}")
                continue

            # ========================
            # 動画URL選択イベント（experiment群のホストのみ）
            # ========================
            if message_type == 'video_url_selected':
                # ホストが動画URLを選択したことをexperiment群全体にブロードキャスト
                if experiment_group == 'experiment' and manager.user_is_host.get(user_id, False):
                    video_id = data.get('videoId', '')
                    print(f"📺 動画URL選択イベント受信 ({user_id}): {video_id}")
                    # experiment群の他のメンバーにブロードキャスト
                    await manager.broadcast_to_group({
                        "type": "video_url_selected",
                        "videoId": video_id,
                        "timestamp": data.get('timestamp', int(time.time() * 1000))
                    }, 'experiment')
                continue

            # ========================
            # 動画同期イベント（experiment群のみ）
            # ========================
            if message_type in ['video_play', 'video_pause', 'video_seek']:
                # ホストからの動画操作をexperiment群全体にブロードキャスト
                if experiment_group == 'experiment':
                    print(f"🎬 動画同期イベント受信 ({user_id}): {message_type}")
                    # experiment群の他のメンバーにブロードキャスト
                    await manager.broadcast_to_group({
                        "type": message_type,
                        "currentTime": data.get('currentTime', 0),
                        "timestamp": data.get('timestamp', int(time.time() * 1000))
                    }, 'experiment')
                continue

            # ========================
            # 時刻同期リクエスト（experiment群の参加者 → ホスト）
            # ========================
            if message_type == 'time_sync_request':
                # 被験者からホストへの時刻問い合わせ
                host_user_id = manager.get_host_user_id(experiment_group)
                if host_user_id:
                    print(f"⏱️ 時刻同期リクエスト: {user_id} → {host_user_id}")
                    await manager.send_personal_message({
                        "type": "time_sync_request",
                        "requesterId": user_id,
                        "timestamp": data.get('timestamp', int(time.time() * 1000))
                    }, host_user_id)
                else:
                    print(f"⚠️ 時刻同期リクエスト: ホストが見つかりません (group: {experiment_group})")
                continue

            # ========================
            # 時刻同期レスポンス（ホスト → 参加者）
            # ========================
            if message_type == 'time_sync_response':
                # ホストから被験者への時刻応答
                requester_id = data.get('requesterId')
                if requester_id:
                    print(f"⏱️ 時刻同期レスポンス: {user_id} → {requester_id} (time: {data.get('currentTime', 0):.2f}s)")
                    await manager.send_personal_message({
                        "type": "time_sync_response",
                        "currentTime": data.get('currentTime', 0),
                        "timestamp": data.get('timestamp', int(time.time() * 1000))
                    }, requester_id)
                continue

            # ========================
            # リアクションデータの処理
            # ========================
            # 受信データをログ出力（簡略版）
            is_host_user = manager.user_is_host.get(user_id, False)
            host_label = " (HOST)" if is_host_user else ""
            print(f"📥 データ受信 ({user_id}{host_label}): states={data.get('states', {})}, events={data.get('events', {})}")

            # データをDBに記録
            try:
                log_reaction(user_id, data)
            except Exception as e:
                print(f"⚠️ DB記録エラー ({user_id}): {e}")

            # ホストのリアクションは集約エンジンに登録しない
            if not is_host_user:
                manager.update_reaction_data(user_id, data)
            else:
                print(f"  ⏭️ ホストのリアクションは集約から除外")

            # 受信確認（デバッグ用、本番では削除可）
            await manager.send_personal_message({
                "type": "data_received",
                "message": "データを受信し、集約処理に追加しました",
                "timestamp": datetime.now().isoformat()
            }, user_id)
            
    except WebSocketDisconnect:
        if user_id:
            manager.disconnect(user_id)
        print(f"🔌 WebSocket切断: {user_id if user_id else '不明'}")
        
    except Exception as e:
        if user_id:
            manager.disconnect(user_id)
        print(f"❌ エラー発生: {e}")
        import traceback
        traceback.print_exc()

@app.get("/status")
async def get_status():
    """システムステータス取得（デバッグ用）"""
    # グループ別のユーザー数を集計
    group_counts = {'experiment': 0, 'control1': 0, 'control2': 0}
    for user_id, group in manager.user_groups.items():
        if group in group_counts:
            group_counts[group] += 1

    return {
        "active_connections": len(manager.active_connections),
        "connected_users": list(manager.active_connections.keys()),
        "user_groups": manager.user_groups,
        "group_counts": group_counts,
        "aggregation_data": {
            "total_users": len(manager.aggregation_engine.user_data),
            "user_ids": list(manager.aggregation_engine.user_data.keys())
        },
        "timestamp": datetime.now().isoformat()
    }

@app.get("/debug/aggregation")
async def get_aggregation_debug():
    """集約データのデバッグ情報取得"""
    debug_info = {}

    for user_id, user_reaction in manager.aggregation_engine.user_data.items():
        recent_samples = user_reaction.get_recent_samples()
        debug_info[user_id] = {
            "sample_count": len(recent_samples),
            "latest_sample": recent_samples[-1] if recent_samples else None
        }

    return {
        "user_data": debug_info,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/debug/database")
async def get_database_stats():
    """データベース統計情報取得"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # 各テーブルのレコード数を取得
            cursor.execute("SELECT COUNT(*) FROM users")
            users_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM reactions_log")
            reactions_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM effects_log")
            effects_count = cursor.fetchone()[0]

            # 最新のレコードを取得
            cursor.execute("SELECT * FROM reactions_log ORDER BY timestamp DESC LIMIT 5")
            recent_reactions = cursor.fetchall()

            cursor.execute("SELECT * FROM effects_log ORDER BY timestamp DESC LIMIT 5")
            recent_effects = cursor.fetchall()

            db_info = str(DB_PATH) if DB_PATH else f"{DB_TYPE} (DATABASE_URL)"
            return {
                "database_path": db_info,
                "stats": {
                    "users": users_count,
                    "reactions_log": reactions_count,
                    "effects_log": effects_count
                },
                "recent_reactions": recent_reactions,
                "recent_effects": recent_effects,
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# ========================
# データエクスポートAPI
# ========================

@app.get("/admin/export/session/{session_id}")
async def export_session(session_id: str):
    """特定のセッションデータをエクスポート"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # セッション情報を取得
            cursor.execute("""
                SELECT session_id, user_id, video_id, experiment_group,
                       started_at, completed_at, is_completed
                FROM sessions
                WHERE session_id = %s
            """, (session_id,))
            session_row = cursor.fetchone()

            if not session_row:
                return {"error": "Session not found", "session_id": session_id}

            # セッション情報を整形
            session_info = {
                "session_id": session_row[0],
                "user_id": session_row[1],
                "video_id": session_row[2],
                "experiment_group": session_row[3],
                "started_at": session_row[4],
                "completed_at": session_row[5],
                "is_completed": bool(session_row[6]),
                "duration_ms": session_row[5] - session_row[4] if session_row[5] else None
            }

            # リアクションデータを取得
            cursor.execute("""
                SELECT timestamp, video_time, is_smiling, is_surprised, is_concentrating,
                       is_hand_up, nod_count, sway_vertical_count, cheer_count, clap_count
                FROM reactions_log
                WHERE session_id = %s
                ORDER BY timestamp
            """, (session_id,))
            reactions_rows = cursor.fetchall()

            reactions = []
            for row in reactions_rows:
                reactions.append({
                    "timestamp": row[0],
                    "video_time": row[1],
                    "is_smiling": bool(row[2]) if row[2] is not None else None,
                    "is_surprised": bool(row[3]) if row[3] is not None else None,
                    "is_concentrating": bool(row[4]) if row[4] is not None else None,
                    "is_hand_up": bool(row[5]) if row[5] is not None else None,
                    "nod_count": row[6],
                    "sway_vertical_count": row[7],
                    "cheer_count": row[8],
                    "clap_count": row[9]
                })

            # エフェクトデータを取得
            cursor.execute("""
                SELECT timestamp, video_time, effect_type, intensity, duration_ms
                FROM effects_log
                WHERE session_id = %s
                ORDER BY timestamp
            """, (session_id,))
            effects_rows = cursor.fetchall()

            effects = []
            for row in effects_rows:
                effects.append({
                    "timestamp": row[0],
                    "video_time": row[1],
                    "effect_type": row[2],
                    "intensity": row[3],
                    "duration_ms": row[4]
                })

            return {
                "session": session_info,
                "reactions": reactions,
                "effects": effects,
                "stats": {
                    "total_reactions": len(reactions),
                    "total_effects": len(effects)
                }
            }

    except Exception as e:
        return {"error": str(e), "session_id": session_id}


@app.get("/admin/export/completed")
async def export_completed_sessions(group: str = None, date: str = None):
    """完了したセッションの一覧を取得

    Args:
        group: 実験グループでフィルタ (experiment, control1, control2)
        date: 日付でフィルタ (YYYY-MM-DD形式)
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            # クエリを構築
            query = """
                SELECT session_id, user_id, video_id, experiment_group,
                       started_at, completed_at, is_completed
                FROM sessions
                WHERE is_completed = %s
            """
            params = [True]

            if group:
                query += " AND experiment_group = %s"
                params.append(group)

            if date:
                # 日付範囲でフィルタ（その日の0時から24時まで）
                from datetime import datetime
                date_obj = datetime.strptime(date, "%Y-%m-%d")
                start_ms = int(date_obj.timestamp() * 1000)
                end_ms = start_ms + (24 * 60 * 60 * 1000)
                query += " AND started_at >= %s AND started_at < %s"
                params.extend([start_ms, end_ms])

            query += " ORDER BY started_at DESC"

            cursor.execute(query, tuple(params))
            sessions_rows = cursor.fetchall()

            sessions = []
            for row in sessions_rows:
                sessions.append({
                    "session_id": row[0],
                    "user_id": row[1],
                    "video_id": row[2],
                    "experiment_group": row[3],
                    "started_at": row[4],
                    "completed_at": row[5],
                    "is_completed": bool(row[6]),
                    "duration_ms": row[5] - row[4] if row[5] else None
                })

            return {
                "sessions": sessions,
                "total": len(sessions),
                "filters": {
                    "group": group,
                    "date": date
                }
            }

    except Exception as e:
        return {"error": str(e)}


@app.get("/admin/sessions")
async def get_all_sessions():
    """全セッションの一覧を取得（管理用）"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT session_id, user_id, video_id, experiment_group,
                       started_at, completed_at, is_completed
                FROM sessions
                ORDER BY started_at DESC
                LIMIT 100
            """)
            sessions_rows = cursor.fetchall()

            sessions = []
            for row in sessions_rows:
                sessions.append({
                    "session_id": row[0],
                    "user_id": row[1],
                    "video_id": row[2],
                    "experiment_group": row[3],
                    "started_at": row[4],
                    "completed_at": row[5],
                    "is_completed": bool(row[6]),
                    "duration_ms": row[5] - row[4] if row[5] else None
                })

            return {
                "sessions": sessions,
                "total": len(sessions)
            }

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🚀 Live Reaction System - Backend Server (Step 7)")
    print("=" * 60)
    print("📍 Server: http://localhost:8000")
    print("🔌 WebSocket: ws://localhost:8000/ws")
    print("📊 Status: http://localhost:8000/status")
    print("🐛 Debug: http://localhost:8000/debug/aggregation")
    db_info = str(DB_PATH) if DB_PATH else f"{DB_TYPE} (DATABASE_URL)"
    print("💾 Database: " + db_info)
    print("=" * 60)
    print("✨ Step 7機能:")
    print("  - リアクション拡張: 笑顔、驚き、手上げ、頷き、縦揺れ")
    print("  - エフェクト拡張: sparkle, excitement, wave, bounce, cheer")
    print("  - 優先順位付きエフェクト判定")
    print("  - データベース記録: users, reactions_log, effects_log")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")