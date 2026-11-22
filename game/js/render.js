// render.js — everything that turns game state into DOM: cards, boards,
// hero bars, floating damage numbers and the message log line.

import { WINDS } from './cards.js';

const $ = (id) => document.getElementById(id);

// Kindred rule: a creature strikes harder while another creature of the
// same wind stands on its board — +1 attack.
export function kindredActive(unit, board) {
  return board.some((u) => u !== unit && u.wind === unit.wind);
}

export function effAtk(unit, board, rallyBonus) {
  return unit.atk + (rallyBonus || 0) + (kindredActive(unit, board) ? 1 : 0);
}

function windBadge(card) {
  const w = WINDS[card.wind];
  return `<span class="wind-badge" style="--wind:${w.color}">${w.symbol}</span>`;
}

export function cardEl(card, opts = {}) {
  const el = document.createElement('div');
  const w = WINDS[card.wind];
  el.className = 'card ' + card.wind + (opts.mini ? ' mini' : '') + (opts.extraClass || '');
  el.dataset.uid = card.uid;
  el.style.setProperty('--wind', w.color);
  const abilityLine = card.kind === 'spell'
    ? `<div class="card-text">${card.text}</div>`
    : (card.text ? `<div class="card-text">${card.text}</div>` : '<div class="card-text"></div>');
  el.innerHTML = `
    <div class="card-cost">${card.cost}</div>
    ${windBadge(card)}
    <div class="card-art">${w.symbol}</div>
    <div class="card-name">${card.name}</div>
    ${abilityLine}
    ${card.kind === 'unit'
      ? `<div class="card-stats"><span class="atk">&#9876; ${opts.atk ?? card.atk}</span><span class="hp">&#9829; ${opts.hp ?? card.curHp}</span></div>`
      : '<div class="card-stats spell-tag">SPELL</div>'}`;
  return el;
}

export function renderHeroes(state) {
  $('enemy-life').textContent = state.enemy.life;
  $('player-life').textContent = state.player.life;
  $('enemy-deck').textContent = state.enemy.deck.length;
  $('player-deck').textContent = state.player.deck.length;
  $('enemy-hand-count').textContent = state.enemy.hand.length;
  $('score-dealt').textContent = state.stats.damageDealt;
  const pips = $('energy-pips');
  pips.innerHTML = '';
  for (let i = 0; i < state.player.maxEnergy; i++) {
    const pip = document.createElement('span');
    pip.className = 'pip' + (i < state.player.energy ? ' full' : '');
    pips.appendChild(pip);
  }
}

export function renderHands(state, handlers) {
  const eHand = $('enemy-hand');
  eHand.innerHTML = '';
  for (const _ of state.enemy.hand) {
    const back = document.createElement('div');
    back.className = 'card back mini';
    back.innerHTML = '<div class="back-rune">&#10047;</div>';
    eHand.appendChild(back);
  }
  const pHand = $('player-hand');
  pHand.innerHTML = '';
  for (const card of state.player.hand) {
    const el = cardEl(card);
    if (card.cost > state.player.energy || state.locked) el.classList.add('unaffordable');
    if (state.selectedHandUid === card.uid) el.classList.add('selected');
    el.addEventListener('click', () => handlers.onHandCard(card.uid));
    pHand.appendChild(el);
  }
}

export function renderBoards(state, handlers) {
  const draw = (containerId, board, owner) => {
    const box = $(containerId);
    box.innerHTML = '';
    if (board.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'board-empty';
      empty.textContent = owner === 'enemy' ? 'Sova has no creatures' : 'Your board is empty — summon a creature';
      box.appendChild(empty);
      return;
    }
    for (const unit of board) {
      const el = cardEl(unit, {
        atk: effAtk(unit, board, owner === 'player' ? state.player.rally : 0),
        hp: unit.curHp,
      });
      if (unit.exhausted) el.classList.add('exhausted');
      if (state.selectedAttackerUid === unit.uid) el.classList.add('selected');
      if (state.pendingTarget && owner === 'enemy') el.classList.add('targetable');
      el.addEventListener('click', () => handlers.onBoardCard(owner, unit.uid));
      box.appendChild(el);
    }
  };
  draw('enemy-board', state.enemy.board, 'enemy');
  draw('player-board', state.player.board, 'player');
}

export function renderAll(state, handlers) {
  renderHeroes(state);
  renderHands(state, handlers);
  renderBoards(state, handlers);
  $('turn-banner').textContent = state.locked
    ? (state.over ? 'Duel over' : 'Sova is thinking…')
    : 'Your turn — turn ' + state.turn;
  $('end-turn-btn').disabled = state.locked || state.over;
}

export function log(state, message) {
  state.log = message;
  $('log-line').textContent = message;
}

// Floating combat text over a card or hero: "-3", "+6", "GUARD!"…
export function floatText(anchorEl, text, cls = 'dmg') {
  if (!anchorEl) return;
  const floater = document.createElement('div');
  floater.className = 'floater ' + cls;
  floater.textContent = text;
  const rect = anchorEl.getBoundingClientRect();
  floater.style.left = rect.left + rect.width / 2 - 20 + 'px';
  floater.style.top = rect.top - 6 + 'px';
  document.body.appendChild(floater);
  setTimeout(() => floater.remove(), 1100);
}

export function cardElByUid(uid) {
  return document.querySelector(`.card[data-uid="${uid}"]`);
}

export function heroEl(owner) {
  return document.querySelector(owner === 'enemy' ? '.enemy-hero' : '.player-hero');
}
