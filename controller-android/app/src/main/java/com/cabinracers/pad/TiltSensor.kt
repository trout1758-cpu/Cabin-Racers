package com.cabinracers.pad

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.view.Surface
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot

/**
 * Steering by tilting the phone like a steering wheel (held sideways, screen
 * facing you): reads gravity, works out how far the phone is rotated in the
 * plane of the screen, and reports it in degrees (clockwise = positive).
 */
class TiltSensor(context: Context, private val rotation: () -> Int, private val onAngle: (Float) -> Unit) : SensorEventListener {
    private val sm = context.getSystemService(SensorManager::class.java)
    private val gravity = sm?.getDefaultSensor(Sensor.TYPE_GRAVITY)
    private val accel = sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private val g = FloatArray(3)
    private var smoothed = 0f
    private var primed = false

    val available get() = gravity != null || accel != null

    /** Latest tilt angle in degrees. */
    var angle = 0f
        private set

    fun start() {
        val s = gravity ?: accel ?: return
        sm?.registerListener(this, s, SensorManager.SENSOR_DELAY_GAME)
    }

    fun stop() {
        sm?.unregisterListener(this)
        primed = false
    }

    override fun onSensorChanged(e: SensorEvent) {
        if (e.sensor.type == Sensor.TYPE_ACCELEROMETER) {
            // no gravity sensor: low-pass the accelerometer to strip out shakes
            val a = 0.2f
            for (i in 0..2) g[i] = if (primed) g[i] + (e.values[i] - g[i]) * a else e.values[i]
        } else {
            for (i in 0..2) g[i] = e.values[i]
        }
        primed = true
        // device axes -> screen axes for the current orientation (y up)
        val (sx, sy) = when (rotation()) {
            Surface.ROTATION_90 -> -g[1] to g[0]
            Surface.ROTATION_180 -> -g[0] to -g[1]
            Surface.ROTATION_270 -> g[1] to -g[0]
            else -> g[0] to g[1]
        }
        // Lying nearly flat there's no reliable wheel angle; keep the last one.
        if (hypot(sx, sy) < 2.5f) return
        val raw = Math.toDegrees(atan2(-sx.toDouble(), sy.toDouble())).toFloat()
        smoothed += (raw - smoothed) * if (abs(raw - smoothed) > 20f) 0.6f else 0.35f
        angle = smoothed
        onAngle(angle)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
