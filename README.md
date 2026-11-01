# Cabin Racers

Up-to-4-player split-screen racing with Hot Wheels–sized cars on toy tracks that run around the house.
The game runs on the computer (TV); each player uses an Android phone running **Racer Pad** as a tilt-steering Bluetooth controller.

> **Early build.** The racing core, split-screen, phone controller and two starter tracks work.
> The house is a hand-built placeholder living room and kitchen; it will be replaced by a model of the real house.
> No power-ups or boosts yet; pure racing.

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
  js/track.js            Track model: smooth closed curve, width, banking, rails, jump gaps
  js/tracks/             Track layouts
  js/house.js            The house's furniture as collision boxes
  js/car.js              Arcade car physics (grip, drift, ramps and jumps, rails, respawn)
  js/race.js             Grid, countdown, laps, positions, finishing
  js/render/             3D: house, toy-track mesh, cars, split-screen cameras
  js/controllers.js      Racer Pad phones over Web Bluetooth, keyboards, gamepads
  js/vendor/             three.js r170 (MIT)
  tests/run.js           Headless tests: `node game/tests/run.js`
controller-android/      Racer Pad (Kotlin)
docs/PROTOCOL.md         Bluetooth protocol
```

Add `?debug` to the game URL for an FPS counter, or `?autotest=4` to jump straight into a 4-player keyboard race.

## Making tracks

A track is a list of control points through the house, in centimetres. `x` runs east, `z` runs south, and `y` is the height of the track surface.
Optional per point:
- `w` sets the width.
- `bank` tilts the track, in degrees.
- `gap: true` means the next segment is a jump.
- `rails: false` removes the side rails.
- `sharp: true` makes a crisp ramp lip.

See `game/js/tracks/`.
The tests drive every track with a track-following autopilot to check that it can be completed and every jump cleared.
