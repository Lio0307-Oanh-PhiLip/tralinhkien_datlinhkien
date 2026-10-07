const fs = require('fs');

// We can create a crisp, professional SVG for OPPO Label Studio and write it
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#008353"/>
      <stop offset="50%" stop-color="#00663e"/>
      <stop offset="100%" stop-color="#004d2f"/>
    </linearGradient>
    <linearGradient id="labelBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f0fdf4"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- App Rounded Squircle Background -->
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#bg)" filter="url(#shadow)"/>

  <!-- Thermal Label Paper Shape -->
  <rect x="90" y="110" width="332" height="280" rx="20" fill="url(#labelBg)" stroke="#dcfce7" stroke-width="4" filter="url(#shadow)"/>

  <!-- Label Header Green Strip -->
  <path d="M 90 130 Q 90 110 110 110 L 402 110 Q 422 110 422 130 L 422 165 L 90 165 Z" fill="#008353"/>
  <text x="110" y="148" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="24" letter-spacing="1.5">OPPO LABEL</text>
  
  <!-- Mini Thermal Tag Pill -->
  <rect x="325" y="125" width="80" height="26" rx="13" fill="#004d2f"/>
  <text x="365" y="143" fill="#86efac" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="bold" font-size="13" text-anchor="middle">3x2 INCH</text>

  <!-- Barcode Simulation on Thermal Label -->
  <g fill="#1e293b">
    <rect x="115" y="195" width="8" height="85" rx="2"/>
    <rect x="130" y="195" width="14" height="85" rx="2"/>
    <rect x="152" y="195" width="6" height="85" rx="2"/>
    <rect x="165" y="195" width="18" height="85" rx="2"/>
    <rect x="190" y="195" width="8" height="85" rx="2"/>
    <rect x="205" y="195" width="16" height="85" rx="2"/>
    <rect x="228" y="195" width="10" height="85" rx="2"/>
    <rect x="245" y="195" width="18" height="85" rx="2"/>
    <rect x="270" y="195" width="6" height="85" rx="2"/>
    <rect x="283" y="195" width="12" height="85" rx="2"/>
  </g>

  <!-- QR Code Simulation Block -->
  <g fill="#008353">
    <!-- QR Outer box 1 -->
    <rect x="318" y="195" width="85" height="85" rx="12" fill="#008353"/>
    <rect x="326" y="203" width="69" height="69" rx="8" fill="#ffffff"/>
    <rect x="336" y="213" width="49" height="49" rx="4" fill="#008353"/>
    <rect x="345" y="222" width="31" height="31" rx="2" fill="#ffffff"/>
    <rect x="352" y="229" width="17" height="17" rx="1" fill="#008353"/>
  </g>

  <!-- Label Bottom Details -->
  <text x="115" y="315" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="bold" font-size="20">LINH KIỆN HCM4</text>
  <text x="115" y="342" fill="#64748b" font-family="monospace" font-weight="600" font-size="16" letter-spacing="1">MÃ SP: 621033000403</text>
  
  <line x1="115" y1="358" x2="400" y2="358" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6,4"/>
  <text x="115" y="378" fill="#008353" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="14">AUTO-PRINT &amp; THERMAL READY</text>
</svg>`;

fs.writeFileSync('./public/oppo-label-icon.svg', svg);
fs.writeFileSync('./public/icon.svg', svg);
fs.writeFileSync('./public/favicon.svg', svg);
console.log('Created SVG icons and favicon!');
