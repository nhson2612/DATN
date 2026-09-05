import React from "react";

export default function Logo({ className = "w-12 h-12" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Wanderlust Logo"
    >
      <defs>
        <linearGradient id="wlOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff7e47" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>

        <linearGradient id="wlEmeraldGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#064e3b" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>

        <linearGradient id="wlGoldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* Background Subtle Ring */}
      <circle cx="60" cy="60" r="54" stroke="url(#wlOrangeGrad)" strokeWidth="2.5" opacity="0.25" strokeDasharray="6 4" />

      {/* Outer Compass Points (N, S, E, W marks) */}
      <polygon points="60,10 63,18 57,18" fill="url(#wlOrangeGrad)" />
      <polygon points="60,110 63,102 57,102" fill="url(#wlOrangeGrad)" opacity="0.6" />
      <polygon points="110,60 102,63 102,57" fill="url(#wlOrangeGrad)" opacity="0.6" />
      <polygon points="10,60 18,63 18,57" fill="url(#wlOrangeGrad)" opacity="0.6" />

      {/* Mountain Twin Peaks */}
      <path
        d="M 28,78 L 52,38 L 68,62 L 80,46 L 94,78 Z"
        fill="url(#wlEmeraldGrad)"
      />
      <path
        d="M 52,38 L 60,50 L 52,54 L 42,50 Z"
        fill="#ffffff"
        opacity="0.35"
      />
      <path
        d="M 80,46 L 85,55 L 80,58 L 74,54 Z"
        fill="#ffffff"
        opacity="0.35"
      />

      {/* Dynamic Fluid Wave Underneath */}
      <path
        d="M 20,74 Q 40,64 60,74 T 100,74 C 95,84 80,90 60,90 C 40,90 25,84 20,74 Z"
        fill="url(#wlOrangeGrad)"
      />
      <path
        d="M 24,78 Q 44,70 60,78 T 96,78"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />

      {/* Compass Star Core Overlay */}
      <g transform="translate(60, 42)">
        <polygon points="0,-16 4,-4 16,0 4,4 0,16 -4,4 -16,0 -4,-4" fill="url(#wlGoldAccent)" />
        <circle cx="0" cy="0" r="3" fill="#ffffff" />
      </g>
    </svg>
  );
}
