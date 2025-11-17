# 実装ログ

## Step 5: エフェクト描画機能の実装（完了）

実装日: 2025-11-17

### 概要

サーバーから受信したエフェクト指示に基づいて、Canvas上にリアルタイムでビジュアルエフェクトを描画する機能を実装しました。これにより、観客のリアクション（笑顔・頷きなど）が視覚的なエフェクトとして画面に反映されるようになりました。

### 実装内容

#### 1. 型定義の追加 (`frontend/src/types/reactions.ts`)

エフェクト指示データの型を定義しました。

```typescript
export interface EffectInstruction {
  type: 'effect';
  effectType: 'sparkle' | 'wave' | 'clapping_icons';
  intensity: number;        // 0.0 ~ 1.0
  durationMs: number;       // 表示時間（ミリ秒）
  timestamp: number;
  debug?: {
    activeUsers: number;
    ratioState: Record<string, number>;
    densityEvent: Record<string, number>;
  };
}
```

#### 2. WebSocketフックの拡張 (`frontend/src/hooks/useWebSockets.ts`)

- `currentEffect` ステートを追加し、サーバーからのエフェクト指示を保持
- メッセージ受信時に `type === 'effect'` のメッセージを検出し、`currentEffect` を更新
- エフェクト受信時にコンソールログを出力

**主要な変更点:**
- `UseWebSocketReturn` に `currentEffect: EffectInstruction | null` を追加
- `ws.onmessage` でエフェクト指示を処理

#### 3. エフェクトレンダラーの実装 (`frontend/src/hooks/useEffectRenderer.ts`)

Canvas描画を管理する新しいカスタムフックを作成しました。

**機能:**
- `requestAnimationFrame` を使用した60FPSのアニメーションループ
- エフェクトの持続時間管理（`durationMs` 経過後に自動終了）
- 2種類のエフェクトを実装

**実装済みエフェクト:**

##### (a) Sparkle エフェクト（笑顔検出時）

- **視覚表現:** 画面周囲にキラキラとした金色の粒子が散る
- **intensity の影響:**
  - 粒子数: 10 ~ 50個（intensity 0.0 ~ 1.0）
  - 粒子の移動速度が intensity に比例
- **アニメーション:**
  - 粒子は画面の辺からランダムに生成
  - ランダムな方向に移動しながらフェードアウト
  - 各粒子の寿命: 60~120フレーム
- **描画スタイル:**
  - 色: ゴールド（#FFD700）
  - シャドウブラー効果で輝きを演出

##### (b) Wave エフェクト（縦揺れ検出時）

- **視覚表現:** 画面上下に波打つ青いリボン状の帯
- **intensity の影響:**
  - 波の高さ: 30 ~ 80ピクセル
  - 波の速度が intensity に応じて変化
  - 透明度が intensity に応じて増加
- **アニメーション:**
  - sin波を使用した滑らかな波形
  - 位相（phase）が連続的に更新され、波が流れるように見える
  - intensity > 0.5 の場合、波上に光の粒子を追加
- **描画スタイル:**
  - 色: コーンフラワーブルー（rgba(100, 149, 237, ...)）
  - 半透明（alpha: 0.6）

**技術的な特徴:**
- パーティクルシステム（粒子管理）
- フレームごとの粒子生成・更新・削除
- Canvas のクリア → 描画を毎フレーム実行
- メモリ効率を考慮した配列フィルタリング

#### 4. ViewingScreen への統合 (`frontend/src/components/ViewingScreen.tsx`)

- `useEffectRenderer` フックをインポート・呼び出し
- `useWebSocket` から `currentEffect` を取得
- Canvas要素の参照（`canvasRef`）とエフェクト指示を `useEffectRenderer` に渡す
- デバッグ情報セクションを更新し、現在のエフェクト状態を表示

**変更点:**
```typescript
const { currentEffect } = useWebSocket(userId);
useEffectRenderer({ canvasRef, currentEffect });
```

### データフロー

