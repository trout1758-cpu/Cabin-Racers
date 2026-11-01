package com.cabinracers.pad

import android.content.SharedPreferences
import android.graphics.RectF

/** What a touch zone does. */
enum class Action(val label: String) {
    GAS("GAS"),
    BRAKE("BRAKE / DRIFT"),
    BOOST("BOOST"),
    ITEM("ITEM"),
    STEER_STICK("STEER STICK"),
    STEER_LEFT("STEER LEFT"),
    STEER_RIGHT("STEER RIGHT"),
    NONE("NOTHING"),
}

/**
 * How the screen is divided. Zone rectangles are fractions of the control
 * area (everything below the top bar); each zone gets a default action that
 * the player can change in settings.
 */
enum class Layout(val label: String, val zones: List<Pair<RectF, Action>>, val tilt: Boolean) {
    CLASSIC(
        "Classic: gas left, boost / brake right",
        listOf(
            RectF(0f, 0f, 0.5f, 1f) to Action.GAS,
            RectF(0.5f, 0f, 1f, 0.5f) to Action.BOOST,
            RectF(0.5f, 0.5f, 1f, 1f) to Action.BRAKE,
        ),
        tilt = true,
    ),
    MIRRORED(
        "Mirrored: gas right, boost / brake left",
        listOf(
            RectF(0.5f, 0f, 1f, 1f) to Action.GAS,
            RectF(0f, 0f, 0.5f, 0.5f) to Action.BOOST,
            RectF(0f, 0.5f, 0.5f, 1f) to Action.BRAKE,
        ),
        tilt = true,
    ),
    STICK(
        "Joystick: steer stick left, gas / brake right",
        listOf(
            RectF(0f, 0f, 0.5f, 1f) to Action.STEER_STICK,
            RectF(0.5f, 0f, 1f, 0.5f) to Action.BRAKE,
            RectF(0.5f, 0.5f, 1f, 1f) to Action.GAS,
        ),
        tilt = false,
    ),
    BUTTONS(
        "Buttons: ◀ ▶ left, brake / gas right",
        listOf(
            RectF(0f, 0f, 0.25f, 1f) to Action.STEER_LEFT,
            RectF(0.25f, 0f, 0.5f, 1f) to Action.STEER_RIGHT,
            RectF(0.5f, 0f, 1f, 0.5f) to Action.BRAKE,
            RectF(0.5f, 0.5f, 1f, 1f) to Action.GAS,
        ),
        tilt = false,
    ),
    QUADRANTS(
        "Four corners",
        listOf(
            RectF(0f, 0f, 0.5f, 0.5f) to Action.BOOST,
            RectF(0f, 0.5f, 0.5f, 1f) to Action.BRAKE,
            RectF(0.5f, 0f, 1f, 0.5f) to Action.ITEM,
            RectF(0.5f, 0.5f, 1f, 1f) to Action.GAS,
        ),
        tilt = true,
    ),
    THIRDS(
        "Three columns",
        listOf(
            RectF(0f, 0f, 0.333f, 1f) to Action.BRAKE,
            RectF(0.333f, 0f, 0.667f, 1f) to Action.BOOST,
            RectF(0.667f, 0f, 1f, 1f) to Action.GAS,
        ),
        tilt = true,
    ),
}

/** Everything the player can customise, saved on the phone. */
class PadConfig(private val prefs: SharedPreferences) {
    var layout: Layout = Layout.CLASSIC
    var actions: MutableList<Action> = Layout.CLASSIC.zones.map { it.second }.toMutableList()
    var tilt = true
    var tiltRange = 30f      // degrees of tilt for full lock
    var tiltInvert = false
    var tiltCenter = 0f      // calibration offset, degrees
    var autoGas = false
    var haptics = true

    init {
        load()
    }

    fun applyLayout(l: Layout) {
        layout = l
        actions = l.zones.map { it.second }.toMutableList()
        tilt = l.tilt
    }

    private fun load() {
        val l = runCatching { Layout.valueOf(prefs.getString("layout", Layout.CLASSIC.name)!!) }.getOrDefault(Layout.CLASSIC)
        applyLayout(l)
        val saved = prefs.getString("actions", null)?.split(",")
        if (saved != null && saved.size == l.zones.size) {
            actions = saved.map { runCatching { Action.valueOf(it) }.getOrDefault(Action.NONE) }.toMutableList()
        }
        tilt = prefs.getBoolean("tilt", l.tilt)
        tiltRange = prefs.getFloat("tiltRange", 30f)
        tiltInvert = prefs.getBoolean("tiltInvert", false)
        tiltCenter = prefs.getFloat("tiltCenter", 0f)
        autoGas = prefs.getBoolean("autoGas", false)
        haptics = prefs.getBoolean("haptics", true)
    }

    fun save() {
        prefs.edit()
            .putString("layout", layout.name)
            .putString("actions", actions.joinToString(",") { it.name })
            .putBoolean("tilt", tilt)
            .putFloat("tiltRange", tiltRange)
            .putBoolean("tiltInvert", tiltInvert)
            .putFloat("tiltCenter", tiltCenter)
            .putBoolean("autoGas", autoGas)
            .putBoolean("haptics", haptics)
            .apply()
    }
}
