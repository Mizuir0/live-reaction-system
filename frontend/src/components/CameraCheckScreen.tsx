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

        <div style={styles.mainLayout}>
          {/* 左側: カメラプレビュー */}
          <div style={styles.leftPanel}>
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
          </div>

          {/* 右側: チェック項目とボタン */}
          <div style={styles.rightPanel}>
            <p style={styles.subtitle}>
              顔と体が認識されているか確認してください
            </p>

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
                  顔: {faceDetected ? '検出OK' : '未検出'}
                </span>
              </div>

              <div style={styles.statusItem}>
                <span style={styles.statusIcon}>
                  {poseDetected ? '✅' : '❌'}
                </span>
                <span style={styles.statusText}>
                  体: {poseDetected ? '検出OK' : '未検出'}
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
                <button
                  onClick={requestFullscreen}
                  style={styles.fullscreenButton}
                >
                  全画面表示にする
                </button>
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
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#1a1a1a',
    color: 'white',
    padding: '20px',
    boxSizing: 'border-box'
  },
  content: {
    width: '100%',
    maxWidth: '1200px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '15px',
    textAlign: 'center'
  },
  mainLayout: {
    display: 'flex',
    gap: '30px',
    alignItems: 'flex-start'
  },
  leftPanel: {
    flex: '1 1 50%',
    minWidth: '300px'
  },
  rightPanel: {
    flex: '1 1 50%',
    minWidth: '280px'
  },
  subtitle: {
    fontSize: '16px',
    color: '#ccc',
    marginBottom: '15px'
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
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
    gap: '8px',
    marginBottom: '15px',
    padding: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px'
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '8px',
    fontSize: '14px'
  },
  statusIcon: {
    fontSize: '18px'
  },
  statusText: {
    fontWeight: '500'
  },
  errorContainer: {
    marginBottom: '12px',
    padding: '10px',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 0, 0, 0.3)'
  },
  errorText: {
    color: '#ff6b6b',
    margin: 0,
    fontSize: '14px'
  },
  fullscreenWarning: {
    marginBottom: '15px',
    padding: '12px',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderRadius: '8px',
    border: '2px solid rgba(255, 165, 0, 0.5)'
  },
  fullscreenWarningTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffa500',
    marginBottom: '8px'
  },
  fullscreenWarningText: {
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '10px'
  },
  fullscreenButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#ffa500',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 2px 6px rgba(255, 165, 0, 0.4)'
  },
  hintContainer: {
    marginBottom: '15px',
    padding: '12px',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: '8px',
    textAlign: 'left'
  },
  hintTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '6px',
    color: '#4CAF50'
  },
  hintList: {
    margin: 0,
    paddingLeft: '16px',
    lineHeight: '1.6',
    fontSize: '13px'
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginTop: '10px'
  },
  backButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#666',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  readyButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
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
