'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import SetupScreen from './SetupScreen';
import {
  BALANCE_CATEGORIES,
  categoryLabel,
  nextBalanceRound,
  revealBalance,
  setBalanceCategory,
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
import type { BalanceChoice, BalanceRoom as BalanceRoomState } from '@/lib/types';

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
      const mine = playerIdRef.current;
      if (mine && !next.players.some((p) => p.id === mine)) {
        setNeedsJoin(true);
      }
    });
  }, [roomCode]);

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
        return r;
      });
    } catch {
      /* ignore */
    }
    clearBalanceSession();
    router.push('/balance');
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
        <p className="lobby-label">문제 카테고리</p>
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
        <div className="lobby-list">
          {room.players.map((p) => (
            <div className="player-row" style={{ '--seat': p.color } as CSSProperties} key={p.id}>
              <span className="seat pawn-seat">{p.icon}</span>
              <span className="lobby-name">
                {p.name}
                {p.id === room.hostId ? ' · 방장' : ''}
                {p.id === playerId ? ' · 나' : ''}
              </span>
            </div>
          ))}
        </div>
        {error ? <p className={error.includes('복사') ? 'notice' : 'error'}>{error}</p> : null}
        <div className="bottom-actions">
          {host ? (
            <button
              className="btn btn-primary"
              onClick={() => commit((r) => startBalanceRound(r)).catch((err) => setError(errMessage(err, '시작하지 못했습니다')))}
            >
              {room.players.length < 2 ? '혼자 시작' : '게임 시작'}
            </button>
          ) : (
            <p className="wait-copy">방장이 시작하기를 기다리는 중</p>
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
        <span className="chip">주량 {totalDrinks}잔</span>
      </div>
      <p className="balance-round">
        {categoryLabel(room.category).emoji} {categoryLabel(room.category).name} · {room.round}번째 · {votedCount}명 선택
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
      ) : (
        <p className="balance-status">
          {room.players.length < 2
            ? '혼자라서 이번엔 패스'
            : room.result?.minority === 'tie'
              ? '동점! 이번엔 아무도 안 마십니다'
              : `소수파 1잔 · ${me && room.votes[playerId] === room.result?.minority ? '당신이 마십니다' : '소수파만 한 잔'}`}
        </p>
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
        {room.phase === 'result' && host ? (
          <button
            className="btn btn-primary"
            onClick={() => commit((r) => nextBalanceRound(r, playerId)).catch((err) => setError(errMessage(err, '다음으로 못 갔습니다')))}
          >
            다음 문제
          </button>
        ) : room.phase === 'result' ? (
          <p className="wait-copy">방장이 다음 문제를 고르는 중</p>
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
