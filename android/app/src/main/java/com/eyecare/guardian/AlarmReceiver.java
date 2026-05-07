package com.eyecare.guardian;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class AlarmReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "eyecare-alert";

    @Override
    public void onReceive(Context context, Intent intent) {
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String alertMode = intent.getStringExtra("alertMode");
        int vibrateCount = intent.getIntExtra("vibrateCount", 3);

        if (title == null) title = "护眼小卫士";
        if (body == null) body = "该休息一下眼睛了！";
        if (alertMode == null) alertMode = "both";

        createNotificationChannel(context);

        Intent openIntent = context.getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (openIntent != null) {
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        } else {
            openIntent = new Intent();
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, openIntent, flags
        );

        // 根据 alertMode 配置通知
        int defaults = 0;
        boolean playSound = alertMode.equals("sound") || alertMode.equals("both");
        boolean doVibrate = alertMode.equals("vibrate") || alertMode.equals("both");

        if (playSound) {
            defaults |= NotificationCompat.DEFAULT_SOUND;
        }
        // 不设置 DEFAULT_VIBRATE，用自定义振动代替

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(defaults)
            .setVibrate(null); // 用自定义振动

        NotificationManagerCompat.from(context).notify(991, builder.build());

        // 自定义振动
        if (doVibrate) {
            vibrateCustom(context, vibrateCount);
        }
    }

    private void vibrateCustom(Context context, int count) {
        try {
            // 构建振动模式：[delay, on, off, on, off, ...]
            long[] pattern = new long[1 + count * 2];
            pattern[0] = 0; // 立即开始
            for (int i = 0; i < count; i++) {
                pattern[1 + i * 2] = 300;     // 振动 300ms
                pattern[1 + i * 2 + 1] = 500;  // 暂停 500ms
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    Vibrator v = vm.getDefaultVibrator();
                    v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                }
            } else {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    v.vibrate(VibrationEffect.createWaveform(pattern, -1));
                }
            }
        } catch (Exception e) { /* ignore */ }
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "护眼提醒",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("休息提醒通知");
            channel.setSound(soundUri, attrs);
            channel.enableVibration(false); // 我们用自定义振动

            NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
