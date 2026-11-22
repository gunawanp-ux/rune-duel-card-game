// cards.js — the Rune Duel card catalogue.
// Every card is original to this game: four winds (suits), each told apart by
// colour AND shape, creatures with keyword abilities, and a handful of spells.

export const WINDS = {
  ember: { name: 'Ember', symbol: '\u25B2', color: '#e2483d' },
  tide:  { name: 'Tide',  symbol: '\u25CF', color: '#2f7fd0' },
  grove: { name: 'Grove', symbol: '\u25C6', color: '#3da34d' },
  gale:  { name: 'Gale',  symbol: '\u2605', color: '#8b4fc0' },
};

// kind: 'unit' | 'spell'
// ability: guard | rush | spark (amount) | mend (amount) | draw (amount) | kindred
export const CATALOGUE = [
  // ---- Ember (red triangles): aggressive, burns on arrival ----
  { id: 'cinder-pup',   name: 'Cinder Pup',   wind: 'ember', kind: 'unit', cost: 1, atk: 2, hp: 1, ability: 'rush',  text: 'Rush' },
  { id: 'ash-archer',   name: 'Ash Archer',   wind: 'ember', kind: 'unit', cost: 2, atk: 2, hp: 2, ability: 'spark', amount: 1, text: 'Spark 1' },
  { id: 'forge-knight', name: 'Forge Knight', wind: 'ember', kind: 'unit', cost: 3, atk: 3, hp: 4, ability: null, text: '' },
  { id: 'pyre-dragon',  name: 'Pyre Dragon',  wind: 'ember', kind: 'unit', cost: 6, atk: 6, hp: 5, ability: 'spark', amount: 2, text: 'Spark 2' },

  // ---- Tide (blue circles): sturdy walls and sudden strikers ----
  { id: 'puddle-sprite', name: 'Puddle Sprite', wind: 'tide', kind: 'unit', cost: 1, atk: 1, hp: 3, ability: 'mend', amount: 2, text: 'Mend 2' },
  { id: 'reef-guard',    name: 'Reef Guard',    wind: 'tide', kind: 'unit', cost: 2, atk: 1, hp: 5, ability: 'guard', text: 'Guard' },
  { id: 'storm-eel',     name: 'Storm Eel',     wind: 'tide', kind: 'unit', cost: 3, atk: 4, hp: 2, ability: 'rush', text: 'Rush' },
  { id: 'abyss-leviathan', name: 'Abyss Leviathan', wind: 'tide', kind: 'unit', cost: 7, atk: 7, hp: 7, ability: null, text: '' },

  // ---- Grove (green diamonds): healing and thick roots ----
  { id: 'sprout-cub',   name: 'Sprout Cub',   wind: 'grove', kind: 'unit', cost: 1, atk: 2, hp: 2, ability: null, text: '' },
  { id: 'thorn-wall',   name: 'Thorn Wall',   wind: 'grove', kind: 'unit', cost: 2, atk: 0, hp: 6, ability: 'guard', text: 'Guard, Kindred' },
  { id: 'elder-treant', name: 'Elder Treant', wind: 'grove', kind: 'unit', cost: 4, atk: 3, hp: 6, ability: 'mend', amount: 3, text: 'Mend 3' },
  { id: 'moss-giant',   name: 'Moss Giant',   wind: 'grove', kind: 'unit', cost: 5, atk: 5, hp: 6, ability: null, text: '' },

  // ---- Gale (purple stars): fast, tricksy, draws cards ----
  { id: 'zephyr-fox',   name: 'Zephyr Fox',   wind: 'gale', kind: 'unit', cost: 2, atk: 3, hp: 2, ability: 'rush', text: 'Rush' },
  { id: 'cloud-dancer', name: 'Cloud Dancer', wind: 'gale', kind: 'unit', cost: 3, atk: 2, hp: 4, ability: 'draw', amount: 1, text: 'Draw 1' },
  { id: 'sky-serpent',  name: 'Sky Serpent',  wind: 'gale', kind: 'unit', cost: 4, atk: 4, hp: 4, ability: 'kindred', text: 'Kindred' },
  { id: 'tempest-roc',  name: 'Tempest Roc',  wind: 'gale', kind: 'unit', cost: 5, atk: 5, hp: 4, ability: 'spark', amount: 2, text: 'Spark 2' },

  // ---- Spells (cast once, then gone) ----
  { id: 'ember-bolt',   name: 'Ember Bolt',   wind: 'ember', kind: 'spell', cost: 2, spell: 'bolt',  amount: 3, text: 'Deal 3 damage to any target.' },
  { id: 'healing-rain', name: 'Healing Rain', wind: 'tide',  kind: 'spell', cost: 2, spell: 'rain',  amount: 6, text: 'Restore 6 life to your hero.' },
  { id: 'sudden-gust',  name: 'Sudden Gust',  wind: 'gale',  kind: 'spell', cost: 1, spell: 'gust',  amount: 2, text: 'Draw 2 cards.' },
  { id: 'rally-winds',  name: 'Rally the Winds', wind: 'grove', kind: 'spell', cost: 2, spell: 'rally', amount: 1, text: 'Your creatures get +1 attack this turn.' },
];

// Deck recipe: [card id, copies]. 30 cards — cheap cards doubled, giants single.
const RECIPE = [
  ['cinder-pup', 2], ['ash-archer', 2], ['forge-knight', 2], ['pyre-dragon', 1],
  ['puddle-sprite', 2], ['reef-guard', 2], ['storm-eel', 1], ['abyss-leviathan', 1],
  ['sprout-cub', 2], ['thorn-wall', 1], ['elder-treant', 1], ['moss-giant', 1],
  ['zephyr-fox', 2], ['cloud-dancer', 2], ['sky-serpent', 1], ['tempest-roc', 1],
  ['ember-bolt', 2], ['healing-rain', 1], ['sudden-gust', 1], ['rally-winds', 1],
];

let uidCounter = 0;

export function makeCard(id) {
  const base = CATALOGUE.find((c) => c.id === id);
  if (!base) throw new Error('unknown card ' + id);
  uidCounter += 1;
  return { ...base, uid: 'u' + uidCounter, curHp: base.hp ?? 0, summonedTurn: -1, exhausted: false };
}

export function buildDeck(rng) {
  const deck = [];
  for (const [id, copies] of RECIPE) {
    for (let i = 0; i < copies; i++) deck.push(makeCard(id));
  }
  // Fisher-Yates with the seeded rng so screenshot staging is reproducible.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// A tiny deterministic rng (mulberry32) — same seed, same shuffle, every time.
export function seededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
