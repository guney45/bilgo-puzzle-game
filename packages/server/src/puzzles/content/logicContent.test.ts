import { describe, it, expect } from 'vitest';
import { LOGIC_QUESTIONS, LOGIC_QUESTIONS_BY_DIFFICULTY, LogicQuestionSchema } from './logicContent';

function validQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    difficulty: 1,
    prompt: 'Soru?',
    choices: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D' },
    ],
    correctChoiceId: 'a',
    ...overrides,
  };
}

describe('LogicQuestionSchema (içerik doğrulama kuralları)', () => {
  it('geçerli bir soruyu kabul eder', () => {
    expect(LogicQuestionSchema.safeParse(validQuestion()).success).toBe(true);
  });

  it('4 şıktan azını reddeder', () => {
    const q = validQuestion({ choices: validQuestion().choices.slice(0, 3) });
    expect(LogicQuestionSchema.safeParse(q).success).toBe(false);
  });

  it('correctChoiceId şıklar arasında yoksa reddeder', () => {
    const q = validQuestion({ correctChoiceId: 'z' });
    expect(LogicQuestionSchema.safeParse(q).success).toBe(false);
  });

  it('tekrarlayan şık id\'lerini reddeder', () => {
    const q = validQuestion({
      choices: [
        { id: 'a', label: 'A' },
        { id: 'a', label: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
    });
    expect(LogicQuestionSchema.safeParse(q).success).toBe(false);
  });

  it('tekrarlayan şık metinlerini reddeder', () => {
    const q = validQuestion({
      choices: [
        { id: 'a', label: 'Aynı' },
        { id: 'b', label: 'Aynı' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
    });
    expect(LogicQuestionSchema.safeParse(q).success).toBe(false);
  });

  it('geçersiz zorluk değerini reddeder', () => {
    const q = validQuestion({ difficulty: 4 });
    expect(LogicQuestionSchema.safeParse(q).success).toBe(false);
  });

  it('boş prompt\'u reddeder', () => {
    const q = validQuestion({ prompt: '' });
    expect(LogicQuestionSchema.safeParse(q).success).toBe(false);
  });
});

describe('gerçek içerik havuzu (logic.tr.json)', () => {
  it('modül throw etmeden yüklendi (sunucu açılışı doğrulaması geçti)', () => {
    expect(LOGIC_QUESTIONS.length).toBeGreaterThan(0);
  });

  it('her zorlukta en az 10 soru var', () => {
    expect(LOGIC_QUESTIONS_BY_DIFFICULTY[1].length).toBeGreaterThanOrEqual(10);
    expect(LOGIC_QUESTIONS_BY_DIFFICULTY[2].length).toBeGreaterThanOrEqual(10);
    expect(LOGIC_QUESTIONS_BY_DIFFICULTY[3].length).toBeGreaterThanOrEqual(10);
  });

  it('tüm soru id\'leri benzersizdir', () => {
    const ids = LOGIC_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('her sorunun tam 4 şıkkı ve şıklar arasında correctChoiceId\'si vardır', () => {
    for (const q of LOGIC_QUESTIONS) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices.map((c) => c.id)).toContain(q.correctChoiceId);
    }
  });
});
