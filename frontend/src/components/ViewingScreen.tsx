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
// 実験グループタイプ（debugは開発用）
export type ExperimentGroup = 'experiment' | 'control1' | 'control2' | 'debug';

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
  const playerRef = useRef<any>(null); // YouTubeプレーヤーのref
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); // 動画再生状態
  const [showDebug, setShowDebug] = useState(false); // デフォルトは非表示
  const [showLandmarks, setShowLandmarks] = useState(false); // ランドマーク表示
  const detectionIntervalRef = useRef<number | null>(null);
  const sendIntervalRef = useRef<number | null>(null);
  const [sessionId] = useState<string>(() => {
    // セッションID生成: userId_timestamp
    return `${userId}_${Date.now()}`;
  });
  const sessionCreatedRef = useRef(false); // セッション作成済みフラグ

  // URLからグループとホスト判定を取得
  const getExperimentGroup = (): ExperimentGroup => {
    const urlParams = new URLSearchParams(window.location.search);
    const group = urlParams.get('group');
    if (group === 'experiment' || group === 'control1' || group === 'control2' || group === 'debug') {
      return group;
    }
    return 'control2'; // デフォルトはエフェクトなし
  };

  const getIsHost = (): boolean => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('host') === 'true';
  };

  const experimentGroup = getExperimentGroup();
  const isHost = getIsHost();
  const isDebugMode = experimentGroup === 'debug';

  // experiment群かつ参加者モードの場合、動画コントロールを非表示
  const shouldHideControls = experimentGroup === 'experiment' && !isHost;
  
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
  const {
    isConnected: wsConnected,
    error: wsError,
    sendReactionData,
    sendVideoEvent,
    sendTimeSyncRequest,
    sendTimeSyncResponse,
    sendSessionCreate,
    sendSessionCompleted,
    sendManualEffect,
    currentEffect,
    videoSyncEvent,
    connectionCount,
    timeSyncRequest,
    timeSyncResponse
  } = useWebSocket(userId, experimentGroup, isHost);

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
      // 動画再生中のみデータを送信
      if (!isPlaying) {
        console.log('⏸️ 動画停止中のため送信スキップ');
        return;
      }

      // refから最新の値を取得
      const currentStates = statesRef.current;
      const currentEvents = eventsRef.current;

      // 動画の現在時刻を取得
      const videoTime = playerRef.current?.getCurrentTime() ?? 0;

      sendReactionData({
        states: currentStates,
        events: currentEvents,
        videoTime: videoTime,
        sessionId: sessionId
      });
    }, 1000); // 1秒ごと

    sendIntervalRef.current = sendInterval;

    return () => {
      if (sendIntervalRef.current) {
        clearInterval(sendIntervalRef.current);
        console.log('📡 リアクションデータ送信ループを停止');
      }
    };
  }, [wsConnected, sendReactionData, isPlaying]); // isPlayingも依存配列に追加

  useEffect(() => {
    // Canvas の初期化（後のステップで描画処理を追加）
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initializeCanvas = () => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Canvas サイズを親要素に合わせる（最小サイズを保証）
        const width = canvas.offsetWidth || 1280;
        const height = canvas.offsetHeight || 720;
        canvas.width = width;
        canvas.height = height;

        console.log('Canvas initialized:', canvas.width, 'x', canvas.height);
      }
    };

    // DOM レイアウト完了後に初期化
    requestAnimationFrame(() => {
      requestAnimationFrame(initializeCanvas);
    });

    // ウィンドウリサイズ時の対応
    const handleResize = () => {
      if (canvas) {
        const width = canvas.offsetWidth || 1280;
        const height = canvas.offsetHeight || 720;
        canvas.width = width;
        canvas.height = height;
        console.log('Canvas resized:', canvas.width, 'x', canvas.height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * YouTube プレイヤーの準備完了時の処理
   */
  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    console.log('YouTube Player Ready');
    playerRef.current = event.target;
    setPlayerReady(true);
  };

  /**
   * YouTube プレイヤーの再生状態変更時の処理
   */
  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    console.log('Player State Changed:', event.data);
    // -1: 未開始, 0: 終了, 1: 再生中, 2: 一時停止, 3: バッファリング中, 5: 頭出し済み

    // 再生状態を更新
    setIsPlaying(event.data === 1);

    // セッション作成（初回再生時のみ）
    if (event.data === 1 && !sessionCreatedRef.current && videoId) {
      sendSessionCreate(sessionId, videoId);
      sessionCreatedRef.current = true;
    }

    // セッション完了（動画終了時）
    if (event.data === 0) {
      console.log('動画が終了しました');
      sendSessionCompleted(sessionId);
    }

    // experiment群のホストの場合、再生/一時停止をWebSocketで同期
    if (experimentGroup === 'experiment' && isHost && playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();

      if (event.data === 1) {
        // 再生開始
        sendVideoEvent('video_play', currentTime);
      } else if (event.data === 2) {
        // 一時停止
        sendVideoEvent('video_pause', currentTime);
      }
    }
  };

  /**
   * 動画シーク時の処理（experiment群のホストのみ）
   */
  const lastSeekTimeRef = useRef<number>(0);
  useEffect(() => {
    if (experimentGroup !== 'experiment' || !isHost || !playerRef.current) {
      return;
    }

    const checkSeek = setInterval(() => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        const diff = Math.abs(currentTime - lastSeekTimeRef.current);

        // 1秒以上のジャンプがあった場合はシークと判定
        if (diff > 1) {
          sendVideoEvent('video_seek', currentTime);
          lastSeekTimeRef.current = currentTime;
        } else {
          lastSeekTimeRef.current = currentTime;
        }
      }
    }, 500); // 0.5秒ごとにチェック

    return () => clearInterval(checkSeek);
  }, [experimentGroup, isHost, sendVideoEvent]);

  /**
   * 動画同期イベントを受信した時の処理（experiment群の参加者のみ）
   */
  useEffect(() => {
    if (experimentGroup !== 'experiment' || isHost || !videoSyncEvent || !playerRef.current) {
      return;
    }

    console.log('🎬 動画同期イベント適用:', videoSyncEvent.type, 'time:', videoSyncEvent.currentTime);

    const player = playerRef.current;

    if (videoSyncEvent.type === 'video_play') {
      player.playVideo();
      player.seekTo(videoSyncEvent.currentTime, true);
    } else if (videoSyncEvent.type === 'video_pause') {
      player.pauseVideo();
      player.seekTo(videoSyncEvent.currentTime, true);
    } else if (videoSyncEvent.type === 'video_seek') {
      player.seekTo(videoSyncEvent.currentTime, true);
    }
  }, [videoSyncEvent, experimentGroup, isHost]);

  /**
   * 時刻同期リクエスト処理（ホスト側）
   * 被験者から時刻問い合わせがあったら現在の動画時刻を返す
   */
  useEffect(() => {
    if (!timeSyncRequest || !isHost || !playerRef.current) {
      return;
    }

    const currentTime = playerRef.current.getCurrentTime();
    console.log(`⏱️ 時刻同期リクエストに応答: ${currentTime.toFixed(2)}s → ${timeSyncRequest.requesterId}`);
    sendTimeSyncResponse(timeSyncRequest.requesterId, currentTime);
  }, [timeSyncRequest, isHost, sendTimeSyncResponse]);

  /**
   * 定期的な時刻同期リクエスト（被験者側）
   * 5秒ごとにホストに現在時刻を問い合わせる
   */
  useEffect(() => {
    if (experimentGroup !== 'experiment' || isHost || !wsConnected || !playerReady) {
      return;
    }

    console.log('⏱️ 定期的な時刻同期を開始');
    const syncInterval = setInterval(() => {
      sendTimeSyncRequest();
    }, 5000); // 5秒ごと

    return () => clearInterval(syncInterval);
  }, [experimentGroup, isHost, wsConnected, playerReady, sendTimeSyncRequest]);

  /**
   * 時刻同期レスポンス処理（被験者側）
   * ホストからの時刻を受け取り、ズレがあれば補正
   */
  useEffect(() => {
    if (!timeSyncResponse || isHost || !playerRef.current) {
      return;
    }

    const hostTime = timeSyncResponse.currentTime;
    const myTime = playerRef.current.getCurrentTime();
    const timeDiff = Math.abs(hostTime - myTime);

    console.log(`⏱️ 時刻同期チェック: ホスト=${hostTime.toFixed(2)}s, 自分=${myTime.toFixed(2)}s, 差分=${timeDiff.toFixed(2)}s`);

    // 1秒以上のズレがあれば補正
    if (timeDiff > 1.0) {
      console.log(`🔧 時刻補正実行: ${myTime.toFixed(2)}s → ${hostTime.toFixed(2)}s`);
      playerRef.current.seekTo(hostTime, true);
    }
  }, [timeSyncResponse, isHost]);

  /**
   * YouTube プレイヤーのオプション
   */
  const opts: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: shouldHideControls ? 0 : 1, // experiment群の参加者は非表示
      modestbranding: 1,
      rel: 0,
      disablekb: shouldHideControls ? 1 : 0 // experiment群の参加者はキーボード操作も無効化
    },
  };

  // リアクション検出が有効かどうか
  const isReactionActive = cameraReady && mediaPipeReady && wsConnected;

  // システムの準備状態を判定
  const isSystemReady = wsConnected && cameraReady && mediaPipeReady;

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

        {/* 接続待機オーバーレイ */}
        {!isSystemReady && (
          <div style={styles.loadingOverlay}>
            <div style={styles.loadingContent}>
              <div style={styles.spinner}></div>
              <h2 style={styles.loadingTitle}>システム起動中...</h2>
              <p style={styles.loadingText}>
                サーバーに接続しています。初回アクセス時は1分程度かかる場合があります。
              </p>
              <div style={styles.statusList}>
                <div style={styles.statusItem}>
                  <span style={wsConnected ? styles.statusIconSuccess : styles.statusIconWaiting}>
                    {wsConnected ? '✓' : '○'}
                  </span>
                  <span style={styles.statusLabel}>
                    サーバー接続 {wsConnected ? '完了' : '接続中...'}
                  </span>
                </div>
                <div style={styles.statusItem}>
                  <span style={cameraReady ? styles.statusIconSuccess : styles.statusIconWaiting}>
                    {cameraReady ? '✓' : '○'}
                  </span>
                  <span style={styles.statusLabel}>
                    カメラ {cameraReady ? '準備完了' : '準備中...'}
                  </span>
                </div>
                <div style={styles.statusItem}>
                  <span style={mediaPipeReady ? styles.statusIconSuccess : styles.statusIconWaiting}>
                    {mediaPipeReady ? '✓' : '○'}
                  </span>
                  <span style={styles.statusLabel}>
                    AI検出システム {mediaPipeReady ? '準備完了' : '読み込み中...'}
                  </span>
                </div>
              </div>
              {wsError && (
                <div style={styles.errorMessage}>
                  ⚠️ エラー: {wsError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* YouTube プレイヤー */}
        <div style={{...styles.playerWrapper, pointerEvents: isSystemReady ? 'auto' : 'none', opacity: isSystemReady ? 1 : 0.3}}>
          <YouTube
            videoId={videoId ?? ''}
            opts={opts as YouTubeProps['opts']}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            style={styles.player}
          />
          {/* experiment群のホストモード表示 */}
          {experimentGroup === 'experiment' && isHost && isSystemReady && (
            <div style={styles.hostBadge}>
              <span style={styles.hostText}>
                🎛️ ホストモード | 全員の動画を操作中
                {connectionCount && (
                  <span style={styles.connectionCountText}>
                    {' '}| 👥 {connectionCount.count}人接続中
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* デバッグオーバーレイ（debugモードのみ） */}
        {isDebugMode && showDebug && (
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

      {/* ステータスバー（debugモードのみ詳細表示） */}
      {isDebugMode ? (
        <div style={styles.statusBar}>
          <div style={styles.statusLeft}>
            <span style={styles.statusLabel}>グループ:</span>
            <span style={{
              ...styles.statusValue,
              color: '#9c27b0',
              fontWeight: 'bold'
            }}>
              DEBUG
            </span>
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
      ) : null}

      {/* エラー表示（debugモードのみ） */}
      {isDebugMode && cameraError && (
        <div style={styles.errorBanner}>
          ⚠️ カメラ: {cameraError}
        </div>
      )}
      {isDebugMode && wsError && !wsConnected && (
        <div style={{...styles.errorBanner, top: '55%'}}>
          ⚠️ WebSocket: {wsError}
        </div>
      )}

      {/* デバッグ情報（debugモードのみ） */}
      {isDebugMode && (
        <div style={styles.debugInfo}>
          <p style={styles.debugText}>
            <strong>接続状態:</strong> {wsConnected ? '✅ 接続中' : '❌ 未接続'}
            {currentEffect && ` | 🎨 エフェクト: ${currentEffect.effectType} (intensity: ${currentEffect.intensity.toFixed(2)})`}
          </p>
        </div>
      )}

      {/* 手動エフェクトボタン（debugモードのみ） */}
      {isDebugMode && (
        <div style={styles.effectButtons}>
          <h3 style={styles.effectButtonsTitle}>🎨 手動エフェクト発動</h3>
          <div style={styles.effectButtonsGrid}>
            <button
              onClick={() => sendManualEffect('sparkle', 1.0, 2000, sessionId, playerRef.current?.getCurrentTime())}
              style={styles.effectButton}
            >
              ✨ Sparkle
            </button>
            <button
              onClick={() => sendManualEffect('wave', 1.0, 2000, sessionId, playerRef.current?.getCurrentTime())}
              style={styles.effectButton}
            >
              🌊 Wave
            </button>
            <button
              onClick={() => sendManualEffect('clapping_icons', 1.0, 2000, sessionId, playerRef.current?.getCurrentTime())}
              style={styles.effectButton}
            >
              👏 Clapping
            </button>
            <button
              onClick={() => sendManualEffect('excitement', 1.0, 2000, sessionId, playerRef.current?.getCurrentTime())}
              style={styles.effectButton}
            >
              🎉 Excitement
            </button>
            <button
              onClick={() => sendManualEffect('bounce', 1.0, 2000, sessionId, playerRef.current?.getCurrentTime())}
              style={styles.effectButton}
            >
              ⬆️ Bounce
            </button>
            <button
              onClick={() => sendManualEffect('cheer', 1.0, 2000, sessionId, playerRef.current?.getCurrentTime())}
              style={styles.effectButton}
            >
              🎊 Cheer
            </button>
            <button
              onClick={() => sendManualEffect('shimmer', 1.0, 2000, sessionId, playerRef.current?.getCurrentTime())}
              style={styles.effectButton}
            >
              💫 Shimmer
            </button>
            <button
              onClick={() => sendManualEffect('focus', 1.0, 2000, sessionId, playerRef.current?.getCurrentTime())}
              style={styles.effectButton}
            >
              🎯 Focus
            </button>
            <button
              onClick={() => sendManualEffect('groove', 1.0, 2000, sessionId, playerRef.current?.getCurrentTime())}
              style={styles.effectButton}
            >
              💃 Groove
            </button>
          </div>
        </div>
      )}
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
  },
  effectButtons: {
    padding: '20px 30px',
    backgroundColor: '#1a1a1a',
    borderTop: '1px solid #444'
  },
  effectButtonsTitle: {
    fontSize: '16px',
    color: '#fff',
    marginBottom: '15px',
    fontWeight: 'bold'
  },
  effectButtonsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '10px'
  },
  effectButton: {
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  loadingContent: {
    textAlign: 'center',
    color: 'white',
    maxWidth: '500px',
    padding: '40px'
  },
  spinner: {
    width: '60px',
    height: '60px',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    borderTop: '4px solid white',
    borderRadius: '50%',
    margin: '0 auto 30px',
    animation: 'spin 1s linear infinite'
  },
  loadingTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '15px'
  },
  loadingText: {
    fontSize: '16px',
    color: '#ccc',
    marginBottom: '30px',
    lineHeight: '1.5'
  },
  statusList: {
    textAlign: 'left',
    maxWidth: '350px',
    margin: '0 auto'
  },
  statusIconSuccess: {
    display: 'inline-block',
    width: '24px',
    height: '24px',
    backgroundColor: '#4caf50',
    borderRadius: '50%',
    textAlign: 'center',
    lineHeight: '24px',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  statusIconWaiting: {
    display: 'inline-block',
    width: '24px',
    height: '24px',
    backgroundColor: '#666',
    borderRadius: '50%',
    textAlign: 'center',
    lineHeight: '24px',
    fontSize: '16px',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  errorMessage: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    border: '1px solid #f44336',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#ff6b6b'
  },
  participantBadge: {
    position: 'absolute',
    top: '15px',
    right: '15px',
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    padding: '10px 20px',
    borderRadius: '8px',
    zIndex: 100,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
  },
  participantText: {
    color: 'white',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  hostBadge: {
    position: 'absolute',
    top: '15px',
    right: '15px',
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    padding: '10px 20px',
    borderRadius: '8px',
    zIndex: 100,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
  },
  hostText: {
    color: 'white',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  connectionCountText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '14px',
    fontWeight: 'normal'
  }
};

export default ViewingScreen;