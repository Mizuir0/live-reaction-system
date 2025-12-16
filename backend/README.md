# Live Reaction System - Backend

FastAPI + WebSocket + SQLite を使用したバックエンドサーバー

## 概要

リアクションデータを集約し、エフェクト判定を行い、全クライアントにブロードキャストします。

## 主な機能

- **WebSocket通信**: クライアントとの双方向リアルタイム通信
- **集約エンジン**: 複数ユーザーのリアクションを3秒窓で集約
- **エフェクト判定**: 優先順位に基づいて適切なエフェクトを選択
- **データベース記録**: ユーザー、リアクション、エフェクトをSQLiteに記録
- **デバッグAPI**: 開発用のデバッグエンドポイント

---

## セットアップ

### 1. 仮想環境の作成と有効化

```bash
# 仮想環境を作成
python -m venv venv

# 仮想環境を有効化
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

### 2. 依存パッケージのインストール

```bash
pip install -r requirements.txt
```

### 3. データベース初期化

```bash
python -c "from app.main import init_db; init_db()"
```

---

## 実行方法

### 開発サーバー（自動リロード）

```bash
uvicorn app.main:app --reload --port 8001
```

### 本番サーバー

```bash
python app/main.py
```

サーバーが起動すると、以下のエンドポイントが利用可能になります：

- **HTTP**: http://localhost:8001
- **WebSocket**: ws://localhost:8001/ws
- **Status**: http://localhost:8001/status
- **Debug Aggregation**: http://localhost:8001/debug/aggregation
- **Debug Database**: http://localhost:8001/debug/database

---

## API エンドポイント

### HTTP Endpoints

#### `GET /`
ヘルスチェック

**レスポンス例:**
```json
{
  "status": "running",
  "service": "Live Reaction System - Step 7",
  "active_connections": 3,
  "database": "/path/to/live_reaction.db",
  "timestamp": "2025-01-17T12:34:56.789Z"
}
```

#### `GET /status`
システムステータスと接続情報

**レスポンス例:**
```json
{
  "active_connections": 3,
  "connected_users": ["user-123", "user-456"],
  "aggregation_data": {
    "total_users": 3,
    "user_ids": ["user-123", "user-456", "user-789"]
  },
  "timestamp": "2025-01-17T12:34:56.789Z"
}
```

#### `GET /debug/aggregation`
集約データのデバッグ情報

#### `GET /debug/database`
データベース統計情報

### WebSocket Endpoint

#### `WS /ws`

**接続フロー:**
1. クライアントが接続
2. 初回メッセージでuserIdを送信
3. サーバーが接続確認を返信
4. クライアントが1秒ごとにリアクションデータを送信
5. サーバーが1秒ごとに集約処理を実行
6. 条件を満たした場合、エフェクト指示を全クライアントにブロードキャスト

---

## データベース

### スキーマ

#### `users` テーブル
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    experiment_group TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
```

#### `reactions_log` テーブル
```sql
CREATE TABLE reactions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    is_smiling BOOLEAN,
    is_surprised BOOLEAN,
    is_concentrating BOOLEAN,
    is_hand_up BOOLEAN,
    nod_count INTEGER,
    sway_vertical_count INTEGER,
    cheer_count INTEGER,
    clap_count INTEGER,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

#### `effects_log` テーブル
```sql
CREATE TABLE effects_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    effect_type TEXT NOT NULL,
    intensity REAL NOT NULL,
    duration_ms INTEGER NOT NULL
);
```

### データベース確認ツール

#### シェルスクリプト（簡易版）
```bash
./check_db.sh
```

#### Pythonスクリプト（詳細版）
```bash
python app/check_db.py
```

---

## 集約エンジン

### 集約ロジック

**時間窓**: 3秒間のスライディングウィンドウ

**計算指標**:
1. **ratio_state**: ステート型リアクションの割合
   ```
   ratio_state[リアクション名] = アクティブユーザー数 / 全アクティブユーザー数
   ```

2. **density_event**: イベント型リアクションの密度
   ```
   density_event[イベント名] = 総カウント / (アクティブユーザー数 × 時間窓[秒])
   ```

### エフェクト判定優先順位

1. **cheer** (isHandUp ≥ 0.3)
2. **excitement** (isSurprised ≥ 0.3)
3. **clapping_icons** (clap ≥ 0.15)
4. **bounce** (swayVertical ≥ 0.2)
5. **shimmer** (shakeHead ≥ 0.2)
6. **groove** (swayHorizontal ≥ 0.2)
7. **wave** (cheer ≥ 0.15)
8. **wave** (nod ≥ 0.3)
9. **sparkle** (isSmiling ≥ 0.35)
10. **focus** (isConcentrating ≥ 0.4)

---

## 開発ガイド

### ファイル構成

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py           # メインサーバー
│   ├── init_db.py        # データベース初期化
│   └── check_db.py       # データベース確認ツール
├── data/
│   └── live_reaction.db  # SQLiteデータベース
├── check_db.sh           # データベース確認スクリプト
├── requirements.txt      # 依存パッケージ
└── README.md
```

### 新しいエフェクトの追加

1. `main.py` の `aggregate()` メソッドにエフェクト判定を追加
2. 優先順位を決定してif-elif文に挿入
3. フロントエンドのエフェクトレンダラーを実装

### 閾値の調整

`main.py` の `aggregate()` メソッド内で閾値を変更:

```python
# 例: 笑顔の閾値を変更
elif ratio_state.get('isSmiling', 0) >= 0.35:  # この値を変更
    effect_type = 'sparkle'
```

---

## トラブルシューティング

### ポートが既に使用されている
```bash
# 別のポートで起動
uvicorn app.main:app --reload --port 8002
```

### データベースが見つからない
```bash
# データベースを再作成
python -c "from app.main import init_db; init_db()"
```

### WebSocket接続エラー
- CORS設定を確認
- フロントエンドのWebSocketエンドポイントURLを確認

---

## 依存パッケージ

- **FastAPI**: ウェブフレームワーク
- **Uvicorn**: ASGIサーバー
- **WebSockets**: WebSocket通信（FastAPIに含まれる）
- **SQLite3**: データベース（Python標準ライブラリ）

---

**最終更新**: 2025-01-17
