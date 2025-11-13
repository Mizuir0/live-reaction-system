import { useState, useEffect, useRef } from 'react';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isReady: boolean;
  error: string | null;
  requestCamera: () => Promise<void>;
}

/**
 * カメラアクセスを管理するカスタムフック
 */
export const useCamera = (): UseCameraReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * カメラアクセスをリクエスト
   */
  const requestCamera = async () => {
    try {
      console.log('カメラアクセスをリクエスト中...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      console.log('カメラアクセス許可されました');
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsReady(true);
          console.log('ビデオストリーム準備完了');
        };
      }

      setStream(mediaStream);
      setError(null);

    } catch (err) {
      console.error('カメラアクセスエラー:', err);
      setError('カメラへのアクセスが拒否されました');
      setIsReady(false);
    }
  };

  /**
   * クリーンアップ: ストリームを停止
   */
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        console.log('カメラストリームを停止しました');
      }
    };
  }, [stream]);

  return {
    videoRef,
    stream,
    isReady,
    error,
    requestCamera
  };
};