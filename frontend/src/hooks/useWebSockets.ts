import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactionData, EffectInstruction } from '../types/reactions';

// 実験グループタイプ（debugは開発用）
type ExperimentGroup = 'experiment' | 'control1' | 'control2' | 'debug';

interface VideoSyncEvent {
  type: 'video_play' | 'video_pause' | 'video_seek';
  currentTime: number;
  timestamp: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  error: string | null;
  sendReactionData: (data: Omit<ReactionData, 'userId' | 'timestamp'>) => void;
  sendVideoEvent: (type: 'video_play' | 'video_pause' | 'video_seek', currentTime: number) => void;
  lastResponse: any;
  currentEffect: EffectInstruction | null;
  videoSyncEvent: VideoSyncEvent | null;
}

/**
 * WebSocket接続を管理するカスタムフック
 * @param userId ユーザーID
 * @param experimentGroup 実験グループ ('experiment' | 'control1' | 'control2')
 */
export const useWebSocket = (userId: string, experimentGroup: ExperimentGroup = 'control2'): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [currentEffect, setCurrentEffect] = useState<EffectInstruction | null>(null);
  const [videoSyncEvent, setVideoSyncEvent] = useState<VideoSyncEvent | null>(null);

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

      // 環境変数からWebSocket URLを取得（デフォルトはローカル）
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8001/ws';
      console.log(`🔗 接続先: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket接続成功');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;

        // 最初のメッセージでuserIdとexperimentGroupを送信
        ws.send(JSON.stringify({ userId, experimentGroup }));
        console.log(`📋 実験グループ: ${experimentGroup}`);
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
          } else if (data.type === 'effect') {
            // エフェクト指示を受信
            console.log('✨ エフェクト指示受信:', data.effectType, 'intensity:', data.intensity);
            setCurrentEffect(data as EffectInstruction);
          } else if (data.type === 'data_received') {
            // データ受信確認（デバッグ用）
            // console.log('✅ データ受信確認:', data.message);
          } else if (data.type === 'video_play' || data.type === 'video_pause' || data.type === 'video_seek') {
            // 動画同期イベントを受信
            console.log('🎬 動画同期イベント受信:', data.type, 'time:', data.currentTime);
            setVideoSyncEvent({
              type: data.type,
              currentTime: data.currentTime,
              timestamp: data.timestamp
            });
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
  }, [userId, experimentGroup]);

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
   * 動画同期イベントを送信（control2群のホスト用）
   */
  const sendVideoEvent = useCallback((type: 'video_play' | 'video_pause' | 'video_seek', currentTime: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ WebSocketが接続されていません');
      return;
    }

    const videoEvent = {
      type,
      currentTime,
      timestamp: Date.now()
    };

    try {
      wsRef.current.send(JSON.stringify(videoEvent));
      console.log('🎬 動画同期イベント送信:', videoEvent);
    } catch (err) {
      console.error('❌ 動画同期イベント送信エラー:', err);
    }
  }, []);

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
    sendVideoEvent,
    lastResponse,
    currentEffect,
    videoSyncEvent
  };
};