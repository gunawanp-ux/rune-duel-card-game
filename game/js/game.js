// game.js — Rune Duel's rules and turn flow. Owns the state, resolves
// combat, runs Sova's turn, and wires the screens together.

import { buildDeck, seededRng, makeCard } from './cards.js';
import { renderAll, renderBoards, renderHeroes, log, floatText, cardElByUid, heroEl, effAtk } from './render.js';
import { sfx, startMusic, stopMusic } from './audio.js';
import * as ai from './ai.js';

const $ = (id) => document.getElementById(id);
const START_LIFE = 24;
const MAX_BOARD = 5;
const MAX_ENERGY = 8;

export const state = {
  turn: 1,
  over: false,
  locked: true,
  player: null,
  enemy: null,
  selectedAttackerUid: null,
  selectedHandUid: null,
  pendingTarget: false,
  pendingAction: null, // { kind: 'attack' } | { kind: 'burn', card, owner, after }
  stats: { damageDealt: 0, cardsPlayed: 0 },
  log: '',
};

function freshSide(deck) {
  return {
    life: START_LIFE, deck, hand: [], board: [],
    energy: 0, maxEnergy: 0, rally: 0, fatigue: 0,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- setup

export function startGame(seed) {
  const rng = seededRng(seed ?? ((Math.random() * 1e9) | 0));
  state.player = freshSide(buildDeck(rng));
  state.enemy = freshSide(buildDeck(rng));
  state.turn = 1;
  state.over = false;
  state.locked = false;
  state.stats = { damageDealt: 0, cardsPlayed: 0 };
  clearSelection();
  for (let i = 0; i < 4; i++) { drawCard(state.player); drawCard(state.enemy); }
  beginPlayerTurn(true);
  log(state, 'The duel begins. Summon a creature, then strike!');
  showScreen('table-screen');
  renderAll(state, handlers);
}

function drawCard(side) {
  if (side.deck.length === 0) {
    side.fatigue += 1;
    side.life -= side.fatigue;
    log(state, `The empty deck bites for ${side.fatigue}!`);
    return null;
  }
  const card = side.deck.pop();
  side.hand.push(card);
  return card;
}

// ---------------------------------------------------------------- turns

function beginPlayerTurn(first = false) {
  state.player.maxEnergy = Math.min(state.turn, MAX_ENERGY);
  state.player.energy = state.player.maxEnergy;
  state.player.rally = 0;
  for (const u of state.player.board) { u.exhausted = false; u.ready = true; }
  if (!first) { drawCard(state.player); sfx.turn(); }
  state.locked = false;
  renderAll(state, handlers);
}

async function endPlayerTurn() {
  if (state.locked || state.over) return;
  clearSelection();
  state.player.rally = 0;
  state.locked = true;
  renderAll(state, handlers);
  await sleep(450);
  await runEnemyTurn();
  if (state.over) return;
  state.turn += 1;
  beginPlayerTurn();
  log(state, `Turn ${state.turn}. Your move.`);
  renderAll(state, handlers);
}

async function runEnemyTurn() {
  const foe = state.enemy;
  foe.maxEnergy = Math.min(state.turn, MAX_ENERGY);
  foe.energy = foe.maxEnergy;
  foe.rally = 0;
  for (const u of foe.board) { u.exhausted = false; u.ready = true; }
  drawCard(foe);
  renderAll(state, handlers);
  await sleep(500);

  // Play cards one at a time so the player can follow her plan.
  for (let guard = 0; guard < 12; guard++) {
    const card = ai.choosePlay(state);
    if (!card) break;
    await playCard('enemy', card, true);
    if (state.over) return;
    await sleep(420);
  }

  // Then attack with every ready creature.
  for (const unit of [...foe.board]) {
    if (state.over) return;
    if (unit.exhausted || !unit.ready || effAtk(unit, foe.board, foe.rally) <= 0) continue;
    const target = ai.chooseAttack(state, unit);
    if (!target) continue;
    await resolveAttack('enemy', unit, target);
    await sleep(420);
  }
  foe.rally = 0;
}

// ---------------------------------------------------------------- playing cards

const handlers = {
  onHandCard(uid) {
    if (state.locked || state.over) return;
    const card = state.player.hand.find((c) => c.uid === uid);
    if (!card) return;
    if (state.pendingAction) { cancelPending(); return; }
    playCard('player', card, false);
  },
  onBoardCard(owner, uid) {
    if (state.over) return;
    if (state.pendingAction) { onTargetChosen({ type: 'unit', owner, uid }); return; }
    if (state.locked) return;
    if (owner === 'player') selectAttacker(uid);
  },
};

function selectAttacker(uid) {
  const unit = state.player.board.find((u) => u.uid === uid);
  if (!unit) return;
  if (state.selectedAttackerUid === uid) { clearSelection(); renderAll(state, handlers); return; }
  if (unit.exhausted || !unit.ready) { log(state, `${unit.name} cannot strike yet.`); return; }
  if (effAtk(unit, state.player.board, state.player.rally) <= 0) { log(state, `${unit.name} has no attack.`); return; }
  state.selectedAttackerUid = uid;
  state.pendingTarget = true;
  state.pendingAction = { kind: 'attack', attackerUid: uid };
  log(state, `${unit.name} is ready — choose a target.`);
  renderAll(state, handlers);
}

function clearSelection() {
  state.selectedAttackerUid = null;
  state.selectedHandUid = null;
  state.pendingTarget = false;
  state.pendingAction = null;
}

function cancelPending() {
  clearSelection();
  log(state, 'Targeting cancelled.');
  renderAll(state, handlers);
}

async function playCard(owner, card, byAi) {
  const side = owner === 'player' ? state.player : state.enemy;
  const foeSide = owner === 'player' ? state.enemy : state.player;
  if (card.cost > side.energy) return false;
  if (card.kind === 'unit' && side.board.length >= MAX_BOARD) {
    if (!byAi) log(state, 'Your board is full (5 creatures).');
    return false;
  }
  side.energy -= card.cost;
  side.hand = side.hand.filter((c) => c.uid !== card.uid);
  if (owner === 'player') state.stats.cardsPlayed += 1;

  if (card.kind === 'spell') {
    sfx.spell();
    log(state, `${owner === 'player' ? 'You cast' : 'Sova casts'} ${card.name}.`);
    renderAll(state, handlers);
    await applySpell(owner, card);
    return true;
  }

  // Summon the creature.
  card.curHp = card.hp;
  card.exhausted = false;
  card.ready = card.ability === 'rush';
  side.board.push(card);
  sfx.play();
  log(state, `${owner === 'player' ? 'You summon' : 'Sova summons'} ${card.name}.`);
  renderAll(state, handlers);
  const el = cardElByUid(card.uid);
  if (el) el.classList.add('just-played');

  if (card.ability === 'mend') {
    side.life = Math.min(START_LIFE + 12, side.life + card.amount);
    sfx.heal();
    floatText(heroEl(owner), '+' + card.amount, 'heal');
    log(state, `${card.name} mends its hero for ${card.amount}.`);
  } else if (card.ability === 'draw') {
    for (let i = 0; i < card.amount; i++) drawCard(side);
    log(state, `${card.name} draws ${card.amount} card${card.amount > 1 ? 's' : ''}.`);
  } else if (card.ability === 'spark') {
    await sleep(300);
    if (byAi) {
      const target = ai.chooseBurnTarget(state, card.amount);
      await applyBurn(owner, card, target);
    } else {
      state.pendingAction = { kind: 'burn', card, owner };
      state.pendingTarget = true;
      state.selectedHandUid = card.uid;
      log(state, `${card.name} sparks — choose any target for ${card.amount} damage.`);
      renderAll(state, handlers);
      return true;
    }
  }
  renderAll(state, handlers);
  checkEnd();
  return true;
}

async function applySpell(owner, card) {
  const side = owner === 'player' ? state.player : state.enemy;
  if (card.spell === 'rain') {
    side.life = Math.min(START_LIFE + 12, side.life + card.amount);
    sfx.heal();
    floatText(heroEl(owner), '+' + card.amount, 'heal');
    log(state, `Healing Rain restores ${card.amount} life.`);
  } else if (card.spell === 'gust') {
    drawCard(side); drawCard(side);
    log(state, `Sudden Gust draws ${card.amount} cards.`);
  } else if (card.spell === 'rally') {
    side.rally += card.amount;
    log(state, `Rally the Winds: +${card.amount} attack this turn.`);
  } else if (card.spell === 'bolt') {
    if (owner === 'enemy') {
      const target = ai.chooseBurnTarget(state, card.amount);
      await applyBurn(owner, card, target);
    } else {
      state.pendingAction = { kind: 'burn', card, owner };
      state.pendingTarget = true;
      state.selectedHandUid = card.uid;
      log(state, 'Ember Bolt — choose any target.');
      renderAll(state, handlers);
      return;
    }
  }
  renderAll(state, handlers);
  checkEnd();
}

// ---------------------------------------------------------------- targeting & combat

function onTargetChosen(target) {
  const pending = state.pendingAction;
  if (!pending) return;
  if (pending.kind === 'attack') {
    if (target.type === 'unit' && target.owner === 'player') {
      log(state, 'Choose an enemy target — or press Esc to cancel.');
      renderAll(state, handlers);
      return;
    }
    const attacker = state.player.board.find((u) => u.uid === pending.attackerUid);
    clearSelection();
    if (!attacker) { renderAll(state, handlers); return; }
    // Guard check: a guarded board may only be attacked through its Guards.
    if (target.type === 'hero') {
      const guards = state.enemy.board.filter((u) => u.ability === 'guard');
      if (guards.length > 0) { log(state, 'A Guard blocks the way to Sova!'); renderAll(state, handlers); return; }
    }
    if (target.type === 'unit') {
      const guards = state.enemy.board.filter((u) => u.ability === 'guard');
      const victim = state.enemy.board.find((u) => u.uid === target.uid);
      if (guards.length > 0 && victim && victim.ability !== 'guard') {
        log(state, 'You must strike the Guard first!');
        renderAll(state, handlers);
        return;
      }
    }
    resolveAttack('player', attacker, target);
  } else if (pending.kind === 'burn') {
    const { card, owner } = pending;
    clearSelection();
    applyBurn(owner, card, target);
  }
}

async function applyBurn(owner, card, target) {
  sfx.attack();
  if (target.type === 'hero') {
    damageHero(target.owner, card.amount, owner);
  } else {
    const board = target.owner === 'player' ? state.player.board : state.enemy.board;
    const unit = board.find((u) => u.uid === target.uid);
    if (unit) damageUnit(target.owner, unit, card.amount);
  }
  renderAll(state, handlers);
  await sleep(300);
  sweepDead();
  renderAll(state, handlers);
  checkEnd();
}

async function resolveAttack(owner, attacker, target) {
  const myBoard = owner === 'player' ? state.player.board : state.enemy.board;
  const foeOwner = owner === 'player' ? 'enemy' : 'player';
  const atk = effAtk(attacker, myBoard, owner === 'player' ? state.player.rally : state.enemy.rally);
  attacker.exhausted = true;
  sfx.attack();
  const el = cardElByUid(attacker.uid);
  if (el) el.classList.add(owner === 'player' ? 'lunging-up' : 'lunging-down');
  log(state, `${attacker.name} strikes for ${atk}!`);
  await sleep(260);

  if (target.type === 'hero') {
    damageHero(foeOwner, atk, owner);
  } else {
    const foeBoard = foeOwner === 'player' ? state.player.board : state.enemy.board;
    const victim = foeBoard.find((u) => u.uid === target.uid);
    if (victim) {
      const back = effAtk(victim, foeBoard, foeOwner === 'player' ? state.player.rally : state.enemy.rally);
      damageUnit(foeOwner, victim, atk);
      if (victim.curHp > 0 || back > 0) damageUnit(owner, attacker, back);
    }
  }
  renderAll(state, handlers);
  await sleep(280);
  sweepDead();
  renderAll(state, handlers);
  checkEnd();
}

function damageUnit(owner, unit, amount) {
  if (amount <= 0) return;
  unit.curHp -= amount;
  sfx.hit();
  const el = cardElByUid(unit.uid);
  if (el) { el.classList.add('hurt'); floatText(el, '-' + amount, 'dmg'); }
}

function damageHero(owner, amount, sourceOwner) {
  const side = owner === 'player' ? state.player : state.enemy;
  side.life -= amount;
  if (sourceOwner === 'player' && owner === 'enemy') state.stats.damageDealt += amount;
  sfx.hit();
  const el = heroEl(owner);
  if (el) { el.classList.add('hurt'); floatText(el, '-' + amount, 'dmg'); }
}

function sweepDead() {
  for (const owner of ['player', 'enemy']) {
    const side = owner === 'player' ? state.player : state.enemy;
    const dead = side.board.filter((u) => u.curHp <= 0);
    for (const u of dead) {
      const el = cardElByUid(u.uid);
      if (el) el.classList.add('dying');
      log(state, `${u.name} falls!`);
      sfx.death();
    }
    side.board = side.board.filter((u) => u.curHp > 0);
  }
}

function checkEnd() {
  if (state.over) return;
  if (state.enemy.life <= 0) endGame(true);
  else if (state.player.life <= 0) endGame(false);
}

function endGame(won) {
  state.over = true;
  state.locked = true;
  stopMusic();
  if (won) sfx.win(); else sfx.lose();
  $('end-title').textContent = won ? 'VICTORY!' : 'DEFEAT';
  $('end-title').className = won ? 'win' : 'loss';
  $('end-text').textContent = won
    ? 'The Bramble Witch scatters to petals and ash. The four winds are yours.'
    : 'Thorns close over the table. Sova keeps her garden — this time.';
  $('end-stats').innerHTML =
    `Turns: <b>${state.turn}</b> &middot; Damage dealt: <b>${state.stats.damageDealt}</b> &middot; Cards played: <b>${state.stats.cardsPlayed}</b>`;
  showScreen('end-screen');
}

// ---------------------------------------------------------------- screens & staging

function showScreen(id) {
  for (const s of ['title-screen', 'table-screen', 'end-screen']) {
    $(s).classList.toggle('hidden', s !== id);
  }
}

// Screenshot staging: ?shot=table|win|loss&seed=N renders a real game state
// so the maker's screenshots are honest renders of the game's own code.
function stageFromQuery() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return false;
  const seed = parseInt(q.get('seed') || '7', 10);
  if (shot === 'win' || shot === 'loss') {
    startGame(seed);
    state.enemy.life = shot === 'win' ? 0 : 24;
    state.player.life = shot === 'win' ? 13 : 0;
    state.stats.damageDealt = shot === 'win' ? 31 : 12;
    state.stats.cardsPlayed = 14;
    state.turn = 8;
    endGame(shot === 'win');
    return true;
  }
  if (shot === 'table') {
    startGame(seed);
    // Stage a living mid-duel table with exact cards, so the render shows
    // both boards, both hands, life totals and a damaged creature.
    const p = state.player, e = state.enemy;
    const place = (side, id, hp) => {
      const c = makeCard(id);
      c.curHp = hp ?? c.hp;
      c.ready = true;
      side.board.push(c);
    };
    place(e, 'reef-guard');
    place(e, 'storm-eel', 1); // battle-worn: 1 of 2 health left
    place(e, 'sprout-cub');
    place(p, 'cinder-pup');
    place(p, 'forge-knight');
    e.life = 18; p.life = 21;
    state.stats.damageDealt = 6;
    state.turn = 3;
    p.maxEnergy = 3; p.energy = 2;
    log(state, 'Your move — your creatures are ready to strike!');
    renderAll(state, handlers);
    return true;
  }
  return false;
}

function init() {
  $('start-btn').addEventListener('click', () => { startMusic(); startGame(); });
  $('howto-btn').addEventListener('click', () => $('howto').classList.toggle('hidden'));
  $('again-btn').addEventListener('click', () => { startMusic(); startGame(); });
  $('end-turn-btn').addEventListener('click', endPlayerTurn);
  document.querySelector('.enemy-hero').addEventListener('click', () => {
    if (state.pendingAction) onTargetChosen({ type: 'hero', owner: 'enemy' });
  });
  document.querySelector('.player-hero').addEventListener('click', () => {
    if (state.pendingAction && state.pendingAction.kind === 'burn') onTargetChosen({ type: 'hero', owner: 'player' });
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && state.pendingAction) cancelPending();
  });
  if (!stageFromQuery()) showScreen('title-screen');
}

init();
