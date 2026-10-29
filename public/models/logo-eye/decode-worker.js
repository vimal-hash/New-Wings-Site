/* Original revision-16 point format. Runs only after the eye is eligible. */
function decodeEyeBuffer(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 48 || view.getUint32(0, true) !== 0x31455945 || view.getUint16(4, true) !== 1 || view.getUint16(6, true) !== 9) throw Error('Invalid eye point header');
  const count = view.getUint32(8, true);
  if (!count || count > 300000 || buffer.byteLength !== 48 + count * 9) throw Error('Invalid eye point length');
  const min = [12, 16, 20].map(o => view.getFloat32(o, true));
  const extent = [24, 28, 32].map(o => view.getFloat32(o, true));
  const radiusMax = view.getFloat32(36, true);
  if (![...min, ...extent, radiusMax].every(Number.isFinite) || extent.some(v => v <= 0) || radiusMax <= 0) throw Error('Invalid eye point bounds');
  const positions = new Uint16Array(count * 3), grains = new Uint8Array(count * 3);
  let offset = 48;
  for (let axis = 0; axis < 3; axis++) {
    let previous = 0;
    for (let i = 0; i < count; i++, offset += 2) {
      previous = (previous + view.getUint16(offset, true)) & 65535;
      positions[i * 3 + axis] = previous;
    }
  }
  for (let axis = 0; axis < 3; axis++) for (let i = 0; i < count; i++) grains[i * 3 + axis] = view.getUint8(offset++);
  return { count, min, extent, radiusMax, positions, grains };
}
self.onmessage = async event => {
  try {
    const started = performance.now(), response = await fetch(event.data.url, { credentials: 'same-origin' });
    if (!response.ok) throw Error(`Eye points: HTTP ${response.status}`);
    const packed = await response.arrayBuffer();
    const bytes = new Uint8Array(packed);
    const raw = bytes[0] === 31 && bytes[1] === 139
      ? await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      : packed;
    const decoded = decodeEyeBuffer(raw);
    self.postMessage({ ...decoded, loadDecodeMs: performance.now() - started }, [decoded.positions.buffer, decoded.grains.buffer]);
  } catch (error) { self.postMessage({ error: String(error) }); }
};
