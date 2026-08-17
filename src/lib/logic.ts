import {
  PLAYER_COLORS,
  PLAYER_ICONS,
  TILES,
  MINIGAMES,
  ROULETTE_PRIZES,
  CHOSUNG_ROUNDS,
  SUBWAY_LINES,
  MAX_PLAYERS,
  TEAM_META,
} from './data';
import type { GameAction, MiniGame, MiniState, OverlayState, PlayMode, Player, Room, RoomOptions, RoulettePrize, Tile } from './types';

export const MIN_LAPS = 1;
export const MAX_LAPS = 20;
export const DEFAULT_LAPS = 3;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function clampLaps(n: number) {
  const value = Math.round(Number(n) || DEFAULT_LAPS);
  return Math.min(MAX_LAPS, Math.max(MIN_LAPS, value));
}

export function rand(n: number) {
  return Math.floor(Math.random() * n);
}

export function makeCode() {
  let code = '';
  for (let i = 0; i < 4; i += 1) code += CODE_CHARS[rand(CODE_CHARS.length)];
  return code;
}

export function makePlayer(name: string, index: number, id = crypto.randomUUID(), team = 0): Player {
  return {
    id,
    name: String(name || '').trim().slice(0, 8) || `플레이어 ${index + 1}`,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    icon: PLAYER_ICONS[index % PLAYER_ICONS.length],
    drinks: 0,
    position: 0,
    skip: false,
    laps: 0,
    connected: true,
    lastSeen: Date.now(),
    team,
  };
}

export function emptyRoom(code: string, host: Player, options: RoomOptions = {}): Room {
  const maxPlayers = Math.min(MAX_PLAYERS, Math.max(1, options.maxPlayers ?? 8));
  const mode = options.mode === 'team' ? 'team' : 'free';
  const teamCount = Math.min(4, Math.max(2, options.teamCount ?? 2));
  return {
    code,
    title: options.title || `${host.name}의 방`,
    hostId: host.id,
    phase: 'lobby',
    mode,
    teamCount,
    maxPlayers,
    players: [{ ...host, team: 0 }],
    current: 0,
    lastDice: 1,
    laps: 0,
    totalLaps: clampLaps(options.totalLaps ?? DEFAULT_LAPS),
    endAcks: [],
    rolling: false,
    moving: false,
    overlay: null,
    mini: null,
    pending: null,
  };
}

export function normalizeRoom(raw: unknown): Room | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const room = { ...data } as Room;
  room.players = toArray(data.players) as Player[];
  if (room.overlay) {
    room.overlay = { ...room.overlay };
    if (room.overlay.ids) room.overlay.ids = toArray(room.overlay.ids).map(Number);
    if (room.overlay.loop) room.overlay.loop = toArray(room.overlay.loop) as OverlayState['loop'];
    if (room.overlay.chosen) room.overlay.chosen = toArray(room.overlay.chosen).map(Number);
  } else {
    room.overlay = null;
  }
  room.mini = (data.mini as MiniState) || null;
  room.pending = (data.pending as Room['pending']) || null;
  room.rolling = !!room.rolling;
  room.moving = !!room.moving;
  room.phase = room.phase === 'playing' || room.phase === 'ended' ? room.phase : 'lobby';
  room.laps = Number(room.laps) || 0;
  room.totalLaps = clampLaps(Number(room.totalLaps) || DEFAULT_LAPS);
  room.endAcks = toArray(room.endAcks).map(String);
  room.mode = room.mode === 'team' ? 'team' : 'free';
  room.teamCount = Math.min(4, Math.max(2, Number(room.teamCount) || 2));
  room.maxPlayers = Math.min(MAX_PLAYERS, Math.max(1, Number(room.maxPlayers) || 8));
  room.title = room.title || `${room.players[0]?.name || '주루마블'}의 방`;
  room.players = room.players.map((p, i) => ({
    ...p,
    team: Math.min(room.teamCount - 1, Math.max(0, Number(p.team) || 0)),
    color: p.color || PLAYER_COLORS[i % PLAYER_COLORS.length],
    icon: p.icon || PLAYER_ICONS[i % PLAYER_ICONS.length],
    laps: Number(p.laps) || 0,
  }));
  return room;
}

