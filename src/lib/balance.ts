import { PLAYER_COLORS, PLAYER_ICONS, MAX_PLAYERS } from './data';
import { makeCode, makePlayer, rand } from './logic';
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

export const BALANCE_QUESTIONS: BalanceQuestion[] = [
  { id: 'q01', category: 'drink', leftEmoji: '🍶', rightEmoji: '🍺', left: '평생 소주만', right: '평생 맥주만' },
  { id: 'q02', category: 'drink', leftEmoji: '🏠', rightEmoji: '✈️', left: '집 앞에서 마시기', right: '해외에서 마시기' },
  { id: 'q03', category: 'taste', leftEmoji: '🤐', rightEmoji: '🎤', left: '취해도 조용한 사람', right: '취하면 텐션 터지는 사람' },
  { id: 'q04', category: 'drink', leftEmoji: '🍗', rightEmoji: '🍜', left: '술안주 치킨', right: '술안주 라면' },
  { id: 'q05', category: 'taste', leftEmoji: '📱', rightEmoji: '🚫', left: '술자리에서 폰 보기', right: '폰 없이 3시간' },
  { id: 'q06', category: 'drink', leftEmoji: '🧊', rightEmoji: '🔥', left: '얼음 가득 소맥', right: '따뜻한 막걸리' },
  { id: 'q07', category: 'taste', leftEmoji: '👥', rightEmoji: '👤', left: '10명이랑 가든', right: '2명이랑 깊게' },
  { id: 'q08', category: 'drink', leftEmoji: '💸', rightEmoji: '🎁', left: '내가 쏘기', right: '얻어먹기' },
  { id: 'q09', category: 'drink', leftEmoji: '🌙', rightEmoji: '☀️', left: '밤샘 2차', right: '일찍 해장' },
  { id: 'q10', category: 'love', leftEmoji: '💔', rightEmoji: '🙈', left: '전애인 마주치기', right: '상사 마주치기' },
  { id: 'q11', category: 'taste', leftEmoji: '📸', rightEmoji: '🤫', left: '취중 사진 남기기', right: '아무 기록 없이' },
  { id: 'q12', category: 'drink', leftEmoji: '🎲', rightEmoji: '🗣️', left: '술게임 계속하기', right: '그냥 수다' },
  { id: 'q13', category: 'drink', leftEmoji: '🍋', rightEmoji: '🥤', left: '하이볼', right: '소맥' },
  { id: 'q14', category: 'taste', leftEmoji: '🚕', rightEmoji: '🚶', left: '집까지 택시', right: '취중 산책' },
  { id: 'q15', category: 'drink', leftEmoji: '🥇', rightEmoji: '😅', left: '내가 제일 덜 취하기', right: '내가 제일 먼저 취하기' },
  { id: 'q16', category: 'drink', leftEmoji: '🍕', rightEmoji: '🍖', left: '피자 + 맥주', right: '삼겹살 + 소주' },
  { id: 'q17', category: 'drink', leftEmoji: '⏰', rightEmoji: '🔁', left: '첫차까지', right: '12시에 파토' },
  { id: 'q18', category: 'love', leftEmoji: '💬', rightEmoji: '❤️', left: '옛 연인 연락', right: '오늘 만난 사람 번호' },
  { id: 'q19', category: 'taste', leftEmoji: '🎧', rightEmoji: '🔇', left: '노래 크게', right: '대화만' },
  { id: 'q20', category: 'drink', leftEmoji: '🥶', rightEmoji: '🥵', left: '겨울 야외 포차', right: '여름 실내 에어컨' },
  { id: 'q21', category: 'extreme', leftEmoji: '🧠', rightEmoji: '💥', left: '기억 남는 실수', right: '아무 기억 없는 블랙아웃' },
  { id: 'q22', category: 'taste', leftEmoji: '👑', rightEmoji: '🧽', left: '분위기 메이커', right: '조용히 따라가기' },
  { id: 'q23', category: 'drink', leftEmoji: '🍣', rightEmoji: '🥘', left: '비싼 이자카야', right: '골목 포장마차' },
  { id: 'q24', category: 'extreme', leftEmoji: '📞', rightEmoji: '❌', left: '취중 전화하기', right: '취중 문자는 괜찮음' },
  { id: 'q25', category: 'love', leftEmoji: '🫶', rightEmoji: '🫠', left: '좋아하는 사람이랑 2차', right: '절친이랑 2차' },
  { id: 'q26', category: 'drink', leftEmoji: '🍫', rightEmoji: '🧂', left: '달달한 술', right: '쓴맛 그대로' },
  { id: 'q27', category: 'taste', leftEmoji: '🎬', rightEmoji: '🕹️', left: '취중 영화', right: '취중 게임' },
  { id: 'q28', category: 'taste', leftEmoji: '👗', rightEmoji: '👕', left: '꾸미고 나가기', right: '편한 옷 그대로' },
  { id: 'q29', category: 'taste', leftEmoji: '🌊', rightEmoji: '🏔️', left: '바다 보면서 마시기', right: '산 정상에서 마시기' },
  { id: 'q30', category: 'extreme', leftEmoji: '🙈', rightEmoji: '📢', left: '비밀 하나 말하기', right: '노래 한 곡 부르기' },
  { id: 'q31', category: 'drink', leftEmoji: '🥂', rightEmoji: '🫗', left: '원샷 문화', right: '천천히 홀짝' },
  { id: 'q32', category: 'taste', leftEmoji: '📆', rightEmoji: '🎉', left: '매주 같은 멤버', right: '매번 새로운 사람' },
  { id: 'q33', category: 'drink', leftEmoji: '🐷', rightEmoji: '🥗', left: '안주 배터지게', right: '술은 많이, 안주는 적게' },
  { id: 'q34', category: 'extreme', leftEmoji: '💭', rightEmoji: '📸', left: '어제 취한 얘기 듣기', right: '영상으로 확인하기' },
  { id: 'q35', category: 'drink', leftEmoji: '🚌', rightEmoji: '🏡', left: '1차로 끝내기', right: '무조건 2차' },
  { id: 'q36', category: 'extreme', leftEmoji: '🍀', rightEmoji: '😈', left: '운으로 벌칙 피하기', right: '실력으로 이기기' },
  { id: 'q37', category: 'extreme', leftEmoji: '😗', rightEmoji: '🙅', left: '술버릇 알려주기', right: '절대 비밀' },
  { id: 'q38', category: 'drink', leftEmoji: '🎂', rightEmoji: '🎄', left: '내 생일 술자리', right: '연말 술자리' },
  { id: 'q39', category: 'taste', leftEmoji: '🫶', rightEmoji: '💤', left: '끝까지 남기', right: '적당히 먼저 일어나기' },
  { id: 'q40', category: 'extreme', leftEmoji: '🔮', rightEmoji: '📦', left: '오늘 운세 보고 마시기', right: '아무 생각 없이 마시기' },
  { id: 'q41', category: 'love', leftEmoji: '💌', rightEmoji: '⏳', left: '먼저 고백하기', right: '상대가 올 때까지 기다리기' },
  { id: 'q42', category: 'love', leftEmoji: '📅', rightEmoji: '🔥', left: '3년 안정 연애', right: '3개월 강렬한 연애' },
  { id: 'q43', category: 'love', leftEmoji: '✈️', rightEmoji: '🏠', left: '장거리 연애', right: '매일 보기' },
  { id: 'q44', category: 'love', leftEmoji: '💐', rightEmoji: '☕', left: '기념일 크게 챙기기', right: '평소에 잘하기' },
  { id: 'q45', category: 'love', leftEmoji: '😏', rightEmoji: '🫡', left: '플러팅 잘하는 사람', right: '진지하고 서툰 사람' },
  { id: 'q46', category: 'love', leftEmoji: '💬', rightEmoji: '🚶', left: '문자 잘 하는 연애', right: '만나서 노는 연애' },
  { id: 'q47', category: 'love', leftEmoji: '🎯', rightEmoji: '🌱', left: '소개팅으로 만나기', right: '자연스럽게 만나기' },
  { id: 'q48', category: 'love', leftEmoji: '🧩', rightEmoji: '🎨', left: '취미가 같은 사람', right: '서로 다른 취미' },
  { id: 'q49', category: 'love', leftEmoji: '📱', rightEmoji: '🔓', left: '폰 비밀번호 공유', right: '각자 비밀 유지' },
  { id: 'q50', category: 'love', leftEmoji: '🌙', rightEmoji: '☀️', left: '밤늦게 전화', right: '아침에 잘 챙겨주기' },
  { id: 'q51', category: 'extreme', leftEmoji: '📱', rightEmoji: '🌐', left: '핸드폰 없이 1년', right: 'SNS에 일기 공개' },
  { id: 'q52', category: 'extreme', leftEmoji: '💼', rightEmoji: '🌈', left: '지금 직업 평생', right: '연봉 반토막 꿈의 일' },
  { id: 'q53', category: 'extreme', leftEmoji: '👻', rightEmoji: '⚡', left: '투명인간', right: '순간이동' },
  { id: 'q54', category: 'extreme', leftEmoji: '⏪', rightEmoji: '⏩', left: '과거 보기', right: '미래 보기' },
  { id: 'q55', category: 'extreme', leftEmoji: '🧠', rightEmoji: '🔒', left: '모든 사람 속마음 보기', right: '내 속마음 숨기기' },
  { id: 'q56', category: 'extreme', leftEmoji: '💰', rightEmoji: '💘', left: '로또 1등', right: '원하는 사람 마음 얻기' },
  { id: 'q57', category: 'extreme', leftEmoji: '🌟', rightEmoji: '🏦', left: '유명해지기', right: '조용히 부자 되기' },
  { id: 'q58', category: 'taste', leftEmoji: '🐱', rightEmoji: '🐶', left: '고양이 성격', right: '강아지 성격' },
  { id: 'q59', category: 'taste', leftEmoji: '🌅', rightEmoji: '🌃', left: '아침형 인간', right: '저녁형 인간' },
  { id: 'q60', category: 'taste', leftEmoji: '🏔️', rightEmoji: '🏖️', left: '산으로 여행', right: '바다로 여행' },
];

