import { describe, it, expect } from "vitest";
import { generateOwnerToken, hashOwnerToken, rateLimit } from "../cloud-guard";

describe("owner token", () => {
  it("mindig egyedi, megfelelő hosszú tokent ad", () => {
    const a = generateOwnerToken();
    const b = generateOwnerToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(24);
  });

  it("a hash stabil és nem tartalmazza a tokent", () => {
    const token = "titkos-token-123";
    expect(hashOwnerToken(token)).toBe(hashOwnerToken(token));
    expect(hashOwnerToken(token)).not.toContain(token);
    expect(hashOwnerToken(token)).toHaveLength(64);
  });

  it("más token más hash-t kap", () => {
    expect(hashOwnerToken("a")).not.toBe(hashOwnerToken("b"));
  });
});

describe("rateLimit", () => {
  it("engedi az első N kérést, utána tilt", () => {
    const key = `test:${Math.random()}`;
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("kulcsok egymástól függetlenek", () => {
    const k1 = `a:${Math.random()}`;
    const k2 = `b:${Math.random()}`;
    expect(rateLimit(k1, 1, 60_000)).toBe(true);
    expect(rateLimit(k1, 1, 60_000)).toBe(false);
    expect(rateLimit(k2, 1, 60_000)).toBe(true);
  });

  it("az ablak elcsúszása után újra enged", async () => {
    const key = `win:${Math.random()}`;
    expect(rateLimit(key, 1, 30)).toBe(true);
    expect(rateLimit(key, 1, 30)).toBe(false);
    // A csúszóablak "eltolásához" valós időt várunk
    await new Promise((r) => setTimeout(r, 40));
    expect(rateLimit(key, 1, 30)).toBe(true);
  });
});
