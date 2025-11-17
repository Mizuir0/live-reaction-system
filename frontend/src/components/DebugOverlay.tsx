import React, { useEffect, useRef } from 'react';
import type { MediaPipeResult } from '../hooks/useMediaPipe';
import type { ReactionStates, ReactionEvents, DetectionDebugInfo, EffectInstruction } from '../types/reactions';

interface DebugOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  detectionResult: MediaPipeResult;
  states: ReactionStates;
  events: ReactionEvents;
  debugInfo: DetectionDebugInfo;
  showLandmarks?: boolean; // ランドマーク表示のオン/オフ
  currentEffect?: EffectInstruction | null; // 現在のエフェクト
}

/**
 * デバッグ用オーバーレイコンポーネント
 * 顔のランドマークとリアクション検出結果を表示
 */
const DebugOverlay: React.FC<DebugOverlayProps> = ({
  videoRef,
  detectionResult,
  states,
  events,
  debugInfo,
  showLandmarks = false, // デフォルトは非表示
  currentEffect = null
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * ランドマークを描画
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas サイズをビデオに合わせる
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // showLandmarks が false の場合は描画しない
    if (!showLandmarks) return;

    // ランドマークの描画
    if (detectionResult && detectionResult.face && detectionResult.face.faceLandmarks && detectionResult.face.faceLandmarks.length > 0) {
      const landmarks = detectionResult.face.faceLandmarks[0];

      // ランドマークを点で描画
      ctx.fillStyle = '#00ff00';
      landmarks.forEach((landmark) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      });

      // 重要なポイントを強調（鼻の先端、口角など）
      ctx.fillStyle = '#ff0000';
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;

      // 鼻の先端（index 1）
      const noseTip = landmarks[1];
      const noseX = noseTip.x * canvas.width;
      const noseY = noseTip.y * canvas.height;
      ctx.beginPath();
      ctx.arc(noseX, noseY, 5, 0, 2 * Math.PI);
      ctx.fill();

      // 口角（左右）
      const mouthLeft = landmarks[61];
      const mouthRight = landmarks[291];
      const mouthLeftX = mouthLeft.x * canvas.width;
      const mouthLeftY = mouthLeft.y * canvas.height;
      const mouthRightX = mouthRight.x * canvas.width;
      const mouthRightY = mouthRight.y * canvas.height;

      ctx.beginPath();
      ctx.arc(mouthLeftX, mouthLeftY, 4, 0, 2 * Math.PI);
      ctx.arc(mouthRightX, mouthRightY, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [detectionResult, videoRef, showLandmarks]);

  return (
    <div style={styles.container}>
      {/* ランドマーク描画用 Canvas */}
      <canvas
        ref={canvasRef}
        style={styles.canvas}
      />

      {/* 検出情報パネル */}
      <div style={styles.infoPanel}>
        <h3 style={styles.panelTitle}>🔍 検出情報（デバッグ）</h3>
        
        {/* 基本情報 */}
        <div style={styles.section}>
          <div style={styles.infoRow}>
            <span style={styles.label}>顔検出:</span>
            <span style={{
              ...styles.value,
              color: debugInfo.faceDetected ? '#4caf50' : '#f44336'
            }}>
              {debugInfo.faceDetected ? '✅ 検出中' : '❌ 未検出'}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>ランドマーク数:</span>
            <span style={styles.value}>{debugInfo.landmarkCount}</span>
          </div>
        </div>

        {/* 現在のエフェクト */}
        {currentEffect && (
          <div style={{...styles.section, backgroundColor: 'rgba(76, 175, 80, 0.2)', padding: '10px', borderRadius: '5px'}}>
            <h4 style={styles.sectionTitle}>🎨 現在のエフェクト</h4>
            <div style={styles.infoRow}>
              <span style={styles.label}>エフェクト:</span>
              <span style={{...styles.value, color: '#4caf50', fontWeight: 'bold'}}>
                {currentEffect.effectType}
              </span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.label}>強度:</span>
              <span style={styles.value}>{(currentEffect.intensity * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* ステート型リアクション */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>ステート型</h4>
          <div style={styles.infoRow}>
            <span style={styles.label}>😊 笑顔:</span>
            <span style={{
              ...styles.value,
              color: states.isSmiling ? '#4caf50' : '#999',
              fontWeight: states.isSmiling ? 'bold' : 'normal'
            }}>
              {states.isSmiling ? 'TRUE' : 'false'}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>😲 驚き:</span>
            <span style={{
              ...styles.value,
              color: states.isSurprised ? '#4caf50' : '#999',
              fontWeight: states.isSurprised ? 'bold' : 'normal'
            }}>
              {states.isSurprised ? 'TRUE' : 'false'}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>🧐 集中:</span>
            <span style={{
              ...styles.value,
              color: states.isConcentrating ? '#4caf50' : '#999',
              fontWeight: states.isConcentrating ? 'bold' : 'normal'
            }}>
              {states.isConcentrating ? 'TRUE' : 'false'}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>🙌 手を上げる:</span>
            <span style={{
              ...styles.value,
              color: states.isHandUp ? '#4caf50' : '#999',
              fontWeight: states.isHandUp ? 'bold' : 'normal'
            }}>
              {states.isHandUp ? 'TRUE' : 'false'}
            </span>
          </div>
        </div>

        {/* イベント型リアクション */}
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>イベント型（1秒間）</h4>
          <div style={styles.infoRow}>
            <span style={styles.label}>👍 頷き:</span>
            <span style={{
              ...styles.value,
              color: events.nod > 0 ? '#4caf50' : '#999',
              fontWeight: events.nod > 0 ? 'bold' : 'normal'
            }}>
              {events.nod > 0 ? `${events.nod}回` : '0回'}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>↔️ 首を横に振る:</span>
            <span style={{
              ...styles.value,
              color: events.shakeHead > 0 ? '#4caf50' : '#999',
              fontWeight: events.shakeHead > 0 ? 'bold' : 'normal'
            }}>
              {events.shakeHead > 0 ? `${events.shakeHead}回` : '0回'}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>🎵 縦揺れ:</span>
            <span style={{
              ...styles.value,
              color: events.swayVertical > 0 ? '#4caf50' : '#999',
              fontWeight: events.swayVertical > 0 ? 'bold' : 'normal'
            }}>
              {events.swayVertical > 0 ? `${events.swayVertical}回` : '0回'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 100
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  infoPanel: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: 'white',
    padding: '15px',
    borderRadius: '8px',
    minWidth: '280px',
    maxWidth: '350px',
    fontSize: '13px',
    pointerEvents: 'auto'
  },
  panelTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    borderBottom: '2px solid #555',
    paddingBottom: '8px'
  },
  section: {
    marginBottom: '15px',
    paddingBottom: '10px',
    borderBottom: '1px solid #444'
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#ffa726'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px'
  },
  label: {
    color: '#bbb',
    fontSize: '13px'
  },
  value: {
    fontSize: '14px',
    fontWeight: '500'
  },
  debugValues: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '6px',
    paddingLeft: '10px'
  },
  debugLabel: {
    fontSize: '11px',
    color: '#888',
    fontFamily: 'monospace'
  }
};

export default DebugOverlay;