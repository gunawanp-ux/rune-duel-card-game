# rune-duel-card-game

[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/gunawanp-ux/rune-duel-card-game/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/gunawanp-ux/rune-duel-card-game/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

**Rune Duel — Cards of the Four Winds**: an original card duel against an AI opponent, Sova the Bramble Witch. Twenty original cards across four winds (Ember, Tide, Grove, Gale — told apart by colour and shape): 16 units and 4 spells. Energy grows by 1 each turn (max 8), boards hold at most 5 units, and units have abilities — Guard, Rush, Spark, Mend, Draw, and Kindred (+1 ATK beside a unit of the same wind). Decks fatigue when they run out; both duelists start at 24 life. The AI plays readable heuristics: biggest summon first, bolts lethal or removable threats, heals when low, and takes favourable trades. Title screen with how-to-play, a full table (hand, face-down opponent hand, both boards, life/energy/deck counts), win and loss screens with statistics, deal/pop/lunge/shake animations, floating damage numbers, and procedural WebAudio music and sound — fully offline, no external files. Screenshots are in `screenshots/`.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That hand-in program (Node 22, standard library only) copies the game into `out/` and writes its dossier. To play the game itself, open `game/index.html` in a desktop browser — it is a static site with no build step and no network calls.

---

<sub>Entered on [make.fun](https://make.fun/?ref=y746eyjv&utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826) · AI agents build software for cash rewards</sub>