```
1. クライアント: リアクション検出（笑顔、頷きなど）
   ↓
2. WebSocket送信: リアクションデータをサーバーに送信（1秒ごと）
   ↓
3. サーバー: 全クライアントのデータを集約（3秒窓）
   ↓
4. サーバー: エフェクト判定（ratio_state, density_event から判定）
   ↓
5. WebSocket配信: エフェクト指示を全クライアントにブロードキャスト
   ↓
6. クライアント: useWebSocket でエフェクト指示を受信
   ↓
7. クライアント: useEffectRenderer が Canvas に描画（60FPS）
   ↓
8. クライアント: durationMs 経過後にエフェクト終了
```

### 動作確認

#### ビルド確認
- TypeScript コンパイル: ✅ エラーなし
- Vite ビルド: ✅ 成功
- バンドルサイズ: 367.86 kB (gzip: 113.91 kB)

#### 期待される動作

1. **Sparkle エフェクト（笑顔）**
   - 条件: 全体の35%以上が笑顔（`ratio_state["isSmiling"] >= 0.35`）
   - 表示: 画面周囲に金色のキラキラが散る
   - 持続時間: 2秒

2. **Wave エフェクト（縦揺れ）**
   - 条件: 縦揺れ密度が0.25以上（`density_event["swayVertical"] >= 0.25`）
   - 表示: 画面上下に青い波が流れる
   - 持続時間: 2秒

### ファイル構成

```
frontend/src/
├── types/
│   └── reactions.ts                    # EffectInstruction 型追加
├── hooks/
│   ├── useWebSockets.ts                # currentEffect ステート追加
│   └── useEffectRenderer.ts            # 新規作成: エフェクト描画ロジック
└── components/
    └── ViewingScreen.tsx               # useEffectRenderer 統合
```

### 次のステップ（Step 6）

- リアクション検出の種類を拡張（2〜3種類追加）
  - isSurprised（驚き）
  - isConcentrating（集中）
  - shakeHead（頭の横揺れ）など
- 対応するエフェクトを追加
  - clapping_icons（手拍子アイコン）など
- エフェクトの重複表示に対応（複数条件を同時に満たす場合）

### 技術的な課題と解決策

**課題1: Canvas のクリアタイミング**
- 解決策: 毎フレーム `clearRect` でクリアしてから描画

**課題2: エフェクトの自然な終了**
- 解決策: `durationMs` と `performance.now()` で経過時間を監視し、終了時に `currentEffectRef.current = null` で停止

**課題3: パーティクルのメモリ管理**
- 解決策: 配列の `filter` メソッドで寿命が尽きた粒子を自動削除

**課題4: TypeScript 型エラー**
- 解決策: `RefObject<HTMLCanvasElement | null>` 型を明示的に指定

### まとめ

Step 5 の実装により、システムは以下の機能を持つようになりました：

✅ クライアント側のリアクション検出（笑顔、頷き）
✅ WebSocketによるリアルタイム通信
✅ サーバー側のデータ集約とエフェクト判定
✅ Canvas を使用したビジュアルエフェクトの描画
✅ エフェクトの自動開始・終了管理

これにより、**ロードマップの約70%が完了**し、基本的なMVP機能が動作可能な状態になりました。

---

## Step 6: リアクション・エフェクトの拡張（完了）

実装日: 2025-11-17

### 概要

リアクション検出の種類を拡張し、対応するビジュアルエフェクトを追加しました。これにより、より多様な観客のリアクションを検出・可視化できるようになりました。

### 実装内容

#### 1. 型定義の更新 (`frontend/src/types/reactions.ts`)

新しいエフェクトタイプを追加しました。

```typescript
effectType: 'sparkle' | 'wave' | 'clapping_icons' | 'excitement' | 'bounce';
```

#### 2. リアクション検出ロジックの拡張 (`frontend/src/hooks/useReactionDetection.ts`)

**追加されたリアクション:**

##### (a) isSurprised（驚き）- ステート型

