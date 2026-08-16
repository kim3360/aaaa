'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { TEAM_META } from '@/lib/data';
import type { GameAction, MiniGame, OverlayState, Room, RoulettePrize, SpinItem } from '@/lib/types';

function ActorWait({ name }: { name: string }) {
  return <p className="wait-copy">{name}가 선택하는 중</p>;
}

function playerName(room: Room, i = 0) {
  const player = room.players[i];
  if (!player) return `플레이어 ${i + 1}`;
  if (room.mode === 'team') {
    const team = TEAM_META[player.team];
    return `${team?.emoji ?? ''} ${player.name}`;
  }
  return player.name;
}

type OverlayProps = {
  room: Room;
  mine: number;
  isHost: boolean;
  showStats: boolean;
  onAct: (data: GameAction) => void;
  onCloseStats: () => void;
  onEndGame: () => void;
};

export default function Overlay({ room, mine, isHost, showStats, onAct, onCloseStats, onEndGame }: OverlayProps) {
  if (showStats) {
    const ranked = [...room.players].sort((a, b) => b.drinks - a.drinks);
    const teams =
      room.mode === 'team'
        ? TEAM_META.slice(0, room.teamCount)
            .map((meta) => ({
              ...meta,
              drinks: room.players.filter((p) => p.team === meta.id).reduce((sum, p) => sum + p.drinks, 0),
              count: room.players.filter((p) => p.team === meta.id).length,
            }))
            .filter((t) => t.count)
            .sort((a, b) => b.drinks - a.drinks)
        : [];
    return (
      <div className="overlay">
        <div className="sheet">
          <div className="handle" />
          <h2 className="event-title" style={{ fontSize: 26 }}>주량 현황</h2>
          <p className="event-desc">많이 마신 사람일수록 오늘의 주인공</p>
          {teams.length ? (
            <div className="stats-sheet" style={{ marginBottom: 12 }}>
              {teams.map((t, idx) => (
                <div className="stat-line" key={t.id}>
                  <span className="rank">{idx + 1}</span>
                  <span className="dot" style={{ background: t.color }} />
                  <b style={{ color: t.color }}>{t.emoji} {t.name}</b>
                  <span className="drinks">{t.drinks}잔</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="stats-sheet">
            {ranked.map((p, idx) => (
              <div className="stat-line" key={p.id}>
                <span className="rank">{idx + 1}</span>
                <span className="pawn mini" style={{ '--pawn': p.color } as CSSProperties}>{p.icon || '🙂'}</span>
                <b style={{ color: p.color }}>
                  {room.mode === 'team' ? `${TEAM_META[p.team]?.emoji ?? ''} ` : ''}
                  {p.name}
                </b>
                <span className="drinks">{p.drinks}잔</span>
              </div>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            {isHost ? (
              <button className="btn btn-ghost" onClick={onEndGame}>게임 종료</button>
            ) : (
              <span />
            )}
            <button className="btn btn-gold" onClick={onCloseStats}>닫기</button>
          </div>
        </div>
      </div>
    );
  }

  const o = room.overlay;
  if (!o) return null;

  return (
    <div className="overlay">
      <div className="sheet">
        <OverlayBody o={o} room={room} mine={mine} onAct={onAct} />
      </div>
    </div>
  );
}

function OverlayBody({
  o,
  room,
  mine,
  onAct,
}: {
  o: OverlayState;
  room: Room;
  mine: number;
  onAct: (data: GameAction) => void;
}) {
  const spinRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(() =>
    o.endsAt ? Math.max(0, Math.ceil((o.endsAt - Date.now()) / 1000)) : 0,
  );

  useEffect(() => {
    const track = spinRef.current;
    if (!track) return;
    const n = track.children.length;
    requestAnimationFrame(() => {
      track.style.transition = 'transform 1.6s cubic-bezier(.15,.8,.1,1)';
      track.style.transform = `translateY(${-54 * (n - 1)}px)`;
    });
  }, [o.type]);

  useEffect(() => {
    if (o.type !== 'chosung' || !o.endsAt) return undefined;
    const tick = () => setLeft(Math.max(0, Math.ceil((o.endsAt! - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [o.type, o.endsAt]);

  if (['finish', 'lap', 'skip', 'move-tile', 'minigame-intro'].includes(o.type)) {
    const op: GameAction['op'] =
      o.type === 'finish'
        ? 'finish'
        : o.type === 'lap'
          ? 'lap'
          : o.type === 'skip'
            ? 'skip-ok'
            : o.type === 'move-tile'
              ? 'do-move'
              : 'start-minigame';
    const label =
      o.type === 'finish' || o.type === 'skip'
        ? '다음 턴 넘기기'
        : o.type === 'lap'
          ? '확인'
          : o.type === 'move-tile'
            ? '이동하기'
            : '게임 시작';
    return (
      <>
        <div className="handle" />
        <div className="event-emoji">{o.emoji || '🎲'}</div>
        <h2 className="event-title">{o.title}</h2>
        <p className="event-desc">{o.desc}</p>
        {mine === o.actor ? (
          <button className="btn btn-primary" onClick={() => onAct({ op } as GameAction)}>{label}</button>
        ) : (
          <ActorWait name={playerName(room, o.actor)} />
        )}
      </>
    );
  }

  if (o.type === 'pick') {
    return (
      <>
        <div className="handle" />
        <h2 className="event-title" style={{ fontSize: 28 }}>{o.title}</h2>
        <p className="event-desc">{o.desc}</p>
        {mine === o.actor ? (
          <div className="pick-grid">
            {(o.ids ?? []).map((i) => (
              <button
                key={i}
                className="pick"
                style={{ '--pawn': room.players[i].color } as CSSProperties}
                onClick={() => onAct({ op: 'pick', index: i })}
              >
                <span className="pawn">{room.players[i].icon || '🙂'}</span>
                {playerName(room, i)}
              </button>
            ))}
          </div>
        ) : (
          <ActorWait name={playerName(room, o.actor)} />
        )}
      </>
    );
  }

  if (o.type === 'knight') {
    return (
      <>
        <div className="handle" />
        <div className="event-emoji">🖤</div>
        <h2 className="event-title">흑기사</h2>
        <p className="event-desc">{o.desc}</p>
        {mine === o.actor ? (
          <>
            <p className="wait-copy">
              {room.mode === 'team' ? '같은 팀이 흑기사를 눌러주길 기다리거나' : '다른 사람이 흑기사를 눌러주길 기다리거나'}
            </p>
            <button className="btn btn-ghost" onClick={() => onAct({ op: 'knight-self' })}>
              흑기사 없음 · 내가 마심
            </button>
          </>
        ) : room.mode === 'team' && room.players[mine]?.team !== room.players[o.actor ?? 0]?.team ? (
          <p className="wait-copy">상대 팀 흑기사 대기</p>
        ) : (
          <button className="btn btn-gold" onClick={() => onAct({ op: 'knight-volunteer' })}>
            내가 흑기사 할게
          </button>
        )}
      </>
    );
  }

  if (o.type === 'truth') {
    return (
      <>
        <div className="handle" />
        <div className="event-emoji">🙊</div>
        <h2 className="event-title">진실 아니면 원샷</h2>
        <p className="event-desc">창피한 진실 하나, 아니면 원샷</p>
        {mine === o.actor ? (
          <div className="btn-row">
            <button className="btn btn-gold" onClick={() => onAct({ op: 'truth', shot: false })}>진실 말할게</button>
            <button className="btn btn-primary" onClick={() => onAct({ op: 'truth', shot: true })}>원샷 할게</button>
          </div>
        ) : (
          <ActorWait name={playerName(room, o.actor)} />
        )}
      </>
    );
  }

  if (o.type === 'sing') {
    return (
      <>
        <div className="handle" />
        <div className="event-emoji">🎤</div>
        <h2 className="event-title">노래 한 소절</h2>
        <p className="event-desc">한 소절만 부르세요. 실패하면 2잔</p>
        {mine === o.actor ? (
          <div className="btn-row">
            <button className="btn btn-soju" onClick={() => onAct({ op: 'sing', ok: true })}>성공</button>
            <button className="btn btn-primary" onClick={() => onAct({ op: 'sing', ok: false })}>실패 · 2잔</button>
          </div>
        ) : (
          <ActorWait name={playerName(room, o.actor)} />
        )}
      </>
    );
  }

  if (o.type === 'spin-player' || o.type === 'spin-roulette' || o.type === 'spin-minigame') {
    const items =
      o.type === 'spin-player'
        ? ((o.loop ?? []) as SpinItem[]).map((x, i) => (
            <div className="spin-item" style={{ color: x.color }} key={i}>{x.name}</div>
          ))
        : o.type === 'spin-minigame'
          ? ((o.loop ?? []) as MiniGame[]).map((g, i) => (
              <div className="spin-item" key={i}>{g.emoji} {g.name}</div>
            ))
          : ((o.loop ?? []) as RoulettePrize[]).map((p, i) => (
              <div className="spin-item" key={i}>{p.emoji} {p.label}</div>
            ));
    const heading = o.type === 'spin-roulette' ? '황금 룰렛' : o.type === 'spin-minigame' ? '랜덤 게임' : '랜덤 원샷';
    return (
      <>
        <div className="handle" />
        <div className="event-emoji">{o.type === 'spin-roulette' ? '👑' : o.type === 'spin-minigame' ? '🎲' : '🎯'}</div>
        <h2 className="event-title">{heading}</h2>
        <p className="event-desc">운명을 뽑는 중</p>
        <div className="spin">
          <div className="spin-track" ref={spinRef}>{items}</div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onAct({ op: 'spin-done' })}>
          결과 보기
        </button>
      </>
    );
  }

  if (o.type === 'baskin') {
    return (
      <>
        <div className="handle" />
        <h2 className="event-title">베스킨 31</h2>
        <div className="mini-stage">
          <div className="mini-help">{playerName(room, o.turn)} 차례</div>
          <div className="big-num">{o.n}</div>
          <p className="mini-help">31을 말하는 사람이 마십니다</p>
          {mine === o.turn ? (
            <div className="btn-row">
              {[1, 2, 3].map((k) => (
                <button
                  key={k}
                  className="btn btn-gold"
                  disabled={(o.n ?? 0) + k > 31}
                  onClick={() => onAct({ op: 'baskin', k })}
                >
                  +{k}
                </button>
              ))}
            </div>
          ) : (
            <ActorWait name={playerName(room, o.turn)} />
          )}
        </div>
      </>
    );
  }

  if (o.type === 'nunchi') {
    return (
      <>
        <div className="handle" />
        <h2 className="event-title">눈치게임</h2>
        <div className="mini-stage">
          <div className="big-num">{o.n}</div>
          <p className="mini-help">다음 숫자는 {(o.n ?? 0) + 1} · 마지막 {o.last}을 말한 사람이 마십니다</p>
          <button className="btn btn-gold" onClick={() => onAct({ op: 'nunchi' })}>내가 외친다</button>
        </div>
      </>
    );
  }

  if (o.type === 'bomb') {
    const holder = o.holder ?? 0;
    return (
      <>
        <div className="handle" />
        <h2 className="event-title">폭탄 돌리기</h2>
        <div className="mini-stage">
          <div className="bomb-pulse">💣</div>
          <p className="mini-help">
            지금 폭탄:{' '}
            <b style={{ color: room.players[holder].color }}>{playerName(room, holder)}</b>
          </p>
          {mine === holder ? (
            <button className="btn btn-primary" onClick={() => onAct({ op: 'bomb-pass' })}>
              다음 사람한테 넘기기
            </button>
          ) : (
            <p className="wait-copy">폭탄이 오면 넘기세요</p>
          )}
        </div>
      </>
    );
  }

  if (o.type === 'subway') {
    const speaker = o.turn ?? 0;
    return (
      <>
        <div className="handle" />
        <h2 className="event-title">지하철 게임</h2>
        <p className="event-desc">이 호선 역을 순서대로 말하세요. 막히면 1잔</p>
        <div className="mini-stage">
          <div className="subway-line" style={{ background: o.hint || '#0052A4' }}>
            {o.text}
          </div>
          <p className="mini-help">{playerName(room, speaker)} 차례</p>
        </div>
        {mine === speaker ? (
          <div className="btn-row">
            <button className="btn btn-soju" onClick={() => onAct({ op: 'subway', ok: true })}>
              {room.players.length <= 1 ? '성공' : '성공 · 다음'}
            </button>
            <button className="btn btn-primary" onClick={() => onAct({ op: 'subway', ok: false })}>실패</button>
          </div>
        ) : (
          <ActorWait name={playerName(room, speaker)} />
        )}
      </>
    );
  }

  if (o.type === 'chosung') {
    return (
      <>
        <div className="handle" />
        <h2 className="event-title">초성 게임</h2>
        <div className="mini-stage">
          <p className="mini-help">카테고리: {o.hint} · {left}초</p>
          <div className="big-num">{o.text}</div>
          <p className="mini-help">{playerName(room, o.actor)}가 단어를 말하세요</p>
        </div>
        {mine === o.actor ? (
          <div className="btn-row">
            <button className="btn btn-soju" onClick={() => onAct({ op: 'chosung', ok: true })}>성공</button>
            <button className="btn btn-primary" onClick={() => onAct({ op: 'chosung', ok: false })}>실패</button>
          </div>
        ) : (
          <ActorWait name={playerName(room, o.actor)} />
        )}
      </>
    );
  }

  if (o.type === 'rps') {
    const chosen = o.chosen || [];
    const a = o.a ?? 0;
    const b = o.b ?? 0;
    const myPick = chosen.includes(mine);
    const playing = mine === a || mine === b;
    return (
      <>
        <div className="handle" />
        <h2 className="event-title" style={{ fontSize: 26 }}>
          {playerName(room, a)} vs {playerName(room, b)}
        </h2>
        <p className="event-desc">{playing ? (myPick ? '상대를 기다리는 중' : '가위바위보') : '대결 중'}</p>
        {playing && !myPick ? (
          <div className="rps-row">
            <button className="rps-btn" onClick={() => onAct({ op: 'rps-pick', v: 0 })}>✌️</button>
            <button className="rps-btn" onClick={() => onAct({ op: 'rps-pick', v: 1 })}>✊</button>
            <button className="rps-btn" onClick={() => onAct({ op: 'rps-pick', v: 2 })}>🖐️</button>
          </div>
        ) : (
          <p className="wait-copy">
            {room.players[a].name} {chosen.includes(a) ? '✓' : '...'} / {room.players[b].name}{' '}
            {chosen.includes(b) ? '✓' : '...'}
          </p>
        )}
      </>
    );
  }

  if (o.type === 'rps-tie') {
    return (
      <>
        <div className="handle" />
        <div className="event-emoji">😅</div>
        <h2 className="event-title">무승부</h2>
        <p className="event-desc">{o.label} vs {o.label}</p>
        {mine === o.actor ? (
          <button className="btn btn-gold" onClick={() => onAct({ op: 'rps-again' })}>다시</button>
        ) : (
          <ActorWait name={playerName(room, o.actor)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="handle" />
      <p className="event-desc">진행 중</p>
    </>
  );
}
