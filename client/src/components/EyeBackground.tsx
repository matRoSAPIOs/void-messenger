import React, { useId } from 'react';

type EyeBackgroundProps = { contained?: boolean };

export default function EyeBackground({ contained = false }: EyeBackgroundProps) {
  const clipId = `eye-clip-${useId().replace(/:/g, '')}`;

  const svgStyle: React.CSSProperties = contained
    ? {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(600px, 100%)',
        height: 'min(600px, 100%)',
        maxWidth: '100%',
        maxHeight: '100%',
        opacity: 0.25,
        pointerEvents: 'none',
        zIndex: 0,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        opacity: 0.25,
        pointerEvents: 'none',
        zIndex: 0,
      };

  const svg = (
    <svg
      style={svgStyle}
      viewBox="0 0 680 680"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{`
        @keyframes rotate1{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes rotate2{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
        @keyframes rotate3{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .bg-o1{transform-origin:340px 340px;animation:rotate1 12s linear infinite}
        .bg-o2{transform-origin:340px 340px;animation:rotate2 20s linear infinite}
        .bg-o3{transform-origin:340px 340px;animation:rotate3 35s linear infinite}
      `}</style>

      <circle cx="340" cy="340" r="200" fill="none" stroke="#7850ff" strokeWidth="0.3" opacity="0.8"/>
      <circle cx="340" cy="340" r="260" fill="none" stroke="#7850ff" strokeWidth="0.3" opacity="0.5"/>

      <g className="bg-o3">
        <circle cx="340" cy="340" r="160" fill="none" stroke="#3a2060" strokeWidth="0.5" strokeDasharray="2 8"/>
        <circle cx="340" cy="180" r="2.5" fill="#5030a0"/>
        <circle cx="340" cy="500" r="1.5" fill="#5030a0"/>
      </g>
      <g className="bg-o2">
        <ellipse cx="340" cy="340" rx="120" ry="50" fill="none" stroke="#7850ff" strokeWidth="0.8" opacity="0.8" transform="rotate(-30 340 340)"/>
        <circle cx="460" cy="340" r="3" fill="#9070ff"/>
      </g>
      <g className="bg-o1">
        <ellipse cx="340" cy="340" rx="90" ry="35" fill="none" stroke="#a080ff" strokeWidth="1" opacity="0.6" transform="rotate(20 340 340)"/>
        <circle cx="430" cy="340" r="4" fill="#c0a0ff"/>
        <circle cx="250" cy="340" r="2" fill="#8060d0"/>
      </g>

      <circle cx="340" cy="340" r="55" fill="none" stroke="#7850ff" strokeWidth="2" opacity="0.9"/>
      <circle cx="340" cy="340" r="42" fill="#0d0d20" opacity="0.5"/>

      <clipPath id={clipId}>
        <ellipse cx="340" cy="340" rx="27" ry="19"/>
      </clipPath>

      <ellipse cx="340" cy="340" rx="27" ry="19" fill="#0a0818" opacity="0.8"/>
      <ellipse cx="340" cy="340" rx="27" ry="19" fill="none" stroke="#9070ff" strokeWidth="1.5"/>

      <g clipPath={`url(#${clipId})`}>
        <circle cx="340" cy="340" r="12" fill="#7850ff" opacity="0.95"/>
        <circle cx="340" cy="340" r="6" fill="#b090ff"/>
        <circle cx="344" cy="336" r="2.5" fill="white" opacity="0.9"/>
      </g>

      <ellipse cx="340" cy="321" rx="27" ry="0" fill="#080810"/>
      <ellipse cx="340" cy="359" rx="27" ry="0" fill="#080810"/>
    </svg>
  );

  if (contained) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
        }}
      >
        {svg}
      </div>
    );
  }
  return svg;
}
