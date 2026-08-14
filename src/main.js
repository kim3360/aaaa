import {
  PLAYER_COLORS,
  TILES,
  MINIGAMES,
  ROULETTE_PRIZES,
  CHOSUNG_ROUNDS,
  tileGridPosition,
} from './data.js';

const app = document.querySelector('#app');
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const state = {
  screen: 'home',
  players: [
    { name: '', color: PLAYER_COLORS[0] },
    { name: '', color: PLAYER_COLORS[1] },
    { name: '', color: PLAYER_COLORS[2] },
  ],
  current: 0,
  positions: [],
  drinks: [],
  skip: [],
  rolling: false,
  moving: false,
  overlay: null,
  lastDice: 1,
};

function buzz(ms = 18) {
  navigator.vibrate?.(ms);
}

function rand(n) {
  return Math.floor(Math.random() * n);
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function playerName(i) {
  return esc(state.players[i]?.name || `플레이어 ${i + 1}`);
}

function others(except = state.current) {
  return state.players.map((_, i) => i).filter((i) => i !== except);
}

function addDrinks(index, amount) {
  if (amount <= 0) return;
  state.drinks[index] += amount;
}

function addAllDrinks(amount, except = null) {
  state.players.forEach((_, i) => {
    if (i !== except) addDrinks(i, amount);
  });
}

function render() {
  if (state.screen === 'home') renderHome();
  else if (state.screen === 'setup') renderSetup();
  else renderGame();
}

function renderHome() {
  app.innerHTML = `
    <section class="screen home">
      <div>
        <div class="lanterns"><span class="lantern"></span><span class="lantern"></span><span class="lantern"></span></div>
        <div class="hero">
          <div class="bottle">🍶</div>
          <h1 class="title">주루마블</h1>
          <p class="tag">걸리면 마신다 · 안 걸리면 더 마신다</p>
          <p class="sub">휴대폰 하나로 하는 술자리 보드게임<br>주사위 굴리고, 칸 효과 수행하고, 다음 사람에게 넘기세요</p>
        </div>
        <div class="rules">
          <h2>진행 방식</h2>
          <ul>
            <li>2~8명이 한 폰을 돌아가며 사용</li>
            <li>자기 턴에 주사위를 굴려 말을 이동</li>
            <li>도착 칸의 벌칙·흑기사·미니게임을 수행</li>
            <li>한 바퀴 돌면 축하주 1잔</li>
          </ul>
        </div>
      </div>
      <button class="btn btn-primary" id="go-setup">인원 정하고 시작</button>
    </section>
  `;
  app.querySelector('#go-setup').onclick = () => {
    state.screen = 'setup';
    render();
  };
}

function renderSetup() {
  app.innerHTML = `
    <section class="screen">
      <div class="setup-head">
        <h1 class="title">누가 마셔</h1>
        <span class="chip">${state.players.length}명</span>
      </div>
      <div class="player-list">
        ${state.players
          .map(
            (p, i) => `
          <div class="player-row">
            <span class="dot" style="background:${p.color};color:${p.color}"></span>
            <input data-i="${i}" maxlength="8" placeholder="이름 ${i + 1}" value="${esc(p.name)}" autocomplete="off" />
            <button class="remove" data-remove="${i}" ${state.players.length <= 2 ? 'disabled' : ''}>×</button>
          </div>
        `,
          )
          .join('')}
      </div>
      <button class="btn btn-ghost add-player" id="add" ${state.players.length >= 8 ? 'disabled' : ''}>+ 사람 추가</button>
      <button class="btn btn-primary" id="start">술판 깔기</button>
    </section>
  `;

  app.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', (e) => {
      state.players[Number(e.target.dataset.i)].name = e.target.value.trim();
    });
  });
  app.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.dataset.remove);
      state.players.splice(i, 1);
      renderSetup();
    };
  });
  app.querySelector('#add').onclick = () => {
    if (state.players.length >= 8) return;
    state.players.push({
      name: '',
      color: PLAYER_COLORS[state.players.length % PLAYER_COLORS.length],
    });
    renderSetup();
  };
  app.querySelector('#start').onclick = startGame;
}