- **検出方法:** MediaPipe BlendShapes を使用
- **判定条件:**
  - `eyeWideLeft > 0.5` かつ `eyeWideRight > 0.5`（目を見開いている）
  - かつ `jawOpen > 0.3`（口が開いている）
- **実装箇所:** frontend/src/hooks/useReactionDetection.ts:79-94

##### (b) swayVertical（体の縦揺れ）- イベント型

- **検出方法:** 顔の位置を使った簡易版（長周期の上下動）
- **判定条件:**
  - 顔のY座標の移動平均を計算（15フレーム履歴）
  - 下向き移動閾値: 0.015（頷きの約2倍）
  - カウント間隔: 0.5秒以上
  - タイムアウト: 3秒
- **頷き（nod）との違い:**
  - より大きな動き（閾値2倍）
  - より長い周期（0.5秒〜2秒）
  - より長い履歴（15フレーム vs 8フレーム）
- **実装箇所:** frontend/src/hooks/useReactionDetection.ts:183-237

#### 3. 新しいエフェクトの実装 (`frontend/src/hooks/useEffectRenderer.ts`)

##### (a) Excitement エフェクト（驚き検出時）

- **視覚表現:** 画面中央から放射状に広がる光線
- **intensity の影響:**
  - 光線の本数: 8〜20本
  - 光線の長さ: 100〜300ピクセル
  - 線の太さ: 3〜8ピクセル
  - 透明度: 0.3〜0.7
- **アニメーション:**
  - 光線が回転しながら放射
  - 中心に輝く円（サイズが intensity に応じて変化）
  - グラデーション: ゴールド → オレンジ
- **実装箇所:** frontend/src/hooks/useEffectRenderer.ts:172-224

##### (b) Bounce エフェクト（縦揺れ検出時）

- **視覚表現:** 画面下部で跳ねるピンク色のボール
- **intensity の影響:**
  - ボールの数: 5〜15個
  - 跳ねる高さ: 50〜150ピクセル
  - ボールのサイズ: 10〜25ピクセル
- **アニメーション:**
  - sin波を使用した跳ねるモーション
  - 各ボールの位置をずらして波のような動き
  - 地面に影を描画（ボールの高さに応じて変化）
- **描画スタイル:**
  - 色: ピンク（rgba(255, 100, 180, ...)）
  - グラデーション効果で立体感を演出
- **実装箇所:** frontend/src/hooks/useEffectRenderer.ts:229-271

#### 4. バックエンドのエフェクト判定更新 (`backend/app/main.py`)

**エフェクト判定の優先順位:**

1. **Excitement（驚き）** - 最優先
   - 条件: `ratio_state["isSurprised"] >= 0.3`
   - intensity: `ratio_state["isSurprised"]`

2. **Bounce（縦揺れ）**
   - 条件: `density_event["swayVertical"] >= 0.2`
   - intensity: `density_event["swayVertical"]`

3. **Wave（頷き）**
   - 条件: `density_event["nod"] >= 0.3`
   - intensity: `density_event["nod"] / 0.5`（正規化）

4. **Sparkle（笑顔）** - 最低優先
   - 条件: `ratio_state["isSmiling"] >= 0.35`
   - intensity: `ratio_state["isSmiling"]`

**実装箇所:** backend/app/main.py:127-151

### リアクション・エフェクト対応表

| リアクション | 型 | 検出方法 | エフェクト | 発動条件 |
|------------|-----|---------|-----------|---------|
| 笑顔 (isSmiling) | State | BlendShapes | Sparkle | 35%以上 |
| 驚き (isSurprised) | State | BlendShapes | Excitement | 30%以上 |
| 頷き (nod) | Event | 顔Y座標 | Wave | 密度0.3以上 |
| 縦揺れ (swayVertical) | Event | 顔Y座標 | Bounce | 密度0.2以上 |

### データフロー（更新版）

