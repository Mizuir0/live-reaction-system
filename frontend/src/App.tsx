import React, { useState, useEffect } from 'react';
import './App.css';
import InitialScreen from './components/InitialScreen';
import ViewingScreen from './components/ViewingScreen';
import { getUserId } from './utils/userIdManager';

type Screen = 'initial' | 'viewing';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('initial');
  const [videoId, setVideoId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    // アプリ起動時に userId を取得または生成
    const id = getUserId();
    setUserId(id);
    console.log('アプリケーション起動 - User ID:', id);
  }, []);

  /**
   * 視聴開始ハンドラ
   */
  const handleStartViewing = (newVideoId: string) => {
    setVideoId(newVideoId);
    setCurrentScreen('viewing');
    console.log('視聴画面に遷移 - Video ID:', newVideoId);
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
      {currentScreen === 'initial' ? (
        <InitialScreen onStartViewing={handleStartViewing} />
      ) : (
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