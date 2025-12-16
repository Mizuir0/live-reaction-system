# Live Reaction System

リアルタイムで視聴者のリアクションを検出し、集約して視覚的エフェクトとして表示するライブ配信支援システム

## 📋 目次

- [概要](#概要)
- [システムアーキテクチャ](#システムアーキテクチャ)
- [実装済み機能](#実装済み機能)
- [技術スタック](#技術スタック)
- [セットアップ](#セットアップ)
- [使用方法](#使用方法)
- [データベース](#データベース)
- [API仕様](#api仕様)
- [開発ガイド](#開発ガイド)

---

## 概要

本システムは、ライブ配信における視聴者のリアクションを自動検出し、リアルタイムで視覚的エフェクトとして表示することで、視聴体験の向上を目指す研究プロジェクトです。

### 主な特徴

- **マルチモーダル検出**: 映像（MediaPipe）と音声（Web Audio API）の両方からリアクションを検出
- **リアルタイム処理**: WebSocketによる低遅延通信
- **集約エンジン**: 複数ユーザーのリアクションを3秒窓で集約し、適切なエフェクトを選択
- **データ記録**: SQLiteによるリアクションとエフェクトの記録

---

## システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Camera    │  │  Microphone  │  │   YouTube    │      │
│  │   Input     │  │    Input     │  │    Player    │      │
│  └──────┬──────┘  └──────┬───────┘  └──────────────┘      │
│         │                 │                                 │
│         ▼                 ▼                                 │
│  ┌─────────────┐  ┌──────────────┐                        │
│  │  MediaPipe  │  │ Web Audio API│                        │
│  │   (Face &   │  │   Analyser   │                        │
│  │    Pose)    │  │              │                        │
│  └──────┬──────┘  └──────┬───────┘                        │
│         │                 │                                 │
│         ▼                 ▼                                 │
│  ┌─────────────────────────────────┐                      │
│  │   Reaction Detection Logic      │                      │
│  │  - Visual: 顔表情、頭の動き、   │                      │
│  │           手の位置、体の揺れ    │                      │
│  │  - Audio: 歓声、手拍子          │                      │
│  └─────────────┬───────────────────┘                      │
│                │                                            │
│                │ WebSocket (1秒ごと送信)                   │
│                ▼                                            │
└────────────────┼────────────────────────────────────────────┘
                 │
                 │
┌────────────────┼────────────────────────────────────────────┐
│                ▼            Backend                         │
│  ┌───────────────────────────────────┐                     │
│  │    Aggregation Engine (1秒毎)    │                     │
│  │  - 3秒間の移動窓で集約            │                     │
│  │  - ratio_state 計算               │                     │
│  │  - density_event 計算             │                     │
│  └─────────────┬─────────────────────┘                     │
│                │                                            │
│                ▼                                            │
│  ┌───────────────────────────────────┐                     │
│  │      Effect Decision Logic        │                     │
│  │   優先順位に基づいてエフェクト選択  │                     │
│  └─────────────┬─────────────────────┘                     │
│                │                                            │
│                ├──────────────┐                             │
│                ▼              ▼                             │
│  ┌──────────────────┐  ┌────────────┐                     │
│  │  WebSocket       │  │  SQLite DB │                     │
│  │  Broadcast       │  │   Logger   │                     │
│  └─────────┬────────┘  └────────────┘                     │
└────────────┼───────────────────────────────────────────────┘
             │
             │ WebSocket (エフェクト指示)
             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (All Clients)                     │
│  ┌───────────────────────────────────┐                     │
│  │      Effect Renderer (Canvas)     │                     │
│  │   - Sparkle, Wave, Excitement,    │                     │
│  │   - Bounce, Cheer, Shimmer,       │                     │
│  │   - Focus, Groove, Clapping Icons │                     │
│  └───────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 実装済み機能

### 1. リアクション検出

#### ステート型リアクション（Bool値）

| リアクション | 検出方法 | 技術 | エフェクト |
|------------|---------|------|-----------|
| **😊 笑顔** | 口角の上昇 | MediaPipe BlendShapes | sparkle |
| **😲 驚き** | 目を見開く + 口を開く | MediaPipe BlendShapes | excitement |
| **🧐 集中** | 眉を寄せる + 頭部静止 | MediaPipe BlendShapes | focus |
| **🙌 手を上げる** | 手首が肩より上 | MediaPipe Pose | cheer |

#### イベント型リアクション（カウント）

| リアクション | 検出方法 | 技術 | エフェクト |
|------------|---------|------|-----------|
| **👍 頷き** | 頭部の縦方向移動 | MediaPipe Face | wave |
| **↔️ 首を横に振る** | 頭部の横方向移動 | MediaPipe Face | shimmer |
| **🎵 縦揺れ** | 肩の縦方向周期移動 | MediaPipe Pose | bounce |
| **🎶 横揺れ** | 肩の横方向周期移動 | MediaPipe Pose | groove |
| **🎉 歓声** | 音量が1秒間持続 | Web Audio API | wave |
| **👏 手拍子** | 急激な音量変化 | Web Audio API | clapping_icons |

### 2. 視覚エフェクト

| エフェクト | 説明 | トリガー条件 | 優先度 |
|-----------|------|------------|--------|
| **cheer** | カラフルな応援エフェクト | 手を上げている (≥30%) | 1 |
| **excitement** | 爆発的なパーティクル | 驚き表情 (≥30%) | 2 |
| **clapping_icons** | 拍手絵文字が上昇 | 手拍子音声 (≥0.15/秒) | 3 |
| **bounce** | 弾むようなパーティクル | 縦揺れ (≥0.2/秒) | 4 |
| **shimmer** | 左右に流れる光の帯 | 首を横に振る (≥0.2/秒) | 5 |
| **groove** | リズミカルな横波 | 横揺れ (≥0.2/秒) | 6 |
| **wave** | 波紋エフェクト | 歓声 or 頷き | 7-8 |
| **sparkle** | キラキラした星 | 笑顔 (≥35%) | 9 |
| **focus** | 集中線 | 集中表情 (≥40%) | 10 |

### 3. データベース記録

#### テーブル構成

**users**
- `id` (TEXT, PRIMARY KEY): ユーザーID
- `experiment_group` (TEXT): 実験群/対照群
- `created_at` (INTEGER): 登録日時

**reactions_log**
- `id` (INTEGER, PRIMARY KEY)
- `user_id` (TEXT): ユーザーID
- `timestamp` (INTEGER): タイムスタンプ
- ステート型: `is_smiling`, `is_surprised`, `is_concentrating`, `is_hand_up`
- イベント型: `nod_count`, `sway_vertical_count`, `cheer_count`, `clap_count`

**effects_log**
- `id` (INTEGER, PRIMARY KEY)
- `timestamp` (INTEGER): タイムスタンプ
- `effect_type` (TEXT): エフェクト種別
- `intensity` (REAL): 強度 (0.0-1.0)
- `duration_ms` (INTEGER): 持続時間

---

## 技術スタック

### Frontend
- **React 18** + **TypeScript**
- **Vite** (ビルドツール)
- **MediaPipe** (顔・姿勢検出)
  - Face Landmarker: 478点の顔ランドマーク + BlendShapes
  - Pose Landmarker: 33点の姿勢ランドマーク
- **Web Audio API** (音声解析)
  - AnalyserNode + FFT解析
- **Canvas 2D API** (エフェクト描画)
- **WebSocket** (リアルタイム通信)

### Backend
- **FastAPI** (Pythonウェブフレームワーク)
- **WebSocket** (双方向通信)
- **SQLite** (データベース)
- **Uvicorn** (ASGIサーバー)

---

## セットアップ

### 前提条件
- Node.js 18以上
- Python 3.8以上
- カメラとマイクが使用可能なデバイス

### 1. バックエンドのセットアップ

```bash
cd backend

# 仮想環境の作成と有効化
python -m venv venv
source venv/bin/activate  # Windowsの場合: venv\Scripts\activate

# 依存パッケージのインストール
pip install -r requirements.txt

# データベース初期化
python -c "from app.main import init_db; init_db()"

# サーバー起動
uvicorn app.main:app --reload --port 8001
```

サーバーが起動すると:
- HTTP: http://localhost:8001
- WebSocket: ws://localhost:8001/ws
- Status: http://localhost:8001/status
- Debug: http://localhost:8001/debug/database

### 2. フロントエンドのセットアップ

```bash
cd frontend

# 依存パッケージのインストール
npm install

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 にアクセス

### 3. 本番ビルド

```bash
cd frontend
npm run build
# distフォルダに静的ファイルが生成されます
```

---

## 使用方法

### 基本的な使い方

1. **バックエンドとフロントエンドを起動**
2. **ブラウザでアクセス**: http://localhost:3000
3. **カメラとマイクの許可**: ブラウザのポップアップで許可
4. **YouTube動画ID入力** (任意)
5. **リアクション開始**: カメラに顔を映してリアクション

### デバッグモード

画面右上の「🔍 デバッグ表示中」ボタンでデバッグパネルを表示:
- 顔検出状態
- ランドマーク数
- 各リアクションの検出状態
- イベントカウント
- 現在のエフェクト情報
- 音量レベル

### マルチユーザーテスト

複数のブラウザタブまたはデバイスで同時にアクセスすると、リアクションが集約されてエフェクトが発動します。

---

## データベース

### データベースの確認

```bash
cd backend

# シェルスクリプトで確認（簡易版）
./check_db.sh

# Pythonスクリプトで詳細確認
python app/check_db.py
```

### データベースの場所

```
backend/data/live_reaction.db
```

### データのエクスポート

```bash
# SQLiteコマンドラインツールを使用
cd backend/data
sqlite3 live_reaction.db

# CSV出力
.mode csv
.output reactions_export.csv
SELECT * FROM reactions_log;
.output effects_export.csv
SELECT * FROM effects_log;
.quit
```

---

## API仕様

### WebSocket通信

#### クライアント → サーバー

**接続時（初回メッセージ）**
```json
{
  "userId": "user-12345678-1234-1234-1234-123456789abc"
}
```

**リアクションデータ送信（1秒ごと）**
```json
{
  "userId": "user-12345678-1234-1234-1234-123456789abc",
  "timestamp": 1234567890123,
  "states": {
    "isSmiling": true,
    "isSurprised": false,
    "isConcentrating": false,
    "isHandUp": false
  },
  "events": {
    "nod": 2,
    "shakeHead": 0,
    "swayVertical": 1,
    "swayHorizontal": 0,
    "cheer": 1,
    "clap": 3
  }
}
```

#### サーバー → クライアント

**接続確認**
```json
{
  "type": "connection_established",
  "userId": "user-12345678-1234-1234-1234-123456789abc",
  "message": "WebSocket接続が確立されました",
  "timestamp": "2025-01-17T12:34:56.789Z"
}
```

**エフェクト指示（1秒ごと、条件を満たした場合）**
```json
{
  "type": "effect",
  "effectType": "sparkle",
  "intensity": 0.75,
  "durationMs": 2000,
  "timestamp": 1234567890123,
  "debug": {
    "activeUsers": 5,
    "ratioState": {
      "isSmiling": 0.6,
      "isHandUp": 0.2
    },
    "densityEvent": {
      "nod": 0.4,
      "clap": 0.8
    }
  }
}
```

### HTTP API

#### GET /
ヘルスチェック

**レスポンス**
```json
{
  "status": "running",
  "service": "Live Reaction System",
  "active_connections": 3,
  "database": "/path/to/live_reaction.db",
  "timestamp": "2025-01-17T12:34:56.789Z"
}
```

#### GET /status
システムステータス

**レスポンス**
```json
{
  "active_connections": 3,
  "connected_users": ["user-123", "user-456", "user-789"],
  "aggregation_data": {
    "total_users": 3,
    "user_ids": ["user-123", "user-456", "user-789"]
  },
  "timestamp": "2025-01-17T12:34:56.789Z"
}
```

#### GET /debug/aggregation
集約データのデバッグ情報

#### GET /debug/database
データベース統計情報

---

## 開発ガイド

### ディレクトリ構成

```
live-reaction-system/
├── frontend/
│   ├── src/
│   │   ├── components/      # Reactコンポーネント
│   │   │   ├── ViewingScreen.tsx
│   │   │   └── DebugOverlay.tsx
│   │   ├── hooks/           # カスタムフック
│   │   │   ├── useCamera.ts
│   │   │   ├── useMediaPipe.ts
│   │   │   ├── useReactionDetection.ts
│   │   │   ├── useAudioDetection.ts
│   │   │   ├── useEffectRenderer.ts
│   │   │   └── useWebSockets.ts
│   │   ├── types/           # 型定義
│   │   │   └── reactions.ts
│   │   └── App.tsx
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py          # メインサーバー
│   │   ├── init_db.py       # DB初期化
│   │   └── check_db.py      # DB確認ツール
│   ├── data/                # SQLiteデータベース
│   │   └── live_reaction.db
│   ├── check_db.sh          # DB確認シェルスクリプト
│   └── requirements.txt
│
└── README.md
```

### 検出ロジックのカスタマイズ

#### 閾値の調整

**リアクション検出** (`frontend/src/hooks/useReactionDetection.ts`)
```typescript
// 笑顔検出の閾値
const SMILE_THRESHOLD = 0.5;  // 0.0-1.0

// 頷き検出の閾値
const DOWN_MOVEMENT_THRESHOLD = 0.008;

// 集中検出の閾値
const BROW_DOWN_THRESHOLD = 0.5;
const HEAD_MOVEMENT_THRESHOLD = 0.005;
```

**音声検出** (`frontend/src/hooks/useAudioDetection.ts`)
```typescript
// 歓声検出
const VOLUME_THRESHOLD = 0.3;           // 音量閾値
const SUSTAINED_DURATION_MS = 1000;     // 1秒間持続

// 手拍子検出
const VOLUME_SPIKE_THRESHOLD = 0.05;    // 音量変化閾値
const MIN_VOLUME = 0.3;                 // 最低音量
```

**エフェクト発動条件** (`backend/app/main.py`)
```python
# 笑顔 → sparkle
if ratio_state.get('isSmiling', 0) >= 0.35:
    effect_type = 'sparkle'

# 手拍子 → clapping_icons
elif density_event.get('clap', 0) >= 0.15:
    effect_type = 'clapping_icons'
```

#### 新しいリアクションの追加

1. **型定義を更新** (`frontend/src/types/reactions.ts`)
2. **検出ロジックを実装** (`frontend/src/hooks/useReactionDetection.ts`)
3. **エフェクトを実装** (`frontend/src/hooks/useEffectRenderer.ts`)
4. **バックエンドに判定を追加** (`backend/app/main.py`)
5. **デバッグ表示を追加** (`frontend/src/components/DebugOverlay.tsx`)

### パフォーマンス最適化

- **検出頻度**: 現在10fps（100ms間隔）で検出
- **送信頻度**: 1秒ごとにWebSocket送信
- **集約窓**: 3秒間の移動窓
- **エフェクト持続**: 2秒間

---

## トラブルシューティング

### カメラが起動しない
- ブラウザの設定でカメラを許可しているか確認
- HTTPSまたはlocalhostでアクセスしているか確認

### マイクが動作しない
- ブラウザの設定でマイクを許可しているか確認
- 他のアプリケーションがマイクを使用していないか確認

### リアクションが検出されない
- デバッグパネルで検出状態を確認
- コンソールログで閾値と実際の値を確認
- 照明条件を改善（顔検出の精度向上）

### エフェクトが表示されない
- WebSocket接続が確立されているか確認（ステータスバー）
- 複数ユーザーで十分なリアクションが発生しているか確認
- コンソールログでエフェクト判定を確認

---

## ライセンス

本プロジェクトは研究目的で作成されています。

## 作成者

卒業研究プロジェクト - 2025年

---

**最終更新**: 2025-01-17
