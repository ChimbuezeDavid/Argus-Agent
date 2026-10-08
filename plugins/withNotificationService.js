const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to inject the Notification Listener Service
 * and Accessibility RPA Service directly into AndroidManifest.xml.
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

    // 2. Accessibility RPA Autonomous Screen Service
    const accessibilityServiceClass = 'com.argus.agent.monitors.ArgusAccessibilityService';
    const accessServiceExists = mainApplication.service.some(
      (service) => service.$['android:name'] === accessibilityServiceClass
    );

    if (!accessServiceExists) {
      mainApplication.service.push({
        $: {
          'android:name': accessibilityServiceClass,
          'android:label': 'Argus Autonomous RPA Controller',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.accessibilityservice.AccessibilityService',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.accessibilityservice',
              'android:resource': '@xml/accessibility_service_config',
            },
          },
        ],
      });
      console.log(`[Config Plugin] Injected ${accessibilityServiceClass} into AndroidManifest.xml`);
    }

    // 3. Persistent Voice Daemon Service (Foreground Service with Microphone)
    const voiceDaemonServiceClass = 'com.argus.agent.monitors.ArgusVoiceDaemonService';
    const voiceDaemonExists = mainApplication.service.some(
      (service) => service.$['android:name'] === voiceDaemonServiceClass
    );

    if (!voiceDaemonExists) {
      mainApplication.service.push({
        $: {
          'android:name': voiceDaemonServiceClass,
          'android:label': 'Argus Voice Guard',
          'android:enabled': 'true',
          'android:foregroundServiceType': 'microphone',
          'android:stopWithTask': 'false',
          'android:process': ':daemon',
          'android:exported': 'false',
        },
      });
      console.log(`[Config Plugin] Injected ${voiceDaemonServiceClass} into AndroidManifest.xml`);
    }

    // Ensure receivers array exists
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    // 4. Boot Receiver
    const bootReceiverClass = 'com.argus.agent.monitors.ArgusBootReceiver';
    const bootReceiverExists = mainApplication.receiver.some(
      (receiver) => receiver.$['android:name'] === bootReceiverClass
    );

    if (!bootReceiverExists) {
      mainApplication.receiver.push({
        $: {
          'android:name': bootReceiverClass,
          'android:enabled': 'true',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
              { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
              { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
              { $: { 'android:name': 'com.htc.intent.action.QUICKBOOT_POWERON' } },
            ],
          },
        ],
      });
    }

    // 5. Restart Receiver
    const restartReceiverClass = 'com.argus.agent.monitors.ArgusRestartReceiver';
    const restartReceiverExists = mainApplication.receiver.some(
      (receiver) => receiver.$['android:name'] === restartReceiverClass
    );

    if (!restartReceiverExists) {
      mainApplication.receiver.push({
        $: {
          'android:name': restartReceiverClass,
          'android:enabled': 'true',
          'android:exported': 'false',
        },
      });
    }

    return config;
  });
}

module.exports = withNotificationService;
