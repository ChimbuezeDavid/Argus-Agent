const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to inject the Notification Listener Service
 * and Accessibility RPA Service directly into AndroidManifest.xml.
 */
function withNotificationService(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const resXmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      if (!fs.existsSync(resXmlDir)) {
        fs.mkdirSync(resXmlDir, { recursive: true });
      }
      const ellaXmlPath = path.join(resXmlDir, 'ella_voice_interaction_service.xml');
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<voice-interaction-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:sessionService="com.argus.agent.monitors.EllaVoiceInteractionSessionService"
    android:recognitionService="com.argus.agent.monitors.ArgusVoiceDaemonService"
    android:supportsAssist="true"
    android:supportsLocalInteraction="true" />
`;
      fs.writeFileSync(ellaXmlPath, xmlContent, 'utf8');
      return config;
    },
  ]);

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

    // 4. Ella Voice Interaction Assistant Services (Transparent Overlay like Bixby)
    const ellaVoiceServiceClass = 'com.argus.agent.monitors.EllaVoiceInteractionService';
    const ellaVoiceExists = mainApplication.service.some(
      (service) => service.$['android:name'] === ellaVoiceServiceClass
    );
    if (!ellaVoiceExists) {
      mainApplication.service.push({
        $: {
          'android:name': ellaVoiceServiceClass,
          'android:label': 'Ella Voice Assistant',
          'android:permission': 'android.permission.BIND_VOICE_INTERACTION',
          'android:exported': 'true',
        },
        'meta-data': [
          {
            $: {
              'android:name': 'android.voice_interaction',
              'android:resource': '@xml/ella_voice_interaction_service',
            },
          },
        ],
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.voice.VoiceInteractionService',
                },
              },
            ],
          },
        ],
      });
    }

    const ellaSessionServiceClass = 'com.argus.agent.monitors.EllaVoiceInteractionSessionService';
    const ellaSessionExists = mainApplication.service.some(
      (service) => service.$['android:name'] === ellaSessionServiceClass
    );
    if (!ellaSessionExists) {
      mainApplication.service.push({
        $: {
          'android:name': ellaSessionServiceClass,
          'android:permission': 'android.permission.BIND_VOICE_INTERACTION',
          'android:exported': 'true',
        },
      });
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
