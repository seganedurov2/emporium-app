import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

const size = 2048;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Ground texture - grass
ctx.fillStyle = '#2d5a27';
ctx.fillRect(0, 0, size, size);

// Add some variation
for (let i = 0; i < 10000; i++) {
  const x = Math.random() * size;
  const y = Math.random() * size;
  ctx.fillStyle = Math.random() > 0.5 ? '#3a6b32' : '#264a21';
  ctx.fillRect(x, y, 2, 2);
}

// Roads
ctx.fillStyle = '#4a4a4a';
ctx.fillRect(900, 0, 248, size); // vertical road
ctx.fillRect(0, 900, size, 248); // horizontal road

// Road markings
ctx.fillStyle = '#f0f0f0';
ctx.fillRect(1018, 0, 12, size);
ctx.fillRect(0, 1018, size, 12);

writeFileSync('public/textures/kalinkovichi/ground.webp', canvas.toBuffer('image/webp'));
console.log('Ground texture generated');
