'use client';

import { initializeApp } from 'firebase/app';
import { get, getDatabase, onValue, ref, remove, runTransaction, update } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';
import { emptyRoom, makeCode, makePlayer, normalizeRoom } from './logic';

let app;
let db;

export function loadConfig() {
  const env = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || firebaseConfig.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || firebaseConfig.databaseURL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || firebaseConfig.appId,
  };
  if (env.apiKey && env.databaseURL) return env;
  return null;
}

export function initDb(config) {
  if (db) return db;
  app = initializeApp(config);
  db = getDatabase(app);
  return db;
}

function roomRef(code) {
  return ref(db, `rooms/${code}`);
}

function clean(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      if (v !== undefined) out[k] = clean(v);
    });
    return out;
  }
  return value;
}

export async function createRoom(name) {
  for (let i = 0; i < 10; i += 1) {
    const code = makeCode();
    const host = makePlayer(name, 0);
    const created = emptyRoom(code, host);
    const result = await runTransaction(roomRef(code), (current) => {
      if (current) return;
      return clean(created);
    });
    if (result.committed && result.snapshot.exists()) {
      return { playerId: host.id, room: normalizeRoom(result.snapshot.val()) };
    }
  }
  throw new Error('방 코드를 만들지 못했습니다. 다시 눌러주세요');
}

export async function joinRoom(code, name) {
  const key = String(code || '').trim().toUpperCase();
  const player = makePlayer(name, 0);
  const result = await runTransaction(roomRef(key), (current) => {
    if (!current) return;
    const room = normalizeRoom(current);
    if (room.phase !== 'lobby') return;
    if (room.players.length >= 8) return;
    room.players.push(makePlayer(name, room.players.length, player.id));
    return clean(room);
  });
  if (!result.committed || !result.snapshot.exists()) {
    const snap = await get(roomRef(key));
    if (!snap.exists()) throw new Error('방이 없어요');
    const room = normalizeRoom(snap.val());
    if (room.phase !== 'lobby') throw new Error('이미 시작한 방입니다');
    throw new Error('방이 가득 찼습니다');
  }
  return { playerId: player.id, room: normalizeRoom(result.snapshot.val()) };
}

export async function transactRoom(code, mutator) {
  const result = await runTransaction(roomRef(code), (current) => {
    if (!current) return current;
    const room = normalizeRoom(current);
    const next = mutator(room);
    if (next === undefined) return;
    return next === null ? null : clean(next);
  });
  if (!result.committed) throw new Error('지금은 할 수 없습니다');
  return normalizeRoom(result.snapshot.val());
}

export function subscribeRoom(code, onRoom) {
  return onValue(roomRef(code), (snap) => {
    onRoom(snap.exists() ? normalizeRoom(snap.val()) : null);
  });
}

export async function deleteRoom(code) {
  await remove(roomRef(code));
}

export async function touchPlayer(code, playerId) {
  const snap = await get(roomRef(code));
  if (!snap.exists()) return;
  const room = normalizeRoom(snap.val());
  const index = room.players.findIndex((p) => p.id === playerId);
  if (index < 0) return;
  await update(ref(db, `rooms/${code}/players/${index}`), {
    connected: true,
    lastSeen: Date.now(),
  });
}
