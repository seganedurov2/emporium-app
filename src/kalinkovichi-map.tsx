import { KalinkovichiGame } from './components/world/KalinkovichiGame';

export function KalinkovichiMapView({ onExit }: { onExit?: () => void }) {
  return <KalinkovichiGame onExit={onExit} />;
}

export { KalinkovichiGame, KalinkovichiScene } from './components/world';
export { KALINKOVICHI_CONFIG } from './maps/kalinkovichi/config';
