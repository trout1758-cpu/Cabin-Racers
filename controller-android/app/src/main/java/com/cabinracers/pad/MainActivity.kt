package com.cabinracers.pad

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity(), BleControllerServer.Listener, PadView.Listener {

    private lateinit var config: PadConfig
    private lateinit var view: PadView
    private lateinit var server: BleControllerServer
    private lateinit var tilt: TiltSensor
    private var vibrator: Vibrator? = null
    private var seq = 0
    private var askedToEnableBluetooth = false
    private var permissionDenied = false
    private var lastBackPress = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        config = PadConfig(getSharedPreferences("pad", MODE_PRIVATE))
        view = PadView(this, config)
        view.listener = this
        setContentView(view)

        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Vibrator::class.java)
        }
        tilt = TiltSensor(this, { displayRotation() }) { view.setTilt(it) }
        server = BleControllerServer(this, this)
        val filter = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(bluetoothStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(bluetoothStateReceiver, filter)
        }
    }

    @Suppress("DEPRECATION")
    private fun displayRotation(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display?.rotation ?: 0 else windowManager.defaultDisplay.rotation

    override fun onStart() {
        super.onStart()
        startIfPossible()
    }

    override fun onResume() {
        super.onResume()
        goImmersive()
        tilt.start()
    }

    override fun onPause() {
        super.onPause()
        tilt.stop()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goImmersive()
    }

    override fun onStop() {
        super.onStop()
        server.stop()
    }

    override fun onDestroy() {
        super.onDestroy()
        runCatching { unregisterReceiver(bluetoothStateReceiver) }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val now = SystemClock.uptimeMillis()
        if (now - lastBackPress < 2000) {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        } else {
            lastBackPress = now
            Toast.makeText(this, "Press back again to close the controller", Toast.LENGTH_SHORT).show()
        }
    }

    private fun goImmersive() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                )
        }
    }

    // ---- permissions & Bluetooth ------------------------------------------------------------

    private fun requiredPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            emptyArray()
        }

    private fun hasPermissions() = requiredPermissions().all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

    private fun startIfPossible() {
        if (server.isRunning) return
        if (!hasPermissions()) {
            if (!permissionDenied) requestPermissions(requiredPermissions(), REQ_PERMISSIONS)
            else onStatus(BleControllerServer.Status.Error("Bluetooth permission is needed to talk to the game."))
            return
        }
        val adapter = getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter != null && !adapter.isEnabled) {
            if (!askedToEnableBluetooth) {
                askedToEnableBluetooth = true
                runCatching {
                    @Suppress("DEPRECATION")
                    startActivityForResult(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), REQ_ENABLE_BT)
                }
            }
            onStatus(BleControllerServer.Status.Error("Bluetooth is off. Turn it on to connect."))
            return
        }
        server.start()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_PERMISSIONS) return
        if (grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
            permissionDenied = false
            startIfPossible()
        } else {
            permissionDenied = true
            onStatus(BleControllerServer.Status.Error("Bluetooth permission is needed to talk to the game."))
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_ENABLE_BT) startIfPossible()
    }

    private val bluetoothStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)) {
                BluetoothAdapter.STATE_ON -> startIfPossible()
                BluetoothAdapter.STATE_TURNING_OFF, BluetoothAdapter.STATE_OFF -> {
                    if (server.isRunning) server.stop()
                    onStatus(BleControllerServer.Status.Error("Bluetooth is off. Turn it on to connect."))
                }
            }
        }
    }

    // ---- BleControllerServer.Listener ------------------------------------------------------------

    override fun onStatus(status: BleControllerServer.Status) {
        view.setConnection(status)
        if (status is BleControllerServer.Status.Connected) {
            rumble(80, 160)
            onControlsChanged()
        }
    }

    override fun onFeedback(bytes: ByteArray) {
        when (val fb = Protocol.parseFeedback(bytes)) {
            is Feedback.Assign -> {
                view.setAssigned(fb.playerIndex, fb.color)
                rumble(120, 200)
            }
            is Feedback.Rumble -> rumble(fb.durationMs, fb.amplitude)
            is Feedback.Status -> view.setRaceStatus(fb.status)
            null -> Unit
        }
    }

    // ---- PadView.Listener ----------------------------------------------------------------------

    override fun onControlsChanged() {
        seq = (seq + 1) and 0xff
        server.update(Protocol.encode(view.state, seq))
    }

    override fun onRetryRequested() {
        if (!hasPermissions() && permissionDenied) {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
            return
        }
        permissionDenied = false
        askedToEnableBluetooth = false
        if (server.isRunning) server.stop()
        startIfPossible()
    }

    /** Controls settings: layout, what each zone does, tilt, auto-gas, vibration. */
    override fun onSettingsRequested() {
        val dp = resources.displayMetrics.density
        val pad = (20 * dp).toInt()
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, (8 * dp).toInt(), pad, pad)
        }
        fun heading(text: String) = TextView(this).apply {
            this.text = text
            textSize = 15f
            setPadding(0, (14 * dp).toInt(), 0, (4 * dp).toInt())
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }

        // layout preset
        box.addView(heading("Screen layout"))
        val layoutSpinner = Spinner(this)
        layoutSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, Layout.entries.map { it.label })
        layoutSpinner.setSelection(config.layout.ordinal)
        box.addView(layoutSpinner)

        // per-zone actions (rebuilt when the layout changes)
        box.addView(heading("What each zone does"))
        val zoneBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        box.addView(zoneBox)
        val actionLabels = Action.entries.map { it.label }
        var actions = config.actions.toMutableList()
        fun buildZones(layout: Layout) {
            zoneBox.removeAllViews()
            layout.zones.forEachIndexed { i, (r, _) ->
                val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                row.addView(TextView(this).apply {
                    text = zoneName(r)
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                })
                val sp = Spinner(this)
                sp.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, actionLabels)
                sp.setSelection(actions[i].ordinal)
                sp.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                    override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                        actions[i] = Action.entries[pos]
                    }
                    override fun onNothingSelected(p: AdapterView<*>?) {}
                }
                row.addView(sp)
                zoneBox.addView(row)
            }
        }
        buildZones(config.layout)

        // steering
        box.addView(heading("Steering"))
        val tiltSwitch = Switch(this).apply { text = "Tilt the phone to steer"; isChecked = config.tilt }
        box.addView(tiltSwitch)
        val rangeLabel = TextView(this)
        var range = config.tiltRange
        fun updateRange() { rangeLabel.text = "Full lock at ${range.toInt()}° of tilt" }
        updateRange()
        box.addView(rangeLabel)
        box.addView(SeekBar(this).apply {
            max = 45
            progress = (range - 15).toInt()
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(s: SeekBar?, p: Int, fromUser: Boolean) { range = 15f + p; updateRange() }
                override fun onStartTrackingTouch(s: SeekBar?) {}
                override fun onStopTrackingTouch(s: SeekBar?) {}
            })
        })
        val invert = Switch(this).apply { text = "Invert tilt"; isChecked = config.tiltInvert }
        box.addView(invert)
        var center = config.tiltCenter
        val centerLabel = TextView(this).apply { text = "Centre: ${center.toInt()}°" }
        box.addView(Button(this).apply {
            text = "Calibrate: hold the phone straight, then tap"
            setOnClickListener {
                center = view.currentTilt
                centerLabel.text = "Centre: ${center.toInt()}°"
            }
        })
        box.addView(centerLabel)

        // other
        box.addView(heading("Other"))
        val autoGas = Switch(this).apply { text = "Auto-accelerate (brake + steer to drift)"; isChecked = config.autoGas }
        box.addView(autoGas)
        val haptics = Switch(this).apply { text = "Vibration"; isChecked = config.haptics }
        box.addView(haptics)

        layoutSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                val l = Layout.entries[pos]
                if (l != config.layout || actions.size != l.zones.size) {
                    actions = l.zones.map { it.second }.toMutableList()
                    tiltSwitch.isChecked = l.tilt
                }
                buildZones(l)
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }

        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("Controls")
            .setView(ScrollView(this).apply { addView(box) })
            .setPositiveButton("Done") { _, _ ->
                config.layout = Layout.entries[layoutSpinner.selectedItemPosition]
                config.actions = actions
                config.tilt = tiltSwitch.isChecked
                config.tiltRange = range
                config.tiltInvert = invert.isChecked
                config.tiltCenter = center
                config.autoGas = autoGas.isChecked
                config.haptics = haptics.isChecked
                config.save()
                view.configChanged()
            }
            .setNeutralButton("Reset to default") { _, _ ->
                config.applyLayout(Layout.CLASSIC)
                config.tiltRange = 30f
                config.tiltInvert = false
                config.tiltCenter = 0f
                config.autoGas = false
                config.save()
                view.configChanged()
            }
            .setNegativeButton("Cancel", null)
            .setOnDismissListener { goImmersive() }
            .show()
    }

    private fun zoneName(r: android.graphics.RectF): String {
        val h = when {
            r.right <= 0.34f -> "Left"
            r.left >= 0.66f -> "Right"
            r.right <= 0.5f -> if (r.width() < 0.3f) "Left" else "Left half"
            r.left >= 0.5f -> if (r.width() < 0.3f) "Right" else "Right half"
            else -> "Middle"
        }
        val v = when {
            r.height() > 0.9f -> ""
            r.top < 0.1f -> " top"
            else -> " bottom"
        }
        val side = if (r.width() < 0.3f && r.right <= 0.5f) {
            if (r.left < 0.1f) "Far left" else "Inner left"
        } else {
            h
        }
        return side + v
    }

    private fun rumble(ms: Long, amplitude: Int) {
        val v = vibrator ?: return
        if (!config.haptics || !v.hasVibrator()) return
        val amp = if (v.hasAmplitudeControl()) amplitude.coerceIn(1, 255) else VibrationEffect.DEFAULT_AMPLITUDE
        runCatching { v.vibrate(VibrationEffect.createOneShot(ms.coerceIn(5, 2000), amp)) }
    }

    companion object {
        private const val REQ_PERMISSIONS = 1
        private const val REQ_ENABLE_BT = 2
    }
}
