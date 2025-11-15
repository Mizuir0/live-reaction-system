import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactionData } from '../types/reactions';

interface UseWebSocketReturn {
  isConnected: boolean;
  error: string | null;
  sendReactionData: (data: Omit<ReactionData, 'userId' | 'timestamp'>) => void;
  lastResponse: any;
}

/**
 * WebSocket接続を管理するカスタムフック
 */
export const useWebSocket = (userId: string): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef<number>(0);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3秒

  /**
   * WebSocket接続を確立
   */
  const connect = useCallback(() => {
    try {
      console.log('🔌 WebSocket接続を開始...');
      
      const ws = new WebSocket('ws://localhost:8001/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket接続成功');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;

        // 最初のメッセージでuserIdを送信
        ws.send(JSON.stringify({ userId }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📥 サーバーからのメッセージ:', data);
          setLastResponse(data);

          if (data.type === 'connection_established') {
            console.log('🎉 接続確立:', data.message);
          } else if (data.type === 'echo') {
            console.log('🔄 Echoレスポンス受信:', data.original);
          }
        } catch (err) {
          console.error('❌ メッセージのパースエラー:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ WebSocketエラー:', event);
        setError('WebSocket接続エラーが発生しました');
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket切断:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // 自動再接続（最大試行回数まで）
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          console.log(`🔄 再接続を試みます... (${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        } else {
          setError('WebSocket接続に失敗しました。サーバーが起動しているか確認してください。');
        }
      };

    } catch (err) {
      console.error('❌ WebSocket接続エラー:', err);
      setError('WebSocket接続に失敗しました');
    }
  }, [userId]);

  /**
   * リアクションデータを送信
   */
  const sendReactionData = useCallback((data: Omit<ReactionData, 'userId' | 'timestamp'>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocketが接続されていません');
      return;
    }

    const reactionData: ReactionData = {
      userId,
      timestamp: Date.now(),
      ...data
    };

    try {
      wsRef.current.send(JSON.stringify(reactionData));
      console.log('📤 リアクションデータ送信:', reactionData);
    } catch (err) {
      console.error('❌ データ送信エラー:', err);
    }
  }, [userId]);

  /**
   * 初回接続
   */
  useEffect(() => {
    connect();

    // クリーンアップ
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        console.log('🔌 WebSocket接続をクローズしました');
      }
    };
  }, [connect]);

  return {
    isConnected,
    error,
    sendReactionData,
    lastResponse
  };
};