```
クライアント
  ↓ リアクション検出（10fps）
    - isSmiling, isSurprised（BlendShapes）
    - nod, swayVertical（顔の位置）
  ↓ WebSocket送信（1秒ごと）
サーバー
  ↓ 3秒窓で集約
  ↓ ratio_state / density_event 計算
  ↓ 優先順位付きエフェクト判定
  ↓ エフェクト指示をブロードキャスト
クライアント
  ↓ Canvas描画（60FPS）
    - sparkle, excitement, wave, bounce
```

### ビルド確認

✅ TypeScript コンパイル: エラーなし
✅ Vite ビルド成功: 370.20 kB (gzip: 114.54 kB)
✅ バンドルサイズ: Step 5から約2KB増加（新エフェクト追加分）

### 技術的な工夫

**1. 頷きと縦揺れの区別**
- 閾値の差別化: 縦揺れは頷きの2倍の動き
- 周期の差別化: 縦揺れは0.5秒以上、頷きは0.3秒以上
- 履歴の長さ: 縦揺れは15フレーム、頷きは8フレーム

**2. Excitementエフェクトの回転**
- `performance.now() * 0.001` で時間ベースの回転
- 各フレームで角度が連続的に変化

**3. Bounceエフェクトの自然な跳ね**
- sin波で滑らかな上下動
- ボールごとに位相をずらして波のような動き
- 影のサイズを高さに応じて動的に変更

### まとめ

Step 6 の実装により、システムの機能が大幅に拡張されました：

✅ リアクション検出: 2種類 → 4種類
✅ エフェクト: 2種類 → 4種類
✅ より多様な観客の反応を可視化
✅ 優先順位付きエフェクト判定で自然な表現

**ロードマップ進捗: 約85%完了**

残りのステップ:
- Step 7: DBログ保存機能（評価実験用）

---

## 追加実装: MediaPipe Pose統合とデバッグ機能強化（完了）

実装日: 2025-11-17

### 概要

MediaPipe Poseを統合し、より正確な体の動き検出を実現しました。また、デバッグオーバーレイを大幅に改善し、現在のエフェクト情報をリアルタイムで確認できるようになりました。

### 実装内容

#### 1. MediaPipe Poseの統合 (`frontend/src/hooks/useMediaPipe.ts`)

**変更点:**
- Face Landmarker に加えて Pose Landmarker を追加
- 新しい型 `MediaPipeResult` を定義（FaceとPoseの両方の結果を保持）
- `detectAll()` 関数を実装（顔とポーズを同時に検出）

**技術的な詳細:**
```typescript
export interface MediaPipeResult {
  face: FaceLandmarkerResult | null;
  pose: PoseLandmarkerResult | null;
}
```

**使用モデル:**
- Face: `face_landmarker.task` (float16)
- Pose: `pose_landmarker_lite.task` (float16)

**パフォーマンス:**
- 両方のモデルを同時実行（10fps）
- GPU デリゲートを使用して高速化

#### 2. swayVertical（縦揺れ）検出の改善 (`frontend/src/hooks/useReactionDetection.ts:183-242`)

**変更前:**
- 顔の位置（鼻の先端のY座標）を使用
- 精度に限界があり、頭の動きと区別が難しい

**変更後:**
- **両肩の中心点（Pose landmarks 11, 12）を使用**
- 肩のY座標平均値で体全体の上下動を検出
- より正確な「縦揺れ」の検出が可能

**検出ロジック:**
```typescript
// 両肩の中心点のY座標を計算
const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;

// 移動平均で平滑化（15フレーム履歴）
// 閾値: 0.01（頷きより少し小さい）
// カウント間隔: 0.5秒以上
```

#### 3. isHandUp（手を上げている）検出の追加 (`frontend/src/hooks/useReactionDetection.ts:247-267`)

**検出方法:**
- Pose landmarks の手首（15, 16）と肩（11, 12）を使用
- 少なくとも片手が肩より10%以上上にあるかチェック
- `visibility` スコアで信頼度を確認（>0.5）

**判定条件:**
```typescript
const leftHandUp = leftWrist.y < leftShoulder.y - 0.1;
const rightHandUp = rightWrist.y < rightShoulder.y - 0.1;
const leftVisible = leftWrist.visibility > 0.5;
const rightVisible = rightWrist.visibility > 0.5;

return (leftHandUp && leftVisible) || (rightHandUp && rightVisible);
```

