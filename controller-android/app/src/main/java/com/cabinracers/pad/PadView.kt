package com.cabinracers.pad

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sign

/**
 * The controller screen: touch zones (configurable), tilt steering, and a
 * top bar with connection, race position and the pause/settings buttons.
 */
class PadView(context: Context, private val config: PadConfig) : View(context) {

    interface Listener {
        fun onControlsChanged()
        fun onSettingsRequested()
        fun onRetryRequested()
    }

    var listener: Listener? = null
    val state = PadState()

    private var connection: BleControllerServer.Status = BleControllerServer.Status.Off
    private var playerIndex = -1
    private var playerColor = Color.rgb(255, 122, 0)
    private var race: RaceStatus? = null
    private var tiltAngle = 0f

    fun setConnection(s: BleControllerServer.Status) {
        connection = s
        if (s !is BleControllerServer.Status.Connected) {
            playerIndex = -1
            race = null
        }
        invalidate()
    }

    fun setAssigned(index: Int, color: Int) {
        playerIndex = index
        playerColor = color
        invalidate()
    }

    fun setRaceStatus(s: RaceStatus) {
        race = s
        invalidate()
    }

    fun setTilt(degrees: Float) {
        tiltAngle = degrees
        recompute()
    }

    /** Current raw tilt, for calibration. */
    val currentTilt get() = tiltAngle

    fun configChanged() {
        pointers.clear()
        layoutControls()
        recompute()
    }

    // ---- geometry --------------------------------------------------------------------
    private val dp = resources.displayMetrics.density
    private val safe = Rect()
    private var topBottom = 0f
    private val area = RectF()
    private val zones = mutableListOf<RectF>()
    private val pauseBtn = RectF()
    private val settingsBtn = RectF()
    private val helpBox = RectF()
    private var stickR = 0f

