import { PLAYER_COLORS, PLAYER_ICONS } from './data';
import { makeCode, makePlayer } from './logic';
import type {
  BalanceCategoryId,
  BalanceChoice,
  BalanceQuestion,
  BalanceResult,
  BalanceRoom,
  Player,
} from './types';

export const BALANCE_CATEGORIES: Array<{ id: BalanceCategoryId; name: string; emoji: string }> = [
  { id: 'all', name: '전체', emoji: '🎲' },
  { id: 'drink', name: '술자리', emoji: '🍺' },
  { id: 'love', name: '연애', emoji: '💕' },
  { id: 'taste', name: '취향', emoji: '✨' },
  { id: 'extreme', name: '극단', emoji: '🔥' },
];

export const MIN_BALANCE_ROUNDS = 1;
export const MAX_BALANCE_ROUNDS = 30;
export const DEFAULT_BALANCE_ROUNDS = 10;

export function clampBalanceRounds(n: number) {
  const value = Math.round(Number(n) || DEFAULT_BALANCE_ROUNDS);
  return Math.min(MAX_BALANCE_ROUNDS, Math.max(MIN_BALANCE_ROUNDS, value));
}

export function categoryLabel(id: BalanceCategoryId = 'all') {
  return BALANCE_CATEGORIES.find((c) => c.id === id) || BALANCE_CATEGORIES[0];
}

function toArray(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'object') return Object.values(value);
  return [];
}

export function emptyBalanceRoom(code: string, host: Player, title?: string, totalRounds = DEFAULT_BALANCE_ROUNDS): BalanceRoom {
  return {
    code,
    title: title || `${host.name}의 밸런스`,
    hostId: host.id,
    phase: 'lobby',
    maxPlayers: 0,
    players: [host],
    question: null,
    nextQuestion: null,
    votes: {},
    voterIds: [],
    usedIds: [],
    usedTexts: [],
    result: null,
    round: 0,
    totalRounds: clampBalanceRounds(totalRounds),
    category: 'all',
    endAcks: [],
  };
}

export function normalizeBalanceRoom(raw: unknown): BalanceRoom | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const votesRaw = data.votes && typeof data.votes === 'object' ? (data.votes as Record<string, unknown>) : {};
  const votes: Record<string, BalanceChoice> = {};
  Object.entries(votesRaw).forEach(([id, choice]) => {
    if (choice === 'left' || choice === 'right') votes[id] = choice;
  });
  const players = (toArray(data.players) as Player[]).map((p, i) => ({
    ...p,
    color: p.color || PLAYER_COLORS[i % PLAYER_COLORS.length],
    icon: p.icon || PLAYER_ICONS[i % PLAYER_ICONS.length],
    drinks: Number(p.drinks) || 0,
  }));
  const phase = data.phase === 'voting' || data.phase === 'result' ? data.phase : 'lobby';
  return {
    code: String(data.code || ''),
    title: String(data.title || `${players[0]?.name || '밸런스'}의 방`),
    hostId: String(data.hostId || players[0]?.id || ''),
    phase,
    maxPlayers: 0,
    players,
    question: (data.question as BalanceQuestion) || null,
    nextQuestion: (data.nextQuestion as BalanceQuestion) || null,
    votes,
    voterIds: toArray(data.voterIds).map(String),
    usedIds: toArray(data.usedIds).map(String),
    usedTexts: toArray(data.usedTexts).map(String),
    result: (data.result as BalanceResult) || null,
    round: Number(data.round) || 0,
    totalRounds: clampBalanceRounds(Number(data.totalRounds) || DEFAULT_BALANCE_ROUNDS),
    category: BALANCE_CATEGORIES.some((c) => c.id === data.category)
      ? (data.category as BalanceCategoryId)
      : 'all',
    endAcks: toArray(data.endAcks).map(String),
  };
}

export function createBalanceDraft(name: string, totalRounds = DEFAULT_BALANCE_ROUNDS) {
  const host = makePlayer(name, 0);
  const code = makeCode();
  return { host, room: emptyBalanceRoom(code, host, `${host.name}의 밸런스`, totalRounds) };
}

function expectedVoters(room: BalanceRoom) {
  const ids = room.voterIds.length ? room.voterIds : room.players.map((p) => p.id);
  return ids.filter((id) => room.players.some((p) => p.id === id));
}

export function canStartBalance(room: BalanceRoom) {
  return room.players.length % 2 === 1;
}

export function hasMoreBalanceRounds(room: BalanceRoom) {
  return room.round < (room.totalRounds || DEFAULT_BALANCE_ROUNDS);
}

export function isBalanceFinished(room: BalanceRoom) {
  return room.phase === 'result' && !hasMoreBalanceRounds(room);
}

