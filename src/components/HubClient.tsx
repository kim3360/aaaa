'use client';

import { useRouter } from 'next/navigation';

const GAMES = [
  {
    href: '/marble',
    emoji: '🎲',
    name: '주루마블',
    desc: '주사위를 굴려 칸에 걸린 미션을 수행해요',
    tags: ['보드', '1~20명', '주사위'],
    tone: 'marble',
  },
  {
    href: '/balance',
    emoji: '⚖️',
    name: '밸런스 게임',
    desc: '둘 중 하나를 고르고, 소수파가 마십니다',
    tags: ['투표', '2명~', '빠른 한 판'],
    tone: 'balance',
  },
] as const;

export default function HubClient() {
  const router = useRouter();

  return (
    <section className="hub-page">
      <header className="hub-hero">
        <span className="hub-logo" aria-hidden>🍻</span>
        <p className="hub-kicker">술자리 게임</p>
        <h1>오늘 뭐 할래?</h1>
        <p className="hub-lead">테이블에 폰만 올려두면 바로 시작할 수 있어요</p>
      </header>

      <div className="hub-games">
        {GAMES.map((game) => (
          <button
            key={game.href}
            className={`hub-card hub-card--${game.tone}`}
            onClick={() => router.push(game.href)}
          >
            <span className="hub-card-emoji">{game.emoji}</span>
            <div className="hub-card-copy">
              <b>{game.name}</b>
              <small>{game.desc}</small>
              <div className="hub-card-tags">
                {game.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
            <span className="hub-card-go">시작</span>
          </button>
        ))}
      </div>

      <p className="foot">© 2026 주루</p>
    </section>
  );
}
