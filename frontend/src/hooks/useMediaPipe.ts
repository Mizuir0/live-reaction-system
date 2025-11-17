import { useState, useEffect, useRef } from 'react';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

export interface MediaPipeResult {
  face: FaceLandmarkerResult | null;
  pose: PoseLandmarkerResult | null;
}

interface UseMediaPipeReturn {
  faceLandmarker: FaceLandmarker | null;
  poseLandmarker: PoseLandmarker | null;
  isReady: boolean;
  error: string | null;
  lastResult: MediaPipeResult;
  detectFace: (video: HTMLVideoElement) => FaceLandmarkerResult | null;
  detectPose: (video: HTMLVideoElement) => PoseLandmarkerResult | null;
  detectAll: (video: HTMLVideoElement) => MediaPipeResult;
}

/**
 * MediaPipe Face & Pose Landmarker を管理するカスタムフック
 */
export const useMediaPipe = (): UseMediaPipeReturn => {
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MediaPipeResult>({ face: null, pose: null });
  const lastVideoTimeRef = useRef<number>(-1);

  /**
   * MediaPipe の初期化
   */
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        console.log('MediaPipe Face & Pose Landmarker を初期化中...');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        // Face Landmarker
        const face = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
          runningMode: 'VIDEO',
          numFaces: 1
        });

        // Pose Landmarker
        const pose = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1
        });

        setFaceLandmarker(face);
        setPoseLandmarker(pose);
        setIsReady(true);
        console.log('MediaPipe Face & Pose Landmarker 初期化完了');

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
      if (poseLandmarker) {
        poseLandmarker.close();
        console.log('MediaPipe Pose Landmarker をクローズしました');
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

    try {
      const result = faceLandmarker.detectForVideo(video, performance.now());
      return result;
    } catch (err) {
      console.error('顔検出エラー:', err);
      return null;
    }
  };

  /**
   * ポーズ検出を実行
   */
  const detectPose = (video: HTMLVideoElement): PoseLandmarkerResult | null => {
    if (!poseLandmarker || !isReady) {
      return null;
    }

    try {
      const result = poseLandmarker.detectForVideo(video, performance.now());
      return result;
    } catch (err) {
      console.error('ポーズ検出エラー:', err);
      return null;
    }
  };

  /**
   * 顔とポーズを同時に検出
   */
  const detectAll = (video: HTMLVideoElement): MediaPipeResult => {
    // 同じフレームを2回処理しないようにする
    if (video.currentTime === lastVideoTimeRef.current) {
      return lastResult;
    }

    const faceResult = detectFace(video);
    const poseResult = detectPose(video);

    const result: MediaPipeResult = {
      face: faceResult,
      pose: poseResult
    };

    lastVideoTimeRef.current = video.currentTime;
    setLastResult(result);

    return result;
  };

  return {
    faceLandmarker,
    poseLandmarker,
    isReady,
    error,
    lastResult,
    detectFace,
    detectPose,
    detectAll
  };
};