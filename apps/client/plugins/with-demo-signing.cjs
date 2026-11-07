const {
  withAppBuildGradle,
  withProjectBuildGradle,
} = require("expo/config-plugins");
module.exports = function withDemoSigning(config) {
  config = withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("CMAKE_OBJECT_PATH_MAX")) {
      config.modResults.contents =
        `
// Keep C++ object paths within Windows toolchain limits.
subprojects { project ->
    ['com.android.library', 'com.android.application'].each { pluginId ->
        project.plugins.withId(pluginId) {
            project.android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_JOB_POOLS=compile=2;link=1')
            project.android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_JOB_POOL_COMPILE=compile')
            project.android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_JOB_POOL_LINK=link')
            if (project.name == 'app') {
                project.android.externalNativeBuild.cmake.buildStagingDirectory = new File(rootProject.projectDir, '../../../.native-app')
                project.android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_OBJECT_PATH_MAX=250')
            } else {
                project.android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_OBJECT_PATH_MAX=220')
            }
        }
    }
}
` + config.modResults.contents;
    }
    return config;
  });
  // EAS supplies its own signing configuration. The local build script sets
  // this variable only when our private demo keystore is available.
  if (!process.env.UDYAM_KEYSTORE) return config;
  return withAppBuildGradle(config, (config) => {
    const content = config.modResults.contents;
    if (!content.includes("UDYAM_KEYSTORE")) {
      config.modResults.contents = content
        .replace(
          "signingConfigs {",
          `signingConfigs {
        demoRelease {
            storeFile file(System.getenv("UDYAM_KEYSTORE") ?: "missing-demo.keystore")
            storePassword System.getenv("UDYAM_STORE_PASSWORD") ?: ""
            keyAlias "udyam"
            keyPassword System.getenv("UDYAM_STORE_PASSWORD") ?: ""
        }
      `,
        )
        .replace(
          /(release\s*\{[\s\S]*?)signingConfig signingConfigs.debug/,
          "$1signingConfig signingConfigs.demoRelease",
        );
    }
    return config;
  });
};
