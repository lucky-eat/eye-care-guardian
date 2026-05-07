# 护眼小卫士 — Eye Care Guardian

## Overview

Android app (APK) that reminds users to rest their eyes at configurable intervals.
Targets **Huawei 鸿蒙 4.2** devices. Built with **Capacitor.js** (HTML/CSS/JS in WebView + native Android plugins).

## Key Architecture Decision

The app MUST fire alerts when the phone is **locked and screen is off** (user starts timer, puts phone down, goes to study/work). JavaScript `setInterval` is frozen when the WebView is backgrounded on Android, so a **native Android AlarmReceiver** was built to handle background notifications.

## Alert Flow (Background/Locked Screen)

```
JS startTimer()
  → Notif.schedule(seconds, title, body, alertMode, vibrateCount)
    → AlarmPlugin.schedule() [native Java Capacitor plugin]
      → Android AlarmManager.setExactAndAllowWhileIdle()
        → AlarmReceiver.onReceive() [native BroadcastReceiver]
          → Builds notification with setVibrate(pattern)
          → Respects alertMode: 'vibrate'/'sound'/'both'
          → Respects vibrateCount: custom N-buzz pattern
```

**Critical**: The native `AlarmReceiver` does NOT depend on WebView, Capacitor bridge, or JS runtime. It fires purely from the Android system AlarmManager.

## File Map

```
20s/
├── www/                          # Web app (source for Capacitor WebView)
│   ├── index.html                # Single-page app: main timer, alert overlay, DND page, settings
│   ├── css/style.css             # Mobile-first responsive styles, warm orange theme
│   └── js/
│       ├── app.js                # Entry point, page navigation, daily startup check
│       ├── timer.js              # Countdown logic, start/pause/resume/stop, calls Notif.schedule()
│       ├── notifications.js      # Foreground alert overlay, sound/vibration, auto-restart countdown
│       ├── dnd.js                # Do Not Disturb: scheduled (recurring) + quick (one-shot)
│       ├── settings.js           # localStorage persistence, settings defaults
│       ├── stats.js              # Daily rest counter
│       ├── tips.js               # Eye care tips pool (Chinese)
│       └── bridge.js             # JS→native bridge: Notif object wrapping AlarmPlugin
├── android/                      # Android native project (Capacitor-generated)
│   └── app/src/main/
│       ├── AndroidManifest.xml   # Permissions: POST_NOTIFICATIONS, USE_EXACT_ALARM, etc.
│       └── java/com/eyecare/guardian/
│           ├── MainActivity.java         # Registers AlarmPlugin
│           ├── AlarmPlugin.java          # Capacitor plugin: schedule/cancel alarms
│           └── AlarmReceiver.java        # BroadcastReceiver: shows notification + vibration
├── capacitor.config.ts           # appId: com.eyecare.guardian, webDir: www
├── package.json                  # Capacitor 8, Node >=22
└── .github/workflows/build-apk.yml  # CI: builds APK on push
```

## Settings (localStorage key: `eyecare_settings`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| selectedMinutes | int | 20 | Timer duration |
| alertMode | string | both | 'vibrate' / 'sound' / 'both' |
| vibrateCount | int | 3 | 1-10 vibration buzzes |
| dndEnabled | bool | false | Scheduled DND switch |
| dndStart | string | 23:00 | Scheduled DND start time |
| dndEnd | string | 09:00 | Scheduled DND end time |
| startupMode | string | scheduled | 'scheduled' / 'detect' |
| dailyStartupTime | string | 09:00 | Daily startup notification time |
| autoRestart | bool | false | Auto-restart timer after rest |
| restDuration | int | 20 | Rest countdown seconds (10-120) |

## DND Architecture

Two independent DND types, both checked by `isInDNDPeriod()`:

1. **Scheduled DND** — stored in `eyecare_settings.dndEnabled/dndStart/dndEnd`. Daily recurring time range.
2. **Quick DND** — stored in `eyecare_quick_dnd` as `{start: ISO, until: ISO}`. One-shot with cancel button on main page banner. Types: 'tonight' (22:00→08:00), 'nap' (now→13:30), 'movie' (now+2h).

## Known Platform Issues (鸿蒙 4.2)

1. **Battery optimization**: App MUST be whitelisted in 设置→应用→应用启动管理→手动管理 (all 3 toggles ON)
2. **Notification permissions**: Grant POST_NOTIFICATIONS on first launch
3. **USE_EXACT_ALARM**: Android 14+ denies this by default. AlarmPlugin falls back to inexact `set()` if `setExactAndAllowWhileIdle` throws SecurityException
4. **Notification channel**: Must delete old channel before recreating with new settings (Android caches channels). Current channel ID: `eyecare-alert-v2`

## CI/CD

- GitHub Actions at `lucky-eat/eye-care-guardian`
- Triggers on push to `master`
- Build requirements: Node 22, JDK 21, Android SDK 36
- Output: `app-debug.apk` as artifact
- Important: `variables.gradle` must keep `compileSdkVersion = 36` and `targetSdkVersion = 36` to match AndroidX dependencies

## Dev Testing

- Browser: `npm run dev` → http://localhost:3000 (no native features, no background alerts)
- APK: Download from GitHub Actions, sideload onto phone
- Before testing APK: **uninstall previous version first** (notification channels persist across updates)

## Test Checklist

- [ ] Start timer → lock phone → alert fires with correct vibration count at correct time
- [ ] DND: scheduled range + quick DND both suppress alerts
- [ ] Quick DND: cancel button on banner works
- [ ] Auto-restart: silence alert → rest countdown → timer auto-starts
- [ ] Daily startup notification fires at set time
- [ ] Presets 20/30/45 + custom duration work
- [ ] Alert mode: vibrate-only, sound-only, both all work
