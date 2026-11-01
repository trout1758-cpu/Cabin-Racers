# Cabin Racers

Up-to-4-player split-screen cartoon racing with Hot Wheels–sized cars on orange toy tracks: through a cozy log cabin, round the backyard and out over the lake.
The game runs on the computer (TV); each player uses an Android phone running **Racer Pad** as a tilt-steering Bluetooth controller.

> **Early build.** Pure racing for now: no power-ups or boosts yet.

## Worlds and tracks

| World | Track | Length | What's on it |
| --- | --- | --- | --- |
| Cozy Cabin | Rug Rally | short | Quick loop round the rug, ramp jump in front of the sofa |
| Cozy Cabin | Table Top Run | short | Up onto the coffee table and off the far edge |
| Cozy Cabin | Kitchen Loop | medium | Loop-the-loop by the counter, jump past the fridge, under the dining table |
| Cozy Cabin | **Grand Cabin Tour** | long | The whole cabin: under both tables, a spiral up to the kitchen counter, a leap off the end, a long run downhill |
| Backyard | Garden Grand Prix | long | Loop-the-loop, a jump over the puddle, under the picnic table |
| Backyard | **Backyard Adventure** | long | Along the porch and off the end, up round the oak and over your own track, the puddle, across the sandbox |
| Lakeside | Dock Dash | medium | Along the dock, a leap over open water, a loop above the lake |
| Lakeside | **Island Hop** | long | Over a bridge and round the lighthouse island, up over your own track into a loop, a water jump back |

Pick **Chill**, **Normal** or **Zoom** speed in the lobby.
Loops need speed: too slow and you drop off. Land in water and it's a splash.
If you fall off just before a jump or a loop, you're put back on the far side of it, so you never get stuck retrying it.

## Play

1. **Computer:** double-click `start-game.bat` (Windows) or run `sh start-game.sh` (macOS/Linux).
   It opens **http://localhost:8080** in Chrome or Edge, which have the Bluetooth support the game needs.
2. **Phones:** install Racer Pad (see below) and open it. It shows **WAITING FOR GAME**.
3. In the game, click **Play**, then **Phone (Bluetooth)** on a player slot and pick the phone.
   Up to four players; keyboards and gamepads work too.
4. Everyone presses **gas** to ready up, or click **Start race**.

### Racer Pad (Android)

- Each push to `main` builds `RacerPad.apk` and publishes it on the **controller-latest** release:
  `https://github.com/trout1758-cpu/Cabin-Racers/releases/download/controller-latest/RacerPad.apk`.
  Every build is signed with the same development key, so new versions install over old ones.
- **Default controls:** hold the phone sideways like a steering wheel and **tilt to steer**.
  Hold the **left half** for gas.
  Bottom-right is **brake / drift**: drift while on the gas, brake or reverse otherwise.
  Top-right is **boost**, for later.
- **Settings** (top-right button) let each player:
  - choose a different screen layout: mirrored, joystick, ◀ ▶ buttons, four corners or three columns;
  - change what every zone does;
  - turn tilt off and steer with a stick or buttons instead;
  - set the tilt range, invert or calibrate the tilt;
  - auto-accelerate;
  - turn vibration on or off.

### Keyboard / gamepad

| | Gas | Brake / drift | Steer |
| --- | --- | --- | --- |
| Keys: WASD | W | S | A / D |
| Keys: arrows | ↑ | ↓ | ← / → |
| Gamepad | RT or A | LT or B | left stick |

`Esc` pauses.

## Project layout

```
game/                    The racing game (plain JS modules + three.js, no build step)
  js/config.js           Tuning (units: cm and seconds; a car is 7.5 cm long)
  js/track.js            Track model: smooth closed curve, width, banking, rails, jumps, loops
  js/trackKit.js         Helpers for writing tracks: loop(), jump(), headings
  js/world.js            A world's solid scenery (boxes, cylinders), water and edges
  js/worlds/             The worlds, each with its scenery, props and tracks
  js/car.js              Arcade car physics (grip, drift, ramps, jumps, loops, rails, respawn)
  js/race.js             Grid, countdown, laps, positions, finishing
  js/render/             Cartoon 3D: cel shading + ink outlines (toon.js), scenery (worldMesh.js,
                         props.js), toy-track mesh, cars, particles, split-screen cameras
  js/controllers.js      Racer Pad phones over Web Bluetooth, keyboards, gamepads
  js/vendor/             three.js r170 (MIT)
  fonts/                 Lilita One (SIL Open Font License)
  tests/run.js           Headless tests: `node game/tests/run.js`
controller-android/      Racer Pad (Kotlin)
docs/PROTOCOL.md         Bluetooth protocol
```

Add `?debug` to the game URL for an FPS counter, `?track=backyard/0` to pick a track, or `?autotest=4` to jump straight into a 4-player keyboard race.

## Making tracks

Tracks live in their world's file in `game/js/worlds/`. A track is a list of control points, in centimetres: `x` runs east, `z` runs south, and `y` is the height of the track surface.
Optional per point:
- `w` sets the width.
- `bank` tilts the track, in degrees. Positive raises the left edge, for right-hand turns.
- `gap: true` means the next segment is a jump.
- `rails: false` removes the side rails.
- `sharp: true` makes a crisp ramp lip.

`trackKit.js` has helpers you can spread into the list:
- `...loop(x, y, z, heading)` adds a loop-the-loop.
- `...jump(x, y, z, heading, { rise, gap })` adds a ramp jump.
- `...arc(cx, cz, radius, fromAngle, toAngle, { y0, y1 })` adds a curve. It becomes a spiral if it turns more than 360° while climbing.

Headings are in degrees: 0 is east and 90 is south.

A world lists its solid scenery with `box(...)` and `cyl(...)`; the cars collide with these and can drive on top of them.
It lists `water` areas, and `props` that are only for looks.

The tests drive every track with a track-following autopilot, at all three speeds, to check that it can be completed and every jump cleared.
They also check that no track runs through scenery, dips into the ground or crosses itself.
