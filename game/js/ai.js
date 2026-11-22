// ai.js — Sova, the Bramble Witch: a readable, counterable opponent.
// She plays her biggest affordable cards first, saves her burn for real
// threats, trades her creatures when the trade is good, and goes for the
// throat when she smells lethal. No hidden information is used: she reads
// the same board the player sees.

import { effAtk } from './render.js';

// Pick the next card Sova wants to play from her hand, or null to stop.
export function choosePlay(state) {
  const me = state.enemy;
  const playable = me.hand.filter((c) => c.cost <= me.energy);
  if (playable.length === 0) return null;

  // Heal when hurt — a witch who ignores her own wounds dies early.
  const rain = playable.find((c) => c.spell === 'rain');
  if (rain && me.life <= 11) return rain;

  // Burn a dangerous creature the moment it can be killed outright.
  const bolt = playable.find((c) => c.spell === 'bolt');
  if (bolt) {
    const threat = state.player.board.find(
      (u) => u.curHp <= bolt.amount && effAtk(u, state.player.board, state.player.rally) >= 3,
    );
    if (threat) return bolt;
    if (state.player.life <= bolt.amount) return bolt; // lethal burn
  }

  // Card draw is almost always right.
  const gust = playable.find((c) => c.spell === 'gust');
  if (gust) return gust;

  // Rally when at least two creatures stand ready to swing.
  const rally = playable.find((c) => c.spell === 'rally');
  const ready = me.board.filter((u) => !u.exhausted && effAtk(u, me.board, 0) > 0);
  if (rally && ready.length >= 2) return rally;

  // Otherwise summon the most expensive creature she can afford.
  const units = playable
    .filter((c) => c.kind === 'unit' && me.board.length < 5)
    .sort((a, b) => b.cost - a.cost);
  if (units.length > 0) return units[0];

  // Bolt face as a last resort when her hand is otherwise dead.
  if (bolt && me.hand.length <= 2) return bolt;
  return null;
}

// Where should this attacker strike? Returns { type: 'unit', uid } or
// { type: 'hero' } or null when holding back is clearly better.
export function chooseAttack(state, attacker) {
  const me = state.enemy;
  const foe = state.player;
  const myAtk = effAtk(attacker, me.board, me.rally);
  if (myAtk <= 0) return null;

  const guards = foe.board.filter((u) => u.ability === 'guard');
  const targets = guards.length > 0 ? guards : foe.board;

  // Guards must be answered: kill the one she can, else chip the weakest.
  if (guards.length > 0) {
    const killable = targets.filter((u) => u.curHp <= myAtk).sort((a, b) => b.atk - a.atk);
    if (killable.length > 0) return { type: 'unit', uid: killable[0].uid };
    return { type: 'unit', uid: targets.sort((a, b) => a.curHp - b.curHp)[0].uid };
  }

  // Lethal first — always.
  if (myAtk >= foe.life) return { type: 'hero' };

  // A free or favourable kill: removes a real threat and lives (or trades up).
  const goodTrade = targets
    .filter((u) => u.curHp <= myAtk && effAtk(u, foe.board, foe.rally) >= 3)
    .sort((a, b) => effAtk(b, foe.board, foe.rally) - effAtk(a, foe.board, foe.rally));
  if (goodTrade.length > 0) return { type: 'unit', uid: goodTrade[0].uid };

  if (foe.board.length === 0) return { type: 'hero' };

  // Do not throw a creature away: if every target kills it back without
  // dying, and it is small, it waits for a better moment behind her board.
  const suicide = targets.every(
    (u) => u.curHp > myAtk && effAtk(u, foe.board, foe.rally) >= attacker.curHp,
  );
  if (suicide && myAtk < 3 && me.board.length >= 2) return null;

  // Otherwise press the hero — pressure is how she wins.
  return { type: 'hero' };
}

// For a targeted spell or Spark, who suffers? Same instincts as attacking.
// Targets are always on the player's side, so owner is named explicitly.
export function chooseBurnTarget(state, amount) {
  const foe = state.player;
  const killable = foe.board
    .filter((u) => u.curHp <= amount)
    .sort((a, b) => effAtk(b, foe.board, foe.rally) - effAtk(a, foe.board, foe.rally));
  if (killable.length > 0) return { type: 'unit', owner: 'player', uid: killable[0].uid };
  const threat = foe.board
    .filter((u) => effAtk(u, foe.board, foe.rally) >= 4)
    .sort((a, b) => a.curHp - b.curHp);
  if (threat.length > 0) return { type: 'unit', owner: 'player', uid: threat[0].uid };
  return { type: 'hero', owner: 'player' };
}
