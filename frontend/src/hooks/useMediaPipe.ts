import { useState, useEffect, useRef } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

interface UseMediaPipeReturn {
  faceLandmarker: FaceLandmarker | null;
  isReady: boolean;
  error: string | null;
  lastResult: FaceLandmarkerResult | null;
  detectFace: (video: HTMLVideoElement) => FaceLandmarkerResult | null;
}

/**
 * MediaPipe Face Landmarker を管理するカスタムフック
 */
export const useMediaPipe = (): UseMediaPipeReturn => {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<FaceLandmarkerResult | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  /**
   * MediaPipe の初期化
   */
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        console.log('MediaPipe Face Landmarker を初期化中...');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
          runningMode: 'VIDEO',
          numFaces: 1
        });

        setFaceLandmarker(landmarker);
        setIsReady(true);
        console.log('MediaPipe Face Landmarker 初期化完了');

      } catch (err) {
        console.error('MediaPipe 初期化エラー:', err);
        setError('MediaPipe の初期化に失敗しました');
      }
    };

    initMediaPipe();

    // クリーンアップ
    return () => {
      if (faceLandmarker) {
        faceLandmarker.close();
        console.log('MediaPipe Face Landmarker をクローズしました');
      }
    };
  }, []);

  /**
   * 顔検出を実行
   */
  const detectFace = (video: HTMLVideoElement): FaceLandmarkerResult | null => {
    if (!faceLandmarker || !isReady) {
      return null;
    }

    // 同じフレームを2回処理しないようにする
    if (video.currentTime === lastVideoTimeRef.current) {
      return lastResult;
    }

    try {
      const result = faceLandmarker.detectForVideo(video, performance.now());
      lastVideoTimeRef.current = video.currentTime;
      setLastResult(result);
      return result;
    } catch (err) {
      console.error('顔検出エラー:', err);
      return null;
    }
  };

  return {
    faceLandmarker,
    isReady,
    error,
    lastResult,
    detectFace
  };
};