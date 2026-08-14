import type { ChosungRound, MiniGame, RoulettePrize, Tile } from './types';

export const MAX_PLAYERS = 20;

export const PLAYER_COLORS = [
  '#3ecf6a',
  '#ffd24a',
  '#ff5a7a',
  '#5aa7ff',
  '#ff8a3d',
  '#c084fc',
  '#22d3ee',
  '#fb7185',
  '#a3e635',
  '#f472b6',
  '#38bdf8',
  '#facc15',
  '#fb923c',
  '#818cf8',
  '#34d399',
  '#e879f9',
  '#f87171',
  '#2dd4bf',
  '#c4b5fd',
  '#fdba74',
];

export const PLAYER_ICONS = [
  '🦊', '🐸', '🐱', '🐼', '🐯', '🐰', '🐻', '🐷', '🐵', '🐶',
  '🦁', '🐮', '🐨', '🐔', '🦄', '🐙', '🐥', '🐧', '🦉', '🐲',
];

export const TEAM_META = [
  { id: 0, name: '홍팀', emoji: '🔴', color: '#ff5a7a' },
  { id: 1, name: '청팀', emoji: '🔵', color: '#5aa7ff' },
  { id: 2, name: '녹팀', emoji: '🟢', color: '#3ecf6a' },
  { id: 3, name: '노팀', emoji: '🟡', color: '#ffd24a' },
] as const;

export const TILES: Tile[] = [
  { id: 0, name: '출발', emoji: '🚩', type: 'start', desc: '한 바퀴 돌면 축하주 1잔!' },
  { id: 1, name: '술 1잔', emoji: '🍺', type: 'drink', amount: 1, desc: '본인 원샷 1잔' },
  { id: 2, name: '지정 1잔', emoji: '👉', type: 'point', amount: 1, desc: '마음에 드는 사람 지목' },
  { id: 3, name: '랜덤 게임', emoji: '🎲', type: 'minigame', desc: '즉석 술게임 한 판' },
  { id: 4, name: '흑기사', emoji: '🖤', type: 'blackknight', desc: '대신 마셔줄 사람을 찾자' },
  { id: 5, name: '술 2잔', emoji: '🍻', type: 'drink', amount: 2, desc: '본인 2잔. 변명 금지' },
  { id: 6, name: '다같이', emoji: '🎉', type: 'all', amount: 1, desc: '전원 원샷!' },
  { id: 7, name: '가위바위보', emoji: '✌️', type: 'rps', desc: '한 명 골라서 승부' },
  { id: 8, name: '뒤로 3칸', emoji: '⏪', type: 'move', steps: -3, desc: '뒤로 3칸 이동' },
  { id: 9, name: '술 1잔', emoji: '🥃', type: 'drink', amount: 1, desc: '본인 원샷 1잔' },
  { id: 10, name: '진실/원샷', emoji: '🙊', type: 'truth', desc: '진실 아니면 마신다' },
  { id: 11, name: '랜덤 게임', emoji: '🎮', type: 'minigame', desc: '즉석 술게임 한 판' },
  { id: 12, name: '폭탄주', emoji: '💣', type: 'drink', amount: 3, desc: '본인 3잔. 생존을 기원합니다' },
  { id: 13, name: '흑기사', emoji: '🛡️', type: 'blackknight', desc: '흑기사는 사랑입니다' },
  { id: 14, name: '노래 한 소절', emoji: '🎤', type: 'sing', desc: '실패하면 2잔' },
  { id: 15, name: '지정 2잔', emoji: '👆', type: 'point', amount: 2, desc: '한 명에게 2잔 선물' },
  { id: 16, name: '한 턴 쉼', emoji: '😴', type: 'skip', desc: '다음 턴은 쉰다. 대신 1잔' },
  { id: 17, name: '술 1잔', emoji: '🍶', type: 'drink', amount: 1, desc: '본인 원샷 1잔' },
  { id: 18, name: '랜덤 원샷', emoji: '🎯', type: 'random_player', desc: '운명의 희생자를 뽑는다' },
  { id: 19, name: '앞으로 3칸', emoji: '⏩', type: 'move', steps: 3, desc: '앞으로 3칸 이동' },
  { id: 20, name: '랜덤 게임', emoji: '🎰', type: 'minigame', desc: '즉석 술게임 한 판' },
  { id: 21, name: '물 한잔', emoji: '💧', type: 'water', desc: '간 챙기는 턴. 물은 공짜' },
  { id: 22, name: '술 2잔', emoji: '🍷', type: 'drink', amount: 2, desc: '본인 2잔' },
  { id: 23, name: '황금 룰렛', emoji: '👑', type: 'roulette', desc: '운명을 돌린다' },
];

