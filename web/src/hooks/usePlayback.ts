import { useEffect, useState } from 'react';

export const SPEEDS = [1, 5, 10, 20, 50] as const;

/** Match-clock playback. Resets to 0 (paused) whenever `resetKey` changes. */
export function usePlayback(duration: number, resetKey: string) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(10);
  const [key, setKey] = useState(resetKey);

  if (key !== resetKey) {
    setKey(resetKey);
    setT(0);
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => {
        const next = prev + dt * speed;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, duration]);

  const toggle = () => {
    if (!playing && t >= duration) setT(0); // replay from the start
    setPlaying(!playing);
  };

  const seek = (value: number) => setT(Math.min(duration, Math.max(0, value)));

  return { t, playing, speed, setSpeed, toggle, seek };
}
