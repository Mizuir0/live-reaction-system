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
   * Sound Waves エフェクト (歓声): 📢から音の波が広がる
   */
  const renderWave = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const time = performance.now() / 1000;

    ctx.save();

    // 背景に薄いグラデーション
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, `rgba(100, 200, 255, ${0.02 * intensity})`);
    bgGradient.addColorStop(0.5, `rgba(100, 200, 255, ${0.05 * intensity})`);
    bgGradient.addColorStop(1, `rgba(100, 200, 255, ${0.02 * intensity})`);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 垂直の波を描画（Grooveの90度回転版）
    const waveCount = 4; // 波の本数

    for (let i = 0; i < waveCount; i++) {
      const xPos = width * (0.2 + i * 0.2); // 固定されたx位置（垂直線）
      const amplitude = 40 + intensity * 60; // 波の振幅
      const frequency = 0.02; // 波の周波数
      const speed = time * 2 + i * 0.5; // 波の速度（下に流れる）

      // 波線を描画
      ctx.beginPath();
      for (let y = 0; y < height; y += 5) {
        const x = xPos + Math.sin((y * frequency) + speed) * amplitude;

        if (y === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // グラデーションストローク
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, `rgba(100, 200, 255, ${0.3 + intensity * 0.4})`);
      gradient.addColorStop(0.5, `rgba(150, 220, 255, ${0.6 + intensity * 0.4})`);
      gradient.addColorStop(1, `rgba(100, 200, 255, ${0.3 + intensity * 0.4})`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3 + intensity * 3;
      ctx.shadowBlur = 10 + intensity * 10;
      ctx.shadowColor = 'rgba(100, 200, 255, 0.6)';
      ctx.stroke();

      // 2本目の薄い波線（外側の光）
      ctx.beginPath();
      for (let y = 0; y < height; y += 5) {
        const x = xPos + Math.sin((y * frequency) + speed) * amplitude;
        if (y === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = `rgba(150, 220, 255, ${0.2 + intensity * 0.3})`;
      ctx.lineWidth = 6 + intensity * 6;
      ctx.shadowBlur = 20 + intensity * 15;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // パーティクル（上から下に流れる）
    const particleCount = Math.floor(12 + intensity * 16);

    for (let i = 0; i < particleCount; i++) {
      const offset = (i / particleCount) * height; // パーティクルを均等に配置
      const y = (offset + time * 150 + i * 30) % height; // y座標が時間で変化（下に流れる）
      const x = width * (0.15 + (i % 4) * 0.25); // 固定されたx位置
      const size = 3 + intensity * 4;

      // パーティクル本体
      ctx.globalAlpha = 0.6 + intensity * 0.4;
      ctx.fillStyle = `rgba(100, 200, 255, ${0.8 + intensity * 0.2})`;
      ctx.shadowBlur = 8 + intensity * 8;
      ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // パーティクルの尾
      const tailGradient = ctx.createLinearGradient(x, y - 20, x, y);
      tailGradient.addColorStop(0, 'rgba(100, 200, 255, 0)');
      tailGradient.addColorStop(1, `rgba(100, 200, 255, ${0.4 + intensity * 0.4})`);
      ctx.fillStyle = tailGradient;
      ctx.fillRect(x - 1, y - 20, 2, 20);
    }

    ctx.shadowBlur = 0;

    // 大きい光るパーティクル（intensityが高い時）
    if (intensity > 0.5) {
      const glowCount = Math.floor(4 + intensity * 6);

      for (let i = 0; i < glowCount; i++) {
        const offset = (i / glowCount) * height; // パーティクルを均等に配置
        const y = (offset * 0.7 + time * 100 + i * 50) % height;
        const x = width * (0.1 + (i % 5) * 0.2);
        const size = 5 + intensity * 8;

        ctx.globalAlpha = (0.3 + intensity * 0.5) * (0.5 + Math.sin(time * 3 + i) * 0.5);

        // 外側のグロー
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
        glowGradient.addColorStop(0, `rgba(150, 220, 255, ${0.6 + intensity * 0.4})`);
        glowGradient.addColorStop(0.5, `rgba(100, 200, 255, ${0.3 + intensity * 0.3})`);
        glowGradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 3, 0, Math.PI * 2);
        ctx.fill();

        // 内側のコア
        ctx.fillStyle = `rgba(200, 240, 255, ${0.8 + intensity * 0.2})`;
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(100, 200, 255, 1)';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
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
   * Music Bounce エフェクト (頷き): 🎵🎶が上下に弾む
   */
  const renderBounce = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const noteCount = Math.floor(6 + intensity * 12); // 6~18個の音符
    const time = performance.now() * 0.002;

    ctx.save();

    for (let i = 0; i < noteCount; i++) {
      // 左右に分散: 左側 (0~30%) または 右側 (70~100%)
      const isLeft = i % 2 === 0;
      const sideWidth = width * 0.3; // 各サイド30%の幅
      const notesPerSide = Math.ceil(noteCount / 2);
      const sideIndex = Math.floor(i / 2);
      const xOffset = (sideWidth / (notesPerSide + 1)) * (sideIndex + 1);
      const x = isLeft ? xOffset : width - sideWidth + xOffset;

      const bounceHeight = 60 + intensity * 120;
      const bounceSpeed = time * 1.5 + i * 0.5;
      const y = height - 80 - Math.abs(Math.sin(bounceSpeed)) * bounceHeight;
      const size = 35 + intensity * 25;

      // 🎵と🎶を交互に表示
      const emoji = i % 2 === 0 ? '🎵' : '🎶';

      // 音符の絵文字を描画
      ctx.globalAlpha = 0.85 + intensity * 0.15;
      ctx.font = `${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // グロー効果
      ctx.shadowBlur = 15 + intensity * 10;
      ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
      ctx.fillText(emoji, x, y);

      // 跳ねている時に少し回転させる
      const rotation = Math.sin(bounceSpeed * 2) * 0.2;
      if (Math.abs(rotation) > 0.05) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.globalAlpha = 0.5;
        ctx.fillText(emoji, 0, 0);
        ctx.restore();
      }

      // 影を描画
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      const shadowY = height - 50;
      const shadowScale = 1 - ((y - shadowY) / bounceHeight) * 0.7;
      const shadowWidth = size * 0.8 * Math.max(0.2, shadowScale);
      const shadowHeight = size * 0.2 * Math.max(0.2, shadowScale);
      ctx.ellipse(x, shadowY, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // リズムを強調するために、画面下部に波打つライン
    if (intensity > 0.4) {
      ctx.save();
      ctx.globalAlpha = 0.3 + intensity * 0.3;
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.7)';
      ctx.lineWidth = 3 + intensity * 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(100, 200, 255, 0.6)';

      ctx.beginPath();
      for (let x = 0; x <= width; x += 10) {
        const y = height - 40 + Math.sin(x * 0.02 + time * 3) * (10 + intensity * 15);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // intensityが高い時は背景に音の波紋効果
    if (intensity > 0.6) {
      ctx.save();
      const rippleCount = 3;
      for (let i = 0; i < rippleCount; i++) {
        const ripplePhase = (time * 2 + i * 0.7) % 2;
        const rippleRadius = ripplePhase * Math.max(width, height) * 0.4;
        const rippleAlpha = (1 - ripplePhase / 2) * (intensity - 0.6) * 0.4;

        ctx.globalAlpha = rippleAlpha;
        ctx.strokeStyle = 'rgba(150, 220, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  /**
   * Celebration エフェクト (手を上げる): 🙌絵文字 + カラフルな紙吹雪
   */
  const renderCheer = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const time = performance.now() / 1000;

    ctx.save();

    // 🙌絵文字を画面下部に配置（5~15個）
    const emojiCount = Math.floor(5 + intensity * 10);
    for (let i = 0; i < emojiCount; i++) {
      const seed = i * 234.567;
      const x = (Math.sin(seed) * 0.5 + 0.5) * width;
      const y = height * 0.7 + Math.sin(time * 2 + i * 0.5) * 20;
      const size = 40 + intensity * 30;

      // 🙌絵文字を描画
      ctx.globalAlpha = 0.8 + intensity * 0.2;
      ctx.font = `${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
      ctx.fillText('🙌', x, y);
    }

    ctx.shadowBlur = 0;
    ctx.restore();

    // カラフルな紙吹雪（上から降ってくる）
    ctx.save();
    const confettiCount = Math.floor(20 + intensity * 40); // 20~60個の紙吹雪
    const confettiColors = [
      'rgba(255, 0, 100, 0.9)',   // ピンク
      'rgba(255, 215, 0, 0.9)',   // ゴールド
      'rgba(0, 200, 255, 0.9)',   // シアン
      'rgba(150, 0, 255, 0.9)',   // パープル
      'rgba(0, 255, 150, 0.9)',   // グリーン
      'rgba(255, 100, 0, 0.9)',   // オレンジ
    ];

    for (let i = 0; i < confettiCount; i++) {
      const seed = i * 123.456;
      const x = ((time * 80 + seed * width) % (width + 100)) - 50;
      const fallSpeed = 200 + (i % 5) * 50;
      const y = ((time * fallSpeed + i * 200) % (height + 200)) - 100;

      // 紙吹雪の形状（四角または細長い長方形）
      const isRect = i % 2 === 0;
      const rotation = (time * 2 + i) % (Math.PI * 2);
      const sizeW = isRect ? 8 + intensity * 4 : 3 + intensity * 2;
      const sizeH = isRect ? 8 + intensity * 4 : 12 + intensity * 8;

      const color = confettiColors[i % confettiColors.length];

      // 透明度（下に行くほど薄くなる）
      const fadeStart = height * 0.6;
      const alpha = y < fadeStart ? 1.0 : Math.max(0, 1 - (y - fadeStart) / (height - fadeStart));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;

      // 紙吹雪を回転させて描画
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillRect(-sizeW / 2, -sizeH / 2, sizeW, sizeH);
      ctx.restore();
    }

    ctx.restore();

    // intensity が高い時は追加の🎊絵文字を表示
    if (intensity > 0.6) {
      ctx.save();
      const partyCount = Math.floor(3 + (intensity - 0.6) * 10);

      for (let i = 0; i < partyCount; i++) {
        const seed = i * 456.789;
        const x = (Math.sin(seed) * 0.5 + 0.5) * width;
        const y = height * 0.2 + Math.sin(time * 3 + i) * 30;
        const size = 30 + intensity * 20;

        ctx.globalAlpha = 0.6 + Math.sin(time * 2 + i) * 0.3;
        ctx.font = `${size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎊', x, y);
      }

      ctx.restore();
    }

    // 画面全体に明るいグロー効果
    if (intensity > 0.5) {
      ctx.save();
      ctx.globalAlpha = (intensity - 0.5) * 0.2;
      const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.6
      );
      gradient.addColorStop(0, 'rgba(255, 240, 200, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  };

  /**
   * Music Swing エフェクト (首を横に振る): 🎶🎵が左右にスイング
   */
  const renderShimmer = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const time = performance.now() * 0.002;
    const noteCount = Math.floor(5 + intensity * 10); // 5~15個の音符

    ctx.save();

    // 音符を左右の端で揺らしながら配置
    for (let i = 0; i < noteCount; i++) {
      const centerY = height * (0.2 + (i / noteCount) * 0.6);
      const swingAmount = 60 + intensity * 80;
      const swingSpeed = time * 1.8 + i * 0.6;
      // 左右に分散: 左側または右側を中心にスイング
      const isLeft = i % 2 === 0;
      const centerX = isLeft ? width * 0.15 : width * 0.85;
      const x = centerX + Math.sin(swingSpeed) * swingAmount;
      const y = centerY;
      const size = 40 + intensity * 30;

      // 🎶と🎵を交互に表示
      const emoji = i % 2 === 0 ? '🎶' : '🎵';

      // スイングの動きに合わせて回転
      const rotation = Math.sin(swingSpeed) * 0.3;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);

      // グロー効果
      ctx.shadowBlur = 15 + intensity * 10;
      ctx.shadowColor = 'rgba(255, 100, 200, 0.8)';

      // 音符の絵文字を描画
      ctx.globalAlpha = 0.8 + intensity * 0.2;
      ctx.font = `${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 0, 0);

      // 残像効果（動きを強調）
      if (intensity > 0.5) {
        const trailOffset = Math.cos(swingSpeed) * 30;
        ctx.globalAlpha = 0.3;
        ctx.shadowBlur = 5;
        ctx.fillText(emoji, -trailOffset, 0);
      }

      ctx.restore();
    }

    ctx.restore();

    // 左右にスイングする軌跡ライン
    if (intensity > 0.4) {
      ctx.save();
      ctx.globalAlpha = 0.25 + intensity * 0.25;
      ctx.strokeStyle = 'rgba(255, 150, 220, 0.6)';
      ctx.lineWidth = 2 + intensity * 2;
      ctx.setLineDash([5, 5]);

      for (let i = 0; i < 3; i++) {
        const y = height * (0.25 + i * 0.25);

        // 左側のスイング軌跡
        ctx.beginPath();
        for (let angle = -Math.PI; angle <= Math.PI; angle += 0.1) {
          const swingX = width * 0.15 + Math.sin(angle) * (80 + intensity * 80);
          if (angle === -Math.PI) {
            ctx.moveTo(swingX, y);
          } else {
            ctx.lineTo(swingX, y);
          }
        }
        ctx.stroke();

        // 右側のスイング軌跡
        ctx.beginPath();
        for (let angle = -Math.PI; angle <= Math.PI; angle += 0.1) {
          const swingX = width * 0.85 + Math.sin(angle) * (80 + intensity * 80);
          if (angle === -Math.PI) {
            ctx.moveTo(swingX, y);
          } else {
            ctx.lineTo(swingX, y);
          }
        }
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.restore();
    }

    // 左右の端にリズミカルな光の脈動
    ctx.save();
    const pulsateLeft = Math.sin(time * 2.5) * 0.5 + 0.5;
    const pulsateRight = Math.sin(time * 2.5 + Math.PI) * 0.5 + 0.5;

    // 左端のグロー
    const leftGradient = ctx.createRadialGradient(0, height / 2, 0, 0, height / 2, 150);
    leftGradient.addColorStop(0, `rgba(255, 100, 200, ${0.3 * pulsateLeft * intensity})`);
    leftGradient.addColorStop(1, 'rgba(255, 100, 200, 0)');
    ctx.fillStyle = leftGradient;
    ctx.fillRect(0, 0, 150, height);

    // 右端のグロー
    const rightGradient = ctx.createRadialGradient(width, height / 2, 0, width, height / 2, 150);
    rightGradient.addColorStop(0, `rgba(255, 100, 200, ${0.3 * pulsateRight * intensity})`);
    rightGradient.addColorStop(1, 'rgba(255, 100, 200, 0)');
    ctx.fillStyle = rightGradient;
    ctx.fillRect(width - 150, 0, 150, height);

    ctx.restore();

    // intensityが高い時は音の波が左右に広がる
    if (intensity > 0.6) {
      ctx.save();
      const waveCount = 2;

      for (let i = 0; i < waveCount; i++) {
        const wavePhase = (time * 3 + i * 1.5) % 3;
        const waveX = width / 2 + Math.sin(wavePhase) * width * 0.4;
        const waveRadius = wavePhase * 100;
        const waveAlpha = (1 - wavePhase / 3) * (intensity - 0.6) * 0.5;

        ctx.globalAlpha = waveAlpha;
        ctx.strokeStyle = 'rgba(255, 150, 220, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(waveX, height / 2, waveRadius, 0, Math.PI * 2);
        ctx.stroke();
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
    // 左右に2つの焦点を作成
    const leftCenterX = width * 0.15;
    const rightCenterX = width * 0.85;
    const centerY = height / 2;
    const time = performance.now() * 0.001;

    const centers = [
      { x: leftCenterX, y: centerY },
      { x: rightCenterX, y: centerY }
    ];

    for (const center of centers) {
      // 中心から外側へのレーザー集中線
      ctx.save();
      ctx.globalAlpha = 0.5 + intensity * 0.4;

      const lineCount = Math.floor(8 + intensity * 12); // 各側8~20本の集中線
      const maxLength = Math.min(width * 0.4, height * 0.6);

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
          center.x,
          center.y,
          center.x + Math.cos(angle) * length * pulse,
          center.y + Math.sin(angle) * length * pulse
        );

        gradient.addColorStop(0, color);
        gradient.addColorStop(0.6, color.replace(/[\d.]+\)$/g, '0.4)'));
        gradient.addColorStop(1, color.replace(/[\d.]+\)$/g, '0)'));

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3 + intensity * 4;
        ctx.shadowBlur = 15 + intensity * 10;
        ctx.shadowColor = isRed ? 'rgba(255, 50, 50, 0.8)' : 'rgba(50, 150, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(
          center.x + Math.cos(angle) * length * pulse,
          center.y + Math.sin(angle) * length * pulse
        );
        ctx.stroke();
      }

      ctx.restore();
    }

    // 静かに回転する光の粒子（各焦点の周り）
    for (const center of centers) {
      ctx.save();
      const particleCount = Math.floor(3 + intensity * 8); // 各側3~11個の粒子

      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + time * 0.3;
        const radius = 60 + intensity * 100;
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
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
          ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();

      // 中心に穏やかに脈動する光
      ctx.save();
      const pulse = Math.sin(time * 1.5) * 0.2 + 0.8;
      ctx.globalAlpha = 0.3 + intensity * 0.3;

      const centralGradient = ctx.createRadialGradient(
        center.x, center.y, 0,
        center.x, center.y, 60 + intensity * 30
      );
      centralGradient.addColorStop(0, 'rgba(64, 156, 255, 0.5)');
      centralGradient.addColorStop(0.5, 'rgba(64, 156, 255, 0.2)');
      centralGradient.addColorStop(1, 'rgba(64, 156, 255, 0)');

      ctx.fillStyle = centralGradient;
      ctx.beginPath();
      ctx.arc(center.x, center.y, (60 + intensity * 30) * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // intensityが高い時は左右の端にビネット効果
    if (intensity > 0.6) {
      for (const center of centers) {
        ctx.save();
        ctx.globalAlpha = (intensity - 0.6) * 0.5;

        const vignetteGradient = ctx.createRadialGradient(
          center.x, center.y, Math.min(width * 0.2, height * 0.3),
          center.x, center.y, Math.min(width * 0.4, height * 0.6)
        );
        vignetteGradient.addColorStop(0, 'rgba(0, 50, 100, 0)');
        vignetteGradient.addColorStop(1, 'rgba(0, 50, 100, 0.4)');

        ctx.fillStyle = vignetteGradient;
        ctx.fillRect(0, 0, width, height);

        ctx.restore();
      }
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
   * Groove効果（横揺れ）- 視認性向上版
   * 左右に流れる波とリズミカルなパーティクル
   */
  const renderGroove = (ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, _elapsed: number) => {
    ctx.save();

    const time = performance.now() / 1000;

    // 左右に流れる波（4本の正弦波 - 増量）
    const waveCount = 4;
    for (let i = 0; i < waveCount; i++) {
      const yPos = height * (0.2 + i * 0.2);
      const amplitude = 40 + intensity * 60; // 波の高さを増加
      const frequency = 0.02;
      const speed = time * 2 + i * 0.5;

      // メインの波（より明るく、太く）
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 165, 0, ${0.6 + intensity * 0.4})`; // より明るいオレンジ、不透明度アップ
      ctx.lineWidth = 5 + intensity * 5; // 太さアップ
      ctx.shadowBlur = 25; // グローを強化
      ctx.shadowColor = 'rgba(255, 140, 0, 0.9)';

      for (let x = 0; x < width; x += 5) {
        const y = yPos + Math.sin((x * frequency) + speed) * amplitude;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 二重線効果（外側の光）
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255, 200, 100, ${0.3 + intensity * 0.3})`;
      ctx.lineWidth = 10 + intensity * 8;
      ctx.shadowBlur = 35;
      ctx.shadowColor = 'rgba(255, 165, 0, 0.7)';

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

    // 左右に流れるパーティクル（増量、大型化）
    const particleCount = Math.floor(20 + intensity * 35); // 20~55個に増量
    for (let i = 0; i < particleCount; i++) {
      const offset = (i / particleCount) * width;
      const x = (offset + time * 150 + i * 30) % width;
      const y = height * (0.15 + (i % 4) * 0.25) + Math.sin(time * 3 + i) * 25;
      const size = 6 + intensity * 10; // サイズアップ
      const alpha = 0.7 + Math.sin(time * 2 + i * 0.5) * 0.3; // 不透明度アップ

      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(255, 180, 50, 0.95)'; // より明るく鮮やかに
      ctx.shadowBlur = 18; // グロー強化
      ctx.shadowColor = 'rgba(255, 140, 0, 1)';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // パーティクルの内側に白いコアを追加（明るさ強調）
      if (intensity > 0.4) {
        ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // 画面端に左右の脈動するグロー（強化）
    ctx.save();
    const pulse = Math.sin(time * 2.5) * 0.4 + 0.8; // 脈動を強化

    // 左端（範囲拡大、明度アップ）
    const leftGradient = ctx.createLinearGradient(0, 0, 200, 0);
    leftGradient.addColorStop(0, `rgba(255, 165, 0, ${(0.5 + intensity * 0.4) * pulse})`);
    leftGradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
    ctx.fillStyle = leftGradient;
    ctx.fillRect(0, 0, 200, height);

    // 右端（範囲拡大、明度アップ）
    const rightGradient = ctx.createLinearGradient(width - 200, 0, width, 0);
    rightGradient.addColorStop(0, 'rgba(255, 165, 0, 0)');
    rightGradient.addColorStop(1, `rgba(255, 165, 0, ${(0.5 + intensity * 0.4) * pulse})`);
    ctx.fillStyle = rightGradient;
    ctx.fillRect(width - 200, 0, 200, height);

    ctx.restore();

    // 画面全体にリズミカルなフラッシュ（閾値を下げて早めに表示）
    if (intensity > 0.5) {
      const flashAlpha = Math.sin(time * 4) * 0.15 + 0.15;
      ctx.save();
      ctx.globalAlpha = flashAlpha * (intensity - 0.5) * 1.5;
      ctx.fillStyle = 'rgba(255, 215, 100, 0.25)';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // 上下端にもオレンジのグロー帯を追加（視認性向上）
    if (intensity > 0.6) {
      ctx.save();
      ctx.globalAlpha = (intensity - 0.6) * 0.6;

      // 上部
      const topGradient = ctx.createLinearGradient(0, 0, 0, 80);
      topGradient.addColorStop(0, 'rgba(255, 180, 50, 0.4)');
      topGradient.addColorStop(1, 'rgba(255, 180, 50, 0)');
      ctx.fillStyle = topGradient;
      ctx.fillRect(0, 0, width, 80);

      // 下部
      const bottomGradient = ctx.createLinearGradient(0, height - 80, 0, height);
      bottomGradient.addColorStop(0, 'rgba(255, 180, 50, 0)');
      bottomGradient.addColorStop(1, 'rgba(255, 180, 50, 0.4)');
      ctx.fillStyle = bottomGradient;
      ctx.fillRect(0, height - 80, width, 80);

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
