export type Lang = 'ru' | 'en';

export const I18N: Record<Lang, Record<string, string>> = {
  ru: {
    title: 'Мезонин',
    subtitle: 'Загрузите изображение — оно станет картой высот террейна',
    upload: 'Загрузить карту высот',
    uploaded: 'Карта высот загружена',
    generating: 'Генерация карты высот...',
    ready: 'Карта готова',
    startGame: 'Начать игру',
    back: 'Назад к загрузке',
    controls: 'WASD / Стрелки — движение, Колесо мыши / + - — зум',
    heightmap: 'Карта высот',
    blocks: 'блоков',
    terrain: 'Террейн',
    topDown: 'Вид сверху (Diablo-подобный)',
    loading: 'Загрузка террейна...'
  },
  en: {
    title: 'Mezzanine',
    subtitle: 'Upload an image to use it as a heightmap for terrain generation',
    upload: 'Upload heightmap',
    uploaded: 'Heightmap loaded',
    generating: 'Generating heightmap...',
    ready: 'Map ready',
    startGame: 'Start Game',
    back: 'Back to map loader',
    controls: 'WASD / Arrows - Move, Mouse wheel / + - - Zoom',
    heightmap: 'Heightmap',
    blocks: 'blocks',
    terrain: 'Terrain',
    topDown: 'Top-down view (Diablo-like)',
    loading: 'Loading terrain...'
  }
};

export function t(lang: Lang, key: string): string {
  return I18N[lang][key] || key;
}

export type Heightmap = number[][];

export interface TerrainConfig {
  size: number;
  maxHeight: number;
  blockSize: number;
  seed?: number;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  size: 64,
  maxHeight: 12,
  blockSize: 1
};

export class TerrainGenerator {
  config: TerrainConfig;

  constructor(config: Partial<TerrainConfig> = {}) {
    this.config = { ...DEFAULT_TERRAIN_CONFIG, ...config };
  }

  fromImageData(data: Uint8ClampedArray, width: number, height: number): Heightmap {
    const size = this.config.size;
    const grid: Heightmap = Array(size).fill(0).map(() => Array(size).fill(0));

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sx = Math.floor((x / size) * width);
        const sy = Math.floor((y / size) * height);
        const idx = (sy * width + sx) * 4;
        const r = data[idx] || 0;
        const g = data[idx + 1] || 0;
        const b = data[idx + 2] || 0;
        const avg = (r + g + b) / 3;
        grid[y][x] = Math.max(0, Math.min(1, avg / 255));
      }
    }
    return grid;
  }

  fromFile(file: File): Promise<Heightmap> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = this.config.size;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('canvas context failed'));
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size);
        const grid = this.fromImageData(imageData.data, size, size);
        URL.revokeObjectURL(url);
        resolve(grid);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image load failed'));
      };
      img.src = url;
    });
  }

  generate(seed: number = Date.now()): Heightmap {
    const size = this.config.size;
    const grid: Heightmap = Array(size).fill(0).map(() => Array(size).fill(0));
    const rnd = (n: number) => {
      const x = Math.sin(n + seed) * 10000;
      return x - Math.floor(x);
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / size - 0.5;
        const ny = y / size - 0.5;
        const v = (rnd(x * 131542391 + y) * 0.5 + rnd(x * 1009 + y * 9176) * 0.3 + (1 - Math.sqrt(nx*nx+ny*ny)*2)) * 0.4;
        grid[y][x] = Math.max(0, Math.min(1, v));
      }
    }
    return grid;
  }

  getHeight(grid: Heightmap, x: number, z: number): number {
    const size = grid.length;
    const sx = Math.max(0, Math.min(size - 1, Math.floor(x)));
    const sz = Math.max(0, Math.min(size - 1, Math.floor(z)));
    const h = grid[sz][sx];
    return Math.floor(h * this.config.maxHeight);
  }
}

export function heightmapToMeshData(grid: Heightmap, blockSize: number = 1, maxHeight: number = 12) {
  const size = grid.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let idx = 0;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const h = Math.max(0, Math.min(maxHeight, Math.floor(grid[z][x] * maxHeight)));
      for (let y = 0; y < h; y++) {
        const px = (x - size / 2) * blockSize;
        const py = y * blockSize;
        const pz = (z - size / 2) * blockSize;
        const bs = blockSize * 0.5;
        positions.push(px-bs,py-bs,pz-bs, px+bs,py-bs,pz-bs, px+bs,py+bs,pz-bs, px-bs,py+bs,pz-bs);
        positions.push(px-bs,py-bs,pz+bs, px+bs,py-bs,pz+bs, px+bs,py+bs,pz+bs, px-bs,py+bs,pz+bs);
        const base = idx * 4;
        indices.push(base,base+1,base+2, base,base+2,base+3);
        indices.push(base+4,base+5,base+6, base+4,base+6,base+7);
        idx += 2;
        let r=0.29,g=0.49,b=0.35;
        if (y === h-1) { r=0.29; g=0.49; b=0.35; }
        else if (y === 0) { r=0.42; g=0.37; b=0.25; }
        else { r=0.5; g=0.37; b=0.25; }
        for(let i=0;i<16;i++){ colors.push(r,g,b); }
      }
    }
  }
  return { positions, normals, colors, indices };
}
