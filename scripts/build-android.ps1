$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$client = Join-Path $workspace 'apps/client'
$env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
$env:PATH = "$env:JAVA_HOME/bin;$env:ANDROID_HOME/platform-tools;$env:PATH"
$env:NODE_ENV = 'production'
$env:CI = '1'
$env:GRADLE_USER_HOME = Join-Path $workspace '.runtime/gradle'
$privateDir = Join-Path $workspace '.runtime/signing'
New-Item -ItemType Directory -Force $privateDir | Out-Null
$env:UDYAM_KEYSTORE = Join-Path $privateDir 'demo.keystore'
$passwordPath = Join-Path $privateDir 'password'
if (-not (Test-Path -LiteralPath $passwordPath)) {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  [IO.File]::WriteAllText($passwordPath, [Convert]::ToBase64String($bytes))
}
$env:UDYAM_STORE_PASSWORD = [IO.File]::ReadAllText($passwordPath)
if (-not (Test-Path -LiteralPath $env:UDYAM_KEYSTORE)) {
  & "$env:JAVA_HOME/bin/keytool.exe" -genkeypair -v -storetype PKCS12 -keystore $env:UDYAM_KEYSTORE -alias udyam -keyalg RSA -keysize 2048 -validity 3650 -storepass:env UDYAM_STORE_PASSWORD -keypass:env UDYAM_STORE_PASSWORD -dname 'CN=Udyam Digital Demo, O=Prototype, C=IN'
  if ($LASTEXITCODE -ne 0) { throw 'Signing key generation failed' }
}
Push-Location $client
try {
  npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed' }
  Push-Location android
  try {
    ./gradlew.bat assembleRelease --no-daemon --max-workers=2 '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a' '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed' }
  } finally { Pop-Location }
  $artifacts = Join-Path $workspace 'artifacts'
  New-Item -ItemType Directory -Force $artifacts | Out-Null
  Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination (Join-Path $artifacts 'Udyam-Digital.apk') -Force
} finally { Pop-Location; Remove-Item Env:UDYAM_STORE_PASSWORD -ErrorAction SilentlyContinue }
