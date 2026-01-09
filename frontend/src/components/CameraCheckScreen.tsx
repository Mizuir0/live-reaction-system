import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMediaPipe } from '../hooks/useMediaPipe';

interface CameraCheckScreenProps {
  onReady: () => void;
  onBack: () => void;
}

const CameraCheckScreen: React.FC<CameraCheckScreenProps> = ({ onReady, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [poseDetected, setPoseDetected] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  // MediaPipeフックを使用
  const { detectAll, isReady: mediaPipeReady, error: mediaPipeError } = useMediaPipe();

  // 全画面状態を監視
  useEffect(() => {
    const checkFullscreen = () => {
      // Fullscreen API による全画面（Safari対応）
      const fullscreenElement = document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;

      // F11やブラウザの全画面ボタンによる全画面（ウィンドウサイズで判定）
      const isFullscreenBySize = window.innerWidth >= screen.width - 10 &&
                                  window.innerHeight >= screen.height - 10;

      setIsFullscreen(!!fullscreenElement || isFullscreenBySize);
    };

    // 初期状態をチェック
    checkFullscreen();

    // 全画面変更イベントを監視（Safari対応）
    document.addEventListener('fullscreenchange', checkFullscreen);
    document.addEventListener('webkitfullscreenchange', checkFullscreen);
    // F11などによる全画面はresizeイベントで検知
    window.addEventListener('resize', checkFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
      document.removeEventListener('webkitfullscreenchange', checkFullscreen);
      window.removeEventListener('resize', checkFullscreen);
    };
  }, []);

  // 全画面をリクエスト
  const requestFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.error('全画面表示エラー:', err);
    }
  };

  // カメラを起動
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      } catch (err) {
        console.error('カメラアクセスエラー:', err);
        setCameraError(err instanceof Error ? err.message : 'カメラにアクセスできませんでした');
      }
    };

    startCamera();

    return () => {
      // クリーンアップ
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 検出ループ
  const detectLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !mediaPipeReady) {
      animationFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    // MediaPipeで検出
    const result = detectAll(video);

    // 顔の検出チェック
    const hasFace = !!(result.face &&
                       result.face.faceLandmarks &&
                       result.face.faceLandmarks.length > 0);
    setFaceDetected(hasFace);

    // ポーズ（体）の検出チェック
    const hasPose = !!(result.pose &&
                       result.pose.landmarks &&
                       result.pose.landmarks.length > 0);
    setPoseDetected(hasPose);

    // 次のフレーム
    animationFrameRef.current = requestAnimationFrame(detectLoop);
  }, [mediaPipeReady, detectAll]);

  // 検出ループ開始
  useEffect(() => {
    if (cameraReady && mediaPipeReady) {
      detectLoop();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cameraReady, mediaPipeReady, detectLoop]);

  const allDetected = faceDetected && poseDetected && cameraReady && isFullscreen;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>カメラ確認</h1>
        <p style={styles.subtitle}>
          顔と体が認識されているか確認してください
        </p>

        {/* カメラプレビュー */}
        <div style={styles.videoContainer}>
          <video
            ref={videoRef}
            style={styles.video}
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            style={styles.canvas}
          />
        </div>

        {/* 検出状態の表示 */}
        <div style={styles.statusContainer}>
          <div style={styles.statusItem}>
            <span style={styles.statusIcon}>
              {isFullscreen ? '✅' : '❌'}
            </span>
            <span style={styles.statusText}>
              全画面表示: {isFullscreen ? '有効' : '無効'}
            </span>
          </div>

          <div style={styles.statusItem}>
            <span style={styles.statusIcon}>
              {cameraReady ? '✅' : '⏳'}
            </span>
            <span style={styles.statusText}>
              カメラ: {cameraReady ? '起動済み' : '起動中...'}
            </span>
          </div>

          <div style={styles.statusItem}>
            <span style={styles.statusIcon}>
              {faceDetected ? '✅' : '❌'}
            </span>
            <span style={styles.statusText}>
              顔の検出: {faceDetected ? '検出されています' : '検出されていません'}
            </span>
          </div>

          <div style={styles.statusItem}>
            <span style={styles.statusIcon}>
              {poseDetected ? '✅' : '❌'}
            </span>
            <span style={styles.statusText}>
              体の検出: {poseDetected ? '検出されています' : '検出されていません'}
            </span>
          </div>
        </div>

        {/* エラー表示 */}
        {(cameraError || mediaPipeError) && (
          <div style={styles.errorContainer}>
            <p style={styles.errorText}>⚠️ {cameraError || mediaPipeError}</p>
          </div>
        )}

        {/* 全画面表示の警告 */}
        {!isFullscreen && (
          <div style={styles.fullscreenWarning}>
            <p style={styles.fullscreenWarningTitle}>🖥️ 全画面表示が必要です</p>
            <p style={styles.fullscreenWarningText}>
              実験を開始するには、全画面表示にしてください。
            </p>
            <button
              onClick={requestFullscreen}
              style={styles.fullscreenButton}
            >
              全画面表示にする
            </button>
          </div>
        )}

        {/* ヒント */}
        {!allDetected && cameraReady && (
          <div style={styles.hintContainer}>
            <p style={styles.hintTitle}>💡 ヒント:</p>
            <ul style={styles.hintList}>
              {!isFullscreen && (
                <li>上の「全画面表示にする」ボタンをクリックしてください</li>
              )}
              {!faceDetected && (
                <li>カメラに顔が映るように調整してください</li>
              )}
              {!poseDetected && (
                <li>上半身全体が映るように少し後ろに下がってください</li>
              )}
              <li>明るい場所で使用してください</li>
            </ul>
          </div>
        )}

        {/* ボタン */}
        <div style={styles.buttonContainer}>
          <button
            onClick={onBack}
            style={styles.backButton}
          >
            ← 戻る
          </button>

          <button
            onClick={onReady}
            disabled={!allDetected}
            style={{
              ...styles.readyButton,
              ...(allDetected ? styles.readyButtonEnabled : styles.readyButtonDisabled)
            }}
          >
            {allDetected ? '✅ 準備完了' : '⏳ 検出待ち...'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '100vh',
    backgroundColor: '#1a1a1a',
    color: 'white',
    padding: '20px',
    overflow: 'auto'
  },
  content: {
    width: '100%',
    maxWidth: '800px',
    textAlign: 'center'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '10px'
  },
  subtitle: {
    fontSize: '18px',
    color: '#ccc',
    marginBottom: '30px'
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: '640px',
    margin: '0 auto 30px',
    backgroundColor: '#000',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  video: {
    width: '100%',
    height: 'auto',
    display: 'block',
    transform: 'scaleX(-1)' // 鏡像表示
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    transform: 'scaleX(-1)' // 鏡像表示
  },
  statusContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px'
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontSize: '18px'
  },
  statusIcon: {
    fontSize: '24px'
  },
  statusText: {
    fontWeight: '500'
  },
  errorContainer: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 0, 0, 0.3)'
  },
  errorText: {
    color: '#ff6b6b',
    margin: 0
  },
  fullscreenWarning: {
    marginBottom: '20px',
    padding: '20px',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderRadius: '12px',
    border: '2px solid rgba(255, 165, 0, 0.5)'
  },
  fullscreenWarningTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ffa500',
    marginBottom: '10px'
  },
  fullscreenWarningText: {
    fontSize: '16px',
    color: '#ccc',
    marginBottom: '15px'
  },
  fullscreenButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#ffa500',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 4px 8px rgba(255, 165, 0, 0.4)'
  },
  hintContainer: {
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: '12px',
    textAlign: 'left'
  },
  hintTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#4CAF50'
  },
  hintList: {
    margin: 0,
    paddingLeft: '20px',
    lineHeight: '1.8'
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px'
  },
  backButton: {
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#666',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  readyButton: {
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  readyButtonEnabled: {
    backgroundColor: '#4CAF50',
    boxShadow: '0 4px 8px rgba(76, 175, 80, 0.4)'
  },
  readyButtonDisabled: {
    backgroundColor: '#444',
    cursor: 'not-allowed',
    opacity: 0.6
  }
};

export default CameraCheckScreen;
