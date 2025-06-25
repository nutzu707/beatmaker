"use client";
import React, { useEffect, useRef } from "react";
import Beatmaker from "./components/beatmaker";

export default function Home() {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let step = 0;
    let raf: number;
    // Define several pastel hues for a soft, multi-color gradient
    const pastelHues = [
      210, // blue
      170, // teal
      120, // green
      60,  // yellow
      330, // pink
      270, // purple
      20,  // peach
    ];
    const animate = () => {
      // Animate the hues in a circular fashion for smooth transitions
      const stops = pastelHues.map((baseHue, i) => {
        // Each color's phase is offset for a smooth, multi-color effect
        const phase = step / 320 + i * (Math.PI * 2 / pastelHues.length);
        const hue = baseHue + 18 * Math.sin(phase);
        const sat = 65 + 5 * Math.cos(phase);
        const light = 85 + 5 * Math.sin(phase + 1);
        return `hsl(${hue}, ${sat}%, ${light}%)`;
      });
      if (bgRef.current) {
        bgRef.current.style.background = `linear-gradient(120deg, ${stops.join(", ")})`;
      }
      step = (step + 1) % (320 * 2 * Math.PI); // slow
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={bgRef}
      className="flex justify-center items-center h-screen transition-colors duration-1000"
      style={{
        background: "linear-gradient(120deg, #c7d2fe, #fbcfe8, #fef9c3, #bbf7d0)",
        transition: "background 1s linear"
      }}
    >
      <Beatmaker />
    </div>
  );
}
