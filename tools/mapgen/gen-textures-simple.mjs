import { writeFileSync } from 'fs';

// Create simple data URLs as fallback - we'll generate with sharp if available or just note
console.log('Note: canvas not installed, creating placeholder approach');
console.log('Use sharp or install canvas for texture generation');
writeFileSync('public/textures/kalinkovichi/ground_placeholder.txt', 'Need to generate textures');
