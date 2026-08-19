const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to inject the Notification Listener Service
 * directly into the AndroidManifest.xml during the prebuild phase.
 */
function withNotificationService(config) {
  return withAndroidManifest(config, async (config) => {
    let androidManifest = config.modResults;
    let mainApplication = androidManifest.manifest.application[0];

    // Ensure the services tag array exists under application
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    // 1. Notification Listener Service
    const notificationServiceClass = 'com.argus.agent.monitors.ArgusNotificationListenerService';
    const notifServiceExists = mainApplication.service.some(
      (service) => service.$['android:name'] === notificationServiceClass
    );

    if (!notifServiceExists) {
      mainApplication.service.push({
        $: {
          'android:name': notificationServiceClass,
          'android:label': 'Argus Notification Interceptor',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
      console.log(`[Config Plugin] Injected ${notificationServiceClass} into AndroidManifest.xml`);
    }

    return config;
  });
}

module.exports = withNotificationService;
