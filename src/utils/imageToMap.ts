export async function imageToMap(file: File, size = 64): Promise<number[][]> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('load fail'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const grid: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const h = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
      row.push(h);
    }
    grid.push(row);
  }
  URL.revokeObjectURL(url);
  return grid;
}