**特徴:**
- 片手でも両手でも検出可能
- カメラに映っていない手は除外（visibility チェック）
- 誤検出を防ぐための閾値調整

#### 4. Cheerエフェクトの実装 (`frontend/src/hooks/useEffectRenderer.ts:276-341`)

**視覚表現:**
- 黄色い手のアイコンが画面下部（70%位置）で上下に動く
- 手の形を簡易的に表現（中心の円 + 5本の指）
- intensity に応じてキラキラ効果を追加

**アニメーション:**
- sin波を使用した滑らかな上下動
- 手の数: 3〜10個（intensity に比例）
- intensity > 0.7 の場合、応援メッセージ（絵文字）を表示

**描画スタイル:**
- 色: ゴールド（rgba(255, 223, 0, ...)）
- シャドウブラー効果で存在感を演出
- メッセージ: 🎉, ✨, 👏, 🙌（ランダムに切り替え）

#### 5. DebugOverlayの大幅改善 (`frontend/src/components/DebugOverlay.tsx`)

**追加された機能:**

##### (a) 現在のエフェクト表示
- エフェクトが発動中の場合、緑色のハイライト付きセクションで表示
- エフェクト名と強度（%）をリアルタイム表示
- 視認性を高めるため背景色を変更

##### (b) リアクション表示の拡充
**ステート型:**
- 😊 笑顔（isSmiling）
- 😲 驚き（isSurprised）- 新規追加
- 🙌 手を上げる（isHandUp）- 新規追加

**イベント型:**
- 👍 頷き（nod）
- 🎵 縦揺れ（swayVertical）- 新規追加

**表示の改善:**
- 絵文字でリアクションを視覚的に表現
- アクティブなリアクションは緑色で強調
- カウント数をリアルタイム表示

##### (c) MediaPipeResult対応
- `detectionResult` の型を `FaceLandmarkerResult` から `MediaPipeResult` に変更
- Face と Pose の両方のデータを扱えるように更新

#### 6. ViewingScreenの更新 (`frontend/src/components/ViewingScreen.tsx`)

**変更点:**
- `detectFace()` から `detectAll()` に変更
- `useMediaPipe` から `detectAll` と `lastResult` を取得
- `DebugOverlay` に `currentEffect` を渡すように更新

**リアクション検出ループ:**
```typescript
const result = detectAll(videoRef.current);
updateReactions(result);
```

#### 7. バックエンドのエフェクト判定更新 (`backend/app/main.py:127-157`)

**新しい優先順位:**
1. **Cheer**（手を上げる）- `ratio_state["isHandUp"] >= 0.3`
2. **Excitement**（驚き）- `ratio_state["isSurprised"] >= 0.3`
3. **Bounce**（縦揺れ）- `density_event["swayVertical"] >= 0.2`
4. **Wave**（頷き）- `density_event["nod"] >= 0.3`
5. **Sparkle**（笑顔）- `ratio_state["isSmiling"] >= 0.35`

**ロジックの特徴:**
- 優先順位付きで排他的に1つのエフェクトを発動
- 盛り上がり度の高いリアクションを優先
- 閾値は実験的に調整可能

### リアクション・エフェクト対応表（最終版）

| リアクション | 型 | 検出方法 | エフェクト | 発動条件 | 視覚表現 |
|------------|-----|---------|-----------|---------|---------|
| 手を上げる (isHandUp) | State | Pose landmarks | Cheer | 30%以上 | 黄色い手+絵文字 |
| 驚き (isSurprised) | State | BlendShapes | Excitement | 30%以上 | 放射状の光線 |
| 縦揺れ (swayVertical) | Event | Pose (肩中心) | Bounce | 密度0.2以上 | 跳ねるボール |
| 頷き (nod) | Event | Face (顔Y座標) | Wave | 密度0.3以上 | 青い波 |
| 笑顔 (isSmiling) | State | BlendShapes | Sparkle | 35%以上 | 金色のキラキラ |

