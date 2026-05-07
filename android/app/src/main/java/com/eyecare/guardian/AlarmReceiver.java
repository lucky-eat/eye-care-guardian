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
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class AlarmReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "eyecare-alert-v2";

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

        boolean playSound = alertMode.equals("sound") || alertMode.equals("both");
        boolean doVibrate = alertMode.equals("vibrate") || alertMode.equals("both");

        // 构建振动模式（绑定在通知上，不受 BroadcastReceiver 生命周期限制）
        long[] vibratePattern = null;
        if (doVibrate && vibrateCount > 0) {
            vibratePattern = new long[1 + vibrateCount * 2];
            vibratePattern[0] = 0; // 立即开始
            for (int i = 0; i < vibrateCount; i++) {
                vibratePattern[1 + i * 2] = 300;      // 振动 300ms
                vibratePattern[1 + i * 2 + 1] = 500;   // 间隔 500ms
            }
        }

        int defaults = playSound ? NotificationCompat.DEFAULT_SOUND : 0;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(defaults)
            .setVibrate(vibratePattern);  // null = 不振动, pattern = 自定义次数

        NotificationManagerCompat.from(context).notify(991, builder.build());
    }

    private void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            // 删除旧渠道（v1），强制用新配置重建
            manager.deleteNotificationChannel("eyecare-alert");

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
            channel.enableVibration(true);
            channel.setVibrationPattern(null); // 由每条通知的 setVibrate 控制

            manager.createNotificationChannel(channel);
        }
    }
}
