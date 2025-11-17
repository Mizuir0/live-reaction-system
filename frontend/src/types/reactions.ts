/**
 * リアクション検出の型定義
 */

// ステート型リアクション（bool値）
export interface ReactionStates {
  isSmiling: boolean;
  isSurprised: boolean;
  isConcentrating: boolean;
  isHandUp: boolean;
}

// イベント型リアクション（カウント）
export interface ReactionEvents {
  nod: number;
  shakeHead: number;
  swayVertical: number;
  swayHorizontal: number;
  cheer: number;
  clap: number;
}

// 完全なリアクションデータ
export interface ReactionData {
  userId: string;
  timestamp: number;
  states: ReactionStates;
  events: ReactionEvents;
}

// デバッグ用の検出情報
export interface DetectionDebugInfo {
  faceDetected: boolean;
  landmarkCount: number;
  smileLeftValue: number;
  smileRightValue: number;
  headY: number;
  headYThreshold: number;
}

// エフェクト指示データ（サーバーからの受信）
export interface EffectInstruction {
  type: 'effect';
  effectType: 'sparkle' | 'wave' | 'clapping_icons' | 'excitement' | 'bounce' | 'cheer';
  intensity: number;
  durationMs: number;
  timestamp: number;
  debug?: {
    activeUsers: number;
    ratioState: Record<string, number>;
    densityEvent: Record<string, number>;
  };
}