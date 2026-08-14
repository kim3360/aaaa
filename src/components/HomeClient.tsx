'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SetupScreen from './SetupScreen';
import { bootDb, createRoom, joinRoom } from '@/lib/db';
import { getSavedName, getSession, saveName, saveSession } from '@/lib/session';

function errMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function HomeClient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [savedRoom, setSavedRoom] = useState('');

  useEffect(() => {
    setName(getSavedName());
    const session = getSession();
    setSavedRoom(session.code);
    setShowSetup(!bootDb());
    setReady(true);
  }, []);

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
      saveName(name);
      const result = await createRoom(name.trim());
      saveSession(result.room.code, result.playerId);
      router.push(`/room/${result.room.code}`);
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
      saveName(name);
      const result = await joinRoom(code, name.trim());
      saveSession(result.room.code, result.playerId);
      router.push(`/room/${result.room.code}`);
    } catch (err) {
      setError(errMessage(err, '참가하지 못했습니다'));
    }
  };

  if (!ready) return <section className="screen home" />;
  if (showSetup) return <SetupScreen />;

  return (
    <section className="screen home">
      <div className="nav">
        <span className="nav-mark">🎲 주루마블</span>
      </div>
      <p className="eyebrow">🎮 무료 온라인 멀티플레이</p>
      <h1 className="title">언제 어디서나<br />보드게임</h1>
      <p className="lead">이름만 적고 바로 시작 · 최대 20명 · 팀전 가능</p>
      <div className="home-form">
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
        {savedRoom ? (
          <button className="game-card" onClick={() => router.push(`/room/${savedRoom}`)}>
            <span className="game-emoji">▶</span>
            <span className="game-copy">
              <b>방으로 돌아가기</b>
              <small>{savedRoom}</small>
            </span>
            <span className="arrow">→</span>
          </button>
        ) : null}
        <button className="game-card" onClick={onCreate}>
          <span className="game-emoji">🍺</span>
          <span className="game-copy">
            <b>방 만들기</b>
            <small>술자리 보드게임 · 1~20명</small>
          </span>
          <span className="arrow">→</span>
        </button>
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
        <button className="game-card" onClick={onJoin}>
          <span className="game-emoji">🔑</span>
          <span className="game-copy">
            <b>방 참가</b>
            <small>코드만 있으면 바로 입장</small>
          </span>
          <span className="arrow">→</span>
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </section>
  );
}
