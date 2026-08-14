'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import Overlay from './Overlay';
import { TILES, tileGridPosition } from '@/lib/data';
import {
  createRoom,
  deleteRoom,
  initDb,
  joinRoom,
  loadConfig,
  subscribeRoom,
  touchPlayer,
  transactRoom,
  type RoomMutator,
} from '@/lib/db';
import {
  applyAct,
  beginRoll,
  findPlayer,
  startGame,
  startPendingMove,
  stepMove,
} from '@/lib/logic';
import type { GameAction, Player, Room, Screen } from '@/lib/types';

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

export default function GameApp() {
  const searchParams = useSearchParams();
  const [screen, setScreen] = useState<Screen>('home');
  const [name, setName] = useState('');
  const [code, setCode] = useState((searchParams.get('room') || '').toUpperCase());
  const [playerId, setPlayerId] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [ready, setReady] = useState(false);
  const [diceFace, setDiceFace] = useState(1);

  const roomRef = useRef<Room | null>(null);
  const playerIdRef = useRef('');
  const nameRef = useRef('');
  const unsubRef = useRef<(() => void) | null>(null);
  const moveLock = useRef(false);
  const armedUntil = useRef(0);
  const diceTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  roomRef.current = room;
  playerIdRef.current = playerId;
  nameRef.current = name;

  const bootDb = useCallback(() => {
    const config = loadConfig();
    if (!config) return false;
    initDb(config);
    return true;
  }, []);

  const clearSession = () => {
    sessionStorage.removeItem('juru-id');
    sessionStorage.removeItem('juru-code');
  };

  const saveSession = (nextRoom: Room, nextId: string) => {
    if (!nextRoom) return;
    sessionStorage.setItem('juru-id', nextId);
    sessionStorage.setItem('juru-code', nextRoom.code);
    localStorage.setItem('juru-name', nameRef.current);
  };

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
        if (roomRef.current) {
          clearSession();
          setRoom(null);
          setScreen('home');
          setError('방이 없어졌습니다');
        }
        return;
      }
      setRoom(next);
      setScreen(next.phase === 'lobby' ? 'lobby' : 'game');
      if (next.overlay) setShowStats(false);
      saveSession(next, playerIdRef.current);
      if (next.rolling) startDiceAnim();
      else {
        stopDiceAnim();
        setDiceFace(next.lastDice);
      }
    },
    [startDiceAnim, stopDiceAnim],
  );

  const watch = useCallback(
    (roomCode: string) => {
      unsubRef.current?.();
      unsubRef.current = subscribeRoom(roomCode, applyRoom);
    },
    [applyRoom],
  );

  useEffect(() => {
    setName(localStorage.getItem('juru-name') || '');
  }, []);

  useEffect(() => {
    const ok = bootDb();
    setShowSetup(!ok);
    setReady(true);
    if (!ok) return undefined;
    const savedCode = sessionStorage.getItem('juru-code');
    const savedId = sessionStorage.getItem('juru-id');
    if (savedCode && savedId) {
      setPlayerId(savedId);
      playerIdRef.current = savedId;
      watch(savedCode);
    }
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
  }, [bootDb, watch, stopDiceAnim]);

  const commit = (mutator: RoomMutator) => {
    const current = roomRef.current;
    if (!current) return Promise.reject(new Error('방이 없습니다'));
    return transactRoom(current.code, mutator);
  };

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

  const onCreate = async () => {
    if (!bootDb()) {
      setShowSetup(true);
      return;
    }
    if (!name.trim()) {
      setError('이름을 적어주세요');
      return;
    }
    try {
      const result = await createRoom(name.trim());
      setPlayerId(result.playerId);
      playerIdRef.current = result.playerId;
      setError('');
      watch(result.room.code);
      applyRoom(result.room);
    } catch (err) {
      setError(errMessage(err, '방을 만들지 못했습니다'));
    }
  };

  const onJoin = async () => {
    if (!bootDb()) {
      setShowSetup(true);
      return;
    }
    if (!name.trim()) {
      setError('이름을 적어주세요');
      return;
    }
    if (!code) {
      setError('방 코드를 적어주세요');
      return;
    }
    try {
      const result = await joinRoom(code, name.trim());
      setPlayerId(result.playerId);
      playerIdRef.current = result.playerId;
      setError('');
      watch(result.room.code);
      applyRoom(result.room);
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
    setRoom(null);
    setScreen('home');
  };

  if (!ready) {
    return <section className="screen home" />;
  }

  if (showSetup) {
    return (
      <section className="screen">
        <div className="setup-head">
          <h1 className="title">한 번만 연결</h1>
        </div>
        <p className="sub-copy" style={{ textAlign: 'left' }}>
          Firebase 로그인은 <b>이 컴퓨터를 켜는 사람만</b> 하면 됩니다. 술자리에 오는 사람들은 가입도 로그인도 필요 없습니다.
        </p>
        <ol className="setup-steps">
          <li>
            <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">Firebase 콘솔</a>
            에서 프로젝트 1개 만들기
          </li>
          <li>Build → Realtime Database → 만들기 → 테스트 모드</li>
          <li>톱니바퀴 → 프로젝트 설정 → 내 앱 → 웹 앱 추가</li>
          <li>
            <code>.env.example</code>을 복사해 <code>.env.local</code>을 만들고 firebaseConfig 값을 넣기
          </li>
          <li>개발 서버를 재시작한 뒤 이 페이지를 새로고침</li>
        </ol>
        <p className="sub-copy" style={{ textAlign: 'left' }}>
          설정이 들어가면 다른 사람은 주소만 열고 이름 적은 다음 방에 들어오면 됩니다.
        </p>
        <button className="btn btn-gold" onClick={() => location.reload()}>서버 재시작 후 새로고침</button>
      </section>
    );
  }

  if (screen === 'home' || !room) {
    return (
      <section className="screen home">
        <div className="home-left">
          <div className="felt-badge">오늘 밤의 보드</div>
          <div className="hero">
            <div className="mascot">
              <span>🍶</span>
              <span>🎲</span>
            </div>
            <h1 className="title">주루마블</h1>
            <p className="tag">각자 폰으로 접속 · 턴만 넘긴다</p>
          </div>
          <div className="legend">
            <span className="legend-item drink">술</span>
            <span className="legend-item game">게임</span>
            <span className="legend-item knight">흑기사</span>
            <span className="legend-item move">이동</span>
          </div>
        </div>
        <div className="home-right">
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
          <button className="btn btn-primary" onClick={onCreate}>방 만들기</button>
          <div className="or">또는</div>
          <label className="field">
            <span>방 코드</span>
            <input
              maxLength={4}
              placeholder="예: 7K2P"
              value={code}
              autoComplete="off"
              onChange={(e) => setCode(e.target.value.trim().toUpperCase())}
            />
          </label>
          <button className="btn btn-gold" onClick={onJoin}>방 참가</button>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </section>
    );
  }

  if (screen === 'lobby') {
    const link = typeof window === 'undefined' ? '' : `${location.origin}${location.pathname}?room=${room.code}`;
    const host = playerId === room.hostId;
    return (
      <section className="screen lobby">
        <div className="setup-head">
          <h1 className="title">대기실</h1>
          <span className="chip">{room.players.length}명</span>
        </div>
        <p className="lobby-label">방 코드를 알려주세요</p>
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
        <p className="sub-copy">같은 주소로 들어와 코드만 입력하면 됩니다</p>
        <div className="lobby-list">
          {room.players.map((p) => (
            <div className="player-row" style={{ '--seat': p.color } as CSSProperties} key={p.id}>
              <span className="seat">{p.id === room.hostId ? '방' : '입'}</span>
              <span className="lobby-name">{p.name}{p.id === playerId ? ' · 나' : ''}</span>
              <span className={`online ${isOnline(p) ? 'on' : ''}`}>{isOnline(p) ? '접속' : '끊김'}</span>
            </div>
          ))}
        </div>
        {error ? <p className="error">{error}</p> : null}
        {host ? (
          <button
            className="btn btn-primary"
            disabled={room.players.length < 2}
            onClick={() => commit((r) => startGame(r, playerIdRef.current)).catch((err) => setError(errMessage(err, '시작할 수 없습니다')))}
          >
            게임 시작
          </button>
        ) : (
          <p className="wait-copy">방장이 시작하기를 기다리는 중</p>
        )}
        <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={onLeave}>나가기</button>
      </section>
    );
  }

  const mine = findPlayer(room, playerId);
  const current = room.players[room.current];
  const myTurn = mine === room.current;
  const canRoll = myTurn && !room.rolling && !room.moving && !room.overlay;
  const positions = room.players.map((p) => p.position);

  return (
    <section className="screen game">
      <div className="topbar">
        <h1 className="title">주루마블</h1>
        <button className="chip" onClick={() => setShowStats(true)}>
          주량 {room.players.reduce((a, p) => a + p.drinks, 0)}잔
        </button>
      </div>
      <div className={`turn-banner ${myTurn ? 'mine' : ''}`}>
        {myTurn ? '내 차례입니다' : `${current.name} 차례 · 기다리세요`}
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
              <div className="turn-name" style={{ color: current.color }}>{current.name}</div>
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
