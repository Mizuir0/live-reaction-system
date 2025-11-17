from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional
from collections import deque, defaultdict
import json
import asyncio
from datetime import datetime, timedelta
import time

app = FastAPI(title="Live Reaction System API - Step 6")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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

        # 優先順位: cheer > excitement > bounce > wave > sparkle

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

        # 3. bounce（縦揺れ）判定
        elif density_event.get('swayVertical', 0) >= 0.2:
            effect_type = 'bounce'
            intensity = min(density_event['swayVertical'], 1.0)
            print(f"  ✨ Bounce効果発動! (intensity: {intensity:.2f})")

        # 4. wave（頷き）判定
        elif density_event.get('nod', 0) >= 0.3:
            effect_type = 'wave'
            intensity = min(density_event['nod'] / 0.5, 1.0)
            print(f"  ✨ Wave効果発動! (intensity: {intensity:.2f})")

        # 5. sparkle（笑顔）判定
        elif ratio_state.get('isSmiling', 0) >= 0.35:
            effect_type = 'sparkle'
            intensity = min(ratio_state['isSmiling'], 1.0)
            print(f"  ✨ Sparkle効果発動! (intensity: {intensity:.2f})")
        
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

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.aggregation_engine = AggregationEngine()
        self.aggregation_task = None
    
    async def connect(self, websocket: WebSocket, user_id: str):
        self.active_connections[user_id] = websocket
        print(f"✅ クライアント接続: {user_id} (合計: {len(self.active_connections)})")
        
        # 集約タスクを開始（まだ開始していない場合）
        if self.aggregation_task is None:
            self.aggregation_task = asyncio.create_task(self.run_aggregation_loop())
            print("🔄 集約ループを開始しました")
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
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
                
                # 集約処理を実行
                effect = self.aggregation_engine.aggregate()
                
                # エフェクト指示があれば全クライアントに配信
                if effect:
                    await self.broadcast(effect)
                    
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
    return {
        "status": "running",
        "service": "Live Reaction System - Step 4",
        "active_connections": len(manager.active_connections),
        "timestamp": datetime.now().isoformat()
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocketエンドポイント
    Step 4: リアクションデータを受信し、集約してエフェクト判定
    """
    user_id = None
    
    try:
        # 接続受け入れ
        await websocket.accept()
        print("🔌 WebSocket接続待機中...")
        
        # 最初のメッセージでuser_idを取得
        first_message = await websocket.receive_text()
        data = json.loads(first_message)
        user_id = data.get("userId")
        
        if not user_id:
            print("⚠️ user_idがありません。接続を閉じます。")
            await websocket.close()
            return
        
        # 接続を管理リストに追加
        await manager.connect(websocket, user_id)
        
        # 接続確認メッセージを送信
        await websocket.send_json({
            "type": "connection_established",
            "userId": user_id,
            "message": "WebSocket接続が確立されました（Step4: 集約処理有効）",
            "timestamp": datetime.now().isoformat()
        })
        
        # メッセージ受信ループ
        while True:
            # クライアントからメッセージを受信
            text_data = await websocket.receive_text()
            data = json.loads(text_data)
            
            # 受信データをログ出力（簡略版）
            print(f"📥 データ受信 ({user_id}): states={data.get('states', {})}, events={data.get('events', {})}")
            
            # データを集約エンジンに登録
            manager.update_reaction_data(user_id, data)
            
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
    return {
        "active_connections": len(manager.active_connections),
        "connected_users": list(manager.active_connections.keys()),
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

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🚀 Live Reaction System - Backend Server (Step 6)")
    print("=" * 60)
    print("📍 Server: http://localhost:8000")
    print("🔌 WebSocket: ws://localhost:8000/ws")
    print("📊 Status: http://localhost:8000/status")
    print("🐛 Debug: http://localhost:8000/debug/aggregation")
    print("=" * 60)
    print("✨ Step 6機能:")
    print("  - リアクション拡張: 笑顔、驚き、頷き、縦揺れ")
    print("  - エフェクト拡張: sparkle, excitement, wave, bounce")
    print("  - 優先順位付きエフェクト判定")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")