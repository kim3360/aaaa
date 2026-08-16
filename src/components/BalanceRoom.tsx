'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import SetupScreen from './SetupScreen';
import {
  BALANCE_CATEGORIES,
  balanceLosers,
  canStartBalance,
  categoryLabel,
  DEFAULT_BALANCE_ROUNDS,
  hasMoreBalanceRounds,
  isBalanceFinished,
  ackBalanceEnd,
  waitingBalanceEndAcks,
  MAX_BALANCE_ROUNDS,
  MIN_BALANCE_ROUNDS,
  nextBalanceRound,
  revealBalance,
  setBalanceCategory,
  setBalanceRounds,
  startBalanceRound,
  voteBalance,
} from '@/lib/balance';
import {
  bootDb,
  deleteBalanceRoom,
  joinBalance,
  subscribeBalanceRoom,
  transactBalance,
} from '@/lib/db';
import {
  clearBalanceSession,
  getBalanceSession,
  getSavedName,
  saveBalanceSession,
  saveName,
} from '@/lib/session';
import type { BalanceChoice, BalanceQuestion, BalanceRoom as BalanceRoomState } from '@/lib/types';

function errMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function BalanceRoom({ code }: { code: string }) {
  const router = useRouter();
  const roomCode = code.toUpperCase();
  const [name, setName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [room, setRoom] = useState<BalanceRoomState | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [making, setMaking] = useState(false);
  const [endedRoom, setEndedRoom] = useState<BalanceRoomState | null>(null);
  const [myAcked, setMyAcked] = useState(false);
  const playerIdRef = useRef('');

  useEffect(() => {
    setName(getSavedName());
    if (!bootDb()) {
      setShowSetup(true);
      setReady(true);
      return undefined;
    }
    const session = getBalanceSession();
    if (session.code === roomCode && session.id) {
      playerIdRef.current = session.id;
      setPlayerId(session.id);
    } else {
      setNeedsJoin(true);
    }
    setReady(true);
    return subscribeBalanceRoom(roomCode, (next) => {
      setRoom(next);
      if (!next) return;
      if (isBalanceFinished(next)) {
        setEndedRoom(next);
        setNeedsJoin(false);
        return;
      }
      const mine = playerIdRef.current;
      if (mine && !next.players.some((p) => p.id === mine)) {
        setNeedsJoin(true);
      }
    });
  }, [roomCode]);

  useEffect(() => {
    if (room || !endedRoom || !myAcked) return;
    clearBalanceSession();
    router.push('/balance');
  }, [room, endedRoom, myAcked, router]);

  const leaveEnded = () => {
    clearBalanceSession();
    setEndedRoom(null);
    setMyAcked(false);
    router.push('/balance');
  };

  const confirmEnd = async () => {
    setMyAcked(true);
    const view = room || endedRoom;
    const mine = playerIdRef.current;
    if (!view?.players.some((p) => p.id === mine)) {
      leaveEnded();
      return;
    }
    try {
      await commit((r) => ackBalanceEnd(r, mine));
    } catch {
      /* 방이 이미 지워져도 결과 화면은 유지 */
    }
  };

  const commit = (mutator: Parameters<typeof transactBalance>[1]) =>
    transactBalance(roomCode, mutator);

  const onJoin = async () => {
    if (!name.trim()) {
      setError('이름을 적어주세요');
      return;
    }
    try {
      saveName(name);
      const result = await joinBalance(roomCode, name.trim());
      saveBalanceSession(result.room.code, result.playerId);
      playerIdRef.current = result.playerId;
      setPlayerId(result.playerId);
      setNeedsJoin(false);
      setError('');
    } catch (err) {
      setError(errMessage(err, '참가하지 못했습니다'));
    }
  };

  const onLeave = async () => {
    try {
      await commit((r) => {
        r.players = r.players.filter((p) => p.id !== playerIdRef.current);
        if (!r.players.length) return null;
        if (r.hostId === playerIdRef.current) r.hostId = r.players[0].id;
        if (isBalanceFinished(r) && !waitingBalanceEndAcks(r).length) return null;
        return r;
      });
    } catch {
      /* ignore */
    }
    clearBalanceSession();
    router.push('/balance');
  };

  const askQuestion = async (): Promise<BalanceQuestion> => {
    const res = await fetch('/api/balance/question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: room?.category || 'all',
        avoid: room?.usedTexts || [],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as BalanceQuestion & { error?: string };
    if (!res.ok || !data.left || !data.right) {
      throw new Error(data.error || '문제를 만들지 못했습니다');
    }
    return data;
  };

  const startOrNext = async (kind: 'start' | 'next') => {
    if (kind === 'start' && room && !canStartBalance(room)) {
      setError('홀수 인원일 때만 시작할 수 있습니다');
      return;
    }
    if (kind === 'next' && room && !hasMoreBalanceRounds(room)) {
      setError('설정한 횟수를 모두 진행했습니다');
      return;
    }
    setMaking(true);
    setError('');
    try {
      const question = await askQuestion();
      await commit((r) =>
        kind === 'start' ? startBalanceRound(r, question) : nextBalanceRound(r, playerId, question),
      );
    } catch (err) {
      setError(errMessage(err, kind === 'start' ? '시작하지 못했습니다' : '다음으로 못 갔습니다'));
    } finally {
      setMaking(false);
    }
  };

  const shareRoom = async () => {
    if (!room) return;
    const url = `${location.origin}/balance/${room.code}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: '밸런스 게임',
          text: `방 코드 ${room.code}로 들어와 주세요`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(`${room.code}\n${url}`);
      setError('코드와 주소를 복사했어요');
    } catch {
      try {
        await navigator.clipboard.writeText(`${room.code}\n${url}`);
        setError('코드와 주소를 복사했어요');
      } catch {
        /* ignore */
      }
    }
  };

  if (!ready) return <section className="screen" />;
  if (showSetup) return <SetupScreen />;

  const endView = (room && isBalanceFinished(room) ? room : null) || endedRoom;
  if (endView) {
    return (
      <section className="screen">
        <EndSheet
          room={endView}
          playerId={playerId}
          acked={myAcked || endView.endAcks.includes(playerId)}
          onAck={confirmEnd}
        />
      </section>
    );
  }

  if (needsJoin) {
    return (
      <section className="screen join-screen">
        <div className="nav">
          <button className="back-btn" onClick={() => router.push('/balance')}>←</button>
          <span className="nav-mark">방 {roomCode}</span>
        </div>
        <h1 className="title">밸런스 참가</h1>
        <p className="lead">별명만 적으면 바로 참가됩니다</p>
        <label className="field">
          <span>내 별명</span>
          <input
            maxLength={8}
            placeholder="테이블에서 부를 이름"
            value={name}
            autoComplete="nickname"
            enterKeyHint="go"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onJoin();
            }}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="bottom-actions">
          <button className="btn btn-primary" onClick={onJoin}>참가</button>
        </div>
      </section>
    );
  }

  if (!room) {
    return (
      <section className="screen">
        <div className="nav">
          <button className="back-btn" onClick={() => router.push('/balance')}>←</button>
          <span className="nav-mark">방 없음</span>
        </div>
        <p className="lead">방이 없거나 이미 닫혔습니다</p>
        <button className="btn btn-primary" onClick={() => router.push('/balance')}>목록으로</button>
      </section>
    );
  }

  const host = playerId === room.hostId;
  const me = room.players.find((p) => p.id === playerId);
  const totalDrinks = room.players.reduce((sum, p) => sum + p.drinks, 0);

  if (room.phase === 'lobby') {
    const link = typeof window === 'undefined' ? '' : `${location.origin}/balance/${room.code}`;
    return (
      <section className="screen lobby">
        <div className="setup-head">
          <button className="back-btn" onClick={onLeave}>←</button>
          <h1 className="title">밸런스</h1>
          <span className="chip">{room.players.length}명</span>
        </div>
        <p className="lobby-label">코드를 눌러 복사하거나, 친구에게 바로 공유하세요</p>
        <div
          className="room-code"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${room.code}\n${link}`);
              setError('코드와 주소를 복사했어요');
            } catch {
              /* ignore */
            }
          }}
        >
          {room.code}
        </div>
        <button className="btn btn-ghost share-btn" onClick={shareRoom}>친구에게 공유</button>
        <p className="lobby-label">진행 횟수 · {room.totalRounds || DEFAULT_BALANCE_ROUNDS}문제</p>
        {host ? (
          <div className="stepper" style={{ marginBottom: 14 }}>
            <span>🎯 몇 번 할까요</span>
            <div className="stepper-ctrl">
              <button
                type="button"
                aria-label="줄이기"
                disabled={(room.totalRounds || DEFAULT_BALANCE_ROUNDS) <= MIN_BALANCE_ROUNDS}
                onClick={() =>
                  commit((r) => setBalanceRounds(r, playerId, (r.totalRounds || DEFAULT_BALANCE_ROUNDS) - 1)).catch((err) =>
                    setError(errMessage(err, '횟수를 바꾸지 못했습니다')),
                  )
                }
              >
                −
              </button>
              <b>{room.totalRounds || DEFAULT_BALANCE_ROUNDS}</b>
              <button
                type="button"
                aria-label="늘리기"
                disabled={(room.totalRounds || DEFAULT_BALANCE_ROUNDS) >= MAX_BALANCE_ROUNDS}
                onClick={() =>
                  commit((r) => setBalanceRounds(r, playerId, (r.totalRounds || DEFAULT_BALANCE_ROUNDS) + 1)).catch((err) =>
                    setError(errMessage(err, '횟수를 바꾸지 못했습니다')),
                  )
                }
              >
                +
              </button>
            </div>
          </div>
        ) : null}
        <p className="lobby-label">문제 카테고리 · 고르면 AI가 새 문제를 만듭니다</p>
        <div className="cat-grid">
          {BALANCE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`mode-btn ${room.category === cat.id ? 'on' : ''}`}
              disabled={!host}
              onClick={() => {
                if (!host) return;
                commit((r) => setBalanceCategory(r, playerId, cat.id)).catch((err) =>
                  setError(errMessage(err, '카테고리를 바꾸지 못했습니다')),
                );
              }}
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>
        <div className="lobby-list lobby-grid">
          {room.players.map((p) => (
            <div className="player-row" style={{ '--seat': p.color } as CSSProperties} key={p.id}>
              {p.id === room.hostId ? <span className="host-badge">방장</span> : null}
              <span className="seat pawn-seat">{p.icon}</span>
              <span className="lobby-name">
                {p.name}
                {p.id === playerId ? ' · 나' : ''}
              </span>
            </div>
          ))}
        </div>
        {error ? <p className={error.includes('복사') ? 'notice' : 'error'}>{error}</p> : null}
        <div className="bottom-actions">
          {host ? (
            <>
              {canStartBalance(room) ? null : (
                <p className="wait-copy">홀수 인원일 때만 시작됩니다. 지금 {room.players.length}명</p>
              )}
              <button
                className="btn btn-primary"
                disabled={making || !canStartBalance(room)}
                onClick={() => startOrNext('start')}
              >
                {making ? '문제 만드는 중' : '시작'}
              </button>
            </>
          ) : (
            <p className="wait-copy">
              {canStartBalance(room) ? '방장이 시작하기를 기다리는 중' : '홀수 인원이 되면 시작할 수 있습니다'}
            </p>
          )}
          <button className="btn btn-ghost" onClick={onLeave}>나가기</button>
        </div>
      </section>
    );
  }

  const q = room.question;
  const myVote = room.votes[playerId];
  const votedCount = Object.keys(room.votes).length;
  const waiting = Math.max(0, (room.voterIds.length || room.players.length) - votedCount);

  return (
    <section className="screen balance-play">
      <div className="topbar">
        <button className="back-btn" onClick={onLeave}>←</button>
        <h1 className="title">밸런스</h1>
        <span className="chip">소수 {totalDrinks}회</span>
      </div>
      <p className="balance-round">
        {categoryLabel(room.category).emoji} {categoryLabel(room.category).name} · {room.round}/{room.totalRounds || DEFAULT_BALANCE_ROUNDS} · {votedCount}명 선택
      </p>

      {q ? (
        <div className={`balance-vs ${room.phase === 'result' ? 'revealed' : ''}`}>
          <ChoiceButton
            side="left"
            emoji={q.leftEmoji}
            label={q.left}
            picked={myVote === 'left'}
            locked={!!myVote || room.phase === 'result'}
            count={room.result?.left}
            total={votedCount}
            names={namesFor(room, 'left')}
            minority={room.result?.minority === 'left'}
            onPick={() => commit((r) => voteBalance(r, playerId, 'left')).catch((err) => setError(errMessage(err, '고를 수 없습니다')))}
          />
          <div className="balance-vs-mark">VS</div>
          <ChoiceButton
            side="right"
            emoji={q.rightEmoji}
            label={q.right}
            picked={myVote === 'right'}
            locked={!!myVote || room.phase === 'result'}
            count={room.result?.right}
            total={votedCount}
            names={namesFor(room, 'right')}
            minority={room.result?.minority === 'right'}
            onPick={() => commit((r) => voteBalance(r, playerId, 'right')).catch((err) => setError(errMessage(err, '고를 수 없습니다')))}
          />
        </div>
      ) : null}

      {room.phase === 'voting' ? (
        <p className="balance-status">
          {myVote ? (waiting ? `다른 사람 ${waiting}명 기다리는 중` : '집계 중') : '하나를 고르세요'}
        </p>
      ) : hasMoreBalanceRounds(room) ? (
        <p className="balance-status">
          {room.players.length < 2
            ? '혼자라서 이번엔 패스'
            : room.result?.minority === 'tie'
              ? '동점! 이번엔 기록 없음'
              : `소수파 +1 · ${me && room.votes[playerId] === room.result?.minority ? '당신 기록' : '마지막에 제일 많은 사람이 집니다'}`}
        </p>
      ) : (
        <div className="balance-final">
          {balanceLosers(room).length ? (
            <>
              <p className="balance-status">패배 · 소수파 최다</p>
              <p className="balance-losers">
                {balanceLosers(room).map((p) => `${p.icon} ${p.name} ${p.drinks}회`).join(' · ')}
              </p>
              <p className="mini-help">이 사람이 마십니다</p>
            </>
          ) : (
            <p className="balance-status">전원 생존. 이번엔 아무도 안 집니다</p>
          )}
        </div>
      )}

      <div className="balance-people">
        {room.players.map((p) => (
          <span key={p.id} className={`stat ${p.id === playerId ? 'me-stat' : ''}`}>
            <span className="pawn mini" style={{ '--pawn': p.color } as CSSProperties}>{p.icon}</span>
            {p.name}
            <b>{p.drinks}</b>
          </span>
        ))}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="bottom-actions">
        {room.phase === 'voting' && host && votedCount > 0 && waiting > 0 ? (
          <button
            className="btn btn-ghost"
            onClick={() => commit((r) => revealBalance(r, playerId)).catch((err) => setError(errMessage(err, '공개하지 못했습니다')))}
          >
            지금 결과 보기
          </button>
        ) : null}
        {room.phase === 'result' && host && hasMoreBalanceRounds(room) ? (
          <button className="btn btn-primary" disabled={making} onClick={() => startOrNext('next')}>
            {making ? '문제 만드는 중' : '다음 문제'}
          </button>
        ) : room.phase === 'result' && host ? (
          <p className="wait-copy">{room.totalRounds}문제 끝. 소수파가 제일 많은 사람이 졌습니다</p>
        ) : room.phase === 'result' ? (
          <p className="wait-copy">
            {hasMoreBalanceRounds(room) ? '방장이 다음 문제를 고르는 중' : `${room.totalRounds}문제 끝났습니다`}
          </p>
        ) : null}
        {host ? (
          <button className="btn btn-ghost" onClick={() => deleteBalanceRoom(room.code).then(() => router.push('/balance'))}>
            게임 종료
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={onLeave}>나가기</button>
        )}
      </div>
    </section>
  );
}

