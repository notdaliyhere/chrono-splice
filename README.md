# Chrono Splice

A time-loop puzzle platformer. Run through a level, then loop — your run is saved as a ghostly **Echo** that replays itself from the very start. Use your echoes (and your live self) together to hold down pressure plates and open the doors blocking your path.

**Play: https://notdaliyhere.github.io/chrono-splice/**

## How to play

- Walk and jump through each level toward the glowing goal.
- Step on a pressure plate, then press **L** to "loop": your run so far is banked as an Echo that will replay automatically on your next (and all future) attempts, and you restart from the beginning.
- Press **E** while standing on a plate to "splice" — bank an echo right there without resetting your live position, letting you keep pushing forward in the same attempt.
- Every plate a level needs must be held down **at the same time** by some combination of echoes and your live character for its door to open.
- Fall into a pit and you'll respawn at the start of the attempt (your banked echoes are kept).
- Press **R** at any time to scrap your echoes and start the level fresh.
- Progress is saved automatically (localStorage) so you can continue from your furthest level.

## Controls

| Action | Key | Touch |
|---|---|---|
| Move | Arrow keys / A, D | Left / Right buttons |
| Jump | Arrow Up / W / Space | Jump button |
| Loop (bank echo & restart) | L | Loop button |
| Splice (bank echo in place) | E | Splice button |
| Restart attempt | R | R button |

4 hand-built levels, each adding another plate and another echo to juggle, culminating in a 3-echo finale.

Built with plain HTML5 canvas and vanilla JavaScript — no frameworks, no build step, no external assets.
