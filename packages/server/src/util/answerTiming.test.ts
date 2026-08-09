import { describe, it, expect } from 'vitest';
import { computeAnswerMs } from './answerTiming';

describe('computeAnswerMs — gecikme telafisi clamp (docs/03-ARCHITECTURE.md §7.3)', () => {
  it('dürüst client iddiası sunucu ölçümüne yakınsa olduğu gibi kabul edilir', () => {
    const result = computeAnswerMs({ clientClaimedMs: 2100, serverMeasuredMs: 2150, halfRttMs: 50 });
    expect(result).toBe(2100);
  });

  it('client iddiası sunucu ölçümünden büyükse sunucu ölçümüne kırpılır (üst sınır)', () => {
    const result = computeAnswerMs({ clientClaimedMs: 5000, serverMeasuredMs: 2000, halfRttMs: 50 });
    expect(result).toBe(2000);
  });

  it('hileli "0 ms\'de cevapladım" iddiası alt sınıra kırpılır', () => {
    // serverMeasured=2000, halfRtt=50, TOLERANCE=80 → alt sınır = 2000-50-80=1870
    const result = computeAnswerMs({ clientClaimedMs: 0, serverMeasuredMs: 2000, halfRttMs: 50 });
    expect(result).toBe(1870);
  });

  it('halfRtt bilinmiyorsa (0) yalnızca TOLERANCE kadar tolerans tanır', () => {
    const result = computeAnswerMs({ clientClaimedMs: 0, serverMeasuredMs: 500, halfRttMs: 0 });
    expect(result).toBe(420); // 500-0-80
  });
});
