import type { ErrorCode, NoticeCode, ScoreBonus } from 'shared';

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
  lobby: {
    codeLabel: 'Oda kodu',
    playersTitle: 'Oyuncular',
    inviteTitle: 'Arkadaşlarını davet et',
    shareButton: 'PAYLAŞ',
    copyButton: 'LİNKİ KOPYALA',
    copiedFeedback: 'Kopyalandı!',
    copyFailed: 'Kopyalanamadı, linki elle seç.',
    readyButton: 'HAZIRIM',
    unreadyButton: 'HAZIR DEĞİLİM',
    startButton: 'BAŞLAT',
    notEnoughPlayersHint: 'Başlamak için en az 2 oyuncu gerekli.',
    waitingForHost: (hostNickname: string) => `${hostNickname} başlatmayı bekliyor…`,
    hostBadge: 'HOST',
    readyBadge: 'Hazır',
    notReadyBadge: 'Bekliyor',
    youSuffix: '(sen)',
  },
  match: {
    roundLabel: (round: number, totalRounds: number) => `Tur ${round}/${totalRounds}`,
  },
  puzzle: {
    waitingLabel: 'Hazır ol…',
    lockedLabel: 'Kilitlendi',
    miniScore: (score: number) => `${score} puan`,
    memorizeHint: 'Izgarayı ezberle…',
    memorizeDone: 'Şimdi cevapla!',
  },
  roundResult: {
    waitingLabel: 'Sonuçlar hesaplanıyor…',
    correctAnswerLabel: 'Doğru cevap',
    standingsTitle: 'Sıralama',
    correctBadge: 'Doğru',
    wrongBadge: 'Yanlış',
    noAnswer: 'Cevap yok',
    totalLabel: (total: number) => `${total} puan`,
    gainedLabel: (points: number) => (points > 0 ? `+${points}` : `${points}`),
    answerTimeLabel: (ms: number) => `${(ms / 1000).toFixed(1)} sn`,
    bonusLabels: {
      FIRST_CORRECT: 'İlk doğru +100',
      STREAK_3: 'Seri x3 +150',
      STREAK_5: 'Seri x5 +300',
      FINAL_X2: 'Final turu x2',
    } satisfies Record<ScoreBonus, string>,
  },
  gameResult: {
    title: 'Maç bitti',
    waitingLabel: 'Sonuçlar hesaplanıyor…',
    standingsTitle: 'Final tablosu',
    podiumMedal: { 1: '🥇', 2: '🥈', 3: '🥉' } as Record<number, string>,
    totalLabel: (total: number) => `${total} puan`,
    statsTitle: 'İstatistikler',
    fastestCorrectLabel: (nickname: string, ms: number, round: number) =>
      `En hızlı doğru: ${nickname} — ${(ms / 1000).toFixed(1)} sn (Tur ${round})`,
    mostCorrectLabel: (nickname: string, count: number) => `En çok doğru: ${nickname} — ${count}`,
    longestStreakLabel: (nickname: string, streak: number) => `En uzun seri: ${nickname} — ${streak}`,
    noStats: 'Bu maçta kimse doğru cevap veremedi.',
    rematchButton: 'TEKRAR OYNA',
  },
} as const;

export function errorMessage(code: string): string {
  return (tr.errors as Record<string, string>)[code] ?? tr.generic;
}

const NOTICE_TEMPLATES: Record<NoticeCode, (nickname: string) => string> = {
  PLAYER_JOINED: (nickname) => `${nickname} odaya katıldı`,
  PLAYER_LEFT: (nickname) => `${nickname} odadan ayrıldı`,
  PLAYER_DISCONNECTED: (nickname) => `${nickname} bağlantısı koptu`,
  PLAYER_RECONNECTED: (nickname) => `${nickname} geri döndü`,
  HOST_CHANGED: (nickname) => `Yeni host: ${nickname}`,
  MATCH_ABORTED: () => 'Maç sonlandırıldı.',
};

export function noticeMessage(code: NoticeCode, nickname?: string): string {
  return NOTICE_TEMPLATES[code](nickname ?? '');
}
