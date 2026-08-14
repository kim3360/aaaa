'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SetupScreen from './SetupScreen';
import { bootDb, createRoom, joinRoom, subscribeRooms } from '@/lib/db';
import { getSavedName, getSession, saveName, saveSession } from '@/lib/session';
import { MAX_PLAYERS } from '@/lib/data';
import type { PlayMode, Room } from '@/lib/types';

function errMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <div className="stepper-ctrl">
        <button type="button" aria-label="줄이기" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <b>{value}</b>
        <button type="button" aria-label="늘리기" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

export default function HomeClient() {
  const router = useRouter();
  const nickRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [savedRoom, setSavedRoom] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [modal, setModal] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [teamOn, setTeamOn] = useState(false);
  const [teamCount, setTeamCount] = useState(2);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    setName(getSavedName());
    const session = getSession();
    setSavedRoom(session.code);
    if (!bootDb()) {
      setShowSetup(true);
      setReady(true);
      return undefined;
    }
    setReady(true);
    return subscribeRooms(setRooms);
  }, []);

  const needName = () => {
    if (name.trim()) return false;
    setError('먼저 별명을 적어주세요');
    nickRef.current?.focus();
    nickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  };

  const openCreate = () => {
    if (!bootDb()) {
      setShowSetup(true);
      return;
    }
    setError('');
    setModalError('');
    setModal(true);
  };

  const onCreate = async () => {
    if (!name.trim()) {
      setModalError('별명을 적어주세요');
      return;
    }
    const mode: PlayMode = teamOn ? 'team' : 'free';
    const size = Math.max(maxPlayers, teamOn ? teamCount : 1);
    try {
      saveName(name);
      const result = await createRoom(name.trim(), {
        maxPlayers: size,
        mode,
        teamCount: teamOn ? teamCount : 2,
        title: `${name.trim()}의 방`,
      });
      saveSession(result.room.code, result.playerId);
      router.push(`/room/${result.room.code}`);
    } catch (err) {
      setModalError(errMessage(err, '방을 만들지 못했습니다'));
    }
  };

  const enterRoom = async (room: Room) => {
    if (savedRoom === room.code) {
      router.push(`/room/${room.code}`);
      return;
    }
    if (room.phase !== 'lobby') {
      setError('이미 시작한 방입니다');
      return;
    }
    if (needName()) return;
    try {
      saveName(name);
      const result = await joinRoom(room.code, name.trim());
      saveSession(result.room.code, result.playerId);
      router.push(`/room/${result.room.code}`);
    } catch (err) {
      setError(errMessage(err, '참가하지 못했습니다'));
    }
  };

  const onJoinCode = async () => {
    if (!code) {
      setError('방 코드를 적어주세요');
      return;
    }
    const found = rooms.find((r) => r.code === code);
    if (found) {
      await enterRoom(found);
      return;
    }
    if (needName()) return;
    try {
      saveName(name);
      const result = await joinRoom(code, name.trim());
      saveSession(result.room.code, result.playerId);
      router.push(`/room/${result.room.code}`);
    } catch (err) {
      setError(errMessage(err, '참가하지 못했습니다'));
    }
  };

  if (!ready) return <section className="lobby-page" />;
  if (showSetup) return <SetupScreen />;

  const perTeam = teamOn ? Math.ceil(Math.max(maxPlayers, teamCount) / teamCount) : 0;

  return (
    <section className="lobby-page">
      <header className="site-head">
        <div className="brand-lockup">
          <button className="back-btn" type="button" onClick={() => router.push('/')} aria-label="게임 목록">←</button>
          <span className="logo" aria-hidden>🍺</span>
          <div>
            <strong className="brand">주루마블</strong>
            <small>술자리 보드게임</small>
          </div>
        </div>
      </header>

      <label className="field nick-field">
        <span>내 별명</span>
        <input
          ref={nickRef}
          maxLength={8}
          placeholder="테이블에서 부를 이름"
          value={name}
          autoComplete="nickname"
          enterKeyHint="done"
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
        />
      </label>

      <div className="list-head">
        <h2>방 목록</h2>
        <button className="pill desktop-only" onClick={openCreate}>+ 방 만들기</button>
      </div>

      {savedRoom ? (
        <button className="room-card mine" onClick={() => router.push(`/room/${savedRoom}`)}>
          <div className="room-card-top">
            <span className="status wait">내 방</span>
            <span className="room-meta">이어서 입장</span>
          </div>
          <b>{savedRoom}</b>
        </button>
      ) : null}

      {rooms.length ? (
        rooms.map((room) => (
          <button className="room-card" key={room.code} onClick={() => enterRoom(room)}>
            <div className="room-card-top">
              <span className={`status ${room.phase === 'playing' ? 'play' : 'wait'}`}>
                {room.phase === 'playing' ? '게임중' : '대기중'}
              </span>
              <span className="room-meta">
                👥 {room.players.length}/{room.maxPlayers || 8}
                {room.mode === 'team' ? ` · ${room.teamCount}팀` : ''}
              </span>
            </div>
            <b>{room.title || room.code}</b>
            <span className="room-code-mini">{room.code}</span>
          </button>
        ))
      ) : (
        <div className="empty-rooms">아직 열린 방이 없습니다. 아래에서 방을 만들어 보세요.</div>
      )}

      <div className="code-join">
        <input
          maxLength={4}
          placeholder="코드 4자리"
          value={code}
          autoComplete="off"
          autoCapitalize="characters"
          enterKeyHint="go"
          inputMode="text"
          onChange={(e) => setCode(e.target.value.trim().toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onJoinCode();
          }}
        />
        <button type="button" onClick={onJoinCode}>입장</button>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <section className="about">
        <h3>🍺 주루마블이란?</h3>
        <p>
          주사위를 굴려 칸을 이동하는 술자리 보드게임입니다. 걸리면 마시고, 흑기사를 찾고, 즉석 게임으로 한 잔 더 갑니다.
        </p>
        <div className="info-tags">
          <span>👥 1~20명</span>
          <span>⏱ 30분~</span>
          <span>🎲 주사위</span>
          <span>🎉 파티</span>
        </div>
      </section>

      <section className="howto">
        <h3>이렇게 플레이하세요</h3>
        <div className="howto-grid">
          <div className="howto-card"><span>1</span>방을 만들고 친구들과 입장해요</div>
          <div className="howto-card"><span>2</span>방장이 인원과 팀전을 정해요</div>
          <div className="howto-card"><span>3</span>차례대로 주사위를 굴려 말을 이동해요</div>
          <div className="howto-card"><span>4</span>도착한 칸의 미션·이벤트를 수행해요</div>
        </div>
      </section>
      <p className="foot">© 2026 주루마블</p>

      <div className="home-dock">
        <button className="pill dock-create" onClick={openCreate}>+ 방 만들기</button>
      </div>

      {modal ? (
        <div className="modal-back" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="handle" />
            <h3>방 만들기</h3>
            <p className="modal-lead">최대 인원과 팀전을 정한 뒤 방을 엽니다</p>
            <label className="field">
              <span>방장 별명</span>
              <input
                maxLength={8}
                placeholder="별명"
                value={name}
                autoComplete="nickname"
                enterKeyHint="done"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Stepper label="👥 최대 인원" value={maxPlayers} min={1} max={MAX_PLAYERS} onChange={setMaxPlayers} />
            <label className="toggle">
              <input type="checkbox" checked={teamOn} onChange={(e) => setTeamOn(e.target.checked)} />
              팀전으로 시작
            </label>
            {teamOn ? (
              <>
                <Stepper label="🚩 팀 수" value={teamCount} min={2} max={4} onChange={setTeamCount} />
                <p className="modal-hint">{teamCount}팀 · 팀당 약 {perTeam}명 · 총 {Math.max(maxPlayers, teamCount)}명</p>
              </>
            ) : null}
            {modalError ? <p className="error">{modalError}</p> : null}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>취소</button>
              <button className="pill" onClick={onCreate}>만들기</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
