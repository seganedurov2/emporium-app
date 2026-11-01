export default async function run(page) {
  return page.evaluate(() => {
    // Reproduce the loop exactly, on a fresh canvas, independent of React.
    const canvas = document.createElement("canvas");
    canvas.width = 992;
    canvas.height = 608;
    const ctx = canvas.getContext("2d");
    const w = 992,
      h = 608;
    ctx.fillStyle = "#1a4d2e";
    ctx.fillRect(0, 0, w, h);

    const size = 64,
      tile = 48;
    const anchorSpan = 28;
    const ox = w / 2;
    const oy = h / 2 - (anchorSpan * tile) / 8;

    const half = tile / 2,
      q = tile / 4;
    const heightColor = (v) =>
      v < 0.2
        ? "#4a9b3c"
        : v < 0.4
          ? "#6aa84f"
          : v < 0.6
            ? "#8b7355"
            : v < 0.8
              ? "#7a6244"
              : "#6b5b4a";
    let drawn = 0,
      culled = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cx = ((x - y) * tile) / 2 + ox;
        const cy = ((x + y) * tile) / 4 + oy;
        if (cx + half + 2 < 0 || cx - half - 2 > w) {
          culled++;
          continue;
        }
        if (cy + half + 2 < 0 || cy - half - 2 > h) {
          culled++;
          continue;
        }
        drawn++;
        const col = heightColor(0.35);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + half, cy + q);
        ctx.lineTo(cx, cy + q * 2);
        ctx.lineTo(cx - half, cy + q);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.stroke();
      }
    }
    const d = ctx.getImageData(0, 0, w, h).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 4 * 17)
      set.add(d[i] + "," + d[i + 1] + "," + d[i + 2]);
    return { drawn, culled, distinct: set.size, ox, oy };
  });
}
