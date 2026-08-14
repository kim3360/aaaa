'use client';

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  get,
  getDatabase,
  onValue,
  ref,
  remove,
  runTransaction,
  update,
  type Database,
} from 'firebase/database';
import {
  createBalanceDraft,
  joinBalanceRoom,
  normalizeBalanceRoom,
} from './balance';
import { emptyRoom, makeCode, makePlayer, normalizeRoom, smallestTeam } from './logic';
import type { BalanceRoom, FirebaseConfig, Room, RoomOptions } from './types';
import { MAX_PLAYERS } from './data';

let app: FirebaseApp | undefined;
let db: Database | undefined;

export type RoomMutator = (room: Room) => Room | null | undefined;

export function loadConfig(): FirebaseConfig | null {
  const env: FirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || '',
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.trim() || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || '',
  };
  if (env.apiKey && env.databaseURL) return env;
  return null;
}

export function initDb(config: FirebaseConfig) {
  if (db) return db;
  app = initializeApp(config);
  db = getDatabase(app);
  return db;
}

export function bootDb() {
  const config = loadConfig();
  if (!config) return false;
  initDb(config);
  return true;
}

function requireDb() {
  if (!db) throw new Error('DB가 연결되지 않았습니다');
  return db;
}

function roomRef(code: string) {
  return ref(requireDb(), `rooms/${code}`);
}

function clean(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) out[k] = clean(v);
    });
    return out;
  }
  return value;
}

export async function createRoom(name: string, options: RoomOptions = {}) {
  for (let i = 0; i < 10; i += 1) {
    const code = makeCode();
    const host = makePlayer(name, 0);
    const created = emptyRoom(code, host, options);
    const result = await runTransaction(roomRef(code), (current) => {
      if (current) return;
      return clean(created);
    });
    if (result.committed && result.snapshot.exists()) {
      const room = normalizeRoom(result.snapshot.val());
      if (room) return { playerId: host.id, room };
    }
  }
  throw new Error('방 코드를 만들지 못했습니다. 다시 눌러주세요');
}

export async function joinRoom(code: string, name: string) {
  const key = String(code || '').trim().toUpperCase();
  const player = makePlayer(name, 0);
  const result = await runTransaction(roomRef(key), (current) => {
    if (!current) return;
    const room = normalizeRoom(current);
    if (!room) return;
    if (room.phase !== 'lobby') return;
    if (room.players.length >= (room.maxPlayers || MAX_PLAYERS)) return;
    const team = room.mode === 'team' ? smallestTeam(room) : 0;
    room.players.push(makePlayer(name, room.players.length, player.id, team));
    return clean(room);
  });
  if (!result.committed || !result.snapshot.exists()) {
    const snap = await get(roomRef(key));
    if (!snap.exists()) throw new Error('방이 없어요');
    const room = normalizeRoom(snap.val());
    if (room?.phase !== 'lobby') throw new Error('이미 시작한 방입니다');
    throw new Error('방이 가득 찼습니다');
  }
  const room = normalizeRoom(result.snapshot.val());
  if (!room) throw new Error('방이 없어요');
  return { playerId: player.id, room };
}

export async function transactRoom(code: string, mutator: RoomMutator) {
  const result = await runTransaction(roomRef(code), (current) => {
    if (!current) return current;
    const room = normalizeRoom(current);
    if (!room) return;
    const next = mutator(room);
    if (next === undefined) return;
    return next === null ? null : clean(next);
  });
  if (!result.committed) throw new Error('지금은 할 수 없습니다');
  return normalizeRoom(result.snapshot.val());
}

export function subscribeRooms(onRooms: (rooms: Room[]) => void) {
  return onValue(ref(requireDb(), 'rooms'), (snap) => {
    if (!snap.exists()) {
      onRooms([]);
      return;
    }
    const rooms = Object.values(snap.val() as Record<string, unknown>)
      .map((raw) => normalizeRoom(raw))
      .filter((room): room is Room => !!room)
      .sort((a, b) => Number(b.phase === 'lobby') - Number(a.phase === 'lobby'));
    onRooms(rooms);
  });
}

