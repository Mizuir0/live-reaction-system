import React, { useEffect, useRef, useState } from 'react';
import YouTube from 'react-youtube';
import type { YouTubeProps } from 'react-youtube';

interface ViewingScreenProps {
  videoId: string;
  userId: string;
}

/**
 * 視聴画面コンポーネント
 * YouTube プレイヤー、Canvas エフェクト領域、ステータス表示を含む
 */
const ViewingScreen: React.FC<ViewingScreenProps> = ({ videoId, userId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReactionActive, setIsReactionActive] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

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
  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
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

  return (
    <div style={styles.container}>
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
            videoId={videoId}
            opts={opts}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            style={styles.player}
          />
        </div>
      </div>

      {/* ステータスバー */}
      <div style={styles.statusBar}>
        <div style={styles.statusLeft}>
          <span style={styles.statusLabel}>ユーザーID:</span>
          <span style={styles.statusValue}>{userId}</span>
        </div>
        
        <div style={styles.statusCenter}>
          <span style={styles.statusLabel}>プレイヤー:</span>
          <span style={{
            ...styles.statusValue,
            color: playerReady ? '#4caf50' : '#ff9800'
          }}>
            {playerReady ? '準備完了' : '読み込み中...'}
          </span>
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
        </div>
      </div>

      {/* デバッグ情報（開発用） */}
      <div style={styles.debugInfo}>
        <p style={styles.debugText}>
          <strong>Step 1 完了:</strong> YouTube埋め込み + Canvas配置
        </p>
        <p style={styles.debugText}>
          <strong>次のステップ:</strong> カメラ取得 + MediaPipe 実装
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
    pointerEvents: 'none', // Canvas はクリックを通過させる
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
    color: 'white'
  },
  statusLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  statusCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  statusRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  statusLabel: {
    fontSize: '14px',
    color: '#999'
  },
  statusValue: {
    fontSize: '14px',
    fontWeight: '500'
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