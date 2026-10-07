const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoMod = require('png-to-ico');
const pngToIco = pngToIcoMod.default || pngToIcoMod;

async function buildAllIcons() {
  console.log('🔄 Đang tạo bộ icon chuẩn Windows và Linux từ nguồn master...');
  const base64 = require('./electron/icon-base64.cjs');
  const masterPng = Buffer.from(base64, 'base64');

  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
  const pngBuffers = {};

  const dirs = [
    path.join(__dirname, 'electron/resources/icons'),
    path.join(__dirname, 'build/icons'),
    path.join(__dirname, 'build'),
  ];

  dirs.forEach(d => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });

  for (const size of sizes) {
    const resized = await sharp(masterPng)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();

    pngBuffers[size] = resized;
    fs.writeFileSync(path.join(__dirname, `electron/resources/icons/${size}x${size}.png`), resized);
    fs.writeFileSync(path.join(__dirname, `build/icons/${size}x${size}.png`), resized);
    console.log(` -> Đã tạo ${size}x${size}.png (${resized.length} bytes)`);
  }

  // Write 512x512 and 256x256 PNGs
  const master512 = pngBuffers[512];
  const master256 = pngBuffers[256];
  
  [
    path.join(__dirname, 'electron/resources/icon.png'),
    path.join(__dirname, 'electron/icon.png'),
    path.join(__dirname, 'build/icon.png'),
    path.join(__dirname, 'public/icon.png'),
    path.join(__dirname, 'public/pwa-512x512.png'),
  ].forEach(p => fs.writeFileSync(p, master512));

  // Generate 192x192 PNG for PWA
  const pwa192 = await sharp(masterPng)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(__dirname, 'public/pwa-192x192.png'), pwa192);

  // Generate Apple Touch Icon 180x180 (with subtle background for iOS)
  const appleTouch = await sharp(masterPng)
    .resize(180, 180, { fit: 'contain', background: { r: 24, g: 24, b: 27, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(__dirname, 'public/apple-touch-icon.png'), appleTouch);

  // Generate Maskable 512x512 icon with 15% safe-zone padding and background
  const innerIcon = await sharp(masterPng)
    .resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const maskable512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 24, g: 24, b: 27, alpha: 1 },
    }
  })
    .composite([{ input: innerIcon, top: 56, left: 56 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(__dirname, 'public/pwa-maskable-512x512.png'), maskable512);

  fs.writeFileSync(path.join(__dirname, 'public/favicon.png'), pngBuffers[64]);

  // Generate ICO with standard Windows sizes (16, 24, 32, 48, 64, 128, 256)
  const icoFilePaths = [
    path.join(__dirname, 'electron/resources/icons/16x16.png'),
    path.join(__dirname, 'electron/resources/icons/24x24.png'),
    path.join(__dirname, 'electron/resources/icons/32x32.png'),
    path.join(__dirname, 'electron/resources/icons/48x48.png'),
    path.join(__dirname, 'electron/resources/icons/64x64.png'),
    path.join(__dirname, 'electron/resources/icons/128x128.png'),
    path.join(__dirname, 'electron/resources/icons/256x256.png'),
  ];

  const icoBuffer = await pngToIco(icoFilePaths);

  [
    path.join(__dirname, 'build/icon.ico'),
    path.join(__dirname, 'electron/resources/icon.ico'),
    path.join(__dirname, 'electron/icon.ico'),
    path.join(__dirname, 'public/icon.ico'),
    path.join(__dirname, 'public/favicon.ico'),
  ].forEach(p => fs.writeFileSync(p, icoBuffer));

  console.log(`✅ Đã tạo thành công file icon.ico chuẩn Windows (${icoBuffer.length} bytes)!`);

  // Verify structure
  const numImages = icoBuffer.readUInt16LE(4);
  console.log(`🔎 Cấu trúc ICO: ${numImages} độ phân giải hợp lệ.`);
}

buildAllIcons().catch(err => {
  console.error('Lỗi tạo icon:', err);
  process.exit(1);
});
