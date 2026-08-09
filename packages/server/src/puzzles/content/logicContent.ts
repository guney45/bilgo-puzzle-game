// LOGIC içerik havuzu: şema + sunucu açılışında doğrulama. Kaynak:
// docs/02-GAME_DESIGN.md §3.2/§8. Bozuk içerik burada (modül yüklenirken,
// dolayısıyla sunucu açılışında) throw eder — maç ortasında değil.

import { z } from 'zod';
import logicContentRaw from './logic.tr.json';

const LogicChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const LogicQuestionSchema = z
  .object({
    id: z.string().min(1),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    prompt: z.string().min(1),
    choices: z.array(LogicChoiceSchema).length(4),
    correctChoiceId: z.string().min(1),
    explanation: z.string().min(1).optional(),
    review: z.boolean().optional(),
  })
  .superRefine((q, ctx) => {
    const ids = q.choices.map((c) => c.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: `[${q.id}] şık id'leri benzersiz değil` });
    }
    const labels = q.choices.map((c) => c.label);
    if (new Set(labels).size !== labels.length) {
      ctx.addIssue({ code: 'custom', message: `[${q.id}] şık metinleri benzersiz değil` });
    }
    if (!ids.includes(q.correctChoiceId)) {
      ctx.addIssue({ code: 'custom', message: `[${q.id}] correctChoiceId şıklar arasında yok` });
    }
  });

const LogicContentSchema = z.array(LogicQuestionSchema).superRefine((questions, ctx) => {
  const ids = questions.map((q) => q.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) {
    ctx.addIssue({ code: 'custom', message: `Tekrarlayan soru id'leri: ${[...new Set(dupes)].join(', ')}` });
  }
});

export type LogicQuestion = z.infer<typeof LogicQuestionSchema>;

function loadLogicContent(): LogicQuestion[] {
  const parsed = LogicContentSchema.safeParse(logicContentRaw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    throw new Error(`LOGIC içerik havuzu geçersiz (puzzles/content/logic.tr.json):\n${issues}`);
  }
  return parsed.data;
}

export const LOGIC_QUESTIONS: readonly LogicQuestion[] = loadLogicContent();

export const LOGIC_QUESTIONS_BY_DIFFICULTY: Record<1 | 2 | 3, readonly LogicQuestion[]> = {
  1: LOGIC_QUESTIONS.filter((q) => q.difficulty === 1),
  2: LOGIC_QUESTIONS.filter((q) => q.difficulty === 2),
  3: LOGIC_QUESTIONS.filter((q) => q.difficulty === 3),
};

for (const difficulty of [1, 2, 3] as const) {
  if (LOGIC_QUESTIONS_BY_DIFFICULTY[difficulty].length === 0) {
    throw new Error(`LOGIC içerik havuzunda zorluk ${difficulty} için hiç soru yok`);
  }
}
