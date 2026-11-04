import { useLayoutEffect, useRef } from "react";

function waterPath(level, time) {
  const tau = Math.PI * 2;
  let path = "";
  for (let x = -4; x <= 404; x += 4) {
    const u = x / 400;
    const swell = 10 * Math.sin(tau * u * 1.1 - time)
      + 3 * Math.sin(tau * u * 2.2 + time * 0.63);
    path += `${x === -4 ? "M" : "L"}${x},${(level + swell).toFixed(2)} `;
  }
  // Close the surface below the card so the water is one continuous fill.
  return `${path}L404,504 L-4,504 Z`;
}

export default function LiquidWave({ children }) {
  const wrapperRef = useRef(null);
  const bodyRef = useRef(null);
  const pathRef = useRef(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const body = bodyRef.current;
    const path = pathRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let phase = 0;
    let previousTime = 0;
    let frame = 0;
    let level = 345;

    function paint() {
      path.setAttribute("d", waterPath(level, phase));
    }

    function draw(now) {
      frame = 0;
      const elapsed = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 0;
      previousTime = now;
      if (!reducedMotion.matches) phase += elapsed * 1.3;
      paint();
      if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function refresh() {
      if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function measure() {
      const height = wrapper.getBoundingClientRect().height;
      if (height > 0) {
        level = 500 - body.getBoundingClientRect().height / height * 500 - 24;
        paint();
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        previousTime = 0;
        refresh();
      }
    }

    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    observer.observe(body);
    reducedMotion.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    measure();
    refresh();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reducedMotion.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <div className="aura-wave-wrapper" ref={wrapperRef}>
      <svg className="aura-liquid" viewBox="0 0 400 500" preserveAspectRatio="none" aria-hidden="true">
        <path ref={pathRef} d="M-4 345 Q100 330 200 345 T404 345 V504 H-4Z" />
      </svg>
      <div className="aura-wave-body" ref={bodyRef}>
        {children}
      </div>
    </div>
  );
}
