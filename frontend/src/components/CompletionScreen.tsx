import React from 'react';

interface CompletionScreenProps {
  completionCode: string;
  surveyUrl?: string;
  onBackToInitial: () => void;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({
  completionCode,
  surveyUrl = 'https://forms.google.com/',
  onBackToInitial
}) => {
  const handleOpenSurvey = () => {
    // 別タブでアンケートを開く（完了コードを確認できるように）
    window.open(surveyUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(completionCode);
    alert('完了コードをコピーしました！');
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.checkmark}>✅</div>
        <h1 style={styles.title}>視聴完了しました！</h1>
        <p style={styles.subtitle}>
          ご協力ありがとうございました
        </p>

        {/* 完了コード表示 */}
        <div style={styles.codeContainer}>
          <p style={styles.codeLabel}>完了コード:</p>
          <div style={styles.codeBox}>
            <span style={styles.code}>{completionCode}</span>
            <button
              onClick={handleCopyCode}
              style={styles.copyButton}
              title="コピー"
            >
              📋
            </button>
          </div>
          <p style={styles.codeNote}>
            ※ このコードをアンケートに入力してください
          </p>
        </div>

        {/* アンケートボタン */}
        <div style={styles.buttonContainer}>
          <button
            onClick={handleOpenSurvey}
            style={styles.surveyButton}
          >
            📝 アンケートに進む（別タブで開く）
          </button>
        </div>

        {/* 説明 */}
        <div style={styles.instructionContainer}>
          <p style={styles.instructionTitle}>📌 次の手順:</p>
          <ol style={styles.instructionList}>
            <li>上記の「アンケートに進む」ボタンをクリック</li>
            <li>別タブでアンケートが開きます</li>
            <li>アンケートに<strong>完了コード</strong>を入力してください</li>
            <li>その他の質問に回答して送信</li>
          </ol>
        </div>

        {/* 戻るボタン */}
        <button
          onClick={onBackToInitial}
          style={styles.backButton}
        >
          ← 初期画面に戻る
        </button>
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
    padding: '20px'
  },
  content: {
    width: '100%',
    maxWidth: '600px',
    textAlign: 'center'
  },
  checkmark: {
    fontSize: '80px',
    marginBottom: '20px',
    animation: 'bounce 1s ease'
  },
  title: {
    fontSize: '36px',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#4CAF50'
  },
  subtitle: {
    fontSize: '18px',
    color: '#ccc',
    marginBottom: '40px'
  },
  codeContainer: {
    marginBottom: '40px',
    padding: '30px',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: '12px',
    border: '2px solid #4CAF50'
  },
  codeLabel: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#4CAF50'
  },
  codeBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    marginBottom: '15px'
  },
  code: {
    fontSize: '48px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: '8px',
    color: '#4CAF50',
    padding: '15px 30px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px'
  },
  copyButton: {
    fontSize: '24px',
    padding: '10px 15px',
    backgroundColor: 'transparent',
    border: '2px solid #4CAF50',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    color: 'white'
  },
  codeNote: {
    fontSize: '14px',
    color: '#aaa',
    fontStyle: 'italic'
  },
  buttonContainer: {
    marginBottom: '40px'
  },
  surveyButton: {
    padding: '16px 32px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 4px 8px rgba(33, 150, 243, 0.4)',
    width: '100%',
    maxWidth: '400px'
  },
  instructionContainer: {
    marginBottom: '40px',
    padding: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    textAlign: 'left'
  },
  instructionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#2196F3'
  },
  instructionList: {
    margin: 0,
    paddingLeft: '25px',
    lineHeight: '2',
    fontSize: '16px'
  },
  backButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#999',
    backgroundColor: 'transparent',
    border: '2px solid #666',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s'
  }
};

export default CompletionScreen;