export function balanceLosers(room: BalanceRoom) {
  const max = Math.max(0, ...room.players.map((p) => p.drinks));
  if (!max) return [];
  return room.players.filter((p) => p.drinks === max);
}

export function startBalanceRound(room: BalanceRoom, question?: BalanceQuestion) {
  if (room.phase === 'lobby' && !canStartBalance(room)) return;
  if (!question?.left || !question?.right) return;
  room.phase = 'voting';
  room.question = question;
  room.votes = {};
  room.result = null;
  room.voterIds = room.players.map((p) => p.id);
  room.usedIds = [...room.usedIds, question.id].slice(-40);
  room.usedTexts = [...(room.usedTexts || []), `${question.left} vs ${question.right}`].slice(-20);
  room.round = (room.round || 0) + 1;
  room.endAcks = [];
  room.nextQuestion = null;
  return room;
}

export function setNextBalanceQuestion(room: BalanceRoom, playerId: string, question: BalanceQuestion) {
  if (playerId !== room.hostId) return;
  if (room.phase === 'lobby') return;
  if (!hasMoreBalanceRounds(room)) return;
  if (!question?.left || !question?.right) return;
  if (room.nextQuestion?.left) return room;
  const text = `${question.left} vs ${question.right}`;
  if ((room.usedTexts || []).includes(text)) return;
  if (room.question && `${room.question.left} vs ${room.question.right}` === text) return;
  room.nextQuestion = question;
  return room;
}

export function waitingBalanceEndAcks(room: BalanceRoom) {
  return room.players.filter((p) => !room.endAcks.includes(p.id));
}

export function ackBalanceEnd(room: BalanceRoom, playerId: string) {
  if (!isBalanceFinished(room)) return;
  if (!room.players.some((p) => p.id === playerId)) return;
  if (!room.endAcks.includes(playerId)) room.endAcks = [...room.endAcks, playerId];
  if (!waitingBalanceEndAcks(room).length) return null;
  return room;
}

export function setBalanceCategory(room: BalanceRoom, playerId: string, category: BalanceCategoryId) {
  if (room.phase !== 'lobby' || playerId !== room.hostId) return;
  if (!BALANCE_CATEGORIES.some((c) => c.id === category)) return;
  if (room.category === category) return room;
  room.category = category;
  room.usedIds = [];
  room.usedTexts = [];
  room.nextQuestion = null;
  return room;
}

export function setBalanceRounds(room: BalanceRoom, playerId: string, totalRounds: number) {
  if (room.phase !== 'lobby' || playerId !== room.hostId) return;
  room.totalRounds = clampBalanceRounds(totalRounds);
  return room;
}

function revealVotes(room: BalanceRoom) {
  const left = room.players.filter((p) => room.votes[p.id] === 'left');
  const right = room.players.filter((p) => room.votes[p.id] === 'right');
  let minority: BalanceResult['minority'] = 'tie';
  if (left.length && right.length) {
    if (left.length < right.length) minority = 'left';
    else if (right.length < left.length) minority = 'right';
  }
  if (minority !== 'tie') {
    const side = minority === 'left' ? left : right;
    side.forEach((p) => {
      p.drinks += 1;
    });
  }
  room.result = { left: left.length, right: right.length, minority };
  room.phase = 'result';
  return room;
}

export function voteBalance(room: BalanceRoom, playerId: string, choice: BalanceChoice) {
  if (room.phase !== 'voting' || !room.question) return;
  if (room.votes[playerId]) return;
  if (!room.players.some((p) => p.id === playerId)) return;
  room.votes = { ...room.votes, [playerId]: choice };
  const waiting = expectedVoters(room);
  if (waiting.length && waiting.every((id) => room.votes[id])) revealVotes(room);
  return room;
}

export function revealBalance(room: BalanceRoom, playerId: string) {
  if (room.phase !== 'voting' || playerId !== room.hostId) return;
  if (!Object.keys(room.votes).length) return;
  return revealVotes(room);
}

export function nextBalanceRound(room: BalanceRoom, playerId: string, question?: BalanceQuestion) {
  if (room.phase !== 'result' || playerId !== room.hostId) return;
  if (!hasMoreBalanceRounds(room)) return;
  const next = question?.left ? question : room.nextQuestion;
  if (!next?.left || !next?.right) return;
  return startBalanceRound(room, next);
}

export function joinBalanceRoom(room: BalanceRoom, name: string, playerId: string) {
  if (isBalanceFinished(room)) return '이미 끝난 방입니다';
  if (room.players.some((p) => p.id === playerId)) return room;
  room.players.push(makePlayer(name, room.players.length, playerId));
  return room;
}
