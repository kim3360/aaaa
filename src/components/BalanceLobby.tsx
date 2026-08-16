'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SetupScreen from './SetupScreen';
import { DEFAULT_BALANCE_ROUNDS, isBalanceFinished, MAX_BALANCE_ROUNDS, MIN_BALANCE_ROUNDS } from '@/lib/balance';
import { bootDb, createBalanceRoom, deleteBalanceRoom, joinBalance, subscribeBalanceRooms } from '@/lib/db';
import { getBalanceSession, getSavedName, saveBalanceSession, saveName } from '@/lib/session';
import type { BalanceRoom } from '@/lib/types';

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

function errMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function phaseLabel(phase: BalanceRoom['phase']) {
  if (phase === 'lobby') return '대기중';
  if (phase === 'voting') return '투표중';
  return '결과';
}

export default function BalanceLobby() {
  const router = useRouter();
  const nickRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [savedRoom, setSavedRoom] = useState('');
  const [rooms, setRooms] = useState<BalanceRoom[]>([]);
  const [modal, setModal] = useState(false);
  const [totalRounds, setTotalRounds] = useState(DEFAULT_BALANCE_ROUNDS);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    setName(getSavedName());
    setSavedRoom(getBalanceSession().code);
    if (!bootDb()) {
      setShowSetup(true);
      setReady(true);
      return undefined;
    }
    setReady(true);
    return subscribeBalanceRooms((next) => {
      setRooms(next.filter((room) => !isBalanceFinished(room)));
      next.filter(isBalanceFinished).forEach((room) => {
        void deleteBalanceRoom(room.code);
      });
    });
  }, []);

  const needName = () => {
    if (name.trim()) return false;
    setError('먼저 별명을 적어주세요');
    nickRef.current?.focus();
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
    try {
      saveName(name);
      const result = await createBalanceRoom(name.trim(), totalRounds);
      saveBalanceSession(result.room.code, result.playerId);
      router.push(`/balance/${result.room.code}`);
    } catch (err) {
      setModalError(errMessage(err, '방을 만들지 못했습니다'));
    }
  };

  const enterRoom = async (room: BalanceRoom) => {
    if (savedRoom === room.code) {
      router.push(`/balance/${room.code}`);
      return;
    }
    if (needName()) return;
    try {
      saveName(name);
      const result = await joinBalance(room.code, name.trim());
      saveBalanceSession(result.room.code, result.playerId);
      router.push(`/balance/${result.room.code}`);
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
      const result = await joinBalance(code, name.trim());
      saveBalanceSession(result.room.code, result.playerId);
      router.push(`/balance/${result.room.code}`);
    } catch (err) {
      setError(errMessage(err, '참가하지 못했습니다'));
    }
  };

  if (!ready) return <section className="lobby-page" />;
  if (showSetup) return <SetupScreen />;

  return (
    <section className="lobby-page">
      <header className="site-head">
        <div className="brand-lockup">
          <button className="back-btn" type="button" onClick={() => router.push('/')} aria-label="게임 목록">←</button>
          <span className="logo" aria-hidden>⚖️</span>
          <div>
            <strong className="brand">밸런스 게임</strong>
            <small>소수파가 마십니다</small>
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
        <button className="room-card mine" onClick={() => router.push(`/balance/${savedRoom}`)}>
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
              <span className={`status ${room.phase === 'lobby' ? 'wait' : 'play'}`}>
                {phaseLabel(room.phase)}
              </span>
              <span className="room-meta">👥 {room.players.length}명 · {room.totalRounds || 10}문제</span>
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
        <h3>⚖️ 밸런스 게임이란?</h3>
        <p>
          정한 횟수만큼 고른 뒤, 그동안 소수파에 가장 많이 들어간 사람이 집니다.
        </p>
        <div className="info-tags">
          <span>👥 인원 제한 없음</span>
          <span>⚡ 한 문제씩</span>
          <span>🍻 최다 소수파 패배</span>
        </div>
      </section>
      <p className="foot">© 2026 주루</p>

      <div className="home-dock">
        <button className="pill dock-create" onClick={openCreate}>+ 방 만들기</button>
      </div>

      {modal ? (
        <div className="modal-back" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="handle" />
            <h3>방 만들기</h3>
            <p className="modal-lead">몇 문제 진행할지 정한 뒤 방을 엽니다</p>
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
            <Stepper
              label="🎯 진행 횟수"
              value={totalRounds}
              min={MIN_BALANCE_ROUNDS}
              max={MAX_BALANCE_ROUNDS}
              onChange={setTotalRounds}
            />
            <p className="modal-hint">{totalRounds}문제를 하면 게임이 끝납니다</p>
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