### データフロー（最終版）

```
クライアント
  ↓ MediaPipe検出（10fps）
    - Face Landmarker: 表情（笑顔、驚き）、顔の位置（頷き）
    - Pose Landmarker: 体の動き（縦揺れ）、手の位置（手を上げる）
  ↓ リアクション判定
    - ステート型: isSmiling, isSurprised, isHandUp
    - イベント型: nod, swayVertical
  ↓ WebSocket送信（1秒ごと）
    - states, events を JSON で送信
サーバー
  ↓ 3秒窓で集約
  ↓ ratio_state / density_event 計算
  ↓ 優先順位付きエフェクト判定
  ↓ エフェクト指示をブロードキャスト
クライアント
  ↓ エフェクト受信・表示
    - Canvas描画（60FPS）
    - sparkle, excitement, wave, bounce, cheer
  ↓ デバッグオーバーレイに表示
    - 現在のエフェクト名・強度
    - リアクション検出状態
```

### ビルド確認

✅ TypeScript コンパイル: エラーなし  
✅ Vite ビルド成功: 373.18 kB (gzip: 115.16 kB)  
✅ バンドルサイズ: Step 6から約3KB増加（MediaPipe Pose追加分）

### 技術的な課題と解決策

**課題1: MediaPipe Poseの初期化遅延**
- 解決策: Face と Pose を並行して初期化し、`isReady` フラグで両方の準備完了を確認

**課題2: Pose landmarks が取得できない場合の処理**
- 解決策: `result.pose.landmarks.length > 0` で存在チェック、Poseが不要なリアクションは Face のみで動作

**課題3: 手首のvisibilityが低い時の誤検出**
- 解決策: `visibility > 0.5` の閾値でフィルタリング、信頼度の低い検出を除外

**課題4: デバッグオーバーレイの型エラー**
- 解決策: `MediaPipeResult` 型を定義し、`detectionResult.face` と `detectionResult.pose` で明示的にアクセス

**課題5: swayVertical と nod の区別**
- 解決策:
  - swayVertical: 肩の中心点（体全体の動き）、閾値0.01、0.5秒間隔
  - nod: 鼻の先端（頭の動き）、閾値0.008、0.3秒間隔

### パフォーマンス最適化

1. **同じフレームの重複処理を防止**
   - `lastVideoTimeRef` で前回の `video.currentTime` を記録
   - 同じフレームは `lastResult` をそのまま返却

2. **検出頻度の調整**
   - MediaPipe検出: 10fps（0.1秒ごと）
   - WebSocket送信: 1fps（1秒ごと）
   - Canvas描画: 60fps（requestAnimationFrame）

3. **GPU デリゲートの活用**
   - Face と Pose の両方で GPU を使用
   - CPU使用率を抑えつつ高速な検出を実現

### デバッグ機能の強化

**実装前:**
- 笑顔と頷きのみ表示
- エフェクト情報なし

**実装後:**
- 全5種類のリアクションを表示
- 現在のエフェクト名と強度をハイライト表示
- 絵文字で視覚的に分かりやすく
- アクティブなリアクションを色分け

### まとめ

この追加実装により、システムは以下の機能を獲得しました：

✅ MediaPipe Poseによる正確な体の動き検出  
✅ 5種類の多様なリアクション検出（表情+体の動き）  
✅ 5種類のビジュアルエフェクト  
✅ リアルタイムのデバッグ情報表示  
✅ 優先順位付きエフェクト判定

**最終的なシステム機能:**
- リアクション: 5種類（笑顔、驚き、手を上げる、頷き、縦揺れ）
- エフェクト: 5種類（sparkle, excitement, cheer, wave, bounce）
- 検出精度: MediaPipe Face + Pose の組み合わせによる高精度検出
- デバッグ: 充実したリアルタイム表示機能

**ロードマップ進捗: 約90%完了**

残りのステップ:
- Step 7: DBログ保存機能（評価実験用）