export function categoryLabel(id: BalanceCategoryId = 'all') {
  return BALANCE_CATEGORIES.find((c) => c.id === id) || BALANCE_CATEGORIES[0];
}

export function questionsFor(category: BalanceCategoryId = 'all') {
  if (category === 'all') return BALANCE_QUESTIONS;
  return BALANCE_QUESTIONS.filter((q) => q.category === category);
}

function toArray(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'object') return Object.values(value);
  return [];
}

export function emptyBalanceRoom(code: string, host: Player, title?: string): BalanceRoom {
  return {
    code,
    title: title || `${host.name}의 밸런스`,
    hostId: host.id,
    phase: 'lobby',
    maxPlayers: MAX_PLAYERS,
    players: [host],
    question: null,
    votes: {},
    voterIds: [],
    usedIds: [],
    result: null,
    round: 0,
    category: 'all',
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
    maxPlayers: Math.min(MAX_PLAYERS, Math.max(1, Number(data.maxPlayers) || MAX_PLAYERS)),
    players,
    question: (data.question as BalanceQuestion) || null,
    votes,
    voterIds: toArray(data.voterIds).map(String),
    usedIds: toArray(data.usedIds).map(String),
    result: (data.result as BalanceResult) || null,
    round: Number(data.round) || 0,
    category: BALANCE_CATEGORIES.some((c) => c.id === data.category)
      ? (data.category as BalanceCategoryId)
      : 'all',
  };
}