function startGame() {
  state.players = state.players.map((p, i) => ({
    ...p,
    name: p.name || `플레이어 ${i + 1}`,
  }));
  state.positions = state.players.map(() => 0);
  state.drinks = state.players.map(() => 0);
  state.skip = state.players.map(() => false);
  state.current = 0;
  state.lastDice = 1;
  state.overlay = null;
  state.screen = 'game';
  render();
}

function renderGame() {
  const current = state.players[state.current];
  app.innerHTML = `
    <section class="screen game">
      <div class="topbar">
        <h1 class="title">주루마블</h1>
        <button class="chip" id="open-stats">주량 ${state.drinks.reduce((a, b) => a + b, 0)}잔</button>
      </div>
      <div class="board-wrap">
        <div class="board">
          ${TILES.map((tile) => {
            const pos = tileGridPosition(tile.id);
            const here = state.positions
              .map((p, i) => (p === tile.id ? i : -1))
              .filter((i) => i >= 0);
            const active = here.includes(state.current) ? 'active' : '';
            return `
              <div class="tile ${tile.type === 'start' ? 'start' : ''} ${active}"
                   style="grid-column:${pos.col};grid-row:${pos.row}">
                <span class="emoji">${tile.emoji}</span>
                <span class="label">${tile.name}</span>
                <div class="tokens">
                  ${here
                    .map(
                      (i) =>
                        `<span class="token" style="background:${state.players[i].color};color:${state.players[i].color}"></span>`,
                    )
                    .join('')}
                </div>
              </div>
            `;
          }).join('')}
          <div class="center">
            <div class="turn-label">지금 차례</div>
            <div class="turn-name" style="color:${current.color}">${playerName(state.current)}</div>
            <button class="dice ${state.rolling ? 'rolling' : ''}" id="dice" ${
              state.rolling || state.moving || state.overlay ? 'disabled' : ''
            }>${DICE_FACES[state.lastDice - 1]}</button>
            <div class="dice-hint">${state.rolling ? '굴리는 중' : '주사위를 눌러'}</div>
            <div class="stats">
              ${state.players
                .map(
                  (p, i) =>
                    `<span class="stat"><span class="dot" style="background:${p.color};color:${p.color};width:8px;height:8px"></span>${esc(p.name)}<b>${state.drinks[i]}</b></span>`,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
      ${state.overlay ? overlayHtml(state.overlay) : ''}
    </section>
  `;

  const dice = app.querySelector('#dice');
  if (dice) dice.onclick = rollDice;
  const stats = app.querySelector('#open-stats');
  if (stats) stats.onclick = showStats;
  bindOverlay();
}

function overlayHtml(view) {
  return `
    <div class="overlay">
      <div class="sheet">${view.html}</div>
    </div>
  `;
}

function openOverlay(html, bind) {
  state.overlay = { html, bind };
  renderGame();
}

function closeOverlay() {
  state.overlay = null;
  renderGame();
}

function bindOverlay() {
  state.overlay?.bind?.(app);
}

function showStats() {
  const ranked = state.players
    .map((p, i) => ({ ...p, drinks: state.drinks[i], i }))
    .sort((a, b) => b.drinks - a.drinks);
  openOverlay(
    `
      <div class="handle"></div>
      <h2 class="event-title" style="font-size:26px">주량 현황</h2>
      <p class="event-desc">많이 마신 사람일수록 오늘의 주인공</p>
      <div class="stats-sheet">
        ${ranked
          .map(
            (p, idx) => `
          <div class="stat-line">
            <span>${idx + 1}. <b style="color:${p.color}">${esc(p.name)}</b></span>
            <b>${p.drinks}잔</b>
          </div>
        `,
          )
          .join('')}
      </div>
      <div class="btn-row" style="margin-top:16px">
        <button class="btn btn-ghost" id="end-game">게임 종료</button>
        <button class="btn btn-gold" id="close-stats">계속 마시기</button>
      </div>
    `,
    (root) => {
      root.querySelector('#close-stats').onclick = closeOverlay;
      root.querySelector('#end-game').onclick = () => {
        state.screen = 'home';
        state.overlay = null;
        render();
      };
    },
  );
}

