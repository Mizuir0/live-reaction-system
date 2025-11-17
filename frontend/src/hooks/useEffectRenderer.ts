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
