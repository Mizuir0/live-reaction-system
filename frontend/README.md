# Live Reaction System - Frontend

React + TypeScript + Vite を使用したフロントエンドアプリケーション

## 概要

カメラとマイクからリアクションを検出し、WebSocketでバックエンドに送信、受信したエフェクト指示に基づいて視覚効果を表示します。

## 主な機能

- **カメラ入力**: WebRTCによるカメラアクセス
- **顔・姿勢検出**: MediaPipe Face & Pose Landmarker
- **音声検出**: Web Audio API による音量解析
- **リアクション検出**: 10種類のリアクションを自動検出
- **エフェクト表示**: Canvas 2Dによる9種類の視覚エフェクト
- **WebSocket通信**: リアルタイムデータ送受信
- **デバッグUI**: 検出状態の可視化

---

## セットアップ

### 依存パッケージのインストール

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセス

### 本番ビルド

```bash
npm run build
```

生成された `dist/` フォルダを静的ホスティングサービスにデプロイ可能

---

## プロジェクト構成

```
frontend/
├── src/
│   ├── components/          # Reactコンポーネント
│   │   ├── ViewingScreen.tsx    # メイン画面
│   │   └── DebugOverlay.tsx     # デバッグオーバーレイ
│   ├── hooks/               # カスタムフック
│   │   ├── useCamera.ts         # カメラアクセス
│   │   ├── useMediaPipe.ts      # MediaPipe初期化
│   │   ├── useReactionDetection.ts  # 視覚リアクション検出
│   │   ├── useAudioDetection.ts     # 音声リアクション検出
│   │   ├── useEffectRenderer.ts     # エフェクト描画
│   │   └── useWebSockets.ts         # WebSocket通信
│   ├── types/               # TypeScript型定義
│   │   └── reactions.ts
│   ├── App.tsx              # ルートコンポーネント
│   └── main.tsx             # エントリーポイント
├── public/                  # 静的ファイル
├── package.json
└── README.md
```

---

## 技術スタック

### フレームワーク・ライブラリ
- **React 18**: UIフレームワーク
- **TypeScript**: 型安全な開発
- **Vite**: 高速ビルドツール

### メディア処理
- **MediaPipe Tasks Vision**: 顔・姿勢検出
  - Face Landmarker: 478点のランドマーク + 52種類のBlendShapes
  - Pose Landmarker: 33点のランドマーク
- **Web Audio API**: 音声解析
  - AnalyserNode
  - FFT (Fast Fourier Transform)

### 描画・通信
- **Canvas 2D API**: エフェクト描画（60fps）
- **WebSocket**: リアルタイム双方向通信
- **react-youtube**: YouTube埋め込み

---

## リアクション検出の仕組み

### 視覚リアクション（MediaPipe）

#### ステート型
- **笑顔**: BlendShapes の `mouthSmileLeft/Right` を使用
- **驚き**: BlendShapes の `eyeWideLeft/Right` + `jawOpen` を使用
- **集中**: BlendShapes の `browDownLeft/Right` + 頭部静止判定
- **手を上げる**: Pose の手首と肩の位置関係

#### イベント型
- **頷き**: Face Landmarks の鼻先端Y座標の変化
- **首を横に振る**: Face Landmarks の鼻先端X座標の変化
- **縦揺れ**: Pose Landmarks の肩Y座標の周期的変化
- **横揺れ**: Pose Landmarks の肩X座標の周期的変化

### 音声リアクション（Web Audio API）

- **歓声**: 音量が閾値を1秒間持続的に超える
- **手拍子**: 急激な音量変化（スパイク）を検出

---

## エフェクト一覧

