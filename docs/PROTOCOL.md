# Racer Pad ↔ Cabin Racers protocol (Bluetooth LE)

The phone runs a GATT server (BLE peripheral) and advertises one service.
The game connects to it from Chrome or Edge with Web Bluetooth.
No OS pairing is needed.

| Item | UUID |
| --- | --- |
| Service | `49fa860a-95dd-48a7-b575-f424d3f9852e` |
| Input (phone → game, notify) | `49fa860b-95dd-48a7-b575-f424d3f9852e` |
| Feedback (game → phone, write) | `49fa860c-95dd-48a7-b575-f424d3f9852e` |

## Input packet (12 bytes)

| Byte | Meaning |
| --- | --- |
| 0 | version `1` (anything else is ignored) |
| 1 | sequence number |
| 2 | steering, int8 −127…127 (right is positive), from tilt and/or touch |
| 3 | throttle 0…255 |
| 4 | brake 0…255 |
| 5 | held buttons: 1 gas, 2 brake/drift, 4 boost, 8 item |
| 6–9 | press counters (wrapping): gas, boost, item, pause |
| 10 | flags: 1 tilt steering on, 2 auto-accelerate on |
| 11 | reserved |

The game turns brake into **drift** while the throttle is on, and into **brake/reverse** otherwise.
The phone sends a packet whenever its controls change, and at least every 200 ms.

## Feedback (game → phone)

| First byte | Message | Payload |
| --- | --- | --- |
| `1` | Assign | `playerIndex, r, g, b` |
| `2` | Rumble | `duration / 10 ms, amplitude 1…255` |
| `3` | Status | `state, position, lap, laps, players, ready, place` |

`state`: `0` lobby, `1` countdown, `2` racing, `3` you finished, `4` results, `5` paused.