function toArray(value: unknown): unknown[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'object') return Object.values(value);
  return [];
}

export function findPlayer(room: Room, playerId: string) {
  return room.players.findIndex((p) => p.id === playerId);
}

function pname(room: Room, i: number) {
  return room.players[i]?.name || `플레이어 ${i + 1}`;
}

function others(room: Room, except: number, kind: 'any' | 'rival' | 'ally' = 'any') {
  return room.players.map((_, i) => i).filter((i) => {
    if (i === except) return false;
    if (room.mode !== 'team' || kind === 'any') return true;
    const same = room.players[i].team === room.players[except].team;
    return kind === 'rival' ? !same : same;
  });
}

export function teamLabel(team: number) {
  return TEAM_META[team] ?? TEAM_META[0];
}

export function smallestTeam(room: Room) {
  const counts = TEAM_META.slice(0, room.teamCount).map(
    (meta) => room.players.filter((p) => p.team === meta.id).length,
  );
  return counts.indexOf(Math.min(...counts));
}

function pickOrFallback(
  room: Room,
  me: number,
  title: string,
  desc: string,
  ids: number[],
  kind: string,
  extra: number | string | null = null,
) {
  if (ids.length) {
    setPick(room, title, desc, ids, kind, extra);
    return;
  }
  if (kind === 'point') {
    const amount = Number(extra) || 1;
    addDrinks(room, me, amount);
    finishTurn(room, `지목할 상대가 없어 ${pname(room, me)} ${amount}잔`);
  } else if (kind === 'death') {
    addDrinks(room, me, 2);
    finishTurn(room, `지목할 상대가 없어 ${pname(room, me)} 2잔`);
  } else if (kind === 'knight-2') {
    addDrinks(room, me, 2);
    finishTurn(room, `흑기사 후보가 없어 ${pname(room, me)} 2잔`);
  } else if (kind === 'rps-opponent') {
    finishTurn(room, '대결할 상대가 없습니다');
  } else if (kind === 'all_but_one') {
    finishTurn(room, `${pname(room, me)}만 생존. 마실 사람이 없습니다`);
  }
}

function addDrinks(room: Room, index: number, amount = 0) {
  if (amount > 0) room.players[index].drinks += amount;
}

function addAllDrinks(room: Room, amount = 0, except: number | null = null) {
  room.players.forEach((_, i) => {
    if (i !== except) addDrinks(room, i, amount);
  });
}

function finishTurn(room: Room, message: string) {
  room.overlay = {
    type: 'finish',
    emoji: '🍻',
    title: '수행 완료',
    desc: message,
    actor: room.current,
  };
  room.mini = null;
  room.pending = null;
}

function setPick(
  room: Room,
  title: string,
  desc: string,
  ids: number[],
  kind: string,
  extra: number | string | null = null,
) {
  room.overlay = { type: 'pick', title, desc, ids, kind, extra, actor: room.current };
}

function nextTurn(room: Room) {
  room.overlay = null;
  room.mini = null;
  room.pending = null;
  room.current = (room.current + 1) % room.players.length;
}

function shuffle<T>(list: T[]) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startRandomMinigame(room: Room) {
  const game = MINIGAMES[rand(MINIGAMES.length)];
  const loop = shuffle([...MINIGAMES, ...MINIGAMES]);
  loop.push(game);
  room.overlay = {
    type: 'spin-minigame',
    loop,
    gameId: game.id,
    emoji: game.emoji,
    title: game.name,
    desc: game.desc,
    actor: room.current,
    until: Date.now() + 2100,
  };
}

function startSpinPlayer(room: Room) {
  const rivals = others(room, room.current, 'rival');
  const ids = rivals.length ? rivals : room.players.map((_, i) => i);
  const winner = ids[rand(ids.length)];
  const loop = [...ids, ...ids, ...ids, winner];
  room.overlay = {
    type: 'spin-player',
    loop: loop.map((i) => ({ i, name: pname(room, i), color: room.players[i].color })),
    winner,
    until: Date.now() + 1750,
  };
}

