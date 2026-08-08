import type { ErrorCode } from 'shared';

export const tr = {
  errors: {
    E_ROOM_NOT_FOUND: 'Böyle bir oda bulunamadı.',
    E_ROOM_FULL: 'Oda dolu.',
    E_MATCH_STARTED: 'Maç zaten başladı.',
    E_NOT_HOST: 'Bu işlemi yalnızca oda sahibi yapabilir.',
    E_NOT_ENOUGH_PLAYERS: 'Yeterli oyuncu yok.',
    E_WRONG_PHASE: 'Bu işlem şu anda yapılamaz.',
    E_ALREADY_ANSWERED: 'Zaten cevap verdin.',
    E_STALE_PUZZLE: 'Bu soru artık geçerli değil.',
    E_TIMING: 'Zamanlama hatası.',
    E_INVALID_NICKNAME: 'Geçersiz takma ad.',
    E_RATE_LIMITED: 'Çok hızlı işlem yapıyorsun, biraz bekle.',
    E_INVALID_PAYLOAD: 'Geçersiz istek.',
  } satisfies Record<ErrorCode, string>,
  generic: 'Bir şeyler ters gitti. Lütfen tekrar dene.',
  home: {
    title: 'Puzzle Race',
    nicknameLabel: 'Takma adın',
    nicknamePlaceholder: 'Adını yaz',
    createButton: 'ODA KUR',
    joinCodeLabel: 'Oda kodu',
    joinCodePlaceholder: 'Q7K8A',
    joinButton: 'KATIL',
  },
  room: {
    codeLabel: 'Oda kodu',
    playersTitle: 'Oyuncular',
  },
} as const;

export function errorMessage(code: string): string {
  return (tr.errors as Record<string, string>)[code] ?? tr.generic;
}
