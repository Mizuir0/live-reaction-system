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
   * Sparkle エフェクト: キラキラとした粒子が画面周囲に散る
   */
  const renderSparkle = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    // intensity に応じて粒子数を調整（0.0 ~ 1.0 -> 10 ~ 50個）
    const targetParticleCount = Math.floor(10 + intensity * 40);

    // 新しい粒子を生成
    while (particlesRef.current.length < targetParticleCount) {
      const isHorizontal = Math.random() > 0.5;
      let x, y;

      if (isHorizontal) {
        // 上下の辺
        x = Math.random() * width;
        y = Math.random() > 0.5 ? 0 : height;
      } else {
        // 左右の辺
        x = Math.random() > 0.5 ? 0 : width;
        y = Math.random() * height;
      }

      const particle: Particle = {
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        alpha: 1.0,
        size: 2 + Math.random() * 3,
        life: 0,
        maxLife: 60 + Math.random() * 60 // 60~120フレーム
      };

      particlesRef.current.push(particle);
    }

    // 粒子を更新・描画
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx * intensity;
      particle.y += particle.vy * intensity;
      particle.life += 1;
      particle.alpha = 1 - (particle.life / particle.maxLife);

      if (particle.alpha <= 0) return false;

      // 描画
      ctx.save();
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = '#FFD700'; // ゴールド
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FFD700';
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      return true;
    });
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
   * Excitement エフェクト: 驚き時の放射状の光線
   */
  const renderExcitement = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number,
    _elapsed: number
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const rayCount = Math.floor(8 + intensity * 12); // 8~20本の光線

    ctx.save();
    ctx.globalAlpha = 0.3 + intensity * 0.4;

    for (let i = 0; i < rayCount; i++) {
      const angle = (Math.PI * 2 * i) / rayCount + performance.now() * 0.001;
      const length = 100 + intensity * 200;

      const gradient = ctx.createLinearGradient(
        centerX,
        centerY,
        centerX + Math.cos(angle) * length,
        centerY + Math.sin(angle) * length
      );

      gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)'); // ゴールド
      gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.4)'); // オレンジ
      gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3 + intensity * 5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angle) * length,
        centerY + Math.sin(angle) * length
      );
      ctx.stroke();
    }

    ctx.restore();

    // 中心に輝く円
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.shadowBlur = 30 + intensity * 20;
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20 + intensity * 30, 0, Math.PI * 2);
    ctx.fill();
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