async function rollDice() {
  if (state.rolling || state.moving || state.overlay) return;
  if (state.skip[state.current]) {
    state.skip[state.current] = false;
    openOverlay(
      eventCard('😴', '한 턴 쉼', `${playerName(state.current)} 이번엔 쉽니다. 다음!`, [
        { id: 'next', label: '다음 사람', className: 'btn-primary' },
      ]),
      (root) => {
        root.querySelector('#next').onclick = () => {
          closeOverlay();
          nextTurn();
        };
      },
    );
    return;
  }

  state.rolling = true;
  renderGame();
  buzz(12);
  playDiceSound();

  const result = 1 + rand(6);
  const diceBtn = app.querySelector('#dice');
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = (now) => {
      if (diceBtn) diceBtn.textContent = DICE_FACES[rand(6)];
      if (now - start < 900) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });

  state.lastDice = result;
  state.rolling = false;
  renderGame();
  buzz([20, 40, 30]);
  await moveToken(state.current, result);
}

function playDiceSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 180;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.stop(ctx.currentTime + 0.23);
  } catch {
    /* ignore */
  }
}

async function moveToken(player, steps, trigger = true) {
  state.moving = true;
  const dir = steps >= 0 ? 1 : -1;
  let left = Math.abs(steps);
  let passedStart = false;
  while (left > 0) {
    const next = (state.positions[player] + dir + TILES.length) % TILES.length;
    if (dir > 0 && next === 0) passedStart = true;
    state.positions[player] = next;
    left -= 1;
    renderGame();
    buzz(8);
    await sleep(160);
  }
  state.moving = false;
  renderGame();
  if (passedStart && trigger) {
    addDrinks(player, 1);
    await popupThen(
      '🚩',
      '한 바퀴 완주',
      `${playerName(player)} 출발점 통과! 축하주 1잔 추가`,
    );
  }
  if (trigger) resolveTile(TILES[state.positions[player]]);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function eventCard(emoji, title, desc, buttons) {
  return `
    <div class="handle"></div>
    <div class="event-emoji">${emoji}</div>
    <h2 class="event-title">${title}</h2>
    <p class="event-desc">${desc}</p>
    ${buttons
      .map(
        (b) =>
          `<button class="btn ${b.className || 'btn-primary'}" id="${b.id}" style="margin-top:8px">${b.label}</button>`,
      )
      .join('')}
  `;
}

function playerPicker(title, desc, ids, onPick, extra = '', extraBind) {
  openOverlay(
    `
      <div class="handle"></div>
      <h2 class="event-title" style="font-size:28px">${title}</h2>
      <p class="event-desc">${desc}</p>
      <div class="pick-grid">
        ${ids
          .map(
            (i) =>
              `<button class="pick" data-pick="${i}" style="background:${state.players[i].color}">${playerName(i)}</button>`,
          )
          .join('')}
      </div>
      ${extra}
    `,
    (root) => {
      root.querySelectorAll('[data-pick]').forEach((btn) => {
        btn.onclick = () => onPick(Number(btn.dataset.pick));
      });
      extraBind?.(root);
    },
  );
}

function popupThen(emoji, title, desc) {
  return new Promise((resolve) => {
    openOverlay(
      eventCard(emoji, title, desc, [{ id: 'ok', label: '확인', className: 'btn-gold' }]),
      (root) => {
        root.querySelector('#ok').onclick = () => {
          closeOverlay();
          resolve();
        };
      },
    );
  });
}

function finishTurn(message) {
  openOverlay(
    eventCard('🍻', '수행 완료', message, [
      { id: 'next', label: '다음 사람한테 폰 넘기기', className: 'btn-primary' },
    ]),
    (root) => {
      root.querySelector('#next').onclick = () => {
        closeOverlay();
        nextTurn();
      };
    },
  );
}

function nextTurn() {
  state.current = (state.current + 1) % state.players.length;
  renderGame();
}

function resolveTile(tile) {
  const me = state.current;
  switch (tile.type) {
    case 'start':
      finishTurn('출발점에 머물렀습니다. 숨 고르고 다음!');
      break;
    case 'drink':
      addDrinks(me, tile.amount);
      finishTurn(`${playerName(me)} ${tile.amount}잔 마시기`);
      break;
    case 'all':
      addAllDrinks(tile.amount);
      finishTurn(`전원 ${tile.amount}잔! 원샷`);
      break;
    case 'point':
      playerPicker('누구 마실래', `${tile.amount}잔을 떠넘길 사람을 고르세요`, others(), (i) => {
        addDrinks(i, tile.amount);
        finishTurn(`${playerName(i)}가 ${tile.amount}잔 마십니다`);
      });
      break;
    case 'blackknight':
      playerPicker(
        '흑기사',
        `${playerName(me)} 대신 마셔줄 사람을 찾으세요`,
        others(),
        (i) => {
          addDrinks(i, 1);
          finishTurn(`${playerName(i)} 흑기사 등판. 1잔 대참`);
        },
        `<button class="btn btn-ghost" id="no-knight">흑기사 없음 · 내가 마심</button>`,
        (root) => {
          root.querySelector('#no-knight').onclick = () => {
            addDrinks(me, 1);
            finishTurn(`${playerName(me)} 흑기사 실패. 본인 1잔`);
          };
        },
      );
      break;
    case 'random_player':
      spinPlayer(others().concat(me), (i) => {
        addDrinks(i, 1);
        finishTurn(`운명의 원샷: ${playerName(i)}`);
      });
      break;
    case 'skip':
      addDrinks(me, 1);
      state.skip[me] = true;
      finishTurn(`${playerName(me)} 1잔 마시고 다음 턴 쉽니다`);
      break;
    case 'water':
      finishTurn('물 한잔. 오늘은 간도 챙기자');
      break;
    case 'truth':
      openOverlay(
        eventCard('🙊', '진실 아니면 원샷', '창피한 진실 하나, 아니면 원샷', [
          { id: 'truth', label: '진실 말할게', className: 'btn-gold' },
          { id: 'shot', label: '원샷 할게', className: 'btn-primary' },
        ]),
        (root) => {
          root.querySelector('#truth').onclick = () =>
            finishTurn(`${playerName(me)} 진실을 말하기로 했습니다. 다들 잘 들으세요`);
          root.querySelector('#shot').onclick = () => {
            addDrinks(me, 1);
            finishTurn(`${playerName(me)} 진실 포기. 원샷`);
          };
        },
      );
      break;
    case 'sing':
      openOverlay(
        eventCard('🎤', '노래 한 소절', '한 소절만 부르세요. 실패하면 2잔', [
          { id: 'ok', label: '성공', className: 'btn-soju' },
          { id: 'fail', label: '실패 · 2잔', className: 'btn-primary' },
        ]),
        (root) => {
          root.querySelector('#ok').onclick = () => finishTurn('노래 성공. 넘어갑니다');
          root.querySelector('#fail').onclick = () => {
            addDrinks(me, 2);
            finishTurn(`${playerName(me)} 음치 인증. 2잔`);
          };
        },
      );
      break;
    case 'rps':
      playerPicker('가위바위보 상대', '한 명을 골라 승부하세요', others(), (i) => playRps(me, i));
      break;
    case 'move':
      openOverlay(
        eventCard(tile.emoji, tile.name, tile.desc, [
          { id: 'go', label: '이동하기', className: 'btn-gold' },
        ]),
        (root) => {
          root.querySelector('#go').onclick = async () => {
            closeOverlay();
            await moveToken(me, tile.steps, true);
          };
        },
      );
      break;
    case 'minigame':
      startRandomMinigame();
      break;
    case 'roulette':
      spinRoulette();
      break;
    default:
      finishTurn(tile.desc);
  }
}

function spinPlayer(ids, onDone) {
  const loop = [...ids, ...ids, ...ids, ids[rand(ids.length)]];
  openOverlay(
    `
      <div class="handle"></div>
      <h2 class="event-title" style="font-size:28px">랜덤 원샷</h2>
      <p class="event-desc">운명을 뽑는 중</p>
      <div class="spin"><div class="spin-track" id="track">
        ${loop.map((i) => `<div class="spin-item" style="color:${state.players[i].color}">${playerName(i)}</div>`).join('')}
      </div></div>
    `,
    (root) => {
      const track = root.querySelector('#track');
      const winner = ids[rand(ids.length)];
      const targetIndex = loop.length - 1;
      loop[targetIndex] = winner;
      track.children[targetIndex].textContent = playerName(winner);
      track.children[targetIndex].style.color = state.players[winner].color;
      track.style.transition = 'transform 1.6s cubic-bezier(.15,.8,.1,1)';
      requestAnimationFrame(() => {
        track.style.transform = `translateY(${-54 * targetIndex}px)`;
      });
      setTimeout(() => onDone(winner), 1750);
    },
  );
}

function spinRoulette() {
  const prize = ROULETTE_PRIZES[rand(ROULETTE_PRIZES.length)];
  const loop = shuffle([...ROULETTE_PRIZES, ...ROULETTE_PRIZES]);
  loop.push(prize);
  openOverlay(
    `
      <div class="handle"></div>
      <div class="event-emoji">👑</div>
      <h2 class="event-title">황금 룰렛</h2>
      <p class="event-desc">오늘 밤의 운명</p>
      <div class="spin"><div class="spin-track" id="track">
        ${loop.map((p) => `<div class="spin-item">${p.emoji} ${p.label}</div>`).join('')}
      </div></div>
    `,
    (root) => {
      const track = root.querySelector('#track');
      track.style.transition = 'transform 2s cubic-bezier(.15,.8,.1,1)';
      requestAnimationFrame(() => {
        track.style.transform = `translateY(${-54 * (loop.length - 1)}px)`;
      });
      setTimeout(() => applyPrize(prize), 2100);
    },
  );
}

function applyPrize(prize) {
  const me = state.current;
  if (prize.type === 'drink') {
    addDrinks(me, prize.amount);
    finishTurn(`${playerName(me)} ${prize.label}`);
  } else if (prize.type === 'all') {
    addAllDrinks(prize.amount);
    finishTurn(`전원 ${prize.amount}잔`);
  } else if (prize.type === 'all_but_one') {
    playerPicker('살아남을 사람', '이 사람만 안 마십니다', others().concat(me), (safe) => {
      addAllDrinks(1, safe);
      finishTurn(`${playerName(safe)}만 생존. 나머지는 원샷`);
    });
  } else if (prize.type === 'blackknight') {
    playerPicker('흑기사', '대신 마실 사람', others(), (i) => {
      addDrinks(i, 2);
      finishTurn(`${playerName(i)} 흑기사 2잔`);
    });
  } else if (prize.type === 'point') {
    playerPicker('지정', `${prize.amount}잔 선물`, others(), (i) => {
      addDrinks(i, prize.amount);
      finishTurn(`${playerName(i)} ${prize.amount}잔`);
    });
  } else if (prize.type === 'water') {
    finishTurn('대박. 물 원샷으로 생존');
  } else if (prize.type === 'minigame') {
    startRandomMinigame();
  }
}

function startRandomMinigame() {
  const game = MINIGAMES[rand(MINIGAMES.length)];
  openOverlay(
    eventCard(game.emoji, game.name, game.desc, [
      { id: 'go', label: '게임 시작', className: 'btn-gold' },
    ]),
    (root) => {
      root.querySelector('#go').onclick = () => runMinigame(game.id);
    },
  );
}

function runMinigame(id) {
  if (id === 'baskin') baskin();
  else if (id === 'nunchi') nunchi();
  else if (id === 'updown') updown();
  else if (id === 'bomb') bomb();
  else if (id === 'chosung') chosung();
  else death();
}

function baskin() {
  let n = 0;
  let turn = state.current;
  const paint = () => {
    openOverlay(
      `
        <div class="handle"></div>
        <h2 class="event-title">베스킨 31</h2>
        <div class="mini-stage">
          <div class="mini-help">${playerName(turn)} 차례</div>
          <div class="big-num">${n}</div>
          <p class="mini-help">31을 말하는 사람이 마십니다</p>
          <div class="btn-row">
            ${[1, 2, 3]
              .map(
                (k) =>
                  `<button class="btn btn-gold" data-k="${k}" ${n + k > 31 ? 'disabled' : ''}>+${k}</button>`,
              )
              .join('')}
          </div>
        </div>
      `,
      (root) => {
        root.querySelectorAll('[data-k]').forEach((btn) => {
          btn.onclick = () => {
            n += Number(btn.dataset.k);
            if (n >= 31) {
              addDrinks(turn, 1);
              finishTurn(`${playerName(turn)} 31! 1잔`);
              return;
            }
            turn = (turn + 1) % state.players.length;
            paint();
          };
        });
      },
    );
  };
  paint();
}

function nunchi() {
  const last = 7 + state.players.length;
  let n = 0;
  const paint = () => {
    openOverlay(
      `
        <div class="handle"></div>
        <h2 class="event-title">눈치게임</h2>
        <div class="mini-stage">
          <div class="big-num">${n}</div>
          <p class="mini-help">다음 숫자는 ${n + 1} · 마지막 ${last}을 말한 사람이 마십니다</p>
          <div class="pick-grid">
            ${state.players
              .map(
                (p, i) =>
                  `<button class="pick" data-pick="${i}" style="background:${p.color}">${esc(p.name)}</button>`,
              )
              .join('')}
          </div>
        </div>
      `,
      (root) => {
        root.querySelectorAll('[data-pick]').forEach((btn) => {
          btn.onclick = () => {
            n += 1;
            const i = Number(btn.dataset.pick);
            buzz(10);
            if (n >= last) {
              addDrinks(i, 1);
              finishTurn(`${playerName(i)}가 ${last}! 눈치 실패 1잔`);
              return;
            }
            paint();
          };
        });
      },
    );
  };
  paint();
}

function updown() {
  const secret = 1 + rand(30);
  let turn = state.current;
  let low = 1;
  let high = 30;
  const paint = (msg = `1~30 숫자를 맞히세요`) => {
    openOverlay(
      `
        <div class="handle"></div>
        <h2 class="event-title">업다운</h2>
        <div class="mini-stage">
          <p class="mini-help">${playerName(turn)} 차례 · ${msg}</p>
          <div class="big-num" style="font-size:40px">${low} ~ ${high}</div>
          <input id="guess" type="number" min="1" max="30" inputmode="numeric" placeholder="숫자"
            style="width:100%;margin:8px 0 12px;padding:14px;border-radius:12px;border:0;font-size:18px;text-align:center" />
          <button class="btn btn-gold" id="go">맞춰보기</button>
        </div>
      `,
      (root) => {
        const input = root.querySelector('#guess');
        input.focus();
        root.querySelector('#go').onclick = () => {
          const g = Number(input.value);
          if (!g || g < 1 || g > 30) return;
          if (g === secret) {
            playerPicker('정답! 지목 1잔', `${playerName(turn)} 맞혔습니다`, others(turn), (i) => {
              addDrinks(i, 1);
              finishTurn(`${playerName(turn)} 정답. ${playerName(i)} 1잔`);
            });
            return;
          }
          addDrinks(turn, 1);
          if (g < secret) low = Math.max(low, g + 1);
          else high = Math.min(high, g - 1);
          turn = (turn + 1) % state.players.length;
          paint(g < secret ? `${g}은 업! 틀린 사람 1잔` : `${g}은 다운! 틀린 사람 1잔`);
        };
      },
    );
  };
  paint();
}

function bomb() {
  let holder = state.current;
  const fuse = 3500 + rand(7000);
  let exploded = false;
  let timer;
  const explode = () => {
    if (exploded) return;
    exploded = true;
    clearTimeout(timer);
    buzz([80, 40, 120]);
    addDrinks(holder, 2);
    finishTurn(`펑! ${playerName(holder)} 폭탄 2잔`);
  };
  const paint = () => {
    openOverlay(
      `
        <div class="handle"></div>
        <h2 class="event-title">폭탄 돌리기</h2>
        <div class="mini-stage">
          <div class="bomb-pulse">💣</div>
          <p class="mini-help">지금 폭탄: <b style="color:${state.players[holder].color}">${playerName(holder)}</b></p>
          <button class="btn btn-primary" id="pass">다음 사람한테 넘기기</button>
        </div>
      `,
      (root) => {
        root.querySelector('#pass').onclick = () => {
          if (exploded) return;
          holder = (holder + 1) % state.players.length;
          buzz(8);
          paint();
        };
      },
    );
  };
  paint();
  timer = setTimeout(explode, fuse);
}

function chosung() {
  const round = CHOSUNG_ROUNDS[rand(CHOSUNG_ROUNDS.length)];
  let left = 8;
  let timer;
  openOverlay(
    `
      <div class="handle"></div>
      <h2 class="event-title">초성 게임</h2>
      <div class="mini-stage">
        <p class="mini-help">카테고리: ${round.hint} · <span id="cd">${left}</span>초</p>
        <div class="big-num">${round.text}</div>
        <p class="mini-help">${playerName(state.current)}가 단어를 말하세요</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-soju" id="ok">성공</button>
        <button class="btn btn-primary" id="fail">실패</button>
      </div>
    `,
    (root) => {
      const done = (ok) => {
        clearInterval(timer);
        if (ok) finishTurn('초성 성공. 넘어갑니다');
        else {
          addDrinks(state.current, 1);
          finishTurn(`${playerName(state.current)} 초성 실패 1잔`);
        }
      };
      root.querySelector('#ok').onclick = () => done(true);
      root.querySelector('#fail').onclick = () => done(false);
      timer = setInterval(() => {
        left -= 1;
        const cd = document.querySelector('#cd');
        if (cd) cd.textContent = String(left);
        if (left <= 0) {
          clearInterval(timer);
          addDrinks(state.current, 1);
          finishTurn(`시간 초과! ${playerName(state.current)} 1잔`);
        }
      }, 1000);
    },
  );
}

function death() {
  playerPicker(
    '더 게임 오브 데스',
    '눈을 마주치지 말고 한 명을 지목하세요. 2잔',
    others(),
    (i) => {
      addDrinks(i, 2);
      finishTurn(`${playerName(i)} 지목당함. 2잔`);
    },
  );
}

function playRps(a, b) {
  const picks = { [a]: null, [b]: null };
  const ask = (who) => {
    openOverlay(
      `
        <div class="handle"></div>
        <h2 class="event-title" style="font-size:26px">${playerName(who)}만 보세요</h2>
        <p class="event-desc">가위바위보</p>
        <div class="rps-row">
          <button class="rps-btn" data-v="0">✌️</button>
          <button class="rps-btn" data-v="1">✊</button>
          <button class="rps-btn" data-v="2">🖐️</button>
        </div>
      `,
      (root) => {
        root.querySelectorAll('[data-v]').forEach((btn) => {
          btn.onclick = () => {
            picks[who] = Number(btn.dataset.v);
            if (picks[a] == null) ask(a);
            else if (picks[b] == null) ask(b);
            else {
              const names = ['가위', '바위', '보'];
              if (picks[a] === picks[b]) {
                openOverlay(
                  eventCard('😅', '무승부', `${names[picks[a]]} vs ${names[picks[b]]}`, [
                    { id: 'again', label: '다시', className: 'btn-gold' },
                  ]),
                  (root2) => {
                    root2.querySelector('#again').onclick = () => playRps(a, b);
                  },
                );
                return;
              }
              const aWin = (picks[a] - picks[b] + 3) % 3 === 1;
              const loser = aWin ? b : a;
              addDrinks(loser, 1);
              finishTurn(
                `${playerName(a)} ${names[picks[a]]} vs ${playerName(b)} ${names[picks[b]]} · ${playerName(loser)} 1잔`,
              );
            }
          };
        });
      },
    );
  };
  ask(a);
}

render();