function startSpinRoulette(room: Room) {
  const prize = ROULETTE_PRIZES[rand(ROULETTE_PRIZES.length)];
  const loop = shuffle([...ROULETTE_PRIZES, ...ROULETTE_PRIZES]);
  loop.push(prize);
  room.overlay = {
    type: 'spin-roulette',
    loop,
    prize,
    until: Date.now() + 2100,
  };
}

function applyPrize(room: Room, prize: RoulettePrize) {
  const me = room.current;
  if (prize.type === 'drink') {
    addDrinks(room, me, prize.amount);
    finishTurn(room, `${pname(room, me)} ${prize.label}`);
  } else if (prize.type === 'all') {
    addAllDrinks(room, prize.amount);
    finishTurn(room, `전원 ${prize.amount}잔`);
  } else if (prize.type === 'all_but_one') {
    pickOrFallback(room, me, '살아남을 사람', '이 사람만 안 마십니다', room.players.map((_, i) => i), 'all_but_one');
  } else if (prize.type === 'blackknight') {
    pickOrFallback(room, me, '흑기사', '대신 마실 사람', others(room, me, 'rival'), 'knight-2');
  } else if (prize.type === 'point') {
    pickOrFallback(room, me, '지정', `${prize.amount}잔 선물`, others(room, me, 'rival'), 'point', prize.amount ?? 1);
  } else if (prize.type === 'water') {
    finishTurn(room, '대박. 물 원샷으로 생존');
  } else if (prize.type === 'minigame') {
    startRandomMinigame(room);
  }
}

export function resolveTile(room: Room, tile: Tile) {
  const me = room.current;
  switch (tile.type) {
    case 'start':
      finishTurn(room, '출발점에 머물렀습니다. 숨 고르고 다음!');
      break;
    case 'drink':
      addDrinks(room, me, tile.amount);
      finishTurn(room, `${pname(room, me)} ${tile.amount}잔 마시기`);
      break;
    case 'all':
      addAllDrinks(room, tile.amount);
      finishTurn(room, `전원 ${tile.amount}잔! 원샷`);
      break;
    case 'point':
      pickOrFallback(
        room,
        me,
        '누구 마실래',
        `${tile.amount}잔을 떠넘길 사람을 고르세요`,
        others(room, me, 'rival'),
        'point',
        tile.amount ?? 1,
      );
      break;
    case 'blackknight':
      if (!others(room, me, 'ally').length) {
        addDrinks(room, me, 1);
        finishTurn(room, `흑기사가 없어 ${pname(room, me)} 1잔`);
        break;
      }
      room.overlay = {
        type: 'knight',
        desc:
          room.mode === 'team'
            ? `${pname(room, me)} 대신 마셔줄 같은 팀을 찾습니다`
            : `${pname(room, me)} 대신 마셔줄 사람을 찾습니다`,
        actor: me,
      };
      break;
    case 'random_player':
      startSpinPlayer(room);
      break;
    case 'skip':
      addDrinks(room, me, 1);
      room.players[me].skip = true;
      finishTurn(room, `${pname(room, me)} 1잔 마시고 다음 턴 쉽니다`);
      break;
    case 'water':
      finishTurn(room, '물 한잔. 오늘은 간도 챙기자');
      break;
    case 'truth':
      room.overlay = { type: 'truth', actor: me };
      break;
    case 'sing':
      room.overlay = { type: 'sing', actor: me };
      break;
    case 'rps':
      pickOrFallback(room, me, '가위바위보 상대', '한 명을 골라 승부하세요', others(room, me, 'rival'), 'rps-opponent');
      break;
    case 'move':
      room.overlay = {
        type: 'move-tile',
        emoji: tile.emoji,
        title: tile.name,
        desc: tile.desc,
        steps: tile.steps,
        actor: me,
      };
      break;
    case 'minigame':
      startRandomMinigame(room);
      break;
    case 'roulette':
      startSpinRoulette(room);
      break;
    default:
      finishTurn(room, tile.desc);
  }
}

