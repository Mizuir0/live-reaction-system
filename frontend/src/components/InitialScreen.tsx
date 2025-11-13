import React, { useState } from 'react';

interface InitialScreenProps {
  onStartViewing: (videoId: string) => void;
}

/**
 * 初期画面コンポーネント
 * YouTube Live の URL を入力して視聴を開始する
 */
const InitialScreen: React.FC<InitialScreenProps> = ({ onStartViewing }) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [error, setError] = useState('');

  /**
   * YouTube URL から動画IDを抽出する
   */
  const extractVideoId = (url: string): string | null => {
    // 様々なYouTube URLフォーマットに対応
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // URLではなく直接IDが入力された場合
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
      return url.trim();
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const videoId = extractVideoId(youtubeUrl);

    if (!videoId) {
      setError('有効なYouTube URLまたは動画IDを入力してください');
      return;
    }

    onStartViewing(videoId);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>オンラインライブ視聴システム</h1>
        <p style={styles.description}>
          YouTube Live の URL を入力して視聴を開始してください
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="例: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            style={styles.input}
          />
          
          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.button}>
            視聴開始
          </button>
        </form>

        <div style={styles.hint}>
          <p><strong>ヒント:</strong></p>
          <ul style={styles.hintList}>
            <li>YouTube Live の URL を貼り付けてください</li>
            <li>通常の動画 URL でも動作します（テスト用）</li>
            <li>動画ID（11文字）を直接入力することもできます</li>
          </ul>
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
    backgroundColor: '#f5f5f5',
    padding: '20px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#333',
    textAlign: 'center'
  },
  description: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '30px',
    textAlign: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  input: {
    padding: '12px',
    fontSize: '16px',
    border: '2px solid #ddd',
    borderRadius: '4px',
    outline: 'none',
    transition: 'border-color 0.3s'
  },
  button: {
    padding: '12px 24px',
    fontSize: '18px',
    fontWeight: 'bold',
    backgroundColor: '#ff0000',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  error: {
    color: '#ff0000',
    fontSize: '14px',
    margin: '0'
  },
  hint: {
    marginTop: '30px',
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#666'
  },
  hintList: {
    margin: '10px 0 0 20px',
    paddingLeft: '0'
  }
};

export default InitialScreen;