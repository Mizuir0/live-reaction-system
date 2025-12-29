import { useState, useRef, useCallback } from 'react';
import type { MediaPipeResult } from './useMediaPipe';
import type { ReactionStates, ReactionEvents, DetectionDebugInfo } from '../types/reactions';

interface UseReactionDetectionReturn {
  states: ReactionStates;
  events: ReactionEvents;
  debugInfo: DetectionDebugInfo;
  updateReactions: (result: MediaPipeResult | null) => void;
  resetEvents: () => void;
}

/**
 * リアクション検出ロジックを管理するカスタムフック
 */
export const useReactionDetection = (): UseReactionDetectionReturn => {
  // ステート型リアクション
  const [states, setStates] = useState<ReactionStates>({
    isSmiling: false,
    isSurprised: false,
    isConcentrating: false,
    isHandUp: false
  });

  // イベント型リアクション（1秒間のカウント）
  const [events, setEvents] = useState<ReactionEvents>({
    nod: 0,
    shakeHead: 0,
    swayVertical: 0,
    swayHorizontal: 0,
    cheer: 0,
    clap: 0
  });

  // デバッグ情報
  const [debugInfo, setDebugInfo] = useState<DetectionDebugInfo>({
    faceDetected: false,
    landmarkCount: 0,
    smileLeftValue: 0,
    smileRightValue: 0,
    headY: 0,
    headYThreshold: 0
  });

  // 頷き検出用の状態管理
  const headYHistory = useRef<number[]>([]);
  const prevHeadY = useRef<number>(0); // 前フレームのY座標
  const lastNodTime = useRef<number>(0);
  const downStateStartTime = useRef<number>(0); // down状態開始時刻
  const nodState = useRef<'neutral' | 'down'>('neutral');

  // 首を横に振る検出用の状態管理
  const headXHistory = useRef<number[]>([]);
  const prevHeadX = useRef<number>(0); // 前フレームのX座標
  const lastShakeTime = useRef<number>(0);
  const shakeLeftStartTime = useRef<number>(0); // left状態開始時刻
  const shakeState = useRef<'neutral' | 'left' | 'right'>('neutral');

  // 縦揺れ検出用の状態管理
  const swayYHistory = useRef<number[]>([]);
  const prevSwayY = useRef<number>(0);
  const lastSwayTime = useRef<number>(0);
  const swayDownStartTime = useRef<number>(0);
  const swayState = useRef<'neutral' | 'down'>('neutral');

  // 横揺れ検出用の状態管理
  const swayXHistory = useRef<number[]>([]);
  const prevSwayX = useRef<number>(0);
  const lastSwayHorizontalTime = useRef<number>(0);
  const swayHorizontalStartTime = useRef<number>(0);
  const swayHorizontalState = useRef<'neutral' | 'left' | 'right'>('neutral');

  /**
   * 笑顔検出（ステート型）
   */
  const detectSmile = (blendshapes: any): boolean => {
    if (!blendshapes || blendshapes.length === 0) return false;

    // BlendShapes から笑顔関連の値を取得
    const categories = blendshapes[0].categories;

    const mouthSmileLeft = categories.find((c: any) => c.categoryName === 'mouthSmileLeft')?.score || 0;
    const mouthSmileRight = categories.find((c: any) => c.categoryName === 'mouthSmileRight')?.score || 0;

    // デバッグ情報を更新
    setDebugInfo(prev => ({
      ...prev,
      smileLeftValue: mouthSmileLeft,
      smileRightValue: mouthSmileRight
    }));

    // 両方が閾値を超えたら笑顔と判定
    const SMILE_THRESHOLD = 0.5;
    return mouthSmileLeft > SMILE_THRESHOLD && mouthSmileRight > SMILE_THRESHOLD;
  };

  /**
   * 驚き検出（ステート型）
   */
  const detectSurprise = (blendshapes: any): boolean => {
    if (!blendshapes || blendshapes.length === 0) return false;

    const categories = blendshapes[0].categories;

    const eyeWideLeft = categories.find((c: any) => c.categoryName === 'eyeWideLeft')?.score || 0;
    const eyeWideRight = categories.find((c: any) => c.categoryName === 'eyeWideRight')?.score || 0;
    const jawOpen = categories.find((c: any) => c.categoryName === 'jawOpen')?.score || 0;

    // 目を見開いている かつ 口が開いている
    const EYE_WIDE_THRESHOLD = 0.5;
    const JAW_OPEN_THRESHOLD = 0.3;

    return (eyeWideLeft > EYE_WIDE_THRESHOLD && eyeWideRight > EYE_WIDE_THRESHOLD) &&
           jawOpen > JAW_OPEN_THRESHOLD;
  };

  /**
   * 集中検出（ステート型）
   */
  const detectConcentrating = (blendshapes: any): boolean => {
    if (!blendshapes || blendshapes.length === 0) return false;

    const categories = blendshapes[0].categories;

    // 眉を寄せている（集中時の表情）
    const browDownLeft = categories.find((c: any) => c.categoryName === 'browDownLeft')?.score || 0;
    const browDownRight = categories.find((c: any) => c.categoryName === 'browDownRight')?.score || 0;

    // 両方の眉が下がっているかチェック
    const BROW_DOWN_THRESHOLD = 0.5;
    const browsDown = browDownLeft > BROW_DOWN_THRESHOLD && browDownRight > BROW_DOWN_THRESHOLD;

    // 頭部の動きが小さいかチェック（直近1秒 = 約10フレーム）
    if (headYHistory.current.length < 10) {
      // 履歴が不足している場合は眉の状態のみで判定
      return browsDown;
    }

    // 直近10フレームの頭部Y座標の標準偏差を計算
    const recentY = headYHistory.current.slice(-10);
    const avgY = recentY.reduce((a, b) => a + b, 0) / recentY.length;
    const variance = recentY.reduce((sum, y) => sum + Math.pow(y - avgY, 2), 0) / recentY.length;
    const stdDev = Math.sqrt(variance);

    // 標準偏差が小さい = 頭部の動きが小さい
    const HEAD_MOVEMENT_THRESHOLD = 0.005; // 小さい動きの閾値
    const isStill = stdDev < HEAD_MOVEMENT_THRESHOLD;

    // 眉が下がっている かつ 頭部の動きが小さい
    return browsDown && isStill;
  };

  /**
   * 頷き検出（イベント型）- 前フレームとの差分のみで判定
   */
  const detectNod = (landmarks: any): void => {
    if (!landmarks || landmarks.length === 0) return;

    // 顔の中心（鼻の先端）のY座標を取得
    const noseTip = landmarks[0][1]; // landmark index 1 = 鼻の先端
    const currentY = noseTip.y;

    // Y座標の履歴を保持（最新8フレーム）
    headYHistory.current.push(currentY);
    if (headYHistory.current.length > 8) {
      headYHistory.current.shift();
    }

    // 履歴が十分に溜まっていない場合は終了
    if (headYHistory.current.length < 5) {
      // 初期化
      prevHeadY.current = currentY;
      return;
    }

    // 移動平均を計算してノイズを除去
    const avgY = headYHistory.current.reduce((a, b) => a + b, 0) / headYHistory.current.length;
    
    // 前フレームとの差分（下向きの動きを検出）
    const deltaFromPrev = avgY - prevHeadY.current;
    prevHeadY.current = avgY;

    // 閾値設定
    const DOWN_MOVEMENT_THRESHOLD = 0.008;  // 前フレームから下向きの動き検出閾値
    const TIMEOUT_MS = 1500;                // 1.5秒でタイムアウト（連続カウント防止）
    
    setDebugInfo(prev => ({
      ...prev,
      headY: avgY,
      headYThreshold: DOWN_MOVEMENT_THRESHOLD
    }));

    const currentTime = performance.now();

    // タイムアウトチェック: down状態が1.5秒以上続いたら自動的にneutral復帰
    if (nodState.current === 'down') {
      const downDuration = currentTime - downStateStartTime.current;
      if (downDuration > TIMEOUT_MS) {
        console.log('⏱️ タイムアウト: NEUTRAL復帰 (down状態', (downDuration/1000).toFixed(1), '秒)');
        nodState.current = 'neutral';
        return;
      }
    }

    // 状態遷移の検出（下向きの動きのみ）
    if (nodState.current === 'neutral' && deltaFromPrev > DOWN_MOVEMENT_THRESHOLD) {
      // 下向きの動き検出 → すぐにカウント
      const timeSinceLastNod = currentTime - lastNodTime.current;
      
      // 0.3秒以上経過していればカウント（連続カウント防止）
      if (timeSinceLastNod > 300) {
        setEvents(prev => ({ ...prev, nod: prev.nod + 1 }));
        console.log('✅ 頷き検出！- 下向き移動:', deltaFromPrev.toFixed(4));
        lastNodTime.current = currentTime;
      }
      
      nodState.current = 'down';
      downStateStartTime.current = currentTime;
      console.log('状態: NEUTRAL → DOWN');
      
    } else if (nodState.current === 'down' && deltaFromPrev < -DOWN_MOVEMENT_THRESHOLD) {
      // 上向きの動きが検出されたら neutral に復帰
      const downDuration = currentTime - downStateStartTime.current;
      console.log('状態: DOWN → NEUTRAL (上向き移動:', deltaFromPrev.toFixed(4), ', down時間:', (downDuration/1000).toFixed(2), '秒)');
      nodState.current = 'neutral';
    }
  };

  /**
   * 首を横に振る検出（イベント型）- 顔のX座標の変化を追跡
   */
  const detectShakeHead = (landmarks: any): void => {
    if (!landmarks || landmarks.length === 0) return;

    // 顔の中心（鼻の先端）のX座標を取得
    const noseTip = landmarks[0][1]; // landmark index 1 = 鼻の先端
    const currentX = noseTip.x;

    // X座標の履歴を保持（最新8フレーム）
    headXHistory.current.push(currentX);
    if (headXHistory.current.length > 8) {
      headXHistory.current.shift();
    }

    // 履歴が十分に溜まっていない場合は終了
    if (headXHistory.current.length < 5) {
      // 初期化
      prevHeadX.current = currentX;
      return;
    }

    // 移動平均を計算してノイズを除去
    const avgX = headXHistory.current.reduce((a, b) => a + b, 0) / headXHistory.current.length;

    // 前フレームとの差分（横方向の動きを検出）
    const deltaFromPrev = avgX - prevHeadX.current;
    prevHeadX.current = avgX;

    // 閾値設定
    const HORIZONTAL_MOVEMENT_THRESHOLD = 0.008;  // 横方向の動き検出閾値
    const TIMEOUT_MS = 1500;                       // 1.5秒でタイムアウト

    const currentTime = performance.now();

    // タイムアウトチェック: 状態が1.5秒以上続いたら自動的にneutral復帰
    if (shakeState.current !== 'neutral') {
      const stateDuration = currentTime - shakeLeftStartTime.current;
      if (stateDuration > TIMEOUT_MS) {
        console.log('⏱️ タイムアウト: NEUTRAL復帰 (shake状態', (stateDuration/1000).toFixed(1), '秒)');
        shakeState.current = 'neutral';
        return;
      }
    }

    // 状態遷移の検出（左右の動き）
    if (shakeState.current === 'neutral' && Math.abs(deltaFromPrev) > HORIZONTAL_MOVEMENT_THRESHOLD) {
      // 横方向の動き検出
      const timeSinceLastShake = currentTime - lastShakeTime.current;

      // 0.3秒以上経過していればカウント（連続カウント防止）
      if (timeSinceLastShake > 300) {
        setEvents(prev => ({ ...prev, shakeHead: prev.shakeHead + 1 }));
        console.log('✅ 首横振り検出！- 横移動:', deltaFromPrev.toFixed(4));
        lastShakeTime.current = currentTime;
      }

      // 左右どちらに動いたかで状態を設定
      shakeState.current = deltaFromPrev > 0 ? 'right' : 'left';
      shakeLeftStartTime.current = currentTime;
      console.log('状態: NEUTRAL →', shakeState.current.toUpperCase());

    } else if (shakeState.current === 'left' && deltaFromPrev > HORIZONTAL_MOVEMENT_THRESHOLD) {
      // 左から右への動き → neutral に復帰
      const stateDuration = currentTime - shakeLeftStartTime.current;
      console.log('状態: LEFT → NEUTRAL (右移動:', deltaFromPrev.toFixed(4), ', 状態時間:', (stateDuration/1000).toFixed(2), '秒)');
      shakeState.current = 'neutral';

    } else if (shakeState.current === 'right' && deltaFromPrev < -HORIZONTAL_MOVEMENT_THRESHOLD) {
      // 右から左への動き → neutral に復帰
      const stateDuration = currentTime - shakeLeftStartTime.current;
      console.log('状態: RIGHT → NEUTRAL (左移動:', deltaFromPrev.toFixed(4), ', 状態時間:', (stateDuration/1000).toFixed(2), '秒)');
      shakeState.current = 'neutral';
    }
  };

  /**
   * 体の縦揺れ検出（イベント型）- 両肩の中心点を使用
   * より長い周期（0.5〜2秒）の上下動を検出
   */
  const detectSwayVertical = (poseLandmarks: any): void => {
    if (!poseLandmarks || poseLandmarks.length === 0) return;

    // Pose landmark indices: 11=左肩, 12=右肩
    const leftShoulder = poseLandmarks[0][11];
    const rightShoulder = poseLandmarks[0][12];

    if (!leftShoulder || !rightShoulder) return;

    // 両肩の中心点のY座標を計算
    const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;

    // Y座標の履歴を保持（最新15フレーム = 約1.5秒）
    swayYHistory.current.push(shoulderCenterY);
    if (swayYHistory.current.length > 15) {
      swayYHistory.current.shift();
    }

    // 履歴が十分に溜まっていない場合は終了
    if (swayYHistory.current.length < 8) {
      prevSwayY.current = shoulderCenterY;
      return;
    }

    // 移動平均を計算
    const avgY = swayYHistory.current.reduce((a, b) => a + b, 0) / swayYHistory.current.length;
    const deltaFromPrev = avgY - prevSwayY.current;
    prevSwayY.current = avgY;

    // 閾値設定（頷きよりも大きな動き）
    const DOWN_MOVEMENT_THRESHOLD = 0.01; // 肩の動きに合わせて調整
    const TIMEOUT_MS = 3000; // 3秒でタイムアウト
    const currentTime = performance.now();

    // タイムアウトチェック
    if (swayState.current === 'down') {
      const downDuration = currentTime - swayDownStartTime.current;
      if (downDuration > TIMEOUT_MS) {
        swayState.current = 'neutral';
        return;
      }
    }

    // 状態遷移の検出
    if (swayState.current === 'neutral' && deltaFromPrev > DOWN_MOVEMENT_THRESHOLD) {
      const timeSinceLastSway = currentTime - lastSwayTime.current;

      // 0.5秒以上経過していればカウント
      if (timeSinceLastSway > 500) {
        setEvents(prev => ({ ...prev, swayVertical: prev.swayVertical + 1 }));
        console.log('✅ 縦揺れ検出！- 下向き移動:', deltaFromPrev.toFixed(4));
        lastSwayTime.current = currentTime;
      }

      swayState.current = 'down';
      swayDownStartTime.current = currentTime;
    } else if (swayState.current === 'down' && deltaFromPrev < -DOWN_MOVEMENT_THRESHOLD) {
      swayState.current = 'neutral';
    }
  };

  /**
   * 体の横揺れ検出（イベント型）- 両肩の中心点を使用
   * 左右方向の周期的な動きを検出（音楽に合わせた体の揺れなど）
   */
  const detectSwayHorizontal = (poseLandmarks: any): void => {
    if (!poseLandmarks || poseLandmarks.length === 0) return;

    // Pose landmark indices: 11=左肩, 12=右肩
    const leftShoulder = poseLandmarks[0][11];
    const rightShoulder = poseLandmarks[0][12];

    if (!leftShoulder || !rightShoulder) return;

    // 両肩の中心点のX座標を計算
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;

    // X座標の履歴を保持（最新15フレーム = 約1.5秒）
    swayXHistory.current.push(shoulderCenterX);
    if (swayXHistory.current.length > 15) {
      swayXHistory.current.shift();
    }

    // 履歴が十分に溜まっていない場合は終了
    if (swayXHistory.current.length < 8) {
      prevSwayX.current = shoulderCenterX;
      return;
    }

    // 移動平均を計算
    const avgX = swayXHistory.current.reduce((a, b) => a + b, 0) / swayXHistory.current.length;
    const deltaFromPrev = avgX - prevSwayX.current;
    prevSwayX.current = avgX;

    // 閾値設定（横方向の動き）
    const HORIZONTAL_MOVEMENT_THRESHOLD = 0.008; // 横方向の動き検出閾値
    const TIMEOUT_MS = 3000; // 3秒でタイムアウト
    const currentTime = performance.now();

    // タイムアウトチェック
    if (swayHorizontalState.current !== 'neutral') {
      const stateDuration = currentTime - swayHorizontalStartTime.current;
      if (stateDuration > TIMEOUT_MS) {
        swayHorizontalState.current = 'neutral';
        return;
      }
    }

    // 状態遷移の検出（左右の動き）
    if (swayHorizontalState.current === 'neutral' && Math.abs(deltaFromPrev) > HORIZONTAL_MOVEMENT_THRESHOLD) {
      const timeSinceLastSway = currentTime - lastSwayHorizontalTime.current;

      // 0.3秒以上経過していればカウント
      if (timeSinceLastSway > 300) {
        setEvents(prev => ({ ...prev, swayHorizontal: prev.swayHorizontal + 1 }));
        console.log('✅ 横揺れ検出！- 横移動:', deltaFromPrev.toFixed(4));
        lastSwayHorizontalTime.current = currentTime;
      }

      // 左右どちらに動いたかで状態を設定
      swayHorizontalState.current = deltaFromPrev > 0 ? 'right' : 'left';
      swayHorizontalStartTime.current = currentTime;
    } else if (swayHorizontalState.current === 'left' && deltaFromPrev > HORIZONTAL_MOVEMENT_THRESHOLD) {
      // 左から右への動き → neutral に復帰
      swayHorizontalState.current = 'neutral';
    } else if (swayHorizontalState.current === 'right' && deltaFromPrev < -HORIZONTAL_MOVEMENT_THRESHOLD) {
      // 右から左への動き → neutral に復帰
      swayHorizontalState.current = 'neutral';
    }
  };

  /**
   * 手が上がっている検出（ステート型）
   * 肘の位置で判定（手首が画角外に出ても検出可能）
   */
  const detectHandUp = (poseLandmarks: any): boolean => {
    if (!poseLandmarks || poseLandmarks.length === 0) return false;

    // Pose landmark indices: 13=左肘, 14=右肘, 11=左肩, 12=右肩
    const leftElbow = poseLandmarks[0][13];
    const rightElbow = poseLandmarks[0][14];
    const leftShoulder = poseLandmarks[0][11];
    const rightShoulder = poseLandmarks[0][12];

    if (!leftElbow || !rightElbow || !leftShoulder || !rightShoulder) return false;

    // 少なくとも片方の肘が肩より上にあるかチェック
    const leftHandUp = leftElbow.y < leftShoulder.y - 0.05; // 肩より5%上
    const rightHandUp = rightElbow.y < rightShoulder.y - 0.05;

    // 肘の visibility もチェック（低すぎる場合は検出しない）
    const leftVisible = leftElbow.visibility > 0.5;
    const rightVisible = rightElbow.visibility > 0.5;

    return (leftHandUp && leftVisible) || (rightHandUp && rightVisible);
  };

  /**
   * リアクションを更新
   */
  const updateReactions = useCallback((result: MediaPipeResult | null) => {
    if (!result || !result.face || !result.face.faceLandmarks || result.face.faceLandmarks.length === 0) {
      // 顔が検出されない場合
      setStates({
        isSmiling: false,
        isSurprised: false,
        isConcentrating: false,
        isHandUp: false
      });
      setDebugInfo(prev => ({
        ...prev,
        faceDetected: false,
        landmarkCount: 0
      }));
      return;
    }

    // 顔が検出された
    const faceResult = result.face;
    setDebugInfo(prev => ({
      ...prev,
      faceDetected: true,
      landmarkCount: faceResult.faceLandmarks[0].length
    }));

    // ステート型: 笑顔検出
    const isSmiling = detectSmile(faceResult.faceBlendshapes);
    const isSurprised = detectSurprise(faceResult.faceBlendshapes);
    const isConcentrating = detectConcentrating(faceResult.faceBlendshapes);

    // ステート型: 手が上がっている検出（Poseが必要）
    let isHandUp = false;
    if (result.pose && result.pose.landmarks && result.pose.landmarks.length > 0) {
      isHandUp = detectHandUp(result.pose.landmarks);
    }

    setStates(prev => ({ ...prev, isSmiling, isSurprised, isConcentrating, isHandUp }));

    // イベント型: 頷き検出
    detectNod(faceResult.faceLandmarks);

    // イベント型: 首を横に振る検出
    detectShakeHead(faceResult.faceLandmarks);

    // イベント型: 縦揺れ検出（Poseが必要）
    if (result.pose && result.pose.landmarks && result.pose.landmarks.length > 0) {
      detectSwayVertical(result.pose.landmarks);
      detectSwayHorizontal(result.pose.landmarks);
    }

  }, []);

  /**
   * イベントカウンターをリセット（1秒ごとに呼ばれる）
   */
  const resetEvents = useCallback(() => {
    setEvents({
      nod: 0,
      shakeHead: 0,
      swayVertical: 0,
      swayHorizontal: 0,
      cheer: 0,
      clap: 0
    });
  }, []);

  return {
    states,
    events,
    debugInfo,
    updateReactions,
    resetEvents
  };
};