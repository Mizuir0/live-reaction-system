# Live Reaction System - Backend

FastAPI + WebSocket を使用したバックエンドサーバー

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

## 実行方法

```bash
python main.py
```

サーバーが起動すると、以下のエンドポイントが利用可能になります：

- **HTTP**: http://localhost:8000
- **WebSocket**: ws://localhost:8000/ws
- **Status**: http://localhost:8000/status

## API エンドポイント

### GET /
ヘルスチェック

### GET /status
システムステータスと接続中のクライアント情報を取得

### WebSocket /ws
クライアントとの双方向通信

## 開発メモ

### Step3（現在）
- WebSocket接続の確立
- クライアントからのリアクションデータ受信
- Echoレスポンス送信

### Step4（次回）
- データ集約ロジック
- エフェクト判定
- ブロードキャスト

### Step5以降
- データベース連携
- ログ保存