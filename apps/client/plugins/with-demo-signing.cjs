const { withAppBuildGradle } = require('expo/config-plugins');
module.exports = function withDemoSigning(config) {
  return withAppBuildGradle(config, config => {
    const content = config.modResults.contents;
    if (!content.includes('UDYAM_KEYSTORE')) {
      config.modResults.contents = content.replace('signingConfigs {', `signingConfigs {
        demoRelease {
            storeFile file(System.getenv("UDYAM_KEYSTORE") ?: "missing-demo.keystore")
            storePassword System.getenv("UDYAM_STORE_PASSWORD") ?: ""
            keyAlias "udyam"
            keyPassword System.getenv("UDYAM_STORE_PASSWORD") ?: ""
        }
      `).replace(/(release\s*\{[\s\S]*?)signingConfig signingConfigs.debug/, '$1signingConfig signingConfigs.demoRelease');
    }
    return config;
  });
};
