const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = path.join(__dirname, 'icons');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function buildSvg(size) {
  const cx = size / 2;
  const cy = size * 0.42;
  const r = size * 0.27;
  // Crescent: outer circle minus inner offset circle
  const innerR = r * 0.82;
  const offsetX = cx + r * 0.38;
  const offsetY = cy - r * 0.15;

  const fontSize = size * 0.155;
  const textY = size * 0.84;
  const letterSpacing = size * 0.04;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#2D1F1A"/>
  <defs>
    <mask id="moon">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="white"/>
      <circle cx="${offsetX}" cy="${offsetY}" r="${innerR}" fill="black"/>
    </mask>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#E8C5BC" mask="url(#moon)"/>
  <text
    x="${cx}"
    y="${textY}"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-size="${fontSize}"
    font-weight="600"
    fill="#E8C5BC"
    letter-spacing="${letterSpacing}"
  >LUA</text>
</svg>`;
}

(async () => {
  for (const size of sizes) {
    const svg = Buffer.from(buildSvg(size));
    const outPath = path.join(outDir, `icon-${size}x${size}.png`);
    await sharp(svg).png().toFile(outPath);
    console.log(`✓ icon-${size}x${size}.png`);
  }
  console.log('Ícones gerados em /icons/');
})();
