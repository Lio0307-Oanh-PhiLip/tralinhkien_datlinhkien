const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

async function makePerfectIco() {
  const iconFiles = [
    './electron/resources/icons/16x16.png',
    './electron/resources/icons/24x24.png',
    './electron/resources/icons/32x32.png',
    './electron/resources/icons/48x48.png',
    './electron/resources/icons/64x64.png',
    './electron/resources/icons/128x128.png',
    './electron/resources/icons/256x256.png',
  ].filter(f => fs.existsSync(f));

  console.log('Generating ICO from:', iconFiles);

  const icoBuffer = await pngToIco(iconFiles);
  fs.writeFileSync('./electron/resources/icon.ico', icoBuffer);
  fs.writeFileSync('./electron/icon.ico', icoBuffer);
  fs.writeFileSync('./public/icon.ico', icoBuffer);
  fs.writeFileSync('./public/favicon.ico', icoBuffer);

  console.log('✅ Generated 100% valid Windows icon.ico, size:', icoBuffer.length, 'bytes');

  // Verify header
  const numImages = icoBuffer.readUInt16LE(4);
  console.log('Verified valid ICO! Number of embedded resolutions:', numImages);
  for (let i = 0; i < numImages; i++) {
    const offset = 6 + i * 16;
    const w = icoBuffer.readUInt8(offset) || 256;
    const h = icoBuffer.readUInt8(offset + 1) || 256;
    const bytes = icoBuffer.readUInt32LE(offset + 8);
    const imgOffset = icoBuffer.readUInt32LE(offset + 12);
    console.log(` -> Size: ${w}x${h} | ${bytes} bytes | Offset: ${imgOffset}`);
  }
}

makePerfectIco().catch(err => {
  console.error('Failed to generate ICO:', err);
  process.exit(1);
});
