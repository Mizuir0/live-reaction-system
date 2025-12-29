import { useState, useRef, useEffect, useCallback } from 'react';

interface AudioEvents {
  cheer: number;  // 歓声（音量が閾値を超えた回数）
  clap: number;   // 手拍子（急な音量変化の回数）
}

interface AudioDebugInfo {
  volume: number;           // 現在の音量（0-1）
  volumeThreshold: number;  // 歓声の閾値
  isActive: boolean;        // マイク有効/無効
  error: string | null;     // エラーメッセージ
  hasMicrophone: boolean;   // マイク許可状態
}

interface UseAudioDetectionReturn {
  events: AudioEvents;
  debugInfo: AudioDebugInfo;
  resetEvents: () => void;
  startAudio: () => Promise<void>;
  stopAudio: () => void;
  hasMicrophone: boolean;   // マイク許可状態
}

/**
 * Web Audio APIを使った音声リアクション検出フック
 */
export const useAudioDetection = (): UseAudioDetectionReturn => {
  const [events, setEvents] = useState<AudioEvents>({
    cheer: 0,
    clap: 0
  });

  const [debugInfo, setDebugInfo] = useState<AudioDebugInfo>({
    volume: 0,
    volumeThreshold: 0.2,
    isActive: false,
    error: null,
    hasMicrophone: false
  });

  // Web Audio API関連のref
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 検出用のstate管理
  const prevVolumeRef = useRef<number>(0);
  const lastCheerTimeRef = useRef<number>(0);
  const lastClapTimeRef = useRef<number>(0);
  const volumeHistoryRef = useRef<number[]>([]);
  const highVolumeStartTimeRef = useRef<number | null>(null); // 高音量開始時刻（歓声用）

  /**
   * 音量を計算（0-1の範囲）
   */
  const calculateVolume = (dataArray: Uint8Array): number => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    return average / 255; // 0-1の範囲に正規化
  };

  /**
   * 歓声検出（音量が1秒間持続的に閾値を超える）
   */
  const detectCheer = (volume: number, currentTime: number): void => {
    const VOLUME_THRESHOLD = 0.2; // 音量閾値（20%）
    const SUSTAINED_DURATION_MS = 500; // 0.5秒間持続
    const COOLDOWN_MS = 1000; // 1秒のクールダウン

    if (volume > VOLUME_THRESHOLD) {
      // 高音量が開始したタイミングを記録
      if (highVolumeStartTimeRef.current === null) {
        highVolumeStartTimeRef.current = currentTime;
      }

      // 高音量が1秒間持続しているかチェック
      const highVolumeDuration = currentTime - highVolumeStartTimeRef.current;

      if (highVolumeDuration >= SUSTAINED_DURATION_MS) {
        const timeSinceLastCheer = currentTime - lastCheerTimeRef.current;

        if (timeSinceLastCheer > COOLDOWN_MS) {
          setEvents(prev => ({ ...prev, cheer: prev.cheer + 1 }));
          lastCheerTimeRef.current = currentTime;
          console.log('🎉 歓声検出！ volume:', volume.toFixed(3), 'duration:', (highVolumeDuration / 1000).toFixed(1), 's');
        }

        // 検出後はリセット
        highVolumeStartTimeRef.current = null;
      }
    } else {
      // 音量が閾値を下回ったらリセット
      highVolumeStartTimeRef.current = null;
    }
  };

  /**
   * 手拍子検出（急な音量変化）- 生データを使用
   */
  const detectClap = (rawVolume: number, currentTime: number): void => {
    const VOLUME_SPIKE_THRESHOLD = 0.05; // 急激な変化の閾値
    const MIN_VOLUME = 0.10; // 最低音量（10%、ノイズ除去）
    const COOLDOWN_MS = 200; // 0.2秒のクールダウン

    // 音量の変化量を計算
    const volumeDelta = rawVolume - prevVolumeRef.current;

    // デバッグログ（常に出力して確認）
    if (volumeDelta > 0.03) {
      console.log('📊 音量変化検出 - delta:', volumeDelta.toFixed(3), 'rawVolume:', rawVolume.toFixed(3), 'prev:', prevVolumeRef.current.toFixed(3));
    }

    // 急激な音量上昇を検出（かつ、一定以上の音量）
    if (volumeDelta > VOLUME_SPIKE_THRESHOLD && rawVolume > MIN_VOLUME) {
      const timeSinceLastClap = currentTime - lastClapTimeRef.current;

      if (timeSinceLastClap > COOLDOWN_MS) {
        setEvents(prev => ({ ...prev, clap: prev.clap + 1 }));
        lastClapTimeRef.current = currentTime;
        console.log('👏👏👏 手拍子検出！ delta:', volumeDelta.toFixed(3), 'volume:', rawVolume.toFixed(3));
      } else {
        console.log('⏸️ 手拍子クールダウン中 (残り:', (COOLDOWN_MS - timeSinceLastClap).toFixed(0), 'ms)');
      }
    }

    prevVolumeRef.current = rawVolume;
  };

  /**
   * 音声解析ループ
   */
  const analyzeAudio = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // 周波数データを取得
    analyser.getByteFrequencyData(dataArray);

    // 生の音量を計算
    const rawVolume = calculateVolume(dataArray);

    // 音量履歴を保持（最新10フレーム）
    volumeHistoryRef.current.push(rawVolume);
    if (volumeHistoryRef.current.length > 10) {
      volumeHistoryRef.current.shift();
    }

    // 移動平均を計算してノイズを軽減（歓声検出用）
    const avgVolume = volumeHistoryRef.current.reduce((a, b) => a + b, 0) / volumeHistoryRef.current.length;

    // デバッグ情報を更新
    setDebugInfo(prev => ({
      ...prev,
      volume: avgVolume
    }));

    const currentTime = performance.now();

    // 歓声検出（移動平均を使用 - 持続的な音量）
    detectCheer(avgVolume, currentTime);

    // 手拍子検出（生データを使用 - 瞬間的なスパイク）
    detectClap(rawVolume, currentTime);

    // 次のフレームをリクエスト
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  /**
   * マイクを開始
   */
  const startAudio = useCallback(async () => {
    try {
      console.log('🎤 マイクアクセスを要求中...');

      // マイクへのアクセスを要求
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false // 音量の自動調整をオフ
        }
      });

      streamRef.current = stream;

      // AudioContextを作成
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // AnalyserNodeを作成
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // FFTサイズ
      analyser.smoothingTimeConstant = 0.8; // スムージング
      analyserRef.current = analyser;

      // マイク入力をAnalyserに接続
      const microphone = audioContext.createMediaStreamSource(stream);
      microphoneRef.current = microphone;
      microphone.connect(analyser);

      setDebugInfo(prev => ({
        ...prev,
        isActive: true,
        error: null,
        hasMicrophone: true
      }));

      console.log('✅ マイク開始成功');

      // 解析ループを開始
      analyzeAudio();

    } catch (error) {
      console.error('❌ マイクアクセスエラー:', error);
      setDebugInfo(prev => ({
        ...prev,
        isActive: false,
        error: error instanceof Error ? error.message : 'マイクアクセスに失敗しました',
        hasMicrophone: false
      }));
    }
  }, [analyzeAudio]);

  /**
   * マイクを停止
   */
  const stopAudio = useCallback(() => {
    // アニメーションフレームを停止
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // マイクストリームを停止
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // AudioContextをクローズ
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    microphoneRef.current = null;
    analyserRef.current = null;

    setDebugInfo(prev => ({
      ...prev,
      isActive: false,
      volume: 0
    }));

    console.log('🎤 マイク停止');
  }, []);

  /**
   * イベントカウンターをリセット（1秒ごとに呼ばれる）
   */
  const resetEvents = useCallback(() => {
    setEvents({
      cheer: 0,
      clap: 0
    });
  }, []);

  /**
   * クリーンアップ
   */
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  return {
    events,
    debugInfo,
    resetEvents,
    startAudio,
    stopAudio,
    hasMicrophone: debugInfo.hasMicrophone
  };
};
