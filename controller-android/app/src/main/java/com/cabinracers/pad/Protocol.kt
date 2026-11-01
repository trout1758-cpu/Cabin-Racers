package com.cabinracers.pad

import java.util.UUID
import kotlin.math.roundToInt

/**
 * Bluetooth LE protocol shared with the Cabin Racers game.
 * Keep in sync with game/js/protocol.js and docs/PROTOCOL.md.
 */
object Protocol {
    val SERVICE_UUID: UUID = UUID.fromString("49fa860a-95dd-48a7-b575-f424d3f9852e")
    /** Phone -> game. Read + notify. */
    val INPUT_UUID: UUID = UUID.fromString("49fa860b-95dd-48a7-b575-f424d3f9852e")
    /** Game -> phone. Write / write without response. */
    val FEEDBACK_UUID: UUID = UUID.fromString("49fa860c-95dd-48a7-b575-f424d3f9852e")
    val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    const val VERSION = 1
    const val INPUT_LEN = 12

    const val HELD_GAS = 1
    const val HELD_BRAKE = 2
    const val HELD_BOOST = 4
    const val HELD_ITEM = 8

    const val FLAG_TILT = 1
    const val FLAG_AUTO_GAS = 2

    const val MSG_ASSIGN = 1
    const val MSG_RUMBLE = 2
    const val MSG_STATUS = 3

    fun encode(s: PadState, seq: Int): ByteArray {
        var held = 0
        if (s.gasHeld) held = held or HELD_GAS
        if (s.brakeHeld) held = held or HELD_BRAKE
        if (s.boostHeld) held = held or HELD_BOOST
        if (s.itemHeld) held = held or HELD_ITEM
        var flags = 0
        if (s.tilt) flags = flags or FLAG_TILT
        if (s.autoGas) flags = flags or FLAG_AUTO_GAS
        return byteArrayOf(
            VERSION.toByte(),
            seq.toByte(),
            (s.steer.coerceIn(-1f, 1f) * 127f).roundToInt().toByte(),
            (s.throttle.coerceIn(0f, 1f) * 255f).roundToInt().toByte(),
            (if (s.brakeHeld) 255 else 0).toByte(),
            held.toByte(),
            s.gasCount.toByte(),
            s.boostCount.toByte(),
            s.itemCount.toByte(),
            s.pauseCount.toByte(),
            flags.toByte(),
            0,
        )
    }

    fun parseFeedback(b: ByteArray): Feedback? {
        if (b.isEmpty()) return null
        fun u(i: Int) = if (i < b.size) b[i].toInt() and 0xff else 0
        return when (u(0)) {
            MSG_ASSIGN -> if (b.size >= 5) Feedback.Assign(u(1), (0xff shl 24) or (u(2) shl 16) or (u(3) shl 8) or u(4)) else null
            MSG_RUMBLE -> if (b.size >= 3) Feedback.Rumble(u(1) * 10L, u(2).coerceIn(1, 255)) else null
            MSG_STATUS -> if (b.size >= 8) Feedback.Status(RaceStatus(u(1), u(2), u(3), u(4), u(5), u(6) != 0, u(7))) else null
            else -> null
        }
    }
}

/** What the controls currently say. Press counters wrap at 256. */
class PadState {
    var steer = 0f
    var throttle = 0f
    var gasHeld = false
    var brakeHeld = false
    var boostHeld = false
    var itemHeld = false
    var gasCount = 0
    var boostCount = 0
    var itemCount = 0
    var pauseCount = 0
    var tilt = true
    var autoGas = false
}

data class RaceStatus(
    val state: Int,
    val position: Int,
    val lap: Int,
    val laps: Int,
    val players: Int,
    val ready: Boolean,
    val place: Int,
) {
    companion object {
        const val LOBBY = 0
        const val COUNTDOWN = 1
        const val RACING = 2
        const val FINISHED = 3
        const val RESULTS = 4
        const val PAUSED = 5
    }
}

sealed class Feedback {
    data class Assign(val playerIndex: Int, val color: Int) : Feedback()
    data class Rumble(val durationMs: Long, val amplitude: Int) : Feedback()
    data class Status(val status: RaceStatus) : Feedback()
}
