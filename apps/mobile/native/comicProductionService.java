package com.toonflow.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class comicProductionService extends Service {
  public static final String ACTION_START = "com.toonflow.mobile.action.PRODUCTION_START";
  public static final String ACTION_STOP = "com.toonflow.mobile.action.PRODUCTION_STOP";
  private static final String CHANNEL_ID = "comic_production";
  private static final int NOTIFICATION_ID = 41021;

  @Override
  public void onCreate() {
    super.onCreate();
    createNotificationChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      stopForeground(STOP_FOREGROUND_REMOVE);
      stopSelf();
      return START_NOT_STICKY;
    }
    startForeground(NOTIFICATION_ID, buildNotification());
    return START_STICKY;
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "Comic Factory background activity",
      NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription("Keeps the Toonflow local workspace available while you work in another app.");
    channel.setShowBadge(false);
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager != null) manager.createNotificationChannel(channel);
  }

  private Notification buildNotification() {
    Intent openIntent = new Intent(this, mobileActivity.class);
    openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent openPendingIntent = PendingIntent.getActivity(
      this, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      ? new Notification.Builder(this, CHANNEL_ID)
      : new Notification.Builder(this);
    return builder
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setContentTitle("Toonflow is running")
      .setContentText("Your workspace is kept available in the background.")
      .setContentIntent(openPendingIntent)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .build();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
