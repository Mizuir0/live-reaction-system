import React, { useEffect, useRef, useState } from 'react';
import YouTube from 'react-youtube';
import type { YouTubeProps } from 'react-youtube';
import { useCamera } from '../hooks/useCamera';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { useReactionDetection } from '../hooks/useReactionDetection';
import { useAudioDetection } from '../hooks/useAudioDetection';
import { useWebSocket } from '../hooks/useWebSockets';
import { useEffectRenderer } from '../hooks/useEffectRenderer';
import DebugOverlay from './DebugOverlay';
import type { ReactionStates, ReactionEvents } from '../types/reactions';
interface ViewingScreenProps {
  videoId: string | undefined;
  userId: string;
}

/**
 * 視聴画面コンポーネント
 * YouTube プレイヤー、Canvas エフェクト領域、ステータス表示を含む
 */
const ViewingScreen: React.FC<ViewingScreenProps> = ({ videoId, userId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(false); // ランドマーク表示
  const detectionIntervalRef = useRef<number | null>(null);
  const sendIntervalRef = useRef<number | null>(null);
  
  // 最新のstatesとeventsを保持するref
  const statesRef = useRef<ReactionStates>({
    isSmiling: false,
    isSurprised: false,
    isConcentrating: false,
    isHandUp: false
  });
  const eventsRef = useRef<ReactionEvents>({
    nod: 0,
    shakeHead: 0,
    swayVertical: 0,
    swayHorizontal: 0,
    cheer: 0,
    clap: 0
  });

  // カスタムフック
  const { videoRef, isReady: cameraReady, error: cameraError, requestCamera } = useCamera();
  const { isReady: mediaPipeReady, detectAll, lastResult } = useMediaPipe();
  const { states, events, debugInfo, updateReactions, resetEvents } = useReactionDetection();
  const {
    events: audioEvents,
    debugInfo: audioDebugInfo,
    resetEvents: resetAudioEvents,
    startAudio,
    stopAudio
  } = useAudioDetection();
  const { isConnected: wsConnected, error: wsError, sendReactionData, currentEffect } = useWebSocket(userId);

  // エフェクトレンダラー
  useEffectRenderer({ canvasRef, currentEffect });
  /**
   * カメラアクセスをリクエスト
   */
  useEffect(() => {
    requestCamera();
  }, []);

  /**
   * マイクアクセスをリクエスト
   */
  useEffect(() => {
    startAudio();

    return () => {
      stopAudio();
    };
  }, []);

  /**
   * states と events が変更されたら ref を更新
   * 視覚イベントと音声イベントをマージ
   */
  useEffect(() => {
    statesRef.current = states;
    // 視覚検出イベントと音声検出イベントをマージ
    eventsRef.current = {
      ...events,
      cheer: audioEvents.cheer,
      clap: audioEvents.clap
    };
  }, [states, events, audioEvents]);

  /**
   * リアクション検出ループ（0.1秒ごと = 10fps）
   */
  useEffect(() => {
    if (!cameraReady || !mediaPipeReady || !videoRef.current) {
      return;
    }

    console.log('✅ リアクション検出ループを開始します');

    const detectInterval = window.setInterval(() => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const result = detectAll(videoRef.current);
        updateReactions(result);
      }
    }, 100); // 0.1秒 = 10fps

    detectionIntervalRef.current = detectInterval;

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        console.log('⏹️ リアクション検出ループを停止しました');
      }
    };
  }, [cameraReady, mediaPipeReady]); // detectFace, updateReactionsを依存配列から削除

  /**
   * イベントカウンターのリセット（1秒ごと）
   */
  useEffect(() => {
    const resetInterval = setInterval(() => {
      console.log('イベントカウンターをリセット - nod:', events.nod, 'cheer:', audioEvents.cheer, 'clap:', audioEvents.clap);
      resetEvents();
      resetAudioEvents();
    }, 1000);

    return () => clearInterval(resetInterval);
  }, [resetEvents, resetAudioEvents, events, audioEvents]);

  /**
   * リアクションデータの送信（1秒ごと）
   */
  useEffect(() => {
    if (!wsConnected) {
      console.log('⚠️ WebSocket未接続のため送信スキップ');
      return;
    }

    console.log('📡 リアクションデータ送信ループを開始');

    const sendInterval = window.setInterval(() => {
      // refから最新の値を取得
      const currentStates = statesRef.current;
      const currentEvents = eventsRef.current;
      
      sendReactionData({
        states: currentStates,
        events: currentEvents
      });
    }, 1000); // 1秒ごと

    sendIntervalRef.current = sendInterval;

    return () => {
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current);
        console.log('📡 リアクションデータ送信ループを停止');
      }
    };
  }, [wsConnected, sendReactionData]); // wsConnectedとsendReactionDataのみ依存

  useEffect(() => {
    // Canvas の初期化（後のステップで描画処理を追加）
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Canvas サイズを親要素に合わせる
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        console.log('Canvas initialized:', canvas.width, 'x', canvas.height);
      }
    }

    // ウィンドウリサイズ時の対応
    const handleResize = () => {
      if (canvas) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * YouTube プレイヤーの準備完了時の処理
   */
  const onPlayerReady: YouTubeProps['onReady'] = (_event) => {
    console.log('YouTube Player Ready');
    setPlayerReady(true);
  };

  /**
   * YouTube プレイヤーの再生状態変更時の処理
   */
  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    console.log('Player State Changed:', event.data);
    // -1: 未開始, 0: 終了, 1: 再生中, 2: 一時停止, 3: バッファリング中, 5: 頭出し済み
  };

  /**
   * YouTube プレイヤーのオプション
   */
  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0
    },
  };

  // リアクション検出が有効かどうか
  const isReactionActive = cameraReady && mediaPipeReady && wsConnected;

  return (
    <div style={styles.container}>
      {/* カメラ映像（非表示、検出用） */}
      <video
        ref={videoRef}
        style={styles.hiddenVideo}
        playsInline
        muted
      />

      {/* メインビデオエリア */}
      <div style={styles.videoArea}>
        {/* Canvas エフェクト領域（背景レイヤー） */}
        <canvas 
          ref={canvasRef} 
          style={styles.canvas}
        />
        
        {/* YouTube プレイヤー */}
        <div style={styles.playerWrapper}>
          <YouTube
            videoId={videoId ?? ''}
            opts={opts as YouTubeProps['opts']}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            style={styles.player}
          />
        </div>

        {/* デバッグオーバーレイ */}
        {showDebug && (
          <DebugOverlay
            videoRef={videoRef as unknown as React.RefObject<HTMLVideoElement>}
            detectionResult={lastResult}
            states={states}
            events={{...events, cheer: audioEvents.cheer, clap: audioEvents.clap}}
            debugInfo={debugInfo}
            audioDebugInfo={audioDebugInfo}
            showLandmarks={showLandmarks}
            currentEffect={currentEffect}
          />
        )}
      </div>

      {/* ステータスバー */}
      <div style={styles.statusBar}>
        <div style={styles.statusLeft}>
          <span style={styles.statusLabel}>ユーザーID:</span>
          <span style={styles.statusValue}>{userId.substring(0, 15)}...</span>
        </div>
        
        <div style={styles.statusCenter}>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>プレイヤー:</span>
            <span style={{
              ...styles.statusValue,
              color: playerReady ? '#4caf50' : '#ff9800'
            }}>
              {playerReady ? '準備完了' : '読み込み中'}
            </span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>カメラ:</span>
            <span style={{
              ...styles.statusValue,
              color: cameraReady ? '#4caf50' : cameraError ? '#f44336' : '#ff9800'
            }}>
              {cameraReady ? '✓' : cameraError ? '✗' : '...'}
            </span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>MediaPipe:</span>
            <span style={{
              ...styles.statusValue,
              color: mediaPipeReady ? '#4caf50' : '#ff9800'
            }}>
              {mediaPipeReady ? '✓' : '...'}
            </span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>WebSocket:</span>
            <span style={{
              ...styles.statusValue,
              color: wsConnected ? '#4caf50' : wsError ? '#f44336' : '#ff9800'
            }}>
              {wsConnected ? '✓' : wsError ? '✗' : '...'}
            </span>
          </div>
          <div style={styles.statusItem}>
            <span style={styles.statusLabel}>🎤 Audio:</span>
            <span style={{
              ...styles.statusValue,
              color: audioDebugInfo.isActive ? '#4caf50' : audioDebugInfo.error ? '#f44336' : '#ff9800'
            }}>
              {audioDebugInfo.isActive ? '✓' : audioDebugInfo.error ? '✗' : '...'}
            </span>
          </div>
        </div>

        <div style={styles.statusRight}>
          <span style={styles.statusLabel}>リアクション送信:</span>
          <span style={{
            ...styles.statusValue,
            color: isReactionActive ? '#4caf50' : '#999',
            fontWeight: 'bold'
          }}>
            {isReactionActive ? 'ON' : 'OFF'}
          </span>
          
          <button
            onClick={() => setShowDebug(!showDebug)}
            style={styles.debugToggle}
          >
            {showDebug ? '🔍 デバッグ表示中' : '👁️ デバッグを表示'}
          </button>

          {showDebug && (
            <button
              onClick={() => setShowLandmarks(!showLandmarks)}
              style={{
                ...styles.debugToggle,
                backgroundColor: showLandmarks ? '#4caf50' : '#333'
              }}
            >
              {showLandmarks ? '● ランドマーク表示中' : '○ ランドマーク非表示'}
            </button>
          )}
        </div>
      </div>

      {/* エラー表示 */}
      {cameraError && (
        <div style={styles.errorBanner}>
          ⚠️ カメラ: {cameraError}
        </div>
      )}
      {wsError && !wsConnected && (
        <div style={{...styles.errorBanner, top: '55%'}}>
          ⚠️ WebSocket: {wsError}
        </div>
      )}

      {/* デバッグ情報（開発用） */}
      <div style={styles.debugInfo}>
        <p style={styles.debugText}>
          <strong>Step 6 完了:</strong> リアクション・エフェクト拡張 🎉
        </p>
        <p style={styles.debugText}>
          <strong>接続状態:</strong> {wsConnected ? '✅ 接続中' : '❌ 未接続'}
          {currentEffect && ` | 🎨 エフェクト: ${currentEffect.effectType} (intensity: ${currentEffect.intensity.toFixed(2)})`}
        </p>
        <p style={styles.debugText}>
          <strong>実装済み:</strong> 笑顔→sparkle、驚き→excitement、頷き→wave、縦揺れ→bounce
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#000'
  },
  hiddenVideo: {
    position: 'absolute',
    top: '-9999px',
    left: '-9999px',
    width: '640px',
    height: '480px'
  },
  videoArea: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1
  },
  playerWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
    maxWidth: '1280px',
    maxHeight: '720px',
    zIndex: 2
  },
  player: {
    width: '100%',
    height: '100%'
  },
  statusBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 30px',
    backgroundColor: '#1a1a1a',
    borderTop: '1px solid #333',
    color: 'white',
    flexWrap: 'wrap',
    gap: '15px'
  },
  statusLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  statusCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  statusLabel: {
    fontSize: '14px',
    color: '#999'
  },
  statusValue: {
    fontSize: '14px',
    fontWeight: '500'
  },
  debugToggle: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: '#333',
    color: 'white',
    border: '1px solid #555',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  errorBanner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    color: 'white',
    padding: '20px 40px',
    borderRadius: '8px',
    fontSize: '16px',
    zIndex: 1000,
    textAlign: 'center'
  },
  debugInfo: {
    padding: '10px 30px',
    backgroundColor: '#2a2a2a',
    borderTop: '1px solid #444'
  },
  debugText: {
    fontSize: '12px',
    color: '#888',
    margin: '5px 0'
  }
};

export default ViewingScreen;