function runMinigame(room: Room, id: string) {
  if (id === 'baskin') {
    room.mini = { id, n: 0, turn: room.current };
    room.overlay = { type: 'baskin', n: 0, turn: room.current };
  } else if (id === 'nunchi') {
    const last = 7 + room.players.length;
    room.mini = { id, n: 0, last };
    room.overlay = { type: 'nunchi', n: 0, last };
  } else if (id === 'bomb') {
    room.mini = { id, holder: room.current, exploded: false };
    room.overlay = {
      type: 'bomb',
      holder: room.current,
      explodeAt: Date.now() + 3500 + rand(7000),
    };
  } else if (id === 'chosung') {
    const round = CHOSUNG_ROUNDS[rand(CHOSUNG_ROUNDS.length)];
    const endsAt = Date.now() + 8000;
    room.mini = { id, ...round, endsAt };
    room.overlay = {
      type: 'chosung',
      hint: round.hint,
      text: round.text,
      endsAt,
      actor: room.current,
    };
  } else if (id === 'subway') {
    const line = SUBWAY_LINES[rand(SUBWAY_LINES.length)];
    room.mini = { id, text: line.name, hint: line.color, turn: room.current };
    room.overlay = {
      type: 'subway',
      text: line.name,
      hint: line.color,
      turn: room.current,
      actor: room.current,
    };
  } else {
    pickOrFallback(room, room.current, '더 게임 오브 데스', '한 명을 지목하세요. 2잔', others(room, room.current, 'rival'), 'death');
  }
}

function handlePick(room: Room, index: number) {
  const overlay = room.overlay;
  if (!overlay || overlay.type !== 'pick') return;
  if (!overlay.ids?.includes(index)) return;
  const kind = overlay.kind;
  const amount = Number(overlay.extra) || 1;
  if (kind === 'point') {
    addDrinks(room, index, amount);
    finishTurn(room, `${pname(room, index)}가 ${amount}잔 마십니다`);
  } else if (kind === 'death') {
    addDrinks(room, index, 2);
    finishTurn(room, `${pname(room, index)} 지목당함. 2잔`);
  } else if (kind === 'knight-2') {
    addDrinks(room, index, 2);
    finishTurn(room, `${pname(room, index)} 흑기사 2잔`);
  } else if (kind === 'all_but_one') {
    addAllDrinks(room, 1, index);
    finishTurn(room, `${pname(room, index)}만 생존. 나머지는 원샷`);
  } else if (kind === 'rps-opponent') {
    room.mini = { id: 'rps', a: room.current, b: index, picks: {} };
    room.overlay = { type: 'rps', a: room.current, b: index, chosen: [] };
  }
}

export function beginRoll(room: Room, playerIndex: number) {
  if (room.phase !== 'playing' || room.rolling || room.moving || room.overlay) return;
  if (playerIndex !== room.current) return;
  const me = room.players[playerIndex];
  if (me.skip) {
    room.overlay = {
      type: 'skip',
      emoji: '😴',
      title: '한 턴 쉼',
      desc: `${me.name} 이번엔 쉽니다`,
      actor: playerIndex,
    };
    return room;
  }
  room.rolling = true;
  room.lastDice = 1 + rand(6);
  room.pending = { kind: 'move', player: playerIndex, steps: room.lastDice, trigger: true };
  return room;
}

export function startPendingMove(room: Room) {
  if (!room.pending || room.pending.kind !== 'move') return;
  room.rolling = false;
  room.moving = true;
  room.overlay = null;
  return room;
}

export function stepMove(room: Room) {
  const pending = room.pending;
  if (!pending || pending.kind !== 'move') return;
  const player = room.players[pending.player];
  const dir = pending.steps >= 0 ? 1 : -1;
  const next = (player.position + dir + TILES.length) % TILES.length;
  if (dir > 0 && next === 0) pending.passedStart = true;
  player.position = next;
  pending.left = (pending.left ?? Math.abs(pending.steps)) - 1;
  if (pending.left > 0) return room;
  room.moving = false;
  room.pending = null;
  if (pending.passedStart && pending.trigger) {
    addDrinks(room, pending.player, 1);
    player.laps = (player.laps || 0) + 1;
    room.laps = (room.laps || 0) + 1;
    const total = room.totalLaps || DEFAULT_LAPS;
    if (room.laps >= total) {
      endMarbleGame(
        room,
        pending.player,
        `${pname(room, pending.player)}가 ${total}바퀴째 출발점을 통과했습니다`,
      );
      return room;
    }
    room.overlay = {
      type: 'lap',
      emoji: '🚩',
      title: `${room.laps}/${total}바퀴`,
      desc: `${pname(room, pending.player)} 출발점 통과! 축하주 1잔 추가`,
      actor: pending.player,
    };
    return room;
  }
  if (pending.trigger) resolveTile(room, TILES[player.position]);
  return room;
}

