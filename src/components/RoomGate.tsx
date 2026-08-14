'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Overlay from './Overlay';
import SetupScreen from './SetupScreen';
import {
  applyAct,
  beginRoll,
  canStartGame,
  findPlayer,
  setPlayMode,
  setPlayerTeam,
  startGame,
  startPendingMove,
  stepMove,
  teamLabel,
} from '@/lib/logic';
import { MAX_PLAYERS, TEAM_META, TILES, tileGridPosition } from '@/lib/data';
import {
  bootDb,
  deleteRoom,
  joinRoom,
  subscribeRoom,
  touchPlayer,
  transactRoom,
  type RoomMutator,
} from '@/lib/db';
import { clearSession, getSavedName, getSession, saveName, saveSession } from '@/lib/session';
import type { GameAction, Player, Room } from '@/lib/types';

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function sleep(ms: number) {
  return new Promise<void>((r) => {
    setTimeout(r, ms);
  });
}

function buzz(ms = 18) {
  navigator.vibrate?.(ms);
}

function playDiceSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 180;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.stop(ctx.currentTime + 0.23);
  } catch {
    /* ignore */
  }
}

function isOnline(p: Player) {
  return Date.now() - (p.lastSeen || 0) < 25000;
}

function errMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function RoomGate({ code, view }: { code: string; view: 'lobby' | 'play' }) {
  const router = useRouter();
  const roomCode = code.toUpperCase();
  const [name, setName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [ready, setReady] = useState(false);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [diceFace, setDiceFace] = useState(1);

  const roomRef = useRef<Room | null>(null);
  const playerIdRef = useRef('');
  const unsubRef = useRef<(() => void) | null>(null);
  const moveLock = useRef(false);
  const armedUntil = useRef(0);
  const diceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPhase = useRef<'lobby' | 'playing' | null>(null);

  roomRef.current = room;
  playerIdRef.current = playerId;

  const startDiceAnim = useCallback(() => {
    if (diceTimer.current) return;
    playDiceSound();
    buzz(12);
    diceTimer.current = setInterval(() => {
      setDiceFace(1 + Math.floor(Math.random() * 6));
    }, 80);
  }, []);

  const stopDiceAnim = useCallback(() => {
    if (!diceTimer.current) return;
    clearInterval(diceTimer.current);
    diceTimer.current = null;
  }, []);

  const applyRoom = useCallback(
    (next: Room | null) => {
      if (!next) {
        clearSession();
        setRoom(null);
        router.replace('/');
        return;
      }
      setRoom(next);
      if (next.overlay) setShowStats(false);
      const session = getSession();
      if (session.id) saveSession(next.code, session.id);
      if (next.rolling) startDiceAnim();
      else {
        stopDiceAnim();
        setDiceFace(next.lastDice);
      }
    },
    [router, startDiceAnim, stopDiceAnim],
  );

  const watch = useCallback(
    (nextCode: string) => {
      unsubRef.current?.();
      unsubRef.current = subscribeRoom(nextCode, applyRoom);
    },
    [applyRoom],
  );

  useEffect(() => {
    setName(getSavedName());
    if (!bootDb()) {
      setShowSetup(true);
      setReady(true);
      return undefined;
    }
    const session = getSession();
    if (session.code === roomCode && session.id) {
      setPlayerId(session.id);
      playerIdRef.current = session.id;
      watch(roomCode);
      setNeedsJoin(false);
    } else {
      setNeedsJoin(true);
    }
    setReady(true);
    const beat = setInterval(() => {
      const current = roomRef.current;
      const id = playerIdRef.current;
      if (current && id) touchPlayer(current.code, id).catch(() => {});
    }, 8000);
    return () => {
      unsubRef.current?.();
      clearInterval(beat);
      stopDiceAnim();
    };
  }, [roomCode, watch, stopDiceAnim]);

  useEffect(() => {
    if (!room) return;
    if (prevPhase.current === 'lobby' && room.phase === 'playing' && view === 'lobby') {
      router.push(`/room/${roomCode}/play`);
    }
    prevPhase.current = room.phase;
  }, [room, roomCode, router, view]);

  const commit = (mutator: RoomMutator) => transactRoom(roomCode, mutator);

  const runSteps = async () => {
    if (moveLock.current) return;
    moveLock.current = true;
    try {
      while (true) {
        await sleep(160);
        const next = await commit((r) => stepMove(r));
        if (!next?.pending) break;
      }
    } catch {
      /* ignore */
    } finally {
      moveLock.current = false;
    }
  };

  const act = async (data: GameAction) => {
    try {
      const next = await commit((r) => applyAct(r, findPlayer(r, playerIdRef.current), data));
      if (data.op === 'do-move' && next?.pending?.kind === 'move') await runSteps();
    } catch (err) {
      if (!['spin-done', 'bomb-explode', 'chosung-timeout'].includes(data.op)) {
        setError(errMessage(err, '지금은 할 수 없습니다'));
      }
    }
  };

  useEffect(() => {
    const o = room?.overlay;
    if (!o) return undefined;
    const until = o.until || o.explodeAt || o.endsAt;
    if (!until || until === armedUntil.current) return undefined;
    armedUntil.current = until;
    const op: GameAction['op'] | null =
      o.type === 'bomb'
        ? 'bomb-explode'
        : o.type === 'chosung'
          ? 'chosung-timeout'
          : o.type?.startsWith('spin')
            ? 'spin-done'
            : null;
    if (!op) return undefined;
    const id = setTimeout(() => act({ op } as GameAction), Math.max(0, until - Date.now()));
    return () => clearTimeout(id);
  }, [room?.overlay]);

  const onJoin = async () => {
    if (!name.trim()) {
      setError('이름을 적어주세요');
      return;
    }
    try {
      saveName(name);
      const result = await joinRoom(roomCode, name.trim());
      saveSession(result.room.code, result.playerId);
      setPlayerId(result.playerId);
      playerIdRef.current = result.playerId;
      setNeedsJoin(false);
      setError('');
      watch(roomCode);
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
    unsubRef.current?.();
    clearSession();
    router.push('/');
  };

  const onRoll = async () => {
    try {
      const next = await commit((r) => beginRoll(r, findPlayer(r, playerIdRef.current)));
      if (next?.pending?.kind === 'move') {
        await sleep(900);
        await commit((r) => startPendingMove(r));
        await runSteps();
      }
    } catch (err) {
      setError(errMessage(err, '지금은 굴릴 수 없습니다'));
    }
  };

  const onStart = async () => {
    try {
      await commit((r) => startGame(r, playerIdRef.current));
      router.push(`/room/${roomCode}/play`);
    } catch (err) {
      setError(errMessage(err, '시작할 수 없습니다'));
    }
  };

  if (!ready) return <section className="screen" />;
  if (showSetup) return <SetupScreen />;

  if (needsJoin) {
    return (
      <section className="screen">
        <div className="nav">
          <button className="back-btn" onClick={() => router.push('/')}>←</button>
          <span className="nav-mark">방 {roomCode}</span>
        </div>
        <h1 className="title">방에 들어가기</h1>
        <p className="lead">이름만 적으면 바로 참가됩니다</p>
        <label className="field">
          <span>내 이름</span>
          <input
            maxLength={8}
            placeholder="별명"
            value={name}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" onClick={onJoin}>참가</button>
        {error ? <p className="error">{error}</p> : null}
      </section>
    );
  }

  if (!room) return <section className="screen" />;

  if (view === 'lobby') {
    const link = typeof window === 'undefined' ? '' : `${location.origin}/room/${room.code}`;
    const host = playerId === room.hostId;
    const startReady = canStartGame(room);
    return (
      <section className="screen lobby">
        <div className="setup-head">
          <button className="back-btn" onClick={onLeave}>←</button>
          <h1 className="title">대기실</h1>
          <span className="chip">{room.players.length}/{MAX_PLAYERS}명</span>
        </div>
        <p className="lobby-label">코드를 공유하면 바로 들어옵니다</p>
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
        <p className="sub-copy">회원가입 없이 이름만 적으면 됩니다</p>
        {room.phase === 'playing' ? (
          <button className="btn btn-primary" onClick={() => router.push(`/room/${roomCode}/play`)}>
            보드로 돌아가기
          </button>
        ) : null}
        {host && room.phase === 'lobby' ? (
          <div className="mode-row">
            <button
              className={`mode-btn ${room.mode === 'free' ? 'on' : ''}`}
              onClick={() => commit((r) => setPlayMode(r, playerIdRef.current, 'free')).catch((err) => setError(errMessage(err, '바꿀 수 없습니다')))}
            >
              개인전
            </button>
            <button
              className={`mode-btn ${room.mode === 'team' ? 'on' : ''}`}
              onClick={() => commit((r) => setPlayMode(r, playerIdRef.current, 'team', room.teamCount)).catch((err) => setError(errMessage(err, '바꿀 수 없습니다')))}
            >
              팀전
            </button>
          </div>
        ) : (
          room.phase === 'lobby' ? <p className="sub-copy">{room.mode === 'team' ? '팀전' : '개인전'}</p> : null
        )}
        {room.mode === 'team' && host && room.phase === 'lobby' ? (
          <div className="mode-row">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                className={`mode-btn ${room.teamCount === n ? 'on' : ''}`}
                onClick={() => commit((r) => setPlayMode(r, playerIdRef.current, 'team', n)).catch((err) => setError(errMessage(err, '바꿀 수 없습니다')))}
              >
                {n}팀
              </button>
            ))}
          </div>
        ) : null}
        <div className="lobby-list">
          {room.players.map((p) => {
            const team = teamLabel(p.team);
            return (
              <div
                className="player-row"
                style={{ '--seat': room.mode === 'team' ? team.color : p.color } as CSSProperties}
                key={p.id}
              >
                <span className="seat">{p.id === room.hostId ? '방' : '입'}</span>
                <span className="lobby-name">
                  {room.mode === 'team' ? `${team.emoji} ` : ''}
                  {p.name}
                  {p.id === playerId ? ' · 나' : ''}
                </span>
                {room.mode === 'team' && (host || p.id === playerId) && room.phase === 'lobby' ? (
                  <div className="team-picks">
                    {TEAM_META.slice(0, room.teamCount).map((meta) => (
                      <button
                        key={meta.id}
                        className={`team-chip ${p.team === meta.id ? 'on' : ''}`}
                        style={{ background: meta.color }}
                        onClick={() => commit((r) => setPlayerTeam(r, playerIdRef.current, p.id, meta.id)).catch((err) => setError(errMessage(err, '팀을 바꿀 수 없습니다')))}
                      >
                        {meta.emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className={`online ${isOnline(p) ? 'on' : ''}`}>{isOnline(p) ? '접속' : '끊김'}</span>
                )}
              </div>
            );
          })}
        </div>
        {error ? <p className="error">{error}</p> : null}
        {room.phase === 'lobby' && host ? (
          <>
            {!startReady && room.mode === 'team' ? (
              <p className="wait-copy">팀을 둘 이상으로 나눠주세요</p>
            ) : null}
            <button className="btn btn-primary" disabled={!startReady} onClick={onStart}>
              {room.players.length < 2 ? '혼자 시작' : '게임 시작'}
            </button>
          </>
        ) : room.phase === 'lobby' ? (
          <p className="wait-copy">방장이 시작하기를 기다리는 중</p>
        ) : null}
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={onLeave}>나가기</button>
      </section>
    );
  }

  const mine = findPlayer(room, playerId);
  const current = room.players[room.current];
  const myTurn = mine === room.current;
  const canRoll = myTurn && !room.rolling && !room.moving && !room.overlay;
  const positions = room.players.map((p) => p.position);

  if (room.phase === 'lobby') {
    return (
      <section className="screen">
        <div className="nav">
          <button className="back-btn" onClick={() => router.push(`/room/${roomCode}`)}>←</button>
          <span className="nav-mark">대기실로</span>
        </div>
        <p className="lead">아직 게임이 시작되지 않았습니다</p>
        <button className="btn btn-primary" onClick={() => router.push(`/room/${roomCode}`)}>대기실로 돌아가기</button>
      </section>
    );
  }

  return (
    <section className="screen game">
      <div className="topbar">
        <button className="back-btn" onClick={() => router.push(`/room/${roomCode}`)}>←</button>
        <h1 className="title">주루마블</h1>
        <button className="chip" onClick={() => setShowStats(true)}>
          주량 {room.players.reduce((a, p) => a + p.drinks, 0)}잔
        </button>
      </div>
      <div className={`turn-banner ${myTurn ? 'mine' : ''}`}>
        {myTurn ? '내 차례입니다' : `${room.mode === 'team' ? `${teamLabel(current.team).emoji} ` : ''}${current.name} 차례 · 기다리세요`}
      </div>
      <div className="board-wrap">
        <div className="table">
          <div className="board">
            {TILES.map((tile) => {
              const pos = tileGridPosition(tile.id);
              const here = positions.map((p, i) => (p === tile.id ? i : -1)).filter((i) => i >= 0);
              const active = here.includes(room.current) ? 'active' : '';
              const heavy = (tile.amount ?? 0) >= 3 ? 'tile--heavy' : '';
              return (
                <div
                  key={tile.id}
                  className={`tile tile--${tile.type} ${heavy} ${active}`}
                  style={{ gridColumn: pos.col, gridRow: pos.row }}
                >
                  <span className="emoji">{tile.emoji}</span>
                  <span className="label">{tile.name}</span>
                  <div className="tokens">
                    {here.map((i) => (
                      <span
                        key={room.players[i].id}
                        className={`token ${i === mine ? 'me' : ''}`}
                        style={{ background: room.players[i].color }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="center">
              <div className="turn-label">{myTurn ? '주사위를 누르세요' : '상대 턴'}</div>
              <div className="turn-name" style={{ color: current.color }}>
                {room.mode === 'team' ? `${teamLabel(current.team).emoji} ` : ''}
                {current.name}
              </div>
              <button
                className={`dice ${room.rolling ? 'rolling' : ''}`}
                disabled={!canRoll}
                onClick={onRoll}
              >
                {DICE_FACES[(diceFace || room.lastDice) - 1]}
              </button>
              <div className="dice-hint">{room.rolling ? '굴리는 중' : myTurn ? '내 폰에서 굴리기' : '대기'}</div>
              <div className="stats">
                {room.players.map((p) => (
                  <span className={`stat ${p.id === playerId ? 'me-stat' : ''}`} key={p.id}>
                    <span className="dot" style={{ background: p.color }} />
                    {p.name}
                    {room.mode === 'team' ? teamLabel(p.team).emoji : ''}
                    <b>{p.drinks}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {(room.overlay || showStats) && (
        <Overlay
          room={room}
          mine={mine}
          isHost={playerId === room.hostId}
          showStats={showStats && !room.overlay}
          onAct={act}
          onCloseStats={() => setShowStats(false)}
          onEndGame={() => deleteRoom(room.code)}
        />
      )}
    </section>
  );
}
