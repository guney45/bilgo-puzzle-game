import { describe, it, expect } from 'vitest';
import { mulberry32, shuffle, deriveSeed } from './rng';

describe('mulberry32', () => {
  it('aynı tohum aynı diziyi üretir (determinizm)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('farklı tohumlar farklı diziler üretir', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('her zaman [0,1) aralığında değer döner', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  it('girdi dizisini değiştirmeden bir permütasyon döner', () => {
    const rng = mulberry32(123);
    const input = [1, 2, 3, 4, 5];
    const original = [...input];
    const result = shuffle(input, rng);

    expect(input).toEqual(original);
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it('aynı tohumla aynı karışımı üretir', () => {
    const items = ['a', 'b', 'c', 'd'];
    const resultA = shuffle(items, mulberry32(99));
    const resultB = shuffle(items, mulberry32(99));
    expect(resultA).toEqual(resultB);
  });
});

describe('deriveSeed', () => {
  it('aynı seed+salt aynı sonucu verir', () => {
    expect(deriveSeed(42, 3)).toBe(deriveSeed(42, 3));
  });

  it('farklı salt farklı sonuç verir', () => {
    expect(deriveSeed(42, 1)).not.toBe(deriveSeed(42, 2));
  });

  it('farklı seed farklı sonuç verir', () => {
    expect(deriveSeed(1, 'x')).not.toBe(deriveSeed(2, 'x'));
  });

  it('string salt (playerId gibi) ile de çalışır', () => {
    const seed = deriveSeed(1000, 'sessionId-abc');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
  });
});
