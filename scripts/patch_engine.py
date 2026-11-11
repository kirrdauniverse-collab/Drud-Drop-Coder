#!/usr/bin/env python3
"""engine.ts sebészet: a beépített rajzoló metódusok cseréje közös modulhívásokra."""
import re

P = "/home/z/my-project/src/lib/engine.ts"
src = open(P, encoding="utf-8").read()
orig_len = len(src)

def replace_between(s, start_marker, end_marker, new, include_start=True, include_end=False):
    i = s.find(start_marker)
    assert i != -1, f"start not found: {start_marker[:60]}"
    j = s.find(end_marker, i + len(start_marker))
    assert j != -1, f"end not found: {end_marker[:60]}"
    a = i if include_start else i + len(start_marker)
    b = j + len(end_marker) if include_end else j
    return s[:a] + new + s[b:]

# 1) render() switch: ship / meteor / star / cloud delegálása
old = """      switch (e.kind) {
        case "ship":
          this.drawShip(ctx, e);
          break;
        case "meteor":
          this.drawMeteor(ctx, e);
          break;
        case "star":
          this.drawStar(ctx, e, now);
          break;
        case "cloud":
          this.drawCloud(ctx, e);
          break;"""
new = """      switch (e.kind) {
        case "ship":
          drawShipSprite(ctx, e.size, e.color);
          break;
        case "meteor":
          ctx.rotate(e.rotation);
          drawMeteorSprite(ctx, e.size, e.poly);
          break;
        case "star":
          drawStarSprite(ctx, e.size, e.id, now);
          break;
        case "cloud":
          drawCloudSprite(ctx, e.size, e.color);
          break;"""
assert old in src, "render switch nem található"
src = src.replace(old, new)

# 2) shape ág: drawSprite hívás
old = """        case "shape":
          if (e.role === "platform") this.drawPlatformBox(ctx, e);
          else this.drawShape(ctx, e, now);
          break;"""
new = """        case "shape":
          if (e.role === "platform") this.drawPlatformBox(ctx, e);
          else drawSprite(ctx, e.style, {
            size: e.size, color: e.color, vx: e.vx, id: e.id, now,
            rotation: e.spin ? e.rotation : 0, poly: e.poly,
          });
          break;"""
assert old in src, "shape case nem található"
src = src.replace(old, new)

# 3) drawShape metódus törlése (drawPlatformBox-ig minden)
src = replace_between(
    src,
    "  private drawShape(ctx: CanvasRenderingContext2D, e: Entity, now: number) {",
    "  private drawPlatformBox(",
    "",
)

# 4) drawShip / drawMeteor / drawStar / drawCloud törlése (drawShip-tól drawHud-ig)
src = replace_between(
    src,
    "  private drawShip(ctx: CanvasRenderingContext2D, e: Entity) {",
    "  private drawHud(",
    "",
)

# 5) drawBgBase: preset switch → drawBgPreset hívás; this.shade → shade
i = src.find("  private drawBgBase(ctx: CanvasRenderingContext2D, now: number) {")
assert i != -1
j = src.find("  private shade(", i)
assert j != -1
new_bgbase = """  private drawBgBase(ctx: CanvasRenderingContext2D, now: number) {
    if (this.bg.type === "color" && this.bg.color) {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      if (this.bg.color2) {
        grad.addColorStop(0, this.bg.color);
        grad.addColorStop(1, this.bg.color2);
      } else {
        grad.addColorStop(0, shade(this.bg.color, 18));
        grad.addColorStop(1, this.bg.color);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    if (this.bg.type === "image" && this.bg.image) {
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, W, H);
      const img = this.bg.image;
      const ar = img.naturalWidth / img.naturalHeight;
      let w = W, h = W / ar;
      if (h < H) { h = H; w = H * ar; }
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      return;
    }
    // Előre definiált hátterek a közös modulból (ua. mint a könyvtár-előnézetben)
    drawBgPreset(ctx, this.bg.type === "preset" ? (this.bg.preset ?? "space") : "none", now, this.starfield);
  }
"""
src = src[:i] + new_bgbase + src[j:]

# 6) shade metódus törlése (a class záró '}')
m = re.search(r"\n  private shade\(hex: string, percent: number\): string \{.*?\n  \}\n", src, re.S)
assert m, "shade metódus nem található"
src = src[:m.start()] + src[m.end():]

# 7) ellenőrzés: nem maradt this.shade / this.drawX hivatkozás
for bad in ["this.shade(", "this.drawShape(", "this.drawShip(", "this.drawMeteor(", "this.drawStar(", "this.drawCloud("]:
    assert bad not in src, f"maradt hivatkozás: {bad}"

open(P, "w", encoding="utf-8").write(src)
print(f"OK: {orig_len} -> {len(src)} karakter")