function EndSheet({
  room,
  playerId,
  acked,
  onAck,
}: {
  room: BalanceRoomState;
  playerId: string;
  acked: boolean;
  onAck: () => void;
}) {
  const losers = balanceLosers(room);
  const waiting = waitingBalanceEndAcks(room).filter((p) => p.id !== playerId || !acked);
  return (
    <div className="overlay">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="handle" />
        <div className="event-emoji">🍻</div>
        <h2 className="event-title">패배</h2>
        <p className="event-desc">
          {room.totalRounds}문제 중 소수파에 가장 많이 걸린 사람
        </p>
        {losers.length ? (
          <div className="balance-end-names">
            {losers.map((p) => (
              <div className="balance-end-name" key={p.id}>
                <span className="pawn" style={{ '--pawn': p.color } as CSSProperties}>{p.icon}</span>
                <b>{p.name}</b>
                <em>{p.drinks}회</em>
              </div>
            ))}
          </div>
        ) : (
          <p className="balance-status">이번엔 아무도 안 걸렸습니다</p>
        )}
        <p className="mini-help" style={{ textAlign: 'center', marginTop: 8 }}>
          {losers.length ? '이 사람이 마십니다' : '전원 생존'}
        </p>
        {acked ? (
          <p className="wait-copy" style={{ marginTop: 16 }}>
            {waiting.length
              ? `확인함 · ${waiting.map((p) => p.name).join(', ')} 기다리는 중`
              : '모두 확인했습니다'}
          </p>
        ) : (
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onAck}>
            확인
          </button>
        )}
      </div>
    </div>
  );
}

function namesFor(room: BalanceRoomState, side: BalanceChoice) {
  return room.players.filter((p) => room.votes[p.id] === side).map((p) => p.name);
}

function ChoiceButton({
  side,
  emoji,
  label,
  picked,
  locked,
  count,
  total,
  names,
  minority,
  onPick,
}: {
  side: BalanceChoice;
  emoji: string;
  label: string;
  picked: boolean;
  locked: boolean;
  count?: number;
  total: number;
  names: string[];
  minority?: boolean;
  onPick: () => void;
}) {
  const ratio = total ? Math.round(((count ?? 0) / total) * 100) : 0;
  return (
    <button
      type="button"
      className={`balance-choice balance-choice--${side} ${picked ? 'picked' : ''} ${minority ? 'lose' : ''}`}
      disabled={locked}
      onClick={onPick}
    >
      <span className="balance-choice-emoji">{emoji}</span>
      <strong>{label}</strong>
      {count != null ? (
        <>
          <em>{ratio}% · {count}명</em>
          {names.length ? <small>{names.join(', ')}</small> : null}
        </>
      ) : null}
    </button>
  );
}
