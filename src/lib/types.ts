export type TileType =
  | 'start'
  | 'drink'
  | 'point'
  | 'minigame'
  | 'blackknight'
  | 'all'
  | 'rps'
  | 'move'
  | 'truth'
  | 'sing'
  | 'skip'
  | 'random_player'
  | 'water'
  | 'roulette';

export type Tile = {
  id: number;
  name: string;
  emoji: string;
  type: TileType;
  desc: string;
  amount?: number;
  steps?: number;
};

export type MiniGame = {
  id: string;
  name: string;
  emoji: string;
  desc: string;
};

export type RoulettePrize = {
  label: string;
  emoji: string;
  type: string;
  amount?: number;
};

export type ChosungRound = {
  hint: string;
  text: string;
};

export type PlayMode = 'free' | 'team';

export type Player = {
  id: string;
  name: string;
  color: string;
  icon: string;
  drinks: number;
  position: number;
  skip: boolean;
  connected: boolean;
  lastSeen: number;
  team: number;
};

export type OverlayType =
  | 'finish'
  | 'lap'
  | 'skip'
  | 'move-tile'
  | 'minigame-intro'
  | 'pick'
  | 'knight'
  | 'truth'
  | 'sing'
  | 'spin-player'
  | 'spin-roulette'
  | 'spin-minigame'
  | 'baskin'
  | 'nunchi'
  | 'bomb'
  | 'chosung'
  | 'subway'
  | 'rps'
  | 'rps-tie';

export type SpinItem = {
  i: number;
  name: string;
  color: string;
};

export type OverlayState = {
  type: OverlayType;
  emoji?: string;
  title?: string;
  desc?: string;
  actor?: number;
  ids?: number[];
  kind?: string;
  extra?: number | string | null;
  loop?: Array<SpinItem | RoulettePrize | MiniGame>;
  winner?: number;
  until?: number;
  n?: number;
  turn?: number;
  last?: number;
  low?: number;
  high?: number;
  msg?: string;
  holder?: number;
  explodeAt?: number;
  hint?: string;
  text?: string;
  endsAt?: number;
  a?: number;
  b?: number;
  chosen?: number[];
  label?: string;
  gameId?: string;
  prize?: RoulettePrize;
  steps?: number;
};

export type MiniState = {
  id: string;
  n?: number;
  turn?: number;
  last?: number;
  secret?: number;
  low?: number;
  high?: number;
  holder?: number;
  exploded?: boolean;
  hint?: string;
  text?: string;
  endsAt?: number;
  a?: number;
  b?: number;
  picks?: Record<string, number>;
};

export type PendingMove = {
  kind: 'move';
  player: number;
  steps: number;
  trigger: boolean;
  left?: number;
  passedStart?: boolean;
};

export type RoomOptions = {
  maxPlayers?: number;
  mode?: PlayMode;
  teamCount?: number;
  title?: string;
};

export type Room = {
  code: string;
  title: string;
  hostId: string;
  phase: 'lobby' | 'playing';
  mode: PlayMode;
  teamCount: number;
  maxPlayers: number;
  players: Player[];
  current: number;
  lastDice: number;
  rolling: boolean;
  moving: boolean;
  overlay: OverlayState | null;
  mini: MiniState | null;
  pending: PendingMove | null;
};

export type GameAction =
  | { op: 'finish' }
  | { op: 'lap' }
  | { op: 'skip-ok' }
  | { op: 'do-move' }
  | { op: 'start-minigame' }
  | { op: 'nunchi' }
  | { op: 'bomb-pass' }
  | { op: 'spin-done' }
  | { op: 'bomb-explode' }
  | { op: 'chosung-timeout' }
  | { op: 'rps-again' }
  | { op: 'knight-self' }
  | { op: 'knight-volunteer' }
  | { op: 'pick'; index: number }
  | { op: 'truth'; shot: boolean }
  | { op: 'sing'; ok: boolean }
  | { op: 'baskin'; k: number }
  | { op: 'chosung'; ok: boolean }
  | { op: 'subway'; ok: boolean }
  | { op: 'rps-pick'; v: number };

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

export type Screen = 'home' | 'lobby' | 'game';

export type BalanceChoice = 'left' | 'right';

export type BalanceCategoryId = 'all' | 'drink' | 'love' | 'taste' | 'extreme';

export type BalanceQuestion = {
  id: string;
  category: Exclude<BalanceCategoryId, 'all'>;
  left: string;
  right: string;
  leftEmoji: string;
  rightEmoji: string;
};

export type BalanceResult = {
  left: number;
  right: number;
  minority: BalanceChoice | 'tie';
};

export type BalanceRoom = {
  code: string;
  title: string;
  hostId: string;
  phase: 'lobby' | 'voting' | 'result';
  maxPlayers: number;
  players: Player[];
  question: BalanceQuestion | null;
  nextQuestion: BalanceQuestion | null;
  votes: Record<string, BalanceChoice>;
  voterIds: string[];
  usedIds: string[];
  usedTexts: string[];
  result: BalanceResult | null;
  round: number;
  totalRounds: number;
  category: BalanceCategoryId;
  endAcks: string[];
};
