interface NightHudFrameProps {
  /** Small identifier shown in the top-left corner, e.g. "KALINKOVICHI · 3D". */
  label: string;
  /** Live readout shown in the top-right corner. */
  readout?: string;
}

/**
 * Cockpit frame for the night views: CRT scanlines, RGB mask, vignette, a
 * perspective RGB floor and corner brackets.
 *
 * All of it is decorative and `pointer-events: none`, so the drag-to-pan
 * surface underneath keeps working; the actual data lives in the sibling HUD
 * panel, not here.
 */
export function NightHudFrame({ label, readout }: NightHudFrameProps) {
  return (
    <div aria-hidden="true">
      <div className="rgb-grid" />
      <div className="crt-overlay" />
      <div className="crt-vignette" />
      <div className="hud-frame" />

      <div className="pointer-events-none absolute left-5 top-4 z-20">
        <div className="nasa-label">{label}</div>
        <div className="mt-1 h-px w-24 bg-gradient-to-r from-sky-400/70 to-transparent" />
      </div>

      {readout && (
        <div className="pointer-events-none absolute right-5 top-4 z-20 text-right">
          <div className="nasa-label">Телеметрия</div>
          <div className="nasa-readout mt-1 text-xs text-sky-200">{readout}</div>
        </div>
      )}
    </div>
  );
}
