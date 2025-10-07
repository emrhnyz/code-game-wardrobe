import React, { useEffect, useRef } from "react";

export default function CodeRain({
  density = 0.9,        // 0.5–1.2: sütun sıklığı
  speed = 1.0,          // 0.6–1.6: düşüş hızı
  fontSize = 16,        // px
  opacity = 0.25,       // 0–1
}) {
  const ref = useRef(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d", { alpha: true });

    const chars = "01{}[]<>=+*/%-;:.#@$&|^~ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let w, h, cols, drops, dpr;

    function resize() {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const { innerWidth, innerHeight } = window;
      w = innerWidth;
      h = innerHeight;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const colWidth = fontSize * 0.8;
      cols = Math.floor(w / colWidth);
      drops = Array(cols)
        .fill(0)
        .map(() => Math.floor(Math.random() * -50));
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
    }

    function step() {
      // arka planı yarı saydam doldur (iz bırakma efekti)
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.12 * speed, 0.2)})`;
      ctx.fillRect(0, 0, w, h);

      const colWidth = fontSize * 0.8;
      for (let i = 0; i < cols; i++) {
        const x = i * colWidth;
        const y = drops[i] * fontSize;

        // renk gradyanı: üst satırlar daha soluk
        const head = Math.random() < 0.06;
        ctx.fillStyle = head
          ? `rgba(168, 85, 247, ${opacity})`   // mor parıltı (Tailwind purple-500)
          : `rgba(79, 70, 229, ${opacity * 0.85})`; // indigo-600

        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, x, y);

        // bir sütunun “yağış hızı”: rastgele ama kontrol edilebilir
        const fall = (Math.random() * 3 + 1.5) * speed;
        drops[i] += fall;

        // ekranı geçtiyse reset
        if (y > h && Math.random() < density * 0.02) {
          drops[i] = Math.floor(Math.random() * -30);
        }
      }
      raf.current = requestAnimationFrame(step);
    }

    resize();
    window.addEventListener("resize", resize);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    raf.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
    };
  }, [density, speed, fontSize, opacity]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-10"  // <- z-10
      aria-hidden="true"
    />
  );


}
