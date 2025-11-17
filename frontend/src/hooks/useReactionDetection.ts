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

  // 縦揺れ検出用の状態管理
  const swayYHistory = useRef<number[]>([]);
  const prevSwayY = useRef<number>(0);
  const lastSwayTime = useRef<number>(0);
  const swayDownStartTime = useRef<number>(0);
  const swayState = useRef<'neutral' | 'down'>('neutral');

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
   * 手が上がっている検出（ステート型）
   */
  const detectHandUp = (poseLandmarks: any): boolean => {
    if (!poseLandmarks || poseLandmarks.length === 0) return false;

    // Pose landmark indices: 15=左手首, 16=右手首, 11=左肩, 12=右肩
    const leftWrist = poseLandmarks[0][15];
    const rightWrist = poseLandmarks[0][16];
    const leftShoulder = poseLandmarks[0][11];
    const rightShoulder = poseLandmarks[0][12];

    if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder) return false;

    // 少なくとも片手が肩より上にあるかチェック
    const leftHandUp = leftWrist.y < leftShoulder.y - 0.1; // 肩より10%上
    const rightHandUp = rightWrist.y < rightShoulder.y - 0.1;

    // 手首の visibility もチェック（低すぎる場合は検出しない）
    const leftVisible = leftWrist.visibility > 0.5;
    const rightVisible = rightWrist.visibility > 0.5;

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

    // ステート型: 手が上がっている検出（Poseが必要）
    let isHandUp = false;
    if (result.pose && result.pose.landmarks && result.pose.landmarks.length > 0) {
      isHandUp = detectHandUp(result.pose.landmarks);
    }

    setStates(prev => ({ ...prev, isSmiling, isSurprised, isHandUp }));

    // イベント型: 頷き検出
    detectNod(faceResult.faceLandmarks);

    // イベント型: 縦揺れ検出（Poseが必要）
    if (result.pose && result.pose.landmarks && result.pose.landmarks.length > 0) {
      detectSwayVertical(result.pose.landmarks);
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