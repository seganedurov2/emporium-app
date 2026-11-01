import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MAPS_DIR = join(ROOT, 'src', 'maps', 'kalinkovichi');
const TEXTURES_DIR = join(ROOT, 'public', 'textures', 'kalinkovichi');
const COORDS_FILE = join(ROOT, 'public', 'kalinkovichi-coordinates.json');

const MAP_SIZE = 2048;
const TILE_SIZE = 256;
const ZOOM = 16;

let centerLat = 52.128814;
let centerLon = 29.332527;

// Auto-accept coordinates from Yandex Maps JSON if present
if (existsSync(COORDS_FILE)) {
  try {
    const saved = JSON.parse(readFileSync(COORDS_FILE, 'utf8'));
    if (typeof saved.centerLat === 'number' && typeof saved.centerLon === 'number') {
      centerLat = saved.centerLat;
      centerLon = saved.centerLon;
      console.log(`Coordinates loaded from ${COORDS_FILE}: ${centerLat}, ${centerLon}`);
    }
  } catch {
    // ignore, use defaults
  }
}

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--lat' && args[i + 1]) { centerLat = parseFloat(args[i + 1]); i++; }
  if (args[i] === '--lon' && args[i + 1]) { centerLon = parseFloat(args[i + 1]); i++; }
}

function deg2rad(d) { return d * Math.PI / 180; }
function latToTileY(lat, zoom) {
  return (1 - Math.log(Math.tan(deg2rad(lat)) + 1 / Math.cos(deg2rad(lat))) / Math.PI) / 2 * Math.pow(2, zoom);
}
function lonToTileX(lon, zoom) {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

function buildTiles() {
  const tileX = lonToTileX(centerLon, ZOOM);
  const tileY = latToTileY(centerLat, ZOOM);
  const tilesX = Math.ceil(MAP_SIZE / TILE_SIZE);
  const tilesY = Math.ceil(MAP_SIZE / TILE_SIZE);
  const offsetX = Math.floor(tileX - tilesX / 2);
  const offsetY = Math.floor(tileY - tilesY / 2);

  console.log(`Generating ${tilesX}x${tilesY} tile grid for Kalinkovichi...`);
  console.log(`Center: ${centerLat}, ${centerLon}`);
  console.log(`Tile origin: ${offsetX}, ${offsetY} at zoom ${ZOOM}`);

  mkdirSync(TEXTURES_DIR, { recursive: true });

  const tiles = [];
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      tiles.push({ x: offsetX + tx, y: offsetY + ty, z: ZOOM });
    }
  }

  return { tilesX, tilesY, tiles };
}

const { tilesX, tilesY, tiles } = buildTiles();

// Write terrain config
const config = {
  name: 'Калинковичи',
  country: 'Беларусь',
  region: '04_eastern_europe',
  centerLat,
  centerLon,
  zoom: ZOOM,
  mapSize: MAP_SIZE,
  tileSize: TILE_SIZE,
  startPosition: { x: MAP_SIZE / 2, y: MAP_SIZE / 2 },
  playerHeight: 1.8,
  cameraHeight: 15,
  viewAngle: -Math.PI / 2,
  tileCount: { x: tilesX, y: tilesY },
  tileOrigin: { x: tiles[0].x, y: tiles[0].y },
  textures: {
    ground: '/textures/kalinkovichi/ground.webp',
    roads: '/textures/kalinkovichi/roads.webp',
    buildings: '/textures/kalinkovichi/buildings.webp'
  }
};

writeFileSync(join(MAPS_DIR, 'terrain.json'), JSON.stringify(config, null, 2));

// Generate placeholder textures (1x1 colored pixels encoded as data URIs would be ideal;
// here we emit an index manifest so the renderer knows tiles exist)
const manifest = {
  center: { lat: centerLat, lon: centerLon },
  zoom: ZOOM,
  tiles: tiles.map(t => `${t.z}/${t.x}/${t.y}.png`)
};
writeFileSync(join(TEXTURES_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Generated ${tiles.length} tiles`);
console.log('Terrain config written to src/maps/kalinkovichi/terrain.json');
console.log('Texture manifest written to public/textures/kalinkovichi/manifest.json');
console.log('Map generator ready');