export function applyAct(room: Room, playerIndex: number, data: GameAction) {
  const op = data?.op;
  const overlay = room.overlay;
  if (op === 'spin-done') {
    if (overlay?.type === 'spin-player') {
      const loop = overlay.loop;
      const last = loop?.[loop.length - 1];
      const winner = overlay.winner ?? (last && 'i' in last ? last.i : undefined);
      if (winner == null || !room.players[winner]) return room;
      addDrinks(room, winner, 1);
      finishTurn(room, `운명의 원샷: ${pname(room, winner)}`);
      return room;
    }
    if (overlay?.type === 'spin-roulette') {
      if (!overlay.prize) return room;
      applyPrize(room, overlay.prize);
      return room;
    }
    if (overlay?.type === 'spin-minigame') {
      const game =
        MINIGAMES.find((g) => g.id === overlay.gameId) ||
        (overlay.loop?.[overlay.loop.length - 1] as MiniGame | undefined);
      if (!game || !('id' in game)) return room;
      room.overlay = {
        type: 'minigame-intro',
        emoji: game.emoji,
        title: game.name,
        desc: game.desc,
        gameId: game.id,
        actor: overlay.actor ?? room.current,
      };
      return room;
    }
    return room;
  }
  if (op === 'bomb-explode') {
    if (overlay?.type !== 'bomb' || !room.mini || room.mini.exploded) return;
    if (overlay.holder == null) return;
    room.mini.exploded = true;
    addDrinks(room, overlay.holder, 2);
    finishTurn(room, `펑! ${pname(room, overlay.holder)} 폭탄 2잔`);
    return room;
  }
  if (op === 'chosung-timeout') {
    if (overlay?.type !== 'chosung') return;
    addDrinks(room, room.current, 1);
    finishTurn(room, `시간 초과! ${pname(room, room.current)} 1잔`);
    return room;
  }
  if (!overlay) return;

  if (op === 'finish' && overlay.type === 'finish' && playerIndex === overlay.actor) {
    nextTurn(room);
  } else if (op === 'end-ack' && overlay.type === 'gameover') {
    const id = playerIndex >= 0 ? room.players[playerIndex]?.id : '';
    if (!id) return;
    return ackMarbleEnd(room, id);
  } else if (op === 'lap' && overlay.type === 'lap' && playerIndex === overlay.actor) {
    resolveTile(room, TILES[room.players[room.current].position]);
  } else if (op === 'skip-ok' && overlay.type === 'skip' && playerIndex === overlay.actor) {
    room.players[playerIndex].skip = false;
    nextTurn(room);
  } else if (op === 'pick' && overlay.type === 'pick' && playerIndex === overlay.actor) {
    handlePick(room, Number(data.index));
  } else if (op === 'knight-self' && overlay.type === 'knight' && playerIndex === overlay.actor) {
    addDrinks(room, playerIndex, 1);
    finishTurn(room, `${pname(room, playerIndex)} 흑기사 실패. 본인 1잔`);
  } else if (op === 'knight-volunteer' && overlay.type === 'knight' && playerIndex !== overlay.actor) {
    if (room.mode === 'team') {
      const actorTeam = room.players[overlay.actor ?? 0]?.team;
      if (room.players[playerIndex].team !== actorTeam) return;
    }
    addDrinks(room, playerIndex, 1);
    finishTurn(room, `${pname(room, playerIndex)} 흑기사 등판. 1잔 대참`);
  } else if (op === 'truth' && overlay.type === 'truth' && playerIndex === overlay.actor) {
    if (data.shot) {
      addDrinks(room, playerIndex, 1);
      finishTurn(room, `${pname(room, playerIndex)} 진실 포기. 원샷`);
    } else {
      finishTurn(room, `${pname(room, playerIndex)} 진실을 말하기로 했습니다. 다들 잘 들으세요`);
    }
  } else if (op === 'sing' && overlay.type === 'sing' && playerIndex === overlay.actor) {
    if (data.ok) finishTurn(room, '노래 성공. 넘어갑니다');
    else {
      addDrinks(room, playerIndex, 2);
      finishTurn(room, `${pname(room, playerIndex)} 음치 인증. 2잔`);
    }
  } else if (op === 'do-move' && overlay.type === 'move-tile' && playerIndex === overlay.actor) {
    room.pending = { kind: 'move', player: playerIndex, steps: overlay.steps ?? 0, trigger: true };
    room.rolling = false;
    room.moving = true;
    room.overlay = null;
  } else if (op === 'start-minigame' && overlay.type === 'minigame-intro' && playerIndex === overlay.actor) {
    runMinigame(room, overlay.gameId ?? 'death');
  } else if (op === 'baskin' && overlay.type === 'baskin' && playerIndex === overlay.turn) {
    const k = Number(data.k);
    const n0 = overlay.n ?? 0;
    if (![1, 2, 3].includes(k) || n0 + k > 31) return;
    const n = n0 + k;
    if (n >= 31) {
      addDrinks(room, playerIndex, 1);
      finishTurn(room, `${pname(room, playerIndex)} 31! 1잔`);
    } else {
      const turn = ((overlay.turn ?? 0) + 1) % room.players.length;
      room.mini = { id: 'baskin', n, turn };
      room.overlay = { type: 'baskin', n, turn };
    }
  } else if (op === 'nunchi' && overlay.type === 'nunchi') {
    const n = (overlay.n ?? 0) + 1;
    const last = overlay.last ?? 0;
    if (n >= last) {
      addDrinks(room, playerIndex, 1);
      finishTurn(room, `${pname(room, playerIndex)}가 ${last}! 눈치 실패 1잔`);
    } else {
      room.mini = { ...(room.mini || { id: 'nunchi' }), n };
      room.overlay = { ...overlay, n };
    }
  } else if (op === 'bomb-pass' && overlay.type === 'bomb' && playerIndex === overlay.holder) {
    if (!room.mini || room.mini.exploded) return;
    const holder = ((overlay.holder ?? 0) + 1) % room.players.length;
    room.mini.holder = holder;
    room.overlay = { ...overlay, holder };
  } else if (op === 'subway' && overlay.type === 'subway' && playerIndex === overlay.turn) {
    if (data.ok) {
      const next = ((overlay.turn ?? 0) + 1) % room.players.length;
      if (room.players.length <= 1) {
        finishTurn(room, '지하철 통과. 다음으로');
      } else {
        room.mini = { ...(room.mini || { id: 'subway' }), turn: next };
        room.overlay = { ...overlay, turn: next };
      }
    } else {
      addDrinks(room, playerIndex, 1);
      finishTurn(room, `${pname(room, playerIndex)} 지하철 실패. 1잔`);
    }
  } else if (op === 'chosung' && overlay.type === 'chosung' && playerIndex === overlay.actor) {
    if (data.ok) finishTurn(room, '초성 성공. 넘어갑니다');
    else {
      addDrinks(room, playerIndex, 1);
      finishTurn(room, `${pname(room, playerIndex)} 초성 실패 1잔`);
    }
  } else if (op === 'rps-pick' && overlay.type === 'rps') {
    const { a, b } = overlay;
    if (a == null || b == null) return;
    if (playerIndex !== a && playerIndex !== b) return;
    if (!room.mini) return;
    const key = `p${playerIndex}`;
    if (!room.mini.picks) room.mini.picks = {};
    if (room.mini.picks[key] != null) return;
    room.mini.picks[key] = Number(data.v);
    const chosen = [...(overlay.chosen || []), playerIndex];
    if (room.mini.picks[`p${a}`] == null || room.mini.picks[`p${b}`] == null) {
      room.overlay = { type: 'rps', a, b, chosen };
    } else {
      const names = ['가위', '바위', '보'];
      const pa = room.mini.picks[`p${a}`];
      const pb = room.mini.picks[`p${b}`];
      if (pa === pb) {
        room.overlay = { type: 'rps-tie', a, b, label: names[pa], actor: a };
      } else {
        const aWin = (pa - pb + 3) % 3 === 1;
        const loser = aWin ? b : a;
        addDrinks(room, loser, 1);
        finishTurn(
          room,
          `${pname(room, a)} ${names[pa]} vs ${pname(room, b)} ${names[pb]} · ${pname(room, loser)} 1잔`,
        );
      }
    }
  } else if (op === 'rps-again' && overlay.type === 'rps-tie' && playerIndex === overlay.actor) {
    if (room.mini) room.mini.picks = {};
    room.overlay = { type: 'rps', a: overlay.a, b: overlay.b, chosen: [] };
  } else {
    return;
  }
  return room;
}

