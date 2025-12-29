import React, { useState, useEffect } from 'react';
import './App.css';
import InitialScreen from './components/InitialScreen';
import CameraCheckScreen from './components/CameraCheckScreen';
import ViewingScreen from './components/ViewingScreen';
import { getUserId } from './utils/userIdManager';
import { useWebSocket } from './hooks/useWebSockets';

type Screen = 'initial' | 'waiting' | 'camera_check' | 'viewing';
type ExperimentGroup = 'experiment' | 'control1' | 'control2' | 'debug';

// URLパラメータを取得する関数
const getUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const group = urlParams.get('group');
  const host = urlParams.get('host') === 'true';

  let experimentGroup: ExperimentGroup = 'control2';
  if (group === 'experiment' || group === 'control1' || group === 'control2' || group === 'debug') {
    experimentGroup = group;
  }

  return { experimentGroup, isHost: host };
};

function App() {
  // URLパラメータを初期値として読み込む
  const { experimentGroup: initialGroup, isHost: initialIsHost } = getUrlParams();

  const [currentScreen, setCurrentScreen] = useState<Screen>('initial');
  const [videoId, setVideoId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [experimentGroup] = useState<ExperimentGroup>(initialGroup);
  const [isHost] = useState<boolean>(initialIsHost);
  const [isReady, setIsReady] = useState<boolean>(false); // 準備完了フラグ

  console.log(`実験グループ: ${experimentGroup}, ホスト: ${isHost}`);

  useEffect(() => {
    // アプリ起動時に userId を取得または生成
    const id = getUserId();
    setUserId(id);
    console.log('アプリケーション起動 - User ID:', id);
  }, []);

  // WebSocket接続（experiment群の参加者のみ初期接続が必要）
  const { sendVideoUrlSelected, videoUrlSelectedEvent } = useWebSocket(
    userId,
    experimentGroup,
    isHost
  );

  // experiment群の参加者：ホストからの動画URL選択イベントを監視
  useEffect(() => {
    if (experimentGroup === 'experiment' && !isHost && videoUrlSelectedEvent) {
      console.log('📺 ホストが選択した動画を受信:', videoUrlSelectedEvent.videoId);
      setVideoId(videoUrlSelectedEvent.videoId);

      // 準備完了している場合のみ画面遷移
      if (isReady) {
        console.log('✅ 準備完了済み - 視聴画面に遷移');
        setCurrentScreen('viewing');
      } else {
        console.log('⏳ 準備未完了 - 待機画面を維持');
      }
    }
  }, [videoUrlSelectedEvent, experimentGroup, isHost, isReady]);

  // 準備完了後にvideoIdが設定されている場合は画面遷移
  useEffect(() => {
    if (experimentGroup === 'experiment' && !isHost && isReady && videoId && currentScreen === 'waiting') {
      console.log('✅ 準備完了 - 視聴画面に遷移');
      setCurrentScreen('viewing');
    }
  }, [isReady, videoId, currentScreen, experimentGroup, isHost]);

  // experiment群の参加者：初期画面を待機画面に設定
  useEffect(() => {
    if (experimentGroup === 'experiment' && !isHost && currentScreen === 'initial') {
      console.log('⏳ 待機画面に遷移');
      setCurrentScreen('waiting');
    }
  }, [experimentGroup, isHost]);

  /**
   * 視聴開始ハンドラ（動画選択後、カメラチェック画面へ）
   */
  const handleStartViewing = (newVideoId: string) => {
    setVideoId(newVideoId);
    setCurrentScreen('camera_check');
    console.log('カメラチェック画面に遷移 - Video ID:', newVideoId);

    // experiment群のホストの場合、動画URL選択をブロードキャスト
    if (experimentGroup === 'experiment' && isHost) {
      sendVideoUrlSelected(newVideoId);
      console.log('📺 動画URL選択をブロードキャスト:', newVideoId);
    }
  };

  /**
   * カメラチェック完了ハンドラ
   */
  const handleCameraReady = () => {
    setCurrentScreen('viewing');
    console.log('視聴画面に遷移');
  };

  /**
   * 初期画面に戻るハンドラ（デバッグ用）
   */
  const handleBackToInitial = () => {
    setCurrentScreen('initial');
    setVideoId('');
    console.log('初期画面に戻りました');
  };

  // userId が生成されるまで待機
  if (!userId) {
    return (
      <div style={styles.loading}>
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="App">
      {currentScreen === 'initial' && (
        <InitialScreen onStartViewing={handleStartViewing} />
      )}

      {currentScreen === 'waiting' && (
        <div style={styles.waitingScreen}>
          <div style={styles.waitingContent}>
            <div style={styles.spinner}></div>
            <h2 style={styles.waitingTitle}>ホストの準備を待っています...</h2>
            <p style={styles.waitingText}>
              ホストが動画を選択するまでお待ちください。
            </p>
            <div style={styles.readyButtonContainer}>
              <button
                onClick={() => {
                  if (!isReady) {
                    console.log('✅ 準備完了ボタンがクリックされました');
                    setIsReady(true);
                  }
                }}
                style={{
                  ...styles.readyButton,
                  ...(isReady ? styles.readyButtonClicked : {})
                }}
                disabled={isReady}
              >
                {isReady ? '✅ 準備完了しました' : '📺 準備完了（クリックしてください）'}
              </button>
              {!isReady && (
                <p style={styles.readyButtonNote}>
                  ※ ホストが動画を開始したときに自動再生するため、このボタンをクリックしてください
                </p>
              )}
              {isReady && videoId && (
                <p style={styles.readyButtonSuccess}>
                  ホストが動画を選択しました。まもなく視聴画面に移動します...
                </p>
              )}
              {isReady && !videoId && (
                <p style={styles.readyButtonSuccess}>
                  準備完了しました。ホストが動画を選択するまでお待ちください。
                </p>
              )}
            </div>
            <p style={styles.waitingSubText}>
              実験グループ: <strong>experiment</strong>
            </p>
          </div>
        </div>
      )}

      {currentScreen === 'camera_check' && (
        <CameraCheckScreen
          onReady={handleCameraReady}
          onBack={handleBackToInitial}
        />
      )}

      {currentScreen === 'viewing' && (
        <ViewingScreen videoId={videoId} userId={userId} />
      )}

      {/* デバッグ用：画面切り替えボタン（開発中のみ表示） */}
      {currentScreen === 'viewing' && (
        <button
          onClick={handleBackToInitial}
          style={styles.debugButton}
          title="初期画面に戻る（開発用）"
        >
          ← 戻る
        </button>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666'
  },
  waitingScreen: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#1a1a1a',
    color: 'white'
  },
  waitingContent: {
    textAlign: 'center',
    maxWidth: '600px',
    padding: '40px'
  },
  spinner: {
    margin: '0 auto 30px',
    width: '60px',
    height: '60px',
    border: '6px solid rgba(255, 255, 255, 0.1)',
    borderTop: '6px solid #4CAF50',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  waitingTitle: {
    fontSize: '28px',
    marginBottom: '20px',
    fontWeight: 'bold'
  },
  waitingText: {
    fontSize: '18px',
    color: '#ccc',
    marginBottom: '30px',
    lineHeight: '1.6'
  },
  waitingSubText: {
    fontSize: '14px',
    color: '#999',
    marginTop: '40px'
  },
  readyButtonContainer: {
    marginTop: '40px',
    marginBottom: '20px'
  },
  readyButton: {
    padding: '16px 32px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  readyButtonClicked: {
    backgroundColor: '#2196F3',
    cursor: 'not-allowed',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    opacity: 0.8
  },
  readyButtonNote: {
    fontSize: '14px',
    color: '#aaa',
    marginTop: '16px',
    lineHeight: '1.5'
  },
  readyButtonSuccess: {
    fontSize: '16px',
    color: '#4CAF50',
    marginTop: '16px',
    lineHeight: '1.5',
    fontWeight: 'bold'
  },
  debugButton: {
    position: 'fixed',
    top: '10px',
    left: '10px',
    padding: '8px 16px',
    backgroundColor: '#333',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    zIndex: 1000,
    opacity: 0.7,
    transition: 'opacity 0.3s'
  }
};

export default App;