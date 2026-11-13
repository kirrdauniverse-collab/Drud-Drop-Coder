// Helper-ek újratelepítése a tesztekhez (újratöltés után)
(() => {
  const sel = () => document.querySelector('canvas[width="960"]');
  window.__click = (px, py) => {
    const c = sel(); const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('click', { clientX: r.x + r.width * px, clientY: r.y + r.height * py, bubbles: true }));
    return 'ok';
  };
  window.__move = (px, py) => {
    const c = sel(); const r = c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.x + r.width * px, clientY: r.y + r.height * py, bubbles: true }));
    return 'ok';
  };
  window.__sample = () => {
    const c = sel(); const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, 960, 540).data;
    const cell = (x, y) => { const i = (Math.floor(y) * 960 + Math.floor(x)) * 4; return d[i] + ',' + d[i + 1] + ',' + d[i + 2]; };
    const rows = [];
    for (let gy = 0; gy < 4; gy++) {
      const row = [];
      for (let gx = 0; gx < 6; gx++) row.push(cell(80 + gx * 160, 90 + gy * 120));
      rows.push(row.join('|'));
    }
    return rows.join('\n');
  };
  window.__log = () => document.querySelector('[aria-live=polite]').textContent.replace('ESÉMÉNYNAPLÓ', '').slice(-450);
  return 'helpers ok';
})()