export function joinInto(room: Room, name: string) {
  if (room.phase !== 'lobby') return '이미 시작한 방입니다';
  if (room.players.length >= (room.maxPlayers || MAX_PLAYERS)) return '방이 가득 찼습니다';
  const team = room.mode === 'team' ? smallestTeam(room) : 0;
  room.players.push(makePlayer(name, room.players.length, crypto.randomUUID(), team));
  return room;
}

export function canStartGame(room: Room) {
  if (!room.players.length) return false;
  if (room.mode !== 'team') return true;
  const teams = new Set(room.players.map((p) => p.team));
  return room.players.length >= 2 && teams.size >= 2;
}

export function startGame(room: Room, playerId: string) {
  if (room.phase !== 'lobby') return;
  if (playerId !== room.hostId) return;
  if (!canStartGame(room)) return;
  room.phase = 'playing';
  room.current = 0;
  room.laps = 0;
  room.endAcks = [];
  room.players.forEach((p) => {
    p.laps = 0;
    p.position = 0;
    p.skip = false;
  });
  room.overlay = null;
  return room;
}

export function isMarbleFinished(room: Room) {
  return room.phase === 'ended' || room.overlay?.type === 'gameover';
}

export function marbleLosers(room: Room) {
  const max = Math.max(0, ...room.players.map((p) => p.drinks));
  if (!max) return [];
  return room.players.filter((p) => p.drinks === max);
}

