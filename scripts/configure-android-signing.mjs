#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const gradlePath = path.join(rootDir, "android", "app", "build.gradle");

if (!fs.existsSync(gradlePath)) {
  console.error(`build.gradle not found at ${gradlePath}`);
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, "utf8");

const keystoreLoader = `def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;

if (!gradle.includes('keystorePropertiesFile = rootProject.file("keystore.properties")')) {
  const marker = "def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'";
  if (!gradle.includes(marker)) {
    console.error("Unable to locate jscFlavor marker while configuring signing.");
    process.exit(1);
  }
  gradle = gradle.replace(marker, `${marker}\n\n${keystoreLoader.trimEnd()}`);
}

const signingConfigsRegex =
  /signingConfigs\s*\{\s*debug\s*\{[\s\S]*?keyPassword\s+'android'\s*\}\s*\}/m;
const releaseSigningConfig = `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (!keystorePropertiesFile.exists()) {
                throw new GradleException("Missing android/keystore.properties for release signing")
            }
            storeFile file(keystoreProperties['MYAPP_UPLOAD_STORE_FILE'])
            storePassword keystoreProperties['MYAPP_UPLOAD_STORE_PASSWORD']
            keyAlias keystoreProperties['MYAPP_UPLOAD_KEY_ALIAS']
            keyPassword keystoreProperties['MYAPP_UPLOAD_KEY_PASSWORD']
        }
    }`;

if (!signingConfigsRegex.test(gradle)) {
  console.error("Unable to locate signingConfigs block while configuring signing.");
  process.exit(1);
}
gradle = gradle.replace(signingConfigsRegex, releaseSigningConfig);

const releaseBuildTypeRegex = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/m;
if (!releaseBuildTypeRegex.test(gradle)) {
  console.error("Unable to locate release signingConfig while configuring signing.");
  process.exit(1);
}
gradle = gradle.replace(releaseBuildTypeRegex, "$1signingConfigs.release");

fs.writeFileSync(gradlePath, gradle, "utf8");
console.log(`Configured production release signing in ${gradlePath}`);