export function subscribeRoom(code: string, onRoom: (room: Room | null) => void) {
  return onValue(roomRef(code), (snap) => {
    onRoom(snap.exists() ? normalizeRoom(snap.val()) : null);
  });
}

export async function deleteRoom(code: string) {
  await remove(roomRef(code));
}

export type BalanceMutator = (room: BalanceRoom) => BalanceRoom | string | null | undefined;

function balanceRef(code: string) {
  return ref(requireDb(), `balanceRooms/${code}`);
}

export async function createBalanceRoom(name: string) {
  for (let i = 0; i < 10; i += 1) {
    const draft = createBalanceDraft(name);
    const result = await runTransaction(balanceRef(draft.room.code), (current) => {
      if (current) return;
      return clean(draft.room);
    });
    if (result.committed && result.snapshot.exists()) {
      const room = normalizeBalanceRoom(result.snapshot.val());
      if (room) return { playerId: draft.host.id, room };
    }
  }
  throw new Error('방 코드를 만들지 못했습니다. 다시 눌러주세요');
}

export async function joinBalance(code: string, name: string) {
  const key = String(code || '').trim().toUpperCase();
  const player = makePlayer(name, 0);
  const result = await runTransaction(balanceRef(key), (current) => {
    if (!current) return;
    const room = normalizeBalanceRoom(current);
    if (!room) return;
    const next = joinBalanceRoom(room, name, player.id);
    if (typeof next === 'string' || !next) return;
    return clean(next);
  });
  if (!result.committed || !result.snapshot.exists()) {
    const snap = await get(balanceRef(key));
    if (!snap.exists()) throw new Error('방이 없어요');
    const room = normalizeBalanceRoom(snap.val());
    if (room && room.players.length >= room.maxPlayers) throw new Error('방이 가득 찼습니다');
    throw new Error('참가하지 못했습니다');
  }
  const room = normalizeBalanceRoom(result.snapshot.val());
  if (!room) throw new Error('방이 없어요');
  return { playerId: player.id, room };
}

export async function transactBalance(code: string, mutator: BalanceMutator) {
  const result = await runTransaction(balanceRef(code), (current) => {
    if (!current) return current;
    const room = normalizeBalanceRoom(current);
    if (!room) return;
    const next = mutator(room);
    if (next === undefined) return;
    if (typeof next === 'string') return;
    return next === null ? null : clean(next);
  });
  if (!result.committed) throw new Error('지금은 할 수 없습니다');
  return normalizeBalanceRoom(result.snapshot.val());
}

export function subscribeBalanceRooms(onRooms: (rooms: BalanceRoom[]) => void) {
  return onValue(ref(requireDb(), 'balanceRooms'), (snap) => {
    if (!snap.exists()) {
      onRooms([]);
      return;
    }
    const rooms = Object.values(snap.val() as Record<string, unknown>)
      .map((raw) => normalizeBalanceRoom(raw))
      .filter((room): room is BalanceRoom => !!room)
      .sort((a, b) => Number(b.phase === 'lobby') - Number(a.phase === 'lobby'));
    onRooms(rooms);
  });
}

export function subscribeBalanceRoom(code: string, onRoom: (room: BalanceRoom | null) => void) {
  return onValue(balanceRef(code), (snap) => {
    onRoom(snap.exists() ? normalizeBalanceRoom(snap.val()) : null);
  });
}

export async function deleteBalanceRoom(code: string) {
  await remove(balanceRef(code));
}

export async function touchPlayer(code: string, playerId: string) {
  const snap = await get(roomRef(code));
  if (!snap.exists()) return;
  const room = normalizeRoom(snap.val());
  if (!room) return;
  const index = room.players.findIndex((p) => p.id === playerId);
  if (index < 0) return;
  await update(ref(requireDb(), `rooms/${code}/players/${index}`), {
    connected: true,
    lastSeen: Date.now(),
  });
}
