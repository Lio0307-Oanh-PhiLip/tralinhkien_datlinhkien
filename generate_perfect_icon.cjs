const fs = require('fs');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="50%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#065f46"/>
    </linearGradient>
    <linearGradient id="labelBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- App Rounded Squircle Background -->
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#bg)" filter="url(#shadow)"/>

  <!-- Thermal Label Paper Shape -->
  <rect x="80" y="100" width="352" height="300" rx="24" fill="url(#labelBg)" stroke="#dcfce7" stroke-width="4" filter="url(#shadow)"/>

  <!-- Label Header Green Strip -->
  <path d="M 80 124 Q 80 100 104 100 L 408 100 Q 432 100 432 124 L 432 165 L 80 165 Z" fill="#047857"/>
  <text x="105" y="146" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="24" letter-spacing="1.5">OPPO LABEL</text>
  
  <!-- Mini Thermal Tag Pill -->
  <rect x="330" y="122" width="85" height="28" rx="14" fill="#064e3b"/>
  <text x="372" y="142" fill="#86efac" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="bold" font-size="13" text-anchor="middle">3x2 INCH</text>

  <!-- Barcode Simulation on Thermal Label -->
  <g fill="#1e293b">
    <rect x="105" y="195" width="8" height="85" rx="2"/>
    <rect x="120" y="195" width="14" height="85" rx="2"/>
    <rect x="142" y="195" width="6" height="85" rx="2"/>
    <rect x="155" y="195" width="18" height="85" rx="2"/>
    <rect x="180" y="195" width="8" height="85" rx="2"/>
    <rect x="195" y="195" width="16" height="85" rx="2"/>
    <rect x="218" y="195" width="10" height="85" rx="2"/>
    <rect x="235" y="195" width="18" height="85" rx="2"/>
    <rect x="260" y="195" width="6" height="85" rx="2"/>
    <rect x="273" y="195" width="12" height="85" rx="2"/>
  </g>

  <!-- QR Code Simulation Block -->
  <g fill="#047857">
    <!-- QR Outer box 1 -->
    <rect x="320" y="195" width="85" height="85" rx="12" fill="#047857"/>
    <rect x="328" y="203" width="69" height="69" rx="8" fill="#ffffff"/>
    <rect x="338" y="213" width="49" height="49" rx="4" fill="#047857"/>
    <rect x="347" y="222" width="31" height="31" rx="2" fill="#ffffff"/>
    <rect x="354" y="229" width="17" height="17" rx="1" fill="#047857"/>
  </g>

  <!-- Label Bottom Details -->
  <text x="105" y="318" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="bold" font-size="20">HCM4 LINH KIỆN IN TEM</text>
  <text x="105" y="348" fill="#64748b" font-family="monospace" font-weight="600" font-size="16" letter-spacing="1">MÃ SP: 621033000403</text>
  
  <line x1="105" y1="365" x2="410" y2="365" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6,4"/>
  <text x="105" y="386" fill="#047857" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="13">BARCODE &amp; QR THERMAL STUDIO</text>
</svg>`;

fs.writeFileSync('./public/oppo-label-icon.svg', svg);
fs.writeFileSync('./public/icon.svg', svg);
fs.writeFileSync('./public/favicon.svg', svg);
console.log('Saved SVG icons and favicon!');