    override fun onApplyWindowInsets(insets: WindowInsets): WindowInsets {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val i = insets.getInsetsIgnoringVisibility(WindowInsets.Type.displayCutout())
            safe.set(i.left, i.top, i.right, i.bottom)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val c = insets.displayCutout
            safe.set(c?.safeInsetLeft ?: 0, c?.safeInsetTop ?: 0, c?.safeInsetRight ?: 0, c?.safeInsetBottom ?: 0)
        }
        layoutControls()
        return super.onApplyWindowInsets(insets)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) = layoutControls()

    private fun layoutControls() {
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0 || h <= 0) return
        topBottom = safe.top + max(54 * dp, h * 0.15f)
        area.set(safe.left + 8 * dp, topBottom + 4 * dp, w - safe.right - 8 * dp, h - safe.bottom - 8 * dp)
        zones.clear()
        for ((r, _) in config.layout.zones) {
            zones.add(
                RectF(
                    area.left + r.left * area.width(), area.top + r.top * area.height(),
                    area.left + r.right * area.width(), area.top + r.bottom * area.height(),
                ),
            )
        }
        stickR = min(h * 0.18f, w * 0.11f)
        val b = 44 * dp
        val top = safe.top + (topBottom - safe.top - b) / 2
        settingsBtn.set(w - safe.right - 14 * dp - b, top, w - safe.right - 14 * dp, top + b)
        pauseBtn.set(settingsBtn.left - 10 * dp - b, top, settingsBtn.left - 10 * dp, top + b)
    }

    // ---- touch -----------------------------------------------------------------------
    private class Touch(val zone: Int, val x0: Float, var x: Float)
    private val pointers = HashMap<Int, Touch>()

    override fun onTouchEvent(e: MotionEvent): Boolean {
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                val i = e.actionIndex
                down(e.getPointerId(i), e.getX(i), e.getY(i))
            }
            MotionEvent.ACTION_MOVE -> for (i in 0 until e.pointerCount) {
                pointers[e.getPointerId(i)]?.x = e.getX(i)
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> pointers.remove(e.getPointerId(e.actionIndex))
            MotionEvent.ACTION_CANCEL -> pointers.clear()
        }
        recompute()
        invalidate()
        return true
    }

    private fun hit(r: RectF, x: Float, y: Float) = r.contains(x, y) || (abs(r.centerX() - x) < r.width() / 2 + 10 * dp && abs(r.centerY() - y) < r.height() / 2 + 10 * dp)

    private fun down(id: Int, x: Float, y: Float) {
        when {
            hit(pauseBtn, x, y) -> {
                state.pauseCount = (state.pauseCount + 1) and 0xff
                performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
            }
            hit(settingsBtn, x, y) -> {
                performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                listener?.onSettingsRequested()
            }
            needsRetry() && helpBox.contains(x, y) -> listener?.onRetryRequested()
            else -> {
                val z = zones.indexOfFirst { it.contains(x, y) }
                if (z < 0) return
                pointers[id] = Touch(z, x, x)
                when (config.actions[z]) {
                    Action.GAS -> state.gasCount = (state.gasCount + 1) and 0xff
                    Action.BOOST -> state.boostCount = (state.boostCount + 1) and 0xff
                    Action.ITEM -> state.itemCount = (state.itemCount + 1) and 0xff
                    else -> Unit
                }
            }
        }
    }

    private fun needsRetry() = connection is BleControllerServer.Status.Error || connection is BleControllerServer.Status.Off

    private fun held(a: Action) = pointers.values.any { config.actions.getOrNull(it.zone) == a }

    /** Turns touches + tilt into the controller state and tells the listener. */
    private fun recompute() {
        var steer = 0f
        for (t in pointers.values) {
            when (config.actions.getOrNull(t.zone)) {
                Action.STEER_STICK -> steer += ((t.x - t.x0) / stickR).coerceIn(-1f, 1f)
                Action.STEER_LEFT -> steer -= 1f
                Action.STEER_RIGHT -> steer += 1f
                else -> Unit
            }
        }
        if (config.tilt) {
            var a = tiltAngle - config.tiltCenter
            if (config.tiltInvert) a = -a
            val dead = 2f
            steer += if (abs(a) < dead) 0f else ((a - sign(a) * dead) / (config.tiltRange - dead))
        }
        steer = steer.coerceIn(-1f, 1f)
        val gas = held(Action.GAS)
        val brake = held(Action.BRAKE)
        state.steer = steer
        state.gasHeld = gas || (config.autoGas && !brake)
        state.brakeHeld = brake
        state.boostHeld = held(Action.BOOST)
        state.itemHeld = held(Action.ITEM)
        // Auto-gas: brake while steering hard = drift (keep the gas on), otherwise a real brake.
        state.throttle = when {
            gas -> 1f
            config.autoGas && !brake -> 1f
            config.autoGas && brake && abs(steer) > 0.3f -> 1f
            else -> 0f
        }
        state.tilt = config.tilt
        state.autoGas = config.autoGas
        listener?.onControlsChanged()
        invalidate()
    }

    // ---- drawing ---------------------------------------------------------------------
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val bold = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = Typeface.create("sans-serif-black", Typeface.NORMAL)
        textAlign = Paint.Align.CENTER
    }
    private val body = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        textAlign = Paint.Align.CENTER
    }
    private val tmp = RectF()

    private fun alpha(c: Int, a: Int) = Color.argb(a.coerceIn(0, 255), Color.red(c), Color.green(c), Color.blue(c))

    override fun onDraw(c: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        fill.shader = LinearGradient(0f, 0f, 0f, h, Color.rgb(34, 30, 44), Color.rgb(20, 18, 26), Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, w, h, fill)
        fill.shader = null
        if (playerIndex >= 0) {
            fill.shader = RadialGradient(w / 2, h * 1.1f, w * 0.65f, alpha(playerColor, 70), Color.TRANSPARENT, Shader.TileMode.CLAMP)
            c.drawRect(0f, 0f, w, h, fill)
            fill.shader = null
        }
        drawZones(c)
        drawTopBar(c)
        if (connection !is BleControllerServer.Status.Connected) drawHelp(c)
    }

    private fun drawZones(c: Canvas) {
        zones.forEachIndexed { i, r ->
            val action = config.actions.getOrNull(i) ?: Action.NONE
            val pressed = pointers.values.any { it.zone == i } || (action == Action.GAS && config.autoGas && state.gasHeld)
            tmp.set(r.left + 4 * dp, r.top + 4 * dp, r.right - 4 * dp, r.bottom - 4 * dp)
            fill.color = if (pressed) alpha(playerColor, 110) else Color.argb(18, 255, 255, 255)
            c.drawRoundRect(tmp, 22 * dp, 22 * dp, fill)
            stroke.color = if (pressed) alpha(playerColor, 255) else Color.argb(60, 255, 255, 255)
            stroke.strokeWidth = 2.5f * dp
            c.drawRoundRect(tmp, 22 * dp, 22 * dp, stroke)
            if (action == Action.NONE) return@forEachIndexed
            bold.textSize = min(30 * dp, r.width() / 7f)
            bold.color = if (pressed) Color.WHITE else Color.argb(170, 255, 255, 255)
            val label = when (action) {
                Action.STEER_LEFT -> "◀"
                Action.STEER_RIGHT -> "▶"
                else -> action.label
            }
            c.drawText(label, r.centerX(), r.centerY() + bold.textSize / 3, bold)
            val hint = when (action) {
                Action.GAS -> if (config.autoGas) "auto-gas is on" else "hold to drive"
                Action.BRAKE -> "hold with gas to drift"
                Action.BOOST, Action.ITEM -> "coming later"
                Action.STEER_STICK -> "drag left / right"
                else -> null
            }
            if (hint != null) {
                body.textSize = 12 * dp
                body.color = Color.argb(110, 255, 255, 255)
                c.drawText(hint, r.centerX(), r.centerY() + bold.textSize / 3 + 20 * dp, body)
            }
            // live joystick
            if (action == Action.STEER_STICK) {
                for (t in pointers.values) {
                    if (t.zone != i) continue
                    val cy = r.centerY() + r.height() * 0.22f
                    stroke.color = Color.argb(120, 255, 255, 255)
                    c.drawLine(t.x0 - stickR, cy, t.x0 + stickR, cy, stroke)
                    fill.color = playerColor
                    c.drawCircle(t.x0 + ((t.x - t.x0).coerceIn(-stickR, stickR)), cy, 22 * dp, fill)
                }
            }
        }
    }

    private fun drawTopBar(c: Canvas) {
        val w = width.toFloat()
        val midY = (safe.top + topBottom) / 2
        // connection pill
        val (dot, label) = when (val s = connection) {
            is BleControllerServer.Status.Connected -> if (playerIndex >= 0) playerColor to "P${playerIndex + 1}" else Color.rgb(92, 196, 97) to "CONNECTED"
            is BleControllerServer.Status.Advertising -> Color.rgb(255, 205, 69) to "WAITING FOR GAME"
            is BleControllerServer.Status.Error -> Color.rgb(255, 90, 74) to "BLUETOOTH PROBLEM"
            BleControllerServer.Status.Off -> Color.GRAY to "BLUETOOTH OFF"
        }
        bold.textSize = 15 * dp
        bold.textAlign = Paint.Align.LEFT
        val pillH = 36 * dp
        val left = safe.left + 14 * dp
        tmp.set(left, midY - pillH / 2, left + bold.measureText(label) + 46 * dp, midY + pillH / 2)
        fill.color = if (playerIndex >= 0) playerColor else Color.argb(40, 255, 255, 255)
        c.drawRoundRect(tmp, pillH / 2, pillH / 2, fill)
        fill.color = if (playerIndex >= 0) Color.WHITE else dot
        c.drawCircle(left + 18 * dp, midY, 6 * dp, fill)
        bold.color = Color.WHITE
        c.drawText(label, left + 32 * dp, midY + 5.5f * dp, bold)
        bold.textAlign = Paint.Align.CENTER

        // steering indicator (a little wheel that turns with your steering)
        val wheelX = tmp.right + 40 * dp
        val rr = 15 * dp
        c.save()
        c.rotate(state.steer * 90f, wheelX, midY)
        stroke.color = Color.WHITE
        stroke.strokeWidth = 3 * dp
        c.drawCircle(wheelX, midY, rr, stroke)
        c.drawLine(wheelX - rr, midY, wheelX + rr, midY, stroke)
        c.drawLine(wheelX, midY, wheelX, midY + rr, stroke)
        c.restore()
        body.textSize = 10 * dp
        body.color = Color.argb(150, 255, 255, 255)
        c.drawText(if (config.tilt) "TILT" else "TOUCH", wheelX, midY + rr + 12 * dp, body)

        // race info in the middle
        val r = race
        if (connection is BleControllerServer.Status.Connected && r != null) {
            val (big, small) = when (r.state) {
                RaceStatus.LOBBY -> (if (r.ready) "READY!" else "Press GAS when ready") to "${r.players} player${if (r.players == 1) "" else "s"} · ${r.laps} laps"
                RaceStatus.COUNTDOWN -> "Get ready…" to "Lap 1/${r.laps}"
                RaceStatus.RACING -> ordinal(r.position) to "Lap ${r.lap}/${r.laps}"
                RaceStatus.FINISHED -> "Finished ${ordinal(r.place)}!" to "waiting for the others"
                RaceStatus.RESULTS -> "Race over" to "GAS to race again"
                RaceStatus.PAUSED -> "Paused" to ""
                else -> "" to ""
            }
            bold.textSize = 24 * dp
            bold.color = if (r.state == RaceStatus.LOBBY && r.ready) Color.rgb(120, 230, 120) else Color.WHITE
            c.drawText(big, w / 2, midY + 4 * dp, bold)
            body.textSize = 12 * dp
            body.color = Color.argb(170, 255, 255, 255)
            c.drawText(small, w / 2, midY + 20 * dp, body)
        }

        // pause + settings buttons
        for ((b, isPause) in listOf(pauseBtn to true, settingsBtn to false)) {
            fill.color = Color.argb(40, 255, 255, 255)
            c.drawRoundRect(b, 12 * dp, 12 * dp, fill)
            fill.color = Color.WHITE
            stroke.color = Color.WHITE
            stroke.strokeWidth = 2.5f * dp
            if (isPause) {
                val bw = b.width() * 0.13f
                val bh = b.height() * 0.42f
                tmp.set(b.centerX() - bw * 1.8f, b.centerY() - bh / 2, b.centerX() - bw * 0.6f, b.centerY() + bh / 2)
                c.drawRoundRect(tmp, bw / 2, bw / 2, fill)
                tmp.set(b.centerX() + bw * 0.6f, b.centerY() - bh / 2, b.centerX() + bw * 1.8f, b.centerY() + bh / 2)
                c.drawRoundRect(tmp, bw / 2, bw / 2, fill)
            } else {
                val l = b.left + b.width() * 0.26f
                val rgt = b.right - b.width() * 0.26f
                listOf(0.32f, 0.5f, 0.68f).forEachIndexed { k, f ->
                    val y = b.top + b.height() * f
                    c.drawLine(l, y, rgt, y, stroke)
                    c.drawCircle(l + (rgt - l) * listOf(0.7f, 0.3f, 0.55f)[k], y, 3.5f * dp, fill)
                }
            }
        }
    }

    private fun drawHelp(c: Canvas) {
        val lines = when (val s = connection) {
            is BleControllerServer.Status.Advertising -> listOf(
                "On the computer, open Cabin Racers in Chrome or Edge,",
                "click “Phone (Bluetooth)” on a player slot",
                "and pick “${s.name}” in the list.",
            )
            is BleControllerServer.Status.Error -> listOf(s.message, "Tap here to try again")
            BleControllerServer.Status.Off -> listOf("Bluetooth is off or not allowed.", "Tap here to try again")
            else -> emptyList()
        }
        if (lines.isEmpty()) return
        body.textSize = 15 * dp
        val bw = lines.maxOf { body.measureText(it) } + 40 * dp
        val bh = lines.size * 24 * dp + 20 * dp
        val cx = width / 2f
        val top = topBottom + 16 * dp
        helpBox.set(cx - bw / 2, top, cx + bw / 2, top + bh)
        fill.color = Color.argb(215, 10, 8, 18)
        c.drawRoundRect(helpBox, 16 * dp, 16 * dp, fill)
        body.color = Color.WHITE
        lines.forEachIndexed { k, line -> c.drawText(line, cx, top + 30 * dp + k * 24 * dp, body) }
    }

    private fun ordinal(n: Int): String {
        val v = n % 100
        val suffix = if (v in 11..13) "th" else when (n % 10) { 1 -> "st"; 2 -> "nd"; 3 -> "rd"; else -> "th" }
        return "$n$suffix"
    }
}
