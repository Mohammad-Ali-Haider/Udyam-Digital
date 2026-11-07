$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
# Native codegen resolves real paths, so a short physical staging directory is
# required on Windows. A subst drive mixes roots in Gradle's generated paths.
$buildRoot = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetPathRoot($env:TEMP)) 'ud-apk'))
$ownerFile = Join-Path $buildRoot '.udyam-source'
if ((Test-Path -LiteralPath $buildRoot) -and ((-not (Test-Path -LiteralPath $ownerFile)) -or [IO.File]::ReadAllText($ownerFile) -ne $workspace)) { throw 'Build staging directory belongs to another task' }
New-Item -ItemType Directory -Force $buildRoot | Out-Null
[IO.File]::WriteAllText($ownerFile,$workspace)
robocopy $workspace $buildRoot /E /XD node_modules .runtime artifacts android ios .expo dist .git .claude .vscode /XF '.env*' '*.log' /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -gt 7) { throw 'Could not stage Android sources' }
$client = Join-Path $buildRoot 'apps/client'
$env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
$env:PATH = "$env:JAVA_HOME/bin;$env:ANDROID_HOME/platform-tools;$env:PATH"
$env:NODE_ENV = 'production'
$env:CI = '1'
$env:GRADLE_USER_HOME = Join-Path $buildRoot '.gradle-cache'
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
Push-Location $buildRoot
try {
  $hasher = [Security.Cryptography.SHA256]::Create()
  $lockHash = [Convert]::ToBase64String($hasher.ComputeHash([IO.File]::ReadAllBytes((Join-Path $buildRoot 'package-lock.json'))))
  $hasher.Dispose()
  $hashPath = Join-Path $buildRoot '.installed-lock'
  if (-not (Test-Path -LiteralPath $hashPath) -or [IO.File]::ReadAllText($hashPath) -ne $lockHash) {
    npm ci --include=dev
    if ($LASTEXITCODE -ne 0) { throw 'Build dependency installation failed' }
    [IO.File]::WriteAllText($hashPath,$lockHash)
  }
} finally { Pop-Location }
Push-Location $client
try {
  npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed' }
  Push-Location android
  try {
    ./gradlew.bat :app:assembleRelease --no-daemon --max-workers=2 '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a' '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed' }
  } finally { Pop-Location }
  $artifacts = Join-Path $workspace 'artifacts'
  New-Item -ItemType Directory -Force $artifacts | Out-Null
  $apk = Join-Path $artifacts 'Udyam-Digital.apk'
  Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination $apk -Force
  $signer = Get-ChildItem -LiteralPath (Join-Path $env:ANDROID_HOME 'build-tools') -Directory | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'apksigner.bat' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $signer) { throw 'APK signature verifier not found' }
  & $signer verify --verbose $apk
  if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
  Write-Output "Release APK: $apk"
} finally { Pop-Location; Remove-Item Env:UDYAM_STORE_PASSWORD -ErrorAction SilentlyContinue }