export function waitingMarbleEndAcks(room: Room) {
  return room.players.filter((p) => !(room.endAcks || []).includes(p.id));
}

export function ackMarbleEnd(room: Room, playerId: string) {
  if (!isMarbleFinished(room)) return;
  if (!room.players.some((p) => p.id === playerId)) return;
  if (!room.endAcks.includes(playerId)) room.endAcks = [...room.endAcks, playerId];
  if (!waitingMarbleEndAcks(room).length) return null;
  return room;
}

export function setMarbleLaps(room: Room, playerId: string, totalLaps: number) {
  if (room.phase !== 'lobby' || playerId !== room.hostId) return;
  room.totalLaps = clampLaps(totalLaps);
  return room;
}

function endMarbleGame(room: Room, actor: number, message: string) {
  room.phase = 'ended';
  room.rolling = false;
  room.moving = false;
  room.pending = null;
  room.mini = null;
  room.endAcks = [];
  room.overlay = {
    type: 'gameover',
    emoji: '🏁',
    title: `${room.totalLaps}바퀴 종료`,
    desc: message,
    actor,
  };
}

export function setPlayMode(room: Room, playerId: string, mode: PlayMode, teamCount = 2) {
  if (room.phase !== 'lobby' || playerId !== room.hostId) return;
  if (mode === 'team') {
    const nextCount = Math.min(4, Math.max(2, teamCount));
    const reshuffle = room.mode !== 'team' || room.teamCount !== nextCount;
    room.mode = 'team';
    room.teamCount = nextCount;
    if (reshuffle) {
      room.players.forEach((p, i) => {
        p.team = i % room.teamCount;
      });
    }
  } else {
    room.mode = 'free';
    room.players.forEach((p) => {
      p.team = 0;
    });
  }
  return room;
}

export function setPlayerTeam(room: Room, playerId: string, targetId: string, team: number) {
  if (room.phase !== 'lobby') return;
  if (playerId !== room.hostId && playerId !== targetId) return;
  if (room.mode !== 'team') return;
  if (team < 0 || team >= room.teamCount) return;
  const player = room.players.find((p) => p.id === targetId);
  if (!player) return;
  player.team = team;
  return room;
}
