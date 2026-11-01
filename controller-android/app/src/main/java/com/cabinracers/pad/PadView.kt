package com.cabinracers.pad

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
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

    // ---- drawing (cartoon style: chunky buttons, ink outlines, Lilita One) ---------
    private val ink = Color.rgb(43, 28, 24)
    private val cream = Color.rgb(255, 250, 240)
    private val font: Typeface = runCatching { context.resources.getFont(R.font.lilita_one) }
        .getOrDefault(Typeface.create("sans-serif-black", Typeface.NORMAL))
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }
    private val bold = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = font
        textAlign = Paint.Align.CENTER
    }
    private val outlineText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = font
        textAlign = Paint.Align.CENTER
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        color = Color.rgb(43, 28, 24)
    }
    private val body = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        textAlign = Paint.Align.CENTER
    }
    private val tmp = RectF()

    private fun alpha(c: Int, a: Int) = Color.argb(a.coerceIn(0, 255), Color.red(c), Color.green(c), Color.blue(c))
    private fun lighten(c: Int, f: Float) = Color.rgb(
        (Color.red(c) + (255 - Color.red(c)) * f).toInt(),
        (Color.green(c) + (255 - Color.green(c)) * f).toInt(),
        (Color.blue(c) + (255 - Color.blue(c)) * f).toInt(),
    )

    /** Big cartoon text: white (or [color]) with a thick ink outline. */
    private fun cartoonText(c: Canvas, text: String, x: Float, y: Float, size: Float, color: Int = Color.WHITE, align: Paint.Align = Paint.Align.CENTER) {
        outlineText.textSize = size
        outlineText.strokeWidth = size * 0.2f
        outlineText.textAlign = align
        bold.textSize = size
        bold.color = color
        bold.textAlign = align
        c.drawText(text, x, y, outlineText)
        c.drawText(text, x, y, bold)
        bold.textAlign = Paint.Align.CENTER
    }

    /** A chunky button: ink drop shadow, coloured face, ink outline, glossy top. */
    private fun chunky(c: Canvas, r: RectF, color: Int, pressed: Boolean, radius: Float, depth: Float = 6 * dp) {
        val sink = if (pressed) depth * 0.8f else 0f
        tmp.set(r.left, r.top + depth, r.right, r.bottom)
        fill.color = ink
        c.drawRoundRect(tmp, radius, radius, fill)
        tmp.set(r.left, r.top + sink, r.right, r.bottom - depth + sink)
        fill.color = color
        c.drawRoundRect(tmp, radius, radius, fill)
        val gloss = RectF(tmp.left + radius * 0.5f, tmp.top + 5 * dp, tmp.right - radius * 0.5f, tmp.top + 5 * dp + min(14 * dp, tmp.height() * 0.12f))
        fill.color = Color.argb(70, 255, 255, 255)
        c.drawRoundRect(gloss, gloss.height() / 2, gloss.height() / 2, fill)
        stroke.color = ink
        stroke.strokeWidth = 3.5f * dp
        c.drawRoundRect(tmp, radius, radius, stroke)
    }

    private fun actionColor(a: Action) = when (a) {
        Action.GAS -> Color.rgb(63, 174, 58)
        Action.BRAKE -> Color.rgb(232, 71, 59)
        Action.BOOST -> Color.rgb(222, 196, 120)
        Action.ITEM -> Color.rgb(176, 160, 200)
        Action.STEER_STICK, Action.STEER_LEFT, Action.STEER_RIGHT -> Color.rgb(47, 134, 201)
        Action.NONE -> Color.TRANSPARENT
    }

    override fun onDraw(c: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val top = if (playerIndex >= 0) lighten(playerColor, 0.55f) else Color.rgb(143, 211, 255)
        val bottom = if (playerIndex >= 0) lighten(playerColor, 0.25f) else Color.rgb(94, 180, 240)
        fill.shader = LinearGradient(0f, 0f, 0f, h, top, bottom, Shader.TileMode.CLAMP)
        c.drawRect(0f, 0f, w, h, fill)
        fill.shader = null
        // cartoon polka dots
        fill.color = Color.argb(28, 255, 255, 255)
        val step = 46 * dp
        var row = 0
        var y = step / 2
        while (y < h) {
            var x = if (row % 2 == 0) step / 2 else step
            while (x < w) { c.drawCircle(x, y, 7 * dp, fill); x += step }
            y += step * 0.75f
            row++
        }
        drawZones(c)
        drawTopBar(c)
        if (connection !is BleControllerServer.Status.Connected) drawHelp(c)
    }

    private fun drawZones(c: Canvas) {
        zones.forEachIndexed { i, r ->
            val action = config.actions.getOrNull(i) ?: Action.NONE
            if (action == Action.NONE) return@forEachIndexed
            val pressed = pointers.values.any { it.zone == i } || (action == Action.GAS && config.autoGas && state.gasHeld)
            val face = RectF(r.left + 7 * dp, r.top + 7 * dp, r.right - 7 * dp, r.bottom - 7 * dp)
            val col = actionColor(action)
            chunky(c, face, if (pressed) lighten(col, 0.25f) else col, pressed, 28 * dp, 8 * dp)
            val sink = if (pressed) 6.4f * dp else 0f
            val cy = face.centerY() - 4 * dp + sink
            val label = when (action) {
                Action.STEER_LEFT -> "◀"
                Action.STEER_RIGHT -> "▶"
                else -> action.label
            }
            val size = min(40 * dp, face.width() / 6.2f)
            cartoonText(c, label, face.centerX(), cy + size / 3, size)
            val hint = when (action) {
                Action.GAS -> if (config.autoGas) "auto-gas is on" else "hold to drive"
                Action.BRAKE -> "hold with gas to drift"
                Action.BOOST, Action.ITEM -> "coming soon!"
                Action.STEER_STICK -> "drag left / right"
                else -> null
            }
            if (hint != null) {
                body.textSize = 13 * dp
                body.color = Color.argb(215, 255, 255, 255)
                c.drawText(hint, face.centerX(), cy + size / 3 + 24 * dp, body)
            }
            // live joystick
            if (action == Action.STEER_STICK) {
                for (t in pointers.values) {
                    if (t.zone != i) continue
                    val sy = face.centerY() + face.height() * 0.24f
                    stroke.color = Color.argb(160, 255, 255, 255)
                    stroke.strokeWidth = 6 * dp
                    c.drawLine(t.x0 - stickR, sy, t.x0 + stickR, sy, stroke)
                    val kx = t.x0 + ((t.x - t.x0).coerceIn(-stickR, stickR))
                    fill.color = playerColor
                    c.drawCircle(kx, sy, 24 * dp, fill)
                    stroke.color = ink
                    stroke.strokeWidth = 3.5f * dp
                    c.drawCircle(kx, sy, 24 * dp, stroke)
                }
            }
        }
    }

    private fun drawTopBar(c: Canvas) {
        val w = width.toFloat()
        val midY = (safe.top + topBottom) / 2
        // connection pill
        val (dot, label) = when (val s = connection) {
            is BleControllerServer.Status.Connected -> if (playerIndex >= 0) playerColor to "P${playerIndex + 1}" else Color.rgb(63, 174, 58) to "CONNECTED"
            is BleControllerServer.Status.Advertising -> Color.rgb(255, 210, 63) to "WAITING FOR GAME"
            is BleControllerServer.Status.Error -> Color.rgb(232, 71, 59) to "BLUETOOTH PROBLEM"
            BleControllerServer.Status.Off -> Color.GRAY to "BLUETOOTH OFF"
        }
        val pillH = 40 * dp
        val left = safe.left + 14 * dp
        bold.textSize = 19 * dp
        val pill = RectF(left, midY - pillH / 2, left + bold.measureText(label) + 52 * dp, midY + pillH / 2)
        chunky(c, pill, if (playerIndex >= 0) playerColor else cream, false, pillH / 2, 4 * dp)
        fill.color = if (playerIndex >= 0) Color.WHITE else dot
        c.drawCircle(left + 20 * dp, midY - 2 * dp, 7 * dp, fill)
        stroke.color = ink
        stroke.strokeWidth = 2.5f * dp
        c.drawCircle(left + 20 * dp, midY - 2 * dp, 7 * dp, stroke)
        if (playerIndex >= 0) cartoonText(c, label, left + 36 * dp, midY + 5 * dp, 19 * dp, Color.WHITE, Paint.Align.LEFT)
        else {
            bold.textAlign = Paint.Align.LEFT
            bold.color = ink
            c.drawText(label, left + 36 * dp, midY + 5 * dp, bold)
            bold.textAlign = Paint.Align.CENTER
        }

        // steering indicator (a little wheel that turns with your steering)
        val wheelX = pill.right + 44 * dp
        val rr = 16 * dp
        c.save()
        c.rotate(state.steer * 90f, wheelX, midY - 2 * dp)
        fill.color = cream
        c.drawCircle(wheelX, midY - 2 * dp, rr, fill)
        stroke.color = ink
        stroke.strokeWidth = 4 * dp
        c.drawCircle(wheelX, midY - 2 * dp, rr, stroke)
        c.drawLine(wheelX - rr, midY - 2 * dp, wheelX + rr, midY - 2 * dp, stroke)
        c.drawLine(wheelX, midY - 2 * dp, wheelX, midY - 2 * dp + rr, stroke)
        c.restore()
        body.textSize = 10 * dp
        body.color = ink
        c.drawText(if (config.tilt) "TILT" else "TOUCH", wheelX, midY + rr + 10 * dp, body)

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
            val bigColor = when {
                r.state == RaceStatus.LOBBY && r.ready -> Color.rgb(120, 230, 120)
                r.state == RaceStatus.RACING || r.state == RaceStatus.FINISHED -> Color.rgb(255, 210, 63)
                else -> Color.WHITE
            }
            cartoonText(c, big, w / 2, midY + 6 * dp, 28 * dp, bigColor)
            body.textSize = 13 * dp
            body.color = ink
            c.drawText(small, w / 2, midY + 24 * dp, body)
        }

        // pause + settings buttons
        for ((b, isPause) in listOf(pauseBtn to true, settingsBtn to false)) {
            chunky(c, b, cream, false, 14 * dp, 4 * dp)
            val cyB = b.centerY() - 2 * dp
            fill.color = ink
            stroke.color = ink
            stroke.strokeWidth = 3 * dp
            if (isPause) {
                val bw = b.width() * 0.13f
                val bh = b.height() * 0.4f
                tmp.set(b.centerX() - bw * 1.8f, cyB - bh / 2, b.centerX() - bw * 0.6f, cyB + bh / 2)
                c.drawRoundRect(tmp, bw / 2, bw / 2, fill)
                tmp.set(b.centerX() + bw * 0.6f, cyB - bh / 2, b.centerX() + bw * 1.8f, cyB + bh / 2)
                c.drawRoundRect(tmp, bw / 2, bw / 2, fill)
            } else {
                val l = b.left + b.width() * 0.26f
                val rgt = b.right - b.width() * 0.26f
                listOf(-0.18f, 0f, 0.18f).forEachIndexed { k, f ->
                    val yy = cyB + b.height() * f
                    c.drawLine(l, yy, rgt, yy, stroke)
                    c.drawCircle(l + (rgt - l) * listOf(0.7f, 0.3f, 0.55f)[k], yy, 3.5f * dp, fill)
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
        val bw = lines.maxOf { body.measureText(it) } + 44 * dp
        val bh = lines.size * 24 * dp + 30 * dp
        val cx = width / 2f
        val top = topBottom + 16 * dp
        helpBox.set(cx - bw / 2, top, cx + bw / 2, top + bh)
        chunky(c, helpBox, cream, false, 18 * dp, 6 * dp)
        body.color = ink
        lines.forEachIndexed { k, line -> c.drawText(line, cx, top + 30 * dp + k * 24 * dp, body) }
    }

    private fun ordinal(n: Int): String {
        val v = n % 100
        val suffix = if (v in 11..13) "th" else when (n % 10) { 1 -> "st"; 2 -> "nd"; 3 -> "rd"; else -> "th" }
        return "$n$suffix"
    }
}