export function createBalanceDraft(name: string) {
  const host = makePlayer(name, 0);
  const code = makeCode();
  return { host, room: emptyBalanceRoom(code, host, `${host.name}의 밸런스`) };
}

function pickQuestion(usedIds: string[], category: BalanceCategoryId = 'all') {
  const all = questionsFor(category);
  const pool = all.filter((q) => !usedIds.includes(q.id));
  const source = pool.length ? pool : all;
  return source[rand(source.length)];
}

function expectedVoters(room: BalanceRoom) {
  const ids = room.voterIds.length ? room.voterIds : room.players.map((p) => p.id);
  return ids.filter((id) => room.players.some((p) => p.id === id));
}

export function startBalanceRound(room: BalanceRoom) {
  const pool = questionsFor(room.category);
  const exhausted = room.usedIds.length >= pool.length;
  const used = exhausted ? [] : room.usedIds;
  const question = pickQuestion(used, room.category);
  room.phase = 'voting';
  room.question = question;
  room.votes = {};
  room.result = null;
  room.voterIds = room.players.map((p) => p.id);
  room.usedIds = [...used, question.id];
  room.round = (room.round || 0) + 1;
  return room;
}

export function setBalanceCategory(room: BalanceRoom, playerId: string, category: BalanceCategoryId) {
  if (room.phase !== 'lobby' || playerId !== room.hostId) return;
  if (!BALANCE_CATEGORIES.some((c) => c.id === category)) return;
  if (room.category === category) return room;
  room.category = category;
  room.usedIds = [];
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
    const losers = minority === 'left' ? left : right;
    losers.forEach((p) => {
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

export function nextBalanceRound(room: BalanceRoom, playerId: string) {
  if (room.phase !== 'result' || playerId !== room.hostId) return;
  return startBalanceRound(room);
}

export function joinBalanceRoom(room: BalanceRoom, name: string, playerId: string) {
  if (room.players.some((p) => p.id === playerId)) return room;
  if (room.players.length >= room.maxPlayers) return '방이 가득 찼습니다';
  room.players.push(makePlayer(name, room.players.length, playerId));
  return room;
}