| エフェクト | 説明 | 主な技術 |
|-----------|------|---------|
| **sparkle** | キラキラした星 | パーティクルシステム |
| **wave** | 波紋エフェクト | 同心円アニメーション |
| **excitement** | 爆発的なパーティクル | ランダム発射 |
| **bounce** | 弾むパーティクル | 物理シミュレーション |
| **cheer** | カラフルな応援 | 虹色グラデーション |
| **shimmer** | 左右の光の帯 | 流れる正弦波 |
| **focus** | 集中線 | 放射状グラデーション |
| **groove** | リズミカルな横波 | 正弦波 + パーティクル |
| **clapping_icons** | 拍手絵文字 | 絵文字アニメーション |

---

## カスタマイズ

### 検出閾値の調整

**視覚リアクション** (`src/hooks/useReactionDetection.ts`)
```typescript
// 笑顔検出の閾値
const SMILE_THRESHOLD = 0.5;  // 0.0-1.0

// 頷き検出の閾値
const DOWN_MOVEMENT_THRESHOLD = 0.008;

// 集中検出の閾値
const BROW_DOWN_THRESHOLD = 0.5;
const HEAD_MOVEMENT_THRESHOLD = 0.005;
```

**音声リアクション** (`src/hooks/useAudioDetection.ts`)
```typescript
// 歓声検出
const VOLUME_THRESHOLD = 0.3;           // 音量閾値
const SUSTAINED_DURATION_MS = 1000;     // 持続時間

// 手拍子検出
const VOLUME_SPIKE_THRESHOLD = 0.05;    // 音量変化閾値
const MIN_VOLUME = 0.3;                 // 最低音量
const COOLDOWN_MS = 200;                // クールダウン
```

### エフェクトのカスタマイズ

**新しいエフェクトを追加** (`src/hooks/useEffectRenderer.ts`)

1. レンダリング関数を作成
```typescript
const renderNewEffect = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  elapsed: number
) => {
  // エフェクトの描画ロジック
};
```

2. switch文に追加
```typescript
case 'new_effect':
  renderNewEffect(ctx, width, height, effect.intensity, elapsed);
  break;
```

### WebSocketエンドポイントの変更

**開発環境** (`src/hooks/useWebSockets.ts`)
```typescript
const WS_URL = 'ws://localhost:8001/ws';
```

**本番環境**
```typescript
const WS_URL = `wss://${window.location.hostname}/ws`;
```

---

## デバッグ機能

### デバッグパネル

画面右上の「🔍 デバッグ表示中」ボタンで表示/非表示

**表示内容**:
- 顔検出状態
- ランドマーク数
- ステート型リアクション（笑顔、驚き、集中、手を上げる）
- イベント型リアクション（頷き、首振り、縦揺れ、横揺れ）
- 音声型リアクション（音量、歓声、手拍子）
- 現在のエフェクト情報

### ランドマーク表示

デバッグパネル表示中に「○ ランドマーク非表示」ボタンをクリックすると、顔のランドマークを緑色の点で表示

### コンソールログ

ブラウザのコンソール（F12）で詳細なログを確認:
- リアクション検出ログ
- 音量変化ログ
- WebSocket送受信ログ
- エフェクト発動ログ

---

## パフォーマンス

### 処理頻度
- **MediaPipe検出**: 10fps（100ms間隔）
- **音声解析**: 60fps（requestAnimationFrame）
- **WebSocket送信**: 1秒ごと
- **エフェクト描画**: 60fps

### 最適化のヒント
- カメラ解像度を640x480に制限
- MediaPipeモデルをLiteバージョンに変更
- エフェクトのパーティクル数を削減

---

## トラブルシューティング

### カメラが起動しない
```
エラー: NotAllowedError
対処: ブラウザの設定でカメラを許可
```

### MediaPipeが読み込まれない
```
エラー: Failed to fetch
対処: インターネット接続を確認（CDNから読み込み）
```

### エフェクトが表示されない
- WebSocket接続を確認（ステータスバー）
- コンソールでエラーを確認
- バックエンドが起動しているか確認

### 音声検出が動作しない
- マイク権限を確認
- コンソールログで音量レベルを確認
- 他のアプリがマイクを使用していないか確認

---

## ライセンス

本プロジェクトは研究目的で作成されています。

---

**最終更新**: 2025-01-17
