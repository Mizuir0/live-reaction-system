import { useEffect, useRef } from 'react';
import type { EffectInstruction } from '../types/reactions';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  life: number;
  maxLife: number;
}

interface UseEffectRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  currentEffect: EffectInstruction | null;
}

/**
 * Canvas エフェクト描画を管理するカスタムフック
 */
export const useEffectRenderer = ({ canvasRef, currentEffect }: UseEffectRendererProps) => {
  const animationFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const effectStartTimeRef = useRef<number>(0);
  const currentEffectRef = useRef<EffectInstruction | null>(null);
  const wavePhaseRef = useRef<number>(0);

  /**
   * Yellow Glow エフェクト (笑顔): 黄色い笑顔マーク型のパーティクルが輝く
   */
  const renderSparkle = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const time = performance.now() / 1000;

    // intensity に応じて笑顔マークの数を調整（5 ~ 20個）
    const smileCount = Math.floor(5 + intensity * 15);

    ctx.save();

    for (let i = 0; i < smileCount; i++) {
      // ランダムな位置（シード値で固定）
      const seed = i * 234.567;
      const x = (Math.sin(seed) * 0.5 + 0.5) * width;
      const y = ((Math.sin(seed * 1.234) * 0.5 + 0.5) * height * 0.7) + height * 0.15;

      // サイズと透明度をアニメーション
      const baseSize = 40 + intensity * 30;
      const pulse = Math.sin(time * 2 + i * 0.5) * 0.2 + 1.0;
      const size = baseSize * pulse;
      const alpha = 0.6 + Math.sin(time * 3 + i) * 0.3;

      ctx.globalAlpha = alpha * (0.7 + intensity * 0.3);

      // 黄色いグロー（背景）
      ctx.shadowBlur = 25 + intensity * 15;
      ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
      ctx.fillStyle = 'rgba(255, 223, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // 笑顔の絵文字を描画
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
      ctx.font = `${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('😊', x, y);

      // キラキラ効果
      if (intensity > 0.5) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (let j = 0; j < 4; j++) {
          const angle = (Math.PI * 2 * j) / 4 + time * 2;
          const sparkleX = x + Math.cos(angle) * size * 0.7;
          const sparkleY = y + Math.sin(angle) * size * 0.7;
          ctx.beginPath();
          ctx.arc(sparkleX, sparkleY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();

    // 画面全体に柔らかい黄色のグロー
    if (intensity > 0.6) {
      ctx.save();
      ctx.globalAlpha = (intensity - 0.6) * 0.3;
      const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.6
      );
      gradient.addColorStop(0, 'rgba(255, 240, 150, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 240, 150, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  };

  /**
   * Wave エフェクト: 画面上下に波打つリボン風の帯
   */
  const renderWave = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const waveHeight = 30 + intensity * 50; // 波の高さ
    const waveFrequency = 0.01; // 波の周波数
    const waveSpeed = 0.05 * (1 + intensity); // 波の速度

    // 位相を更新
    wavePhaseRef.current += waveSpeed;

    // 上部の波
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = `rgba(100, 149, 237, ${0.5 + intensity * 0.3})`; // コーンフラワーブルー
    ctx.beginPath();
    ctx.moveTo(0, 0);

    for (let x = 0; x <= width; x += 5) {
      const y = Math.sin(x * waveFrequency + wavePhaseRef.current) * waveHeight;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 下部の波
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = `rgba(100, 149, 237, ${0.5 + intensity * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let x = 0; x <= width; x += 5) {
      const y = height - Math.sin(x * waveFrequency + wavePhaseRef.current + Math.PI) * waveHeight;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 光の粒子を追加（intensity が高いとき）
    if (intensity > 0.5) {
      const particleCount = Math.floor((intensity - 0.5) * 20);
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 5;
      ctx.shadowColor = 'rgba(100, 149, 237, 0.8)';

      for (let i = 0; i < particleCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() > 0.5
          ? Math.sin(x * waveFrequency + wavePhaseRef.current) * waveHeight + 20
          : height - Math.sin(x * waveFrequency + wavePhaseRef.current + Math.PI) * waveHeight - 20;

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  /**
   * Thunder Flash エフェクト (驚き): 稲妻が画面を走る
   */
  const renderExcitement = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const time = performance.now() / 1000;

    // 稲妻の数（intensity に応じて 2~5本）
    const lightningCount = Math.floor(2 + intensity * 3);

    ctx.save();

    for (let i = 0; i < lightningCount; i++) {
      // ランダムな開始位置（上部）
      const seed = i * 345.678 + Math.floor(time * 2); // 定期的に変化
      const startX = (Math.sin(seed) * 0.5 + 0.5) * width;
      const startY = 0;

      // 稲妻の色（黄色〜白）
      const colors = [
        'rgba(255, 255, 100, 0.9)',
        'rgba(255, 255, 255, 0.95)',
        'rgba(255, 240, 100, 0.85)'
      ];
      const color = colors[i % colors.length];

      // 稲妻の経路を描画（ジグザグ）
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4 + intensity * 6;
      ctx.shadowBlur = 20 + intensity * 10;
      ctx.shadowColor = color;
      ctx.lineCap = 'round';

      let x = startX;
      let y = startY;
      ctx.moveTo(x, y);

      // ジグザグに下降
      const segments = 8 + Math.floor(intensity * 4);
      for (let j = 0; j < segments; j++) {
        const nextX = x + (Math.random() - 0.5) * 80;
        const nextY = y + (height / segments);
        ctx.lineTo(nextX, nextY);
        x = nextX;
        y = nextY;
      }

      ctx.stroke();

      // 二重線効果（より明るい中心線）
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 30;
      x = startX;
      y = startY;
      ctx.moveTo(x, y);
      for (let j = 0; j < segments; j++) {
        const nextX = x + (Math.random() - 0.5) * 80;
        const nextY = y + (height / segments);
        ctx.lineTo(nextX, nextY);
        x = nextX;
        y = nextY;
      }
      ctx.stroke();
    }

    ctx.restore();

    // フラッシュ効果（画面全体が一瞬明るくなる）
    if (intensity > 0.5) {
      const flashAlpha = (Math.sin(time * 10) * 0.5 + 0.5) * (intensity - 0.5) * 0.4;
      ctx.save();
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // 稲妻の光が反射する効果（画面端）
    ctx.save();
    ctx.globalAlpha = 0.3 + intensity * 0.3;
    const glowGradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    glowGradient.addColorStop(0, 'rgba(255, 255, 150, 0.2)');
    glowGradient.addColorStop(1, 'rgba(255, 255, 150, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  /**
   * Bounce エフェクト: 縦揺れ時の跳ねるボール
   */
  const renderBounce = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const ballCount = Math.floor(5 + intensity * 10); // 5~15個のボール
    const time = performance.now() * 0.002;

    ctx.save();

    for (let i = 0; i < ballCount; i++) {
      const x = (width / (ballCount + 1)) * (i + 1);
      const bounceHeight = 50 + intensity * 100;
      const y = height - 50 - Math.abs(Math.sin(time + i * 0.5)) * bounceHeight;
      const size = 10 + intensity * 15;

      // ボールのグラデーション
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      gradient.addColorStop(0, 'rgba(255, 100, 180, 1)'); // ピンク
      gradient.addColorStop(1, 'rgba(255, 100, 180, 0.3)');

      ctx.fillStyle = gradient;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255, 100, 180, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // 影を描画
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      const shadowY = height - 30;
      const shadowSize = size * 0.6 * (1 - (y - shadowY) / bounceHeight);
      ctx.ellipse(x, shadowY, shadowSize, shadowSize * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  /**
   * Cheer エフェクト: 手を上げた時の応援エフェクト
   */
  const renderCheer = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const time = performance.now() * 0.003;
    const handCount = Math.floor(3 + intensity * 7); // 3~10個の手

    ctx.save();

    for (let i = 0; i < handCount; i++) {
      const x = (width / (handCount + 1)) * (i + 1);
      const offset = Math.sin(time + i * 0.5) * 30;
      const y = height * 0.7 + offset;
      const size = 20 + intensity * 20;

      // 手のアイコン（簡易版：黄色い円）
      ctx.fillStyle = 'rgba(255, 223, 0, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255, 223, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // 手の形を少し表現（指）
      ctx.fillStyle = 'rgba(255, 200, 0, 0.9)';
      for (let j = 0; j < 5; j++) {
        const angle = (Math.PI * 2 * j) / 5 - Math.PI / 2;
        const fingerX = x + Math.cos(angle) * size * 0.7;
        const fingerY = y + Math.sin(angle) * size * 0.7;
        ctx.beginPath();
        ctx.arc(fingerX, fingerY, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // キラキラ効果
      if (intensity > 0.5) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let k = 0; k < 3; k++) {
          const sparkleX = x + (Math.random() - 0.5) * size * 2;
          const sparkleY = y + (Math.random() - 0.5) * size * 2;
          ctx.beginPath();
          ctx.arc(sparkleX, sparkleY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();

    // 応援メッセージ（intensityが高い時）
    if (intensity > 0.7) {
      ctx.save();
      ctx.font = `bold ${30 + intensity * 20}px Arial`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255, 223, 0, 0.8)';
      ctx.textAlign = 'center';
      const messages = ['🎉', '✨', '👏', '🙌'];
      const message = messages[Math.floor(time) % messages.length];
      ctx.fillText(message, width / 2, height * 0.3 + Math.sin(time * 2) * 10);
      ctx.restore();
    }
  };

  /**
   * Shimmer エフェクト: 横揺れ時の左右に流れる光の粒子
   */
  const renderShimmer = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const time = performance.now() * 0.002;
    const particleCount = Math.floor(10 + intensity * 30); // 10~40個の粒子

    // 左右に流れる光の帯を描画
    ctx.save();
    ctx.globalAlpha = 0.4 + intensity * 0.3;

    for (let i = 0; i < 5; i++) {
      const y = (height / 6) * (i + 1);
      const offset = Math.sin(time + i * 0.5) * 100;
      const xStart = -100 + offset + (time * 100) % (width + 200);

      // グラデーションを使用した光の帯
      const gradient = ctx.createLinearGradient(xStart, y, xStart + 150, y);
      gradient.addColorStop(0, 'rgba(147, 112, 219, 0)'); // 紫
      gradient.addColorStop(0.5, `rgba(147, 112, 219, ${0.6 + intensity * 0.4})`);
      gradient.addColorStop(1, 'rgba(147, 112, 219, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(xStart, y - 5, 150, 10);
    }

    ctx.restore();

    // キラキラした粒子を追加
    ctx.save();
    ctx.fillStyle = 'rgba(255, 215, 255, 0.8)'; // ピンクがかった白
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(147, 112, 219, 0.8)';

    for (let i = 0; i < particleCount; i++) {
      const seed = i * 1.234;
      const x = ((time * 150 + seed * width) % (width + 100)) - 50;
      const y = ((Math.sin(time + seed) * 0.5 + 0.5) * height * 0.8) + height * 0.1;
      const size = 2 + Math.sin(time * 2 + seed) * 2;

      ctx.globalAlpha = 0.3 + Math.sin(time * 3 + seed) * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // スター型の光を追加
      if (intensity > 0.5 && i % 3 === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - size * 2, y);
        ctx.lineTo(x + size * 2, y);
        ctx.moveTo(x, y - size * 2);
        ctx.lineTo(x, y + size * 2);
        ctx.stroke();
      }
    }

    ctx.restore();

    // intensity が高い時はオーロラ風の背景効果を追加
    if (intensity > 0.6) {
      ctx.save();
      ctx.globalAlpha = (intensity - 0.6) * 0.5;

      for (let i = 0; i < 3; i++) {
        const y = height * (0.3 + i * 0.2);
        const waveOffset = Math.sin(time * 0.5 + i) * 50;

        const gradient = ctx.createLinearGradient(0, y - 50, 0, y + 50);
        gradient.addColorStop(0, 'rgba(138, 43, 226, 0)'); // 青紫
        gradient.addColorStop(0.5, 'rgba(138, 43, 226, 0.3)');
        gradient.addColorStop(1, 'rgba(138, 43, 226, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 10) {
          const yOffset = Math.sin((x / width) * Math.PI * 2 + time + i) * 30;
          if (x === 0) {
            ctx.moveTo(x, y + yOffset + waveOffset);
          } else {
            ctx.lineTo(x, y + yOffset + waveOffset);
          }
        }
        ctx.lineTo(width, y + 50);
        ctx.lineTo(0, y + 50);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  };

  /**
   * Laser Lines エフェクト (集中): 赤・青のレーザー集中線
   */
  const renderFocus = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const time = performance.now() * 0.001;

    // 中心から外側へのレーザー集中線
    ctx.save();
    ctx.globalAlpha = 0.5 + intensity * 0.4;

    const lineCount = Math.floor(12 + intensity * 16); // 12~28本の集中線
    const maxLength = Math.sqrt(width * width + height * height) / 2;

    for (let i = 0; i < lineCount; i++) {
      const angle = (Math.PI * 2 * i) / lineCount;
      const length = maxLength * (0.8 + intensity * 0.2);
      const pulse = Math.sin(time * 3 + i * 0.3) * 0.15 + 0.85;

      // 赤と青を交互に
      const isRed = i % 2 === 0;
      const color = isRed
        ? `rgba(255, 50, 50, ${0.7 + intensity * 0.3})`   // 赤
        : `rgba(50, 150, 255, ${0.7 + intensity * 0.3})`; // 青

      // 中心から外側への線
      const gradient = ctx.createLinearGradient(
        centerX,
        centerY,
        centerX + Math.cos(angle) * length * pulse,
        centerY + Math.sin(angle) * length * pulse
      );

      gradient.addColorStop(0, color);
      gradient.addColorStop(0.6, color.replace(/[\d.]+\)$/g, '0.4)'));
      gradient.addColorStop(1, color.replace(/[\d.]+\)$/g, '0)'));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3 + intensity * 4;
      ctx.shadowBlur = 15 + intensity * 10;
      ctx.shadowColor = isRed ? 'rgba(255, 50, 50, 0.8)' : 'rgba(50, 150, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angle) * length * pulse,
        centerY + Math.sin(angle) * length * pulse
      );
      ctx.stroke();
    }

    ctx.restore();

    // 静かに回転する光の粒子
    ctx.save();
    const particleCount = Math.floor(5 + intensity * 15); // 5~20個の粒子

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + time * 0.3;
      const radius = 100 + intensity * 150;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const size = 3 + intensity * 4;
      const alpha = 0.4 + Math.sin(time * 2 + i) * 0.3;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(173, 216, 255, 0.8)'; // 淡い青
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(64, 156, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // 粒子の軌跡を描画
      if (intensity > 0.5) {
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = 'rgba(173, 216, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();

    // 中心に穏やかに脈動する光
    ctx.save();
    const pulse = Math.sin(time * 1.5) * 0.2 + 0.8;
    ctx.globalAlpha = 0.3 + intensity * 0.3;

    const centralGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, 80 + intensity * 40
    );
    centralGradient.addColorStop(0, 'rgba(64, 156, 255, 0.5)');
    centralGradient.addColorStop(0.5, 'rgba(64, 156, 255, 0.2)');
    centralGradient.addColorStop(1, 'rgba(64, 156, 255, 0)');

    ctx.fillStyle = centralGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, (80 + intensity * 40) * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // intensityが高い時は画面周辺にビネット効果
    if (intensity > 0.6) {
      ctx.save();
      ctx.globalAlpha = (intensity - 0.6) * 0.5;

      const vignetteGradient = ctx.createRadialGradient(
        centerX, centerY, Math.min(width, height) * 0.3,
        centerX, centerY, Math.max(width, height) * 0.7
      );
      vignetteGradient.addColorStop(0, 'rgba(0, 50, 100, 0)');
      vignetteGradient.addColorStop(1, 'rgba(0, 50, 100, 0.4)');

      ctx.fillStyle = vignetteGradient;
      ctx.fillRect(0, 0, width, height);

      ctx.restore();
    }
  };

  /**
   * Clapping Icons効果（拍手アイコン）
   * 画面上を上昇する拍手アイコン
   */
  const renderClappingIcons = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, _elapsed: number) => {
    ctx.save();

    const time = performance.now() / 1000;

    // アイコンの数（intensity に応じて 5~20個）
    const iconCount = Math.floor(5 + intensity * 15);

    for (let i = 0; i < iconCount; i++) {
      // ランダムな横位置（ただしシード値を使って安定した位置）
      const seed = i * 123.456;
      const x = (Math.sin(seed) * 0.5 + 0.5) * width;

      // 下から上に上昇
      const baseY = height + 50;
      const riseSpeed = 150 + (i % 3) * 50; // 上昇速度
      const y = baseY - ((time * riseSpeed + i * 100) % (height + 150));

      // サイズ（intensity で変化）
      const size = 30 + intensity * 20 + Math.sin(time * 3 + i) * 5;

      // 透明度（上に行くほど薄くなる）
      const fadeStart = height * 0.3;
      const alpha = y > fadeStart ? 1.0 : Math.max(0, y / fadeStart);

      ctx.globalAlpha = alpha * (0.7 + intensity * 0.3);

      // 拍手の絵文字を描画
      ctx.font = `${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 影をつける
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // 絵文字を描画（拍手）
      ctx.fillText('👏', x, y);
    }

    ctx.restore();

    // intensityが高い時は画面下部にゴールドのグロー
    if (intensity > 0.6) {
      ctx.save();
      ctx.globalAlpha = (intensity - 0.6) * 0.5;

      const gradient = ctx.createLinearGradient(0, height - 100, 0, height);
      gradient.addColorStop(0, 'rgba(255, 215, 0, 0)');
      gradient.addColorStop(1, 'rgba(255, 215, 0, 0.3)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - 100, width, 100);

      ctx.restore();
    }
  };

  /**
   * Groove効果（横揺れ）
   * 左右に流れる波とリズミカルなパーティクル
   */
  const renderGroove = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, _elapsed: number) => {
    ctx.save();

    const time = performance.now() / 1000;

    // 左右に流れる波（3本の正弦波）
    const waveCount = 3;
    for (let i = 0; i < waveCount; i++) {
      const yPos = height * (0.25 + i * 0.25);
      const amplitude = 30 + intensity * 40; // 波の高さ
      const frequency = 0.02; // 波の細かさ
      const speed = time * 2 + i * 0.5; // 左右に流れる速度

      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 140, 0, ${0.3 + intensity * 0.4})`; // オレンジ色
      ctx.lineWidth = 3 + intensity * 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255, 140, 0, 0.6)';

      for (let x = 0; x < width; x += 5) {
        const y = yPos + Math.sin((x * frequency) + speed) * amplitude;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // 左右に流れるパーティクル（10~30個）
    const particleCount = Math.floor(10 + intensity * 20);
    for (let i = 0; i < particleCount; i++) {
      const offset = (i / particleCount) * width;
      const x = (offset + time * 150 + i * 30) % width;
      const y = height * (0.2 + (i % 3) * 0.3) + Math.sin(time * 3 + i) * 20;
      const size = 4 + intensity * 6;
      const alpha = 0.5 + Math.sin(time * 2 + i * 0.5) * 0.3;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(255, 165, 0, 0.8)'; // オレンジゴールド
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(255, 140, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 画面端に左右の脈動するグロー
    ctx.save();
    const pulse = Math.sin(time * 2.5) * 0.3 + 0.7;

    // 左端
    const leftGradient = ctx.createLinearGradient(0, 0, 100, 0);
    leftGradient.addColorStop(0, `rgba(255, 140, 0, ${(0.3 + intensity * 0.3) * pulse})`);
    leftGradient.addColorStop(1, 'rgba(255, 140, 0, 0)');
    ctx.fillStyle = leftGradient;
    ctx.fillRect(0, 0, 100, height);

    // 右端
    const rightGradient = ctx.createLinearGradient(width - 100, 0, width, 0);
    rightGradient.addColorStop(0, 'rgba(255, 140, 0, 0)');
    rightGradient.addColorStop(1, `rgba(255, 140, 0, ${(0.3 + intensity * 0.3) * pulse})`);
    ctx.fillStyle = rightGradient;
    ctx.fillRect(width - 100, 0, 100, height);

    ctx.restore();

    // intensityが高い時は画面全体にリズミカルなフラッシュ
    if (intensity > 0.7) {
      const flashAlpha = Math.sin(time * 4) * 0.1 + 0.1;
      ctx.save();
      ctx.globalAlpha = flashAlpha * (intensity - 0.7);
      ctx.fillStyle = 'rgba(255, 200, 100, 0.2)';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  };

  /**
   * アニメーションループ
   */
  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    // Canvas をクリア
    ctx.clearRect(0, 0, width, height);

    // エフェクトが有効な場合のみ描画
    const effect = currentEffectRef.current;
    if (effect) {
      const now = performance.now();
      const elapsed = now - effectStartTimeRef.current;

      // エフェクトの残り時間をチェック
      if (elapsed < effect.durationMs) {
        // エフェクトタイプに応じて描画
        switch (effect.effectType) {
          case 'sparkle':
            renderSparkle(ctx, width, height, effect.intensity, elapsed);
            break;
          case 'wave':
            renderWave(ctx, width, height, effect.intensity, elapsed);
            break;
          case 'excitement':
            renderExcitement(ctx, width, height, effect.intensity, elapsed);
            break;
          case 'bounce':
            renderBounce(ctx, width, height, effect.intensity, elapsed);
            break;
          case 'cheer':
            renderCheer(ctx, width, height, effect.intensity, elapsed);
            break;
          case 'shimmer':
            renderShimmer(ctx, width, height, effect.intensity, elapsed);
            break;
          case 'focus':
            renderFocus(ctx, width, height, effect.intensity, elapsed);
            break;
          case 'groove':
            renderGroove(ctx, width, height, effect.intensity, elapsed);
            break;
          case 'clapping_icons':
            renderClappingIcons(ctx, width, height, effect.intensity, elapsed);
            break;
          default:
            console.warn('未対応のエフェクトタイプ:', effect.effectType);
        }
      } else {
        // エフェクト終了
        currentEffectRef.current = null;
        particlesRef.current = [];
        console.log('✅ エフェクト終了:', effect.effectType);
      }
    }

    // 次のフレームをリクエスト
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  /**
   * エフェクトが変更されたときの処理
   */
  useEffect(() => {
    if (currentEffect) {
      console.log('🎨 エフェクト描画開始:', currentEffect.effectType, 'intensity:', currentEffect.intensity);
      currentEffectRef.current = currentEffect;
      effectStartTimeRef.current = performance.now();

      // sparkle以外の場合は既存の粒子をクリア
      if (currentEffect.effectType !== 'sparkle') {
        particlesRef.current = [];
      }
    }
  }, [currentEffect]);

  /**
   * アニメーションループの開始・停止
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    console.log('🎬 エフェクトレンダラー初期化');

    // アニメーションループを開始
    animationFrameRef.current = requestAnimationFrame(animate);

    // クリーンアップ
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        console.log('⏹️ エフェクトレンダラー停止');
      }
    };
  }, [canvasRef]);

  return null;
};
