from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Set
import json
import asyncio
from datetime import datetime

app = FastAPI(title="Live Reaction System API")

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Reactの開発サーバー
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 接続中のクライアントを管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        print(f"✅ クライアント接続: {user_id} (合計: {len(self.active_connections)})")
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            print(f"❌ クライアント切断: {user_id} (合計: {len(self.active_connections)})")
    
    async def send_personal_message(self, message: dict, user_id: str):
        """特定のクライアントにメッセージを送信"""
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)
    
    async def broadcast(self, message: dict):
        """全クライアントにメッセージをブロードキャスト"""
        disconnected_users = []
        for user_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"⚠️ 送信エラー ({user_id}): {e}")
                disconnected_users.append(user_id)
        
        # 切断されたクライアントを削除
        for user_id in disconnected_users:
            self.disconnect(user_id)

manager = ConnectionManager()

@app.get("/")
async def root():
    """ヘルスチェック"""
    return {
        "status": "running",
        "service": "Live Reaction System",
        "active_connections": len(manager.active_connections),
        "timestamp": datetime.now().isoformat()
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocketエンドポイント
    クライアントからリアクションデータを受信し、echoで返す（Step3）
    """
    user_id = None
    
    try:
        # 接続受け入れ（user_idは後で受信）
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
        manager.active_connections[user_id] = websocket
        print(f"✅ クライアント接続: {user_id} (合計: {len(manager.active_connections)})")
        
        # 接続確認メッセージを送信
        await websocket.send_json({
            "type": "connection_established",
            "userId": user_id,
            "message": "WebSocket接続が確立されました",
            "timestamp": datetime.now().isoformat()
        })
        
        # メッセージ受信ループ
        while True:
            # クライアントからメッセージを受信
            text_data = await websocket.receive_text()
            data = json.loads(text_data)
            
            # 受信データをログ出力
            print(f"\n📥 受信データ ({user_id}):")
            print(f"  - timestamp: {data.get('timestamp')}")
            print(f"  - states: {data.get('states')}")
            print(f"  - events: {data.get('events')}")
            
            # Step3: 受信したデータをそのままechoで返す
            echo_response = {
                "type": "echo",
                "original": data,
                "serverTimestamp": datetime.now().isoformat(),
                "message": "データを受信しました"
            }
            
            await websocket.send_json(echo_response)
            print(f"📤 Echoレスポンス送信完了")
            
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
    """システムステータス取得"""
    return {
        "active_connections": len(manager.active_connections),
        "connected_users": list(manager.active_connections.keys()),
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🚀 Live Reaction System - Backend Server")
    print("=" * 60)
    print("📍 Server: http://localhost:8000")
    print("🔌 WebSocket: ws://localhost:8000/ws")
    print("📊 Status: http://localhost:8000/status")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")