export const MINIGAMES: MiniGame[] = [
  {
    id: 'baskin',
    name: '베스킨라빈스 31',
    emoji: '🍦',
    desc: '1~3개씩 숫자를 말한다. 31을 말하는 사람이 마신다.',
  },
  {
    id: 'nunchi',
    name: '눈치게임',
    emoji: '👀',
    desc: '숫자를 순서대로 외친다. 마지막 숫자를 말한 사람이 마신다.',
  },
  {
    id: 'updown',
    name: '업다운',
    emoji: '🔢',
    desc: '1~30 숫자를 맞춘다. 틀린 사람은 1잔, 맞히면 지목 1잔.',
  },
  {
    id: 'bomb',
    name: '폭탄 돌리기',
    emoji: '💣',
    desc: '터지기 전에 다음 사람에게 넘긴다. 터진 사람이 2잔.',
  },
  {
    id: 'chosung',
    name: '초성 게임',
    emoji: '📝',
    desc: '초성을 보고 단어를 말한다. 시간 안에 못하면 1잔.',
  },
  {
    id: 'death',
    name: '더 게임 오브 데스',
    emoji: '☠️',
    desc: '한 명을 지목한다. 지목당한 사람이 2잔.',
  },
];

export const ROULETTE_PRIZES: RoulettePrize[] = [
  { label: '술 5잔', emoji: '💀', type: 'drink', amount: 5 },
  { label: '전원 2잔', emoji: '🌊', type: 'all', amount: 2 },
  { label: '한 명 빼고 원샷', emoji: '😈', type: 'all_but_one', amount: 1 },
  { label: '흑기사 호출', emoji: '🖤', type: 'blackknight' },
  { label: '지정 3잔', emoji: '🎁', type: 'point', amount: 3 },
  { label: '물 원샷', emoji: '🍀', type: 'water' },
  { label: '본인 1잔', emoji: '🍺', type: 'drink', amount: 1 },
  { label: '랜덤 게임', emoji: '🎲', type: 'minigame' },
];

export const CHOSUNG_ROUNDS: ChosungRound[] = [
  { hint: '과일', text: 'ㅅㄱ' },
  { hint: '과일', text: 'ㅂㄴㄴ' },
  { hint: '음식', text: 'ㅊㅋㅁㄴ' },
  { hint: '음식', text: 'ㅅㅈ' },
  { hint: '가수', text: 'ㅂㅅ' },
  { hint: '가수', text: 'ㄴㅅ' },
  { hint: '드라마', text: 'ㄱㄷ' },
  { hint: '도시', text: 'ㅅㅇ' },
  { hint: '도시', text: 'ㅂㅅ' },
  { hint: '술', text: 'ㅅㅈ' },
  { hint: '술', text: 'ㅁㄱㄹ' },
  { hint: '동물', text: 'ㄱㅇㅇ' },
  { hint: '동물', text: 'ㅎㅇ' },
  { hint: '아이돌', text: 'ㅂㅌㅅ' },
  { hint: '과자', text: 'ㅃㅃㄹ' },
  { hint: '라면', text: 'ㅅㄹㅁ' },
];

export function tileGridPosition(id: number) {
  if (id >= 0 && id <= 6) return { row: 1, col: id + 1 };
  if (id >= 7 && id <= 11) return { row: id - 5, col: 7 };
  if (id >= 12 && id <= 18) return { row: 7, col: 19 - id };
  return { row: 25 - id, col: 1 };
}
