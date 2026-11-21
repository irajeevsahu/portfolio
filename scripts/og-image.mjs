// Regenerates public/og.png (the link-preview image) from an SVG template.
// Run after changing your title: `node scripts/og-image.mjs`
import sharp from 'sharp';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0b0b0d"/>
  <rect x="0" y="0" width="1200" height="6" fill="#2dd4bf"/>
  <text x="80" y="120" font-family="Menlo, monospace" font-size="28" fill="#2dd4bf">rajeevsahu.me</text>
  <text x="80" y="300" font-family="Helvetica, Arial, sans-serif" font-size="88" font-weight="700" fill="#e7e7ea">Rajeev Sahu</text>
  <text x="80" y="375" font-family="Helvetica, Arial, sans-serif" font-size="40" fill="#9a9aa6">Senior Backend Engineer</text>
  <text x="80" y="520" font-family="Menlo, monospace" font-size="30" fill="#9a9aa6">Node.js · Go · Python · AWS · Distributed systems</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(new URL('../public/og.png', import.meta.url).pathname);
console.log('wrote public/og.png');
