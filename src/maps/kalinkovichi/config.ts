export const KALINKOVICHI_CONFIG = {
  name: 'Калинковичи',
  country: 'Беларусь',
  region: '04_eastern_europe',
  centerLat: 52.129,
  centerLon: 29.318,
  zoom: 16,
  mapSize: 4096,
  tileSize: 256,
  startPosition: { x: 2048, y: 2048 },
  playerHeight: 1.8,
  cameraHeight: 15,
  viewAngle: -Math.PI / 2, // top-down
  textures: {
    ground: '/textures/kalinkovichi/ground.webp',
    roads: '/textures/kalinkovichi/roads.webp',
    buildings: '/textures/kalinkovichi/buildings.webp'
  }
};
