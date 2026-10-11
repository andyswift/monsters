# Stranger Monsters

A modern recreation of the 1983 BBC Micro game *Monsters* (itself a *Space Panic* clone), re-themed around the Upside Down.

Dig holes in the floors, trap the Demodogs in them, then whack them through to the level below. Beat the air timer and clear every level.

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Move, climb ladders |
| Space / Z / X | Dig a hole ahead, or whack a trapped monster |
| Enter | Start / restart |
| M / P | Mute / pause |

A monster you whack falls through to the next floor and dies, crushing anything it lands on. Don't stand under it.

## Develop

```
npm install
npm run dev     # play at the printed localhost URL
npm test        # game logic tests
npm run build   # typecheck + production build
```

Game logic (`src/game/`) has no DOM dependencies and is unit tested. Rendering is a 320x256 canvas scaled with nearest-neighbour, with CSS scanlines.
