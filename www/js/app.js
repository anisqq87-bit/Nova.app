$ErrorActionPreference = "Stop"

$root = Join-Path (Get-Location) "Nova.app"
$zipPath = Join-Path (Get-Location) "Nova.app.zip"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

if (Test-Path $root) { Remove-Item $root -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

function Write-NovaFile {
    param(
        [string]$RelativePath,
        [string]$Content
    )
    $fullPath = Join-Path $root $RelativePath
    $dir = Split-Path -Parent $fullPath
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($fullPath, $Content.TrimStart("`r", "`n"), $utf8NoBom)
    Write-Host "Created: $RelativePath" -ForegroundColor Cyan
}

# 1. .github/workflows/build.yml
Write-NovaFile ".github/workflows/build.yml" @'
name: Build NOVA Android APK

on:
  push:
    branches:
      - main
      - master
  pull_request:
  workflow_dispatch:

jobs:
  build-android-apk:
    name: Build NOVA APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Setup Java 21 (Temurin)
        uses: actions/setup-java@v4
        with:
          distribution: "temurin"
          java-version: "21"

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Ensure Android SDK 36 Platform & Build-Tools
        run: |
          yes | sdkmanager --licenses > /dev/null 2>&1 || true
          sdkmanager "platforms;android-36" "build-tools;36.0.0"

      - name: Install npm dependencies
        run: npm install

      - name: Initialize & Sync Capacitor Android
        run: |
          if [ ! -d "android" ]; then
            npx cap add android
          fi
          npx cap sync android

      - name: Build Debug APK
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleDebug --no-daemon

      - name: Upload NOVA-APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: NOVA-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk
          if-no-files-found: error
'@

# 2. package.json
Write-NovaFile "package.json" @'
{
  "name": "nova-app",
  "version": "1.0.0",
  "description": "NOVA — Connect Beyond Limits. Next-generation global social media application.",
  "private": true,
  "scripts": {
    "cap:add": "npx cap add android",
    "cap:sync": "npx cap sync android",
    "build:apk": "cd android && ./gradlew assembleDebug"
  },
  "dependencies": {
    "@capacitor/android": "^8.6.2",
    "@capacitor/core": "^8.6.2"
  },
  "devDependencies": {
    "@capacitor/cli": "^8.6.2"
  }
}
'@

# 3. capacitor.config.json
Write-NovaFile "capacitor.config.json" @'
{
  "appId": "app.nova.social",
  "appName": "NOVA",
  "webDir": "www",
  "server": {
    "androidScheme": "https"
  },
  "android": {
    "backgroundColor": "#05070e",
    "allowMixedContent": false
  },
  "plugins": {
    "SystemBars": {
      "style": "DARK"
    }
  }
}
'@

# 4. www/manifest.json
Write-NovaFile "www/manifest.json" @'
{
  "name": "NOVA — Connect Beyond Limits",
  "short_name": "NOVA",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#05070e",
  "theme_color": "#05070e",
  "description": "Next-generation global social networking platform.",
  "icons": [
    {
      "src": "./icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
'@

# 5. www/icon.svg
Write-NovaFile "www/icon.svg" @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1A1238"/>
      <stop offset="100%" stop-color="#05070E"/>
    </radialGradient>
    <linearGradient id="novaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6"/>
      <stop offset="100%" stop-color="#00E5FF"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="110" fill="url(#bg)"/>
  <path d="M405 196 A168 168 0 1 1 285 95" fill="none" stroke="url(#novaGrad)" stroke-width="34" stroke-linecap="round"/>
  <path d="M256 116 Q282 230 396 256 Q282 282 256 396 Q230 282 116 256 Q230 230 256 116 Z" fill="url(#novaGrad)"/>
</svg>
'@

# 6. www/sw.js
Write-NovaFile "www/sw.js" @'
const CACHE = "nova-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        "./",
        "./index.html",
        "./css/style.css",
        "./js/app.js",
        "./manifest.json",
        "./icon.svg"
      ])
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
'@

# 7. www/index.html
Write-NovaFile "www/index.html" @'
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#05070e" />
  <meta name="mobile-web-app-capable" content="yes" />
  <title>NOVA — Connect Beyond Limits</title>
  <link rel="manifest" href="./manifest.json" />
  <link rel="icon" href="./icon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="./css/style.css" />
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>

<div class="phone-frame">
  <div class="notch"></div>
  <div id="toast" class="toast"></div>

  <!-- ===================================================================== -->
  <!-- SCREENS 1–4: WELCOME, LOGIN, SIGN UP, FORGOT PASSWORD                 -->
  <!-- ===================================================================== -->
  <div id="authShell">
    <div class="auth-glow-orb purple"></div>
    <div class="auth-glow-orb cyan"></div>

    <!-- 1. WELCOME SCREEN -->
    <section id="auth-welcome" class="auth-screen active">
      <div class="auth-top-row">
        <span style="font-size:11px; color:var(--muted); font-weight:700; letter-spacing:1px;">GLOBAL SOCIAL</span>
        <button id="backendStatusPill" class="backend-pill" onclick="openModal('supabaseConfigModal')">
          <span class="status-dot"></span>
          <span id="backendStatusText">Connect Supabase</span>
        </button>
      </div>

      <div class="welcome-center">
        <div class="welcome-logo-wrap">
          <svg width="74" height="74" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="novaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#8B5CF6"/>
                <stop offset="100%" stop-color="#00E5FF"/>
              </linearGradient>
            </defs>
            <path d="M84 36 A40 40 0 1 1 56 11" fill="none" stroke="url(#novaGrad)" stroke-width="8" stroke-linecap="round"/>
            <path d="M50 18 Q56 44 82 50 Q56 56 50 82 Q44 56 18 50 Q44 44 50 18 Z" fill="url(#novaGrad)"/>
          </svg>
        </div>
        <div class="welcome-title">NOVA</div>
        <div class="welcome-tagline">Connect Beyond Limits.</div>
        <p class="welcome-sub">A next-generation global social network built for futuristic creators, stories, and real connections.</p>
      </div>

      <div class="welcome-actions">
        <button class="primary-btn" onclick="showAuthScreen('signup')">Create Account</button>
        <button class="secondary-glow-btn" onclick="showAuthScreen('login')">Log In</button>
        <div class="divider-or">or continue with</div>
        <button class="google-btn" onclick="handleGoogleAuth()">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-2H12z"/>
          </svg>
          <span>Continue with Google</span>
        </button>
        <button class="preview-demo-link" onclick="enterUiPreviewMode()">Preview All 12 Screens (UI Demo Only — Not Logged In)</button>
      </div>
    </section>

    <!-- 2. LOGIN SCREEN -->
    <section id="auth-login" class="auth-screen">
      <div class="auth-top-row">
        <button class="icon-btn" onclick="showAuthScreen('welcome')">←</button>
        <svg width="28" height="28" viewBox="0 0 100 100">
          <path d="M84 36 A40 40 0 1 1 56 11" fill="none" stroke="url(#novaGrad)" stroke-width="8" stroke-linecap="round"/>
          <path d="M50 18 Q56 44 82 50 Q56 56 50 82 Q44 56 18 50 Q44 44 50 18 Z" fill="url(#novaGrad)"/>
        </svg>
      </div>
      <h2 class="auth-heading">Welcome Back</h2>
      <p class="auth-desc">Log in securely to your NOVA universe.</p>
      <div id="loginBanner" class="auth-banner"></div>
      <form onsubmit="handleLogin(event)" novalidate>
        <div class="field-group">
          <label class="field-label">Email Address</label>
          <input id="loginEmail" class="nova-field" type="email" placeholder="you@example.com" />
          <div id="errLoginEmail" class="field-error"></div>
        </div>
        <div class="field-group">
          <label class="field-label">Password</label>
          <div class="input-wrap">
            <input id="loginPass" class="nova-field with-eye" type="password" placeholder="Enter your password" />
            <button type="button" class="eye-btn" onclick="toggleEye('loginPass', this)">👁</button>
          </div>
          <div id="errLoginPass" class="field-error"></div>
        </div>
        <div class="auth-options-row">
          <label class="remember-lbl"><input type="checkbox" id="rememberMe" checked /><span>Remember me</span></label>
          <button type="button" class="link-btn" onclick="showAuthScreen('forgot')">Forgot password?</button>
        </div>
        <button id="loginSubmitBtn" type="submit" class="primary-btn"><span>Log In</span></button>
      </form>
      <div class="divider-or" style="margin:14px 0;">or</div>
      <button class="google-btn" onclick="handleGoogleAuth()"><span>Continue with Google</span></button>
      <div class="auth-switch">New to NOVA? <button class="link-btn" onclick="showAuthScreen('signup')">Sign Up</button></div>
    </section>

    <!-- 3. SIGN UP SCREEN -->
    <section id="auth-signup" class="auth-screen">
      <div class="auth-top-row">
        <button class="icon-btn" onclick="showAuthScreen('welcome')">←</button>
        <svg width="28" height="28" viewBox="0 0 100 100">
          <path d="M84 36 A40 40 0 1 1 56 11" fill="none" stroke="url(#novaGrad)" stroke-width="8" stroke-linecap="round"/>
          <path d="M50 18 Q56 44 82 50 Q56 56 50 82 Q44 56 18 50 Q44 44 50 18 Z" fill="url(#novaGrad)"/>
        </svg>
      </div>
      <h2 class="auth-heading">Create Account</h2>
      <p class="auth-desc">Sign up with your username, email &amp; profile photo.</p>
      <div id="regBanner" class="auth-banner"></div>
      <form onsubmit="handleRegister(event)" novalidate>
        <input type="file" id="regAvatarInput" accept="image/*" hidden onchange="previewRegAvatar(event)" />
        <div class="avatar-picker" onclick="document.getElementById('regAvatarInput').click()">
          <div class="avatar-picker-circle" id="regAvatarCircle">📷</div>
          <div>
            <div style="font-size:13px; font-weight:700;">Profile Photo <span style="color:var(--muted); font-weight:500;">(Optional)</span></div>
            <div style="font-size:11px; color:var(--cyan);">Tap to upload</div>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Full Name</label>
          <input id="regName" class="nova-field" type="text" placeholder="Amine Benali" />
          <div id="errRegName" class="field-error"></div>
        </div>
        <div class="field-group">
          <label class="field-label">Unique Username</label>
          <input id="regUsername" class="nova-field" type="text" placeholder="amine_nova" />
          <div id="errRegUser" class="field-error"></div>
        </div>
        <div class="field-group">
          <label class="field-label">Email Address</label>
          <input id="regEmail" class="nova-field" type="email" placeholder="you@example.com" />
          <div id="errRegEmail" class="field-error"></div>
        </div>
        <div class="field-group">
          <label class="field-label">Password</label>
          <div class="input-wrap">
            <input id="regPass" class="nova-field with-eye" type="password" placeholder="Min 8 characters" />
            <button type="button" class="eye-btn" onclick="toggleEye('regPass', this)">👁</button>
          </div>
          <div id="errRegPass" class="field-error"></div>
        </div>
        <div class="field-group">
          <label class="field-label">Confirm Password</label>
          <div class="input-wrap">
            <input id="regConfirm" class="nova-field with-eye" type="password" placeholder="Re-enter password" />
            <button type="button" class="eye-btn" onclick="toggleEye('regConfirm', this)">👁</button>
          </div>
          <div id="errRegConfirm" class="field-error"></div>
        </div>
        <button id="regSubmitBtn" type="submit" class="primary-btn" style="margin-top:6px;"><span>Create Account</span></button>
      </form>
      <div class="auth-switch">Already have an account? <button class="link-btn" onclick="showAuthScreen('login')">Log In</button></div>
    </section>

    <!-- 4. FORGOT PASSWORD SCREEN -->
    <section id="auth-forgot" class="auth-screen">
      <div class="auth-top-row"><button class="icon-btn" onclick="showAuthScreen('login')">←</button></div>
      <h2 class="auth-heading">Forgot Password</h2>
      <p class="auth-desc">Enter your email address to receive a recovery link.</p>
      <div id="forgotBanner" class="auth-banner"></div>
      <form onsubmit="handleForgotPassword(event)" novalidate>
        <div class="field-group">
          <label class="field-label">Email Address</label>
          <input id="forgotEmail" class="nova-field" type="email" placeholder="you@example.com" />
          <div id="errForgotEmail" class="field-error"></div>
        </div>
        <button id="forgotSubmitBtn" type="submit" class="primary-btn" style="margin-top:8px;"><span>Send Recovery Link</span></button>
      </form>
    </section>
  </div>

  <!-- ===================================================================== -->
  <!-- SCREENS 5–12: HOME, PROFILE, EXPLORE, CREATE, REELS, NOTIF, DM, SET   -->
  <!-- ===================================================================== -->
  <div id="appShell" class="hidden">
    <div id="previewModeBanner" class="preview-banner">
      <span>UI Preview Mode (Not Authenticated)</span>
      <button class="link-btn" style="font-size:10.5px;" onclick="exitToWelcome()">Sign In</button>
    </div>

    <header id="mainTopbar" class="topbar">
      <div class="brand" onclick="switchTab('home')">
        <svg width="30" height="30" viewBox="0 0 100 100">
          <path d="M84 36 A40 40 0 1 1 56 11" fill="none" stroke="url(#novaGrad)" stroke-width="8" stroke-linecap="round"/>
          <path d="M50 18 Q56 44 82 50 Q56 56 50 82 Q44 56 18 50 Q44 44 50 18 Z" fill="url(#novaGrad)"/>
        </svg>
        <span class="brand-title">NOVA</span>
      </div>
      <div class="top-actions">
        <button class="icon-btn" title="Notifications" onclick="switchTab('notifications')">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span id="notifDot" class="badge-dot"></span>
        </button>
        <button class="icon-btn" title="Private Messages" onclick="switchTab('messages')">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>
        </button>
      </div>
    </header>

    <main id="mainViewport" class="viewport">
      <!-- 5. HOME FEED -->
      <section id="screen-home" class="screen active">
        <div id="storiesRow" class="stories-row"></div>
        <div id="feedList"></div>
      </section>

      <!-- 6. USER PROFILE -->
      <section id="screen-profile" class="screen">
        <div class="profile-hero">
          <div class="profile-top">
            <input type="file" id="profileAvatarUpload" accept="image/*" hidden onchange="uploadNewProfilePhoto(event)" />
            <div class="profile-pic" onclick="document.getElementById('profileAvatarUpload').click()">
              <div class="profile-pic-inner" id="profileAvatarInner">Y</div>
            </div>
            <div>
              <div class="username-row"><span id="profileUsername">@you_nova</span> <span class="verified">✓</span></div>
              <div id="profileFullName" style="font-size:12px; color:var(--cyan); margin:3px 0 6px;">NOVA Member</div>
              <div id="profileBio" style="font-size:13px; color:#cbd5e1; line-height:1.4;">Designing tomorrow beyond limits. Digital creator &amp; explorer.</div>
            </div>
          </div>
          <div class="stats-row">
            <div><div class="stat-num" id="myPostsCount">3</div><div class="stat-lbl">Posts</div></div>
            <div><div class="stat-num">12.4K</div><div class="stat-lbl">Followers</div></div>
            <div><div class="stat-num" id="followingCount">1</div><div class="stat-lbl">Following</div></div>
          </div>
          <div class="profile-btns">
            <button class="ghost-btn" onclick="openModal('editProfileModal')">Edit Profile</button>
            <button class="ghost-btn" onclick="switchTab('settings')">Settings</button>
          </div>
        </div>
        <div class="chip-row" style="padding-top:4px;">
          <button class="chip active" onclick="setProfileTab('all', this)">My Posts</button>
          <button class="chip" onclick="setProfileTab('liked', this)">Liked</button>
        </div>
        <div id="profileGrid" class="profile-grid"></div>
      </section>

      <!-- 7. EXPLORE PAGE -->
      <section id="screen-explore" class="screen">
        <div class="search-wrap">
          <input id="exploreSearch" class="search-input" placeholder="Search @creators or #hashtags..." oninput="renderExplore()" />
        </div>
        <div class="chip-row">
          <button class="chip active" onclick="setExploreTag('all', this)">Trending</button>
          <button class="chip" onclick="setExploreTag('cyberpunk', this)">#cyberpunk</button>
          <button class="chip" onclick="setExploreTag('aiart', this)">#aiart</button>
          <button class="chip" onclick="setExploreTag('future', this)">#future</button>
          <button class="chip" onclick="setExploreTag('space', this)">#space</button>
        </div>
        <div id="exploreCreators"></div>
        <div id="exploreGrid" class="explore-grid"></div>
      </section>

      <!-- 8. CREATE POST PAGE -->
      <section id="screen-create" class="screen">
        <div class="create-box">
          <div class="seg-tabs">
            <button class="seg-btn active" onclick="setCreateType('post', this)">Post</button>
            <button class="seg-btn" onclick="setCreateType('reel', this)">Reel</button>
            <button class="seg-btn" onclick="setCreateType('story', this)">24h Story</button>
          </div>
          <input type="file" id="fileInput" accept="image/*" hidden onchange="handleFileUpload(event)" />
          <div class="upload-zone" id="uploadPreview" onclick="document.getElementById('fileInput').click()">
            <div style="font-size:28px; color:var(--cyan);">+</div>
            <div style="font-size:13px; color:var(--muted);">Tap to upload photo or choose a preset below</div>
          </div>
          <div class="preset-row" id="presetRow"></div>
          <textarea id="createCaption" class="nova-input" placeholder="Write your story or add #hashtags..."></textarea>
          <div class="ai-row">
            <button class="ai-pill" onclick="generateAI('caption')">✨ AI Caption</button>
            <button class="ai-pill" onclick="generateAI('hashtags')"># AI Hashtags</button>
          </div>
          <button class="primary-btn" id="publishBtn" onclick="publishPost()">Publish to NOVA</button>
        </div>
      </section>

      <!-- 9. REELS PAGE -->
      <section id="screen-reels" class="screen">
        <div id="reelsContainer"></div>
      </section>

      <!-- 10. NOTIFICATIONS PAGE -->
      <section id="screen-notifications" class="screen">
        <div class="subpage-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="icon-btn" onclick="goBackTab()">←</button>
            <span class="subpage-title">Notifications</span>
          </div>
          <button class="link-btn" onclick="markAllNotifsRead()">Mark all read</button>
        </div>
        <div class="chip-row" style="padding-top:12px;">
          <button class="chip active" onclick="setNotifFilter('all', this)">All</button>
          <button class="chip" onclick="setNotifFilter('like', this)">Likes</button>
          <button class="chip" onclick="setNotifFilter('comment', this)">Comments</button>
          <button class="chip" onclick="setNotifFilter('follow', this)">Follows</button>
        </div>
        <div id="notificationsList"></div>
      </section>

      <!-- 11. PRIVATE MESSAGES PAGE -->
      <section id="screen-messages" class="screen" style="height:100%;">
        <div id="chatInboxView">
          <div class="subpage-header">
            <div style="display:flex; align-items:center; gap:10px;">
              <button class="icon-btn" onclick="goBackTab()">←</button>
              <span class="subpage-title">Private Messages</span>
            </div>
          </div>
          <div class="search-wrap"><input id="dmSearch" class="search-input" placeholder="Search conversations..." oninput="renderChats()" /></div>
          <div id="chatList"></div>
        </div>
        <div id="chatThreadView" style="display:none; height:100%;">
          <div class="subpage-header">
            <div style="display:flex; align-items:center; gap:10px;">
              <button class="icon-btn" onclick="closeChatThread()">←</button>
              <div id="chatThreadAvatar" class="avatar-sm" style="width:34px;height:34px;"></div>
              <span id="chatThreadUser" class="subpage-title"></span>
            </div>
          </div>
          <div class="chat-thread-box">
            <div id="chatMessagesArea" class="chat-messages-area"></div>
            <div style="display:flex; gap:8px; align-items:center;">
              <input type="file" id="dmPhotoInput" accept="image/*" hidden onchange="sendDMPhoto(event)" />
              <button class="icon-btn" onclick="document.getElementById('dmPhotoInput').click()">📷</button>
              <input id="dmInput" class="search-input" placeholder="Type a message..." />
              <button class="follow-pill" onclick="sendDM()">Send</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 12. SETTINGS PAGE -->
      <section id="screen-settings" class="screen">
        <div class="subpage-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="icon-btn" onclick="switchTab('profile')">←</button>
            <span class="subpage-title">Settings &amp; Privacy</span>
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-label">ACCOUNT</div>
          <div class="settings-row" onclick="openModal('editProfileModal')"><span>Edit Profile &amp; Bio</span><span>→</span></div>
          <div class="settings-row" onclick="document.getElementById('profileAvatarUpload').click()"><span>Upload Profile Photo</span><span>📷</span></div>
          <div class="settings-row" onclick="openModal('supabaseConfigModal')"><span>Supabase Backend Config</span><span style="color:var(--cyan);">Configure</span></div>
        </div>
        <div class="settings-group">
          <div class="settings-label">PRIVACY &amp; SECURITY</div>
          <div class="settings-row"><span>Private Account</span><input type="checkbox" onchange="showToast('Privacy setting updated')" /></div>
          <div class="settings-row" onclick="showToast('No blocked users')"><span>Blocked Accounts</span><span>0</span></div>
        </div>
        <div class="settings-group">
          <div class="settings-label">LANGUAGE (RTL SUPPORT)</div>
          <div class="seg-tabs">
            <button class="seg-btn active" onclick="setLanguage('en', this)">English</button>
            <button class="seg-btn" onclick="setLanguage('ar', this)">العربية</button>
            <button class="seg-btn" onclick="setLanguage('fr', this)">Français</button>
          </div>
        </div>
        <button class="logout-btn" onclick="handleLogout()">Log Out of NOVA</button>
      </section>
    </main>

    <!-- Bottom Navigation -->
    <nav id="bottomNav" class="bottom-nav">
      <button class="nav-btn active" data-tab="home" onclick="switchTab('home')">
        <svg width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>
        <span data-i18n="home">Home</span>
      </button>
      <button class="nav-btn" data-tab="explore" onclick="switchTab('explore')">
        <svg width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span data-i18n="explore">Explore</span>
      </button>
      <button class="create-orb" onclick="switchTab('create')">+</button>
      <button class="nav-btn" data-tab="reels" onclick="switchTab('reels')">
        <svg width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="4"/><path d="m10 9 5 3-5 3z"/></svg>
        <span data-i18n="reels">Reels</span>
      </button>
      <button class="nav-btn" data-tab="profile" onclick="switchTab('profile')">
        <svg width="21" height="21" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
        <span data-i18n="profile">Profile</span>
      </button>
    </nav>
  </div>

  <!-- Modals -->
  <div id="supabaseConfigModal" class="modal-overlay" onclick="if(event.target===this) closeModal('supabaseConfigModal')">
    <div class="modal-sheet">
      <div style="font-weight:800; font-size:16px; margin-bottom:6px;">Supabase Backend Configuration</div>
      <div class="field-group"><label class="field-label">Supabase Project URL</label><input id="cfgUrl" class="nova-field" placeholder="https://your-project.supabase.co" /></div>
      <div class="field-group"><label class="field-label">Supabase Anon Public Key</label><input id="cfgKey" class="nova-field" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." /></div>
      <button class="primary-btn" onclick="saveSupabaseConfig()">Save &amp; Connect Backend</button>
    </div>
  </div>

  <div id="editProfileModal" class="modal-overlay" onclick="if(event.target===this) closeModal('editProfileModal')">
    <div class="modal-sheet">
      <div style="font-weight:800; font-size:16px; margin-bottom:12px;">Edit Profile</div>
      <div class="field-group"><label class="field-label">Full Name</label><input id="editFullName" class="nova-field" /></div>
      <div class="field-group"><label class="field-label">Username</label><input id="editUsername" class="nova-field" /></div>
      <div class="field-group"><label class="field-label">Bio</label><textarea id="bioInput" class="nova-input"></textarea></div>
      <div style="display:flex; gap:8px; margin:8px 0 14px;">
        <button class="ai-pill" onclick="generateAI('bio')">✨ AI Bio Generator</button>
        <button class="ai-pill" onclick="document.getElementById('profileAvatarUpload').click()">📷 Change Photo</button>
      </div>
      <button class="primary-btn" onclick="saveProfileEdits()">Save Profile Changes</button>
    </div>
  </div>

  <div id="commentsModal" class="modal-overlay" onclick="if(event.target===this) closeModal('commentsModal')">
    <div class="modal-sheet">
      <div style="font-weight:800; margin-bottom:12px;">Comments</div>
      <div id="commentsList" style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;"></div>
      <div style="display:flex; gap:8px;">
        <input id="commentInput" class="search-input" placeholder="Write a comment..." />
        <button class="follow-pill" onclick="submitComment()">Send</button>
      </div>
    </div>
  </div>

  <div id="storyViewer" class="story-viewer" onclick="closeStory()">
    <div class="story-progress"><div id="storyProgressFill" class="story-progress-fill"></div></div>
    <div style="padding:0 16px 12px; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center; gap:10px;">
        <div id="storyViewerAvatar" class="avatar-sm"></div>
        <div><div id="storyViewerUser" style="font-weight:700; font-size:14px;"></div><div style="font-size:11px; color:var(--muted);">Expires in 24h</div></div>
      </div>
      <span style="font-size:22px; color:#fff;">✕</span>
    </div>
    <div id="storyViewerBody" style="flex:1; display:flex; align-items:center; justify-content:center; padding:14px;"></div>
  </div>
</div>

<script src="./js/app.js"></script>
</body>
</html>
'@

# 8. www/css/style.css
Write-NovaFile "www/css/style.css" @'
:root {
  --obsidian: #05070e;
  --nebula: #0b1020;
  --slate: #131b33;
  --purple: #8b5cf6;
  --cyan: #00e5ff;
  --pink: #ec4899;
  --text: #f8fafc;
  --muted: #94a3b8;
  --grad: linear-gradient(135deg, #8b5cf6, #00e5ff);
  --border: rgba(255, 255, 255, 0.09);
}

* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

html, body {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--obsidian);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
}

body {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 20% 15%, rgba(139, 92, 246, 0.22), transparent 40%),
    radial-gradient(circle at 80% 85%, rgba(0, 229, 255, 0.18), transparent 40%),
    #020308;
}

.phone-frame {
  width: 396px;
  height: 820px;
  max-height: 94vh;
  background: var(--obsidian);
  border-radius: 46px;
  border: 2px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.85), 0 0 60px rgba(139, 92, 246, 0.22);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.notch {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  width: 112px; height: 26px; background: #020308; border-radius: 20px; z-index: 50;
  border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center;
}
.notch::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--cyan); box-shadow: 0 0 8px var(--cyan); }

/* Full-Screen Native Mode on Android Phones & APK WebView */
@media (max-width: 540px), (display-mode: standalone) {
  body { padding: 0; background: var(--obsidian); }
  .phone-frame {
    width: 100vw;
    height: 100dvh;
    max-height: none;
    border-radius: 0;
    border: none;
    box-shadow: none;
  }
  .notch { display: none; }
  .auth-screen { padding-top: calc(20px + env(safe-area-inset-top)) !important; }
  .topbar { padding-top: calc(14px + env(safe-area-inset-top)) !important; }
  .subpage-header { padding-top: calc(14px + env(safe-area-inset-top)) !important; }
  .bottom-nav { bottom: calc(12px + env(safe-area-inset-bottom)) !important; }
}

/* AUTH SCREENS */
#authShell {
  position: relative; flex: 1; display: flex; flex-direction: column; overflow-y: auto; scrollbar-width: none;
  background: radial-gradient(circle at 50% 18%, rgba(139, 92, 246, 0.28), transparent 55%),
              radial-gradient(circle at 82% 78%, rgba(0, 229, 255, 0.2), transparent 50%),
              linear-gradient(180deg, #070b18 0%, #05070e 100%);
}
#authShell::-webkit-scrollbar, .viewport::-webkit-scrollbar { display: none; }
#authShell.hidden, #appShell.hidden, .topbar.hidden, .bottom-nav.hidden, .badge-dot.hidden { display: none; }

.auth-glow-orb { position: absolute; border-radius: 50%; filter: blur(55px); pointer-events: none; opacity: 0.45; }
.auth-glow-orb.purple { width: 220px; height: 220px; background: var(--purple); top: -40px; left: -60px; }
.auth-glow-orb.cyan { width: 210px; height: 210px; background: var(--cyan); bottom: 30px; right: -70px; }

.auth-screen { display: none; flex: 1; flex-direction: column; padding: 52px 24px 24px; position: relative; z-index: 2; animation: fadeUp 0.28s ease; }
.auth-screen.active { display: flex; }
.auth-top-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.backend-pill {
  padding: 6px 11px; border-radius: 999px; background: rgba(11, 16, 32, 0.85);
  border: 1px solid var(--border); color: var(--muted); font-size: 11px; font-weight: 700;
  cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
}
.backend-pill.connected { border-color: rgba(0, 229, 255, 0.5); color: var(--cyan); }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--pink); }
.backend-pill.connected .status-dot { background: #10b981; box-shadow: 0 0 8px #10b981; }

.welcome-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 10px 0 22px; }
.welcome-logo-wrap {
  width: 120px; height: 120px; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.2), rgba(0, 229, 255, 0.05) 70%, transparent);
  box-shadow: 0 0 50px rgba(139, 92, 246, 0.45), 0 0 25px rgba(0, 229, 255, 0.25);
  margin-bottom: 20px;
}
.welcome-title { font-size: 38px; font-weight: 900; letter-spacing: 8px; background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
.welcome-tagline { font-size: 16px; color: #cbd5e1; margin-bottom: 8px; }
.welcome-sub { font-size: 12.5px; color: var(--muted); max-width: 270px; line-height: 1.5; }
.welcome-actions { display: flex; flex-direction: column; gap: 11px; }

.secondary-glow-btn { width: 100%; padding: 14px; border-radius: 20px; border: 1px solid rgba(0, 229, 255, 0.45); background: rgba(11, 16, 32, 0.75); color: var(--text); font-weight: 800; font-size: 15px; cursor: pointer; }
.google-btn { width: 100%; padding: 12px; border-radius: 18px; border: 1px solid var(--border); background: rgba(255, 255, 255, 0.05); color: var(--text); font-weight: 700; font-size: 13.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; }
.divider-or { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 11px; margin: 2px 0; }
.divider-or::before, .divider-or::after { content: ""; flex: 1; height: 1px; background: var(--border); }
.preview-demo-link { background: none; border: none; color: var(--muted); font-size: 11.5px; text-decoration: underline; cursor: pointer; margin-top: 6px; padding: 4px; }

.auth-heading { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
.auth-desc { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
.avatar-picker { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; padding: 10px 12px; border-radius: 18px; background: rgba(11, 16, 32, 0.75); border: 1px solid var(--border); cursor: pointer; }
.avatar-picker-circle { width: 50px; height: 50px; border-radius: 50%; background: var(--slate); border: 2px solid var(--cyan); display: grid; place-items: center; font-size: 20px; overflow: hidden; flex-shrink: 0; }
.avatar-picker-circle img { width: 100%; height: 100%; object-fit: cover; }

.field-group { margin-bottom: 11px; }
.field-label { font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 5px; display: block; }
.input-wrap { position: relative; display: flex; align-items: center; }
.nova-field { width: 100%; padding: 12px 14px; border-radius: 16px; border: 1px solid var(--border); background: rgba(11, 16, 32, 0.9); color: var(--text); font-size: 13.5px; outline: none; }
.nova-field:focus { border-color: var(--cyan); }
.nova-field.with-eye { padding-right: 42px; }
.eye-btn { position: absolute; right: 12px; background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px; }
.field-error { color: #fda4af; font-size: 11px; margin-top: 4px; display: none; }
.field-error.visible { display: block; }
.auth-banner { padding: 11px 13px; border-radius: 16px; font-size: 12px; line-height: 1.45; margin-bottom: 12px; display: none; }
.auth-banner.error { display: block; background: rgba(236, 72, 153, 0.14); border: 1px solid rgba(236, 72, 153, 0.55); color: #fbcfe8; }
.auth-banner.info { display: block; background: rgba(0, 229, 255, 0.12); border: 1px solid rgba(0, 229, 255, 0.45); color: #cffafe; }
.auth-options-row { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 14px; font-size: 12px; }
.remember-lbl { display: flex; align-items: center; gap: 7px; color: #cbd5e1; cursor: pointer; }
.link-btn { background: none; border: none; color: var(--cyan); font-size: 12px; font-weight: 700; cursor: pointer; }
.auth-switch { text-align: center; margin-top: auto; padding-top: 12px; font-size: 12.5px; color: var(--muted); }
.spinner { width: 17px; height: 17px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

/* MAIN SHELL */
#appShell { display: flex; flex-direction: column; flex: 1; height: 100%; overflow: hidden; }
.preview-banner { display: none; background: rgba(139, 92, 246, 0.18); border-bottom: 1px solid rgba(139, 92, 246, 0.4); padding: 4px 16px; font-size: 10.5px; color: #e9d5ff; align-items: center; justify-content: space-between; }
.preview-banner.visible { display: flex; }

.topbar { padding: 44px 18px 10px; display: flex; align-items: center; justify-content: space-between; background: rgba(5, 7, 14, 0.92); backdrop-filter: blur(14px); z-index: 20; border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
.brand { display: flex; align-items: center; gap: 9px; cursor: pointer; }
.brand-title { font-weight: 900; font-size: 20px; letter-spacing: 3.5px; background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.top-actions { display: flex; gap: 8px; align-items: center; }
.icon-btn { width: 38px; height: 38px; border-radius: 14px; background: var(--nebula); border: 1px solid var(--border); color: var(--text); display: grid; place-items: center; cursor: pointer; position: relative; }
.badge-dot { position: absolute; top: 7px; right: 7px; width: 8px; height: 8px; border-radius: 50%; background: var(--pink); box-shadow: 0 0 8px var(--pink); }

.viewport { flex: 1; overflow-y: auto; padding-bottom: 102px; scrollbar-width: none; }
.viewport.subpage { padding-bottom: 24px; }
.screen { display: none; animation: fadeUp 0.24s ease; }
.screen.active { display: block; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.subpage-header { padding: 46px 16px 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); background: rgba(5, 7, 14, 0.94); position: sticky; top: 0; z-index: 15; }
.subpage-title { font-size: 17px; font-weight: 800; }

.stories-row { display: flex; gap: 14px; overflow-x: auto; padding: 14px 16px 10px; scrollbar-width: none; }
.stories-row::-webkit-scrollbar { display: none; }
.story-item { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; flex-shrink: 0; }
.story-ring { width: 68px; height: 68px; border-radius: 50%; padding: 2.5px; background: var(--grad); box-shadow: 0 0 18px rgba(139, 92, 246, 0.35); }
.story-ring.seen { background: rgba(148, 163, 184, 0.35); box-shadow: none; }
.story-avatar { width: 100%; height: 100%; border-radius: 50%; border: 3px solid var(--obsidian); overflow: hidden; background: var(--slate); display: grid; place-items: center; font-weight: 800; font-size: 20px; }
.story-name { font-size: 11px; color: var(--muted); max-width: 68px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.post-card { margin: 12px 14px 18px; background: linear-gradient(180deg, rgba(19, 27, 51, 0.65), rgba(11, 16, 32, 0.92)); border: 1px solid var(--border); border-radius: 26px; overflow: hidden; }
.post-header { padding: 14px 14px 10px; display: flex; align-items: center; justify-content: space-between; }
.post-user { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.avatar-sm { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 15px; border: 1.5px solid rgba(0, 229, 255, 0.5); overflow: hidden; flex-shrink: 0; }
.avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
.username-row { display: flex; align-items: center; gap: 5px; font-weight: 700; font-size: 14px; }
.verified { width: 15px; height: 15px; border-radius: 50%; background: var(--grad); display: inline-grid; place-items: center; font-size: 9px; color: #fff; }
.post-time { font-size: 11px; color: var(--muted); }
.follow-pill { padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; border: 1px solid rgba(0, 229, 255, 0.45); background: rgba(0, 229, 255, 0.08); color: var(--cyan); cursor: pointer; }
.follow-pill.following { background: rgba(255, 255, 255, 0.06); border-color: var(--border); color: var(--muted); }
.post-media { margin: 0 10px; border-radius: 20px; overflow: hidden; position: relative; background: #070b18; aspect-ratio: 4 / 3.4; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.post-media img, .post-media svg { width: 100%; height: 100%; object-fit: cover; display: block; }
.heart-burst { position: absolute; font-size: 64px; color: var(--pink); filter: drop-shadow(0 0 22px var(--pink)); opacity: 0; transform: scale(0.4); pointer-events: none; transition: all 0.35s cubic-bezier(.17,.89,.32,1.49); }
.heart-burst.pop { opacity: 1; transform: scale(1.15); }
.post-actions { padding: 12px 14px 6px; display: flex; align-items: center; justify-content: space-between; }
.action-left { display: flex; gap: 14px; align-items: center; }
.action-btn { background: none; border: none; color: var(--text); display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
.action-btn.liked { color: var(--pink); }
.post-caption { padding: 4px 16px 16px; font-size: 13.5px; line-height: 1.48; color: #e2e8f0; }
.hashtag { color: var(--cyan); font-weight: 600; }

.search-wrap { padding: 14px 16px 10px; }
.search-input { width: 100%; padding: 13px 16px; border-radius: 18px; border: 1px solid var(--border); background: var(--nebula); color: var(--text); font-size: 14px; outline: none; }
.chip-row { display: flex; gap: 8px; overflow-x: auto; padding: 4px 16px 12px; scrollbar-width: none; }
.chip { padding: 7px 14px; border-radius: 999px; background: var(--nebula); border: 1px solid var(--border); font-size: 12px; font-weight: 600; color: var(--muted); cursor: pointer; white-space: nowrap; }
.chip.active { background: var(--grad); color: #fff; border-color: transparent; }
.creator-result { margin: 0 14px 10px; padding: 10px 14px; border-radius: 18px; background: var(--nebula); border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.explore-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 4px 14px 20px; }
.explore-tile { border-radius: 20px; overflow: hidden; background: var(--nebula); border: 1px solid var(--border); position: relative; aspect-ratio: 1 / 1.12; cursor: pointer; }
.explore-tile.tall { grid-row: span 2; aspect-ratio: auto; }
.explore-tile-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(5,7,14,0.88), transparent 55%); display: flex; flex-direction: column; justify-content: flex-end; padding: 10px; }

.create-box { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.seg-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: var(--nebula); padding: 5px; border-radius: 18px; border: 1px solid var(--border); }
.seg-btn { padding: 9px; border-radius: 14px; border: none; background: transparent; color: var(--muted); font-weight: 700; font-size: 12px; cursor: pointer; }
.seg-btn.active { background: var(--grad); color: #fff; }
.upload-zone { height: 190px; border-radius: 24px; border: 1.5px dashed rgba(0, 229, 255, 0.45); background: rgba(11, 16, 32, 0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; overflow: hidden; }
.upload-zone img { width: 100%; height: 100%; object-fit: cover; }
.preset-row { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
.preset-thumb { width: 58px; height: 58px; border-radius: 14px; overflow: hidden; border: 2px solid transparent; cursor: pointer; flex-shrink: 0; }
.preset-thumb.selected { border-color: var(--cyan); }
textarea.nova-input { width: 100%; min-height: 92px; padding: 14px; border-radius: 18px; border: 1px solid var(--border); background: var(--nebula); color: var(--text); font-family: inherit; font-size: 14px; resize: none; outline: none; }
.ai-row { display: flex; gap: 8px; flex-wrap: wrap; }
.ai-pill { padding: 8px 13px; border-radius: 999px; background: rgba(139, 92, 246, 0.14); border: 1px solid rgba(139, 92, 246, 0.45); color: #e9d5ff; font-size: 12px; font-weight: 700; cursor: pointer; }
.primary-btn { width: 100%; padding: 14px; border-radius: 20px; border: none; background: var(--grad); color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; box-shadow: 0 10px 28px rgba(139, 92, 246, 0.42); display: flex; align-items: center; justify-content: center; gap: 8px; }

.reel-card { margin: 10px 14px 18px; height: 560px; border-radius: 28px; position: relative; overflow: hidden; border: 1px solid var(--border); display: flex; align-items: flex-end; cursor: pointer; }
.reel-bg { position: absolute; inset: 0; animation: pulseBg 8s ease-in-out infinite alternate; }
.reel-bg.paused { animation-play-state: paused; }
@keyframes pulseBg { 0% { transform: scale(1); } 100% { transform: scale(1.06); } }
.reel-overlay { position: relative; z-index: 2; width: 100%; padding: 20px 16px; background: linear-gradient(to top, rgba(5,7,14,0.92), transparent); display: flex; justify-content: space-between; align-items: flex-end; }
.reel-side { display: flex; flex-direction: column; gap: 14px; align-items: center; }

.profile-hero { margin: 12px 14px; padding: 20px 16px; border-radius: 26px; background: radial-gradient(circle at top right, rgba(0, 229, 255, 0.18), transparent 55%), radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.22), transparent 55%), var(--nebula); border: 1px solid var(--border); }
.profile-top { display: flex; align-items: center; gap: 16px; }
.profile-pic { width: 76px; height: 76px; border-radius: 50%; padding: 3px; background: var(--grad); flex-shrink: 0; cursor: pointer; }
.profile-pic-inner { width: 100%; height: 100%; border-radius: 50%; background: var(--slate); display: grid; place-items: center; font-size: 26px; font-weight: 900; border: 3px solid var(--obsidian); overflow: hidden; }
.profile-pic-inner img { width: 100%; height: 100%; object-fit: cover; }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); text-align: center; }
.stat-num { font-size: 18px; font-weight: 800; }
.stat-lbl { font-size: 11px; color: var(--muted); }
.profile-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
.ghost-btn { padding: 10px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: var(--text); font-weight: 700; font-size: 12.5px; cursor: pointer; }
.profile-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 6px 14px 20px; }
.profile-grid-item { aspect-ratio: 1; border-radius: 14px; overflow: hidden; background: var(--nebula); cursor: pointer; }

.notif-card { margin: 8px 14px; padding: 13px 14px; border-radius: 18px; background: var(--nebula); border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.notif-card.unread { border-color: rgba(0, 229, 255, 0.4); background: rgba(19, 27, 51, 0.78); }
.chat-row { margin: 8px 14px; padding: 12px 14px; border-radius: 20px; background: var(--nebula); border: 1px solid var(--border); display: flex; align-items: center; gap: 12px; cursor: pointer; }
.chat-thread-box { display: flex; flex-direction: column; height: calc(100% - 96px); padding: 12px 14px; }
.chat-messages-area { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-bottom: 12px; }
.msg-bubble { max-width: 78%; padding: 10px 14px; border-radius: 18px; font-size: 13.5px; line-height: 1.4; }
.msg-bubble.in { align-self: flex-start; background: var(--slate); border: 1px solid var(--border); }
.msg-bubble.out { align-self: flex-end; background: var(--grad); color: #fff; }
.msg-bubble img { width: 100%; border-radius: 12px; margin-top: 6px; display: block; }

.settings-group { margin: 12px 14px; padding: 14px 16px; border-radius: 22px; background: var(--nebula); border: 1px solid var(--border); }
.settings-label { font-size: 11px; font-weight: 800; color: var(--cyan); letter-spacing: 0.8px; margin-bottom: 10px; }
.settings-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13.5px; cursor: pointer; }
.settings-row:last-child { border-bottom: none; padding-bottom: 2px; }
.logout-btn { width: calc(100% - 28px); margin: 14px; padding: 14px; border-radius: 18px; background: rgba(236, 72, 153, 0.14); border: 1px solid rgba(236, 72, 153, 0.45); color: #fbcfe8; font-weight: 800; font-size: 14px; cursor: pointer; }

.bottom-nav { position: absolute; bottom: 14px; left: 14px; right: 14px; height: 68px; border-radius: 28px; background: rgba(11, 16, 32, 0.88); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.11); box-shadow: 0 12px 34px rgba(0, 0, 0, 0.65); display: flex; align-items: center; justify-content: space-around; z-index: 30; }
.nav-btn { background: none; border: none; color: var(--muted); display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; cursor: pointer; padding: 6px 10px; }
.nav-btn.active { color: var(--cyan); }
.create-orb { width: 48px; height: 48px; border-radius: 50%; background: var(--grad); border: none; color: #fff; font-size: 24px; cursor: pointer; display: grid; place-items: center; box-shadow: 0 0 24px rgba(139, 92, 246, 0.65); }

.modal-overlay { position: absolute; inset: 0; background: rgba(5, 7, 14, 0.82); backdrop-filter: blur(10px); z-index: 60; display: none; flex-direction: column; justify-content: flex-end; }
.modal-overlay.open { display: flex; }
.modal-sheet { background: var(--nebula); border-top-left-radius: 28px; border-top-right-radius: 28px; border-top: 1px solid var(--border); padding: 18px 18px 26px; max-height: 82%; overflow-y: auto; }
.story-viewer { position: absolute; inset: 0; z-index: 70; background: #000; display: none; flex-direction: column; }
.story-viewer.open { display: flex; }
.story-progress { height: 3px; background: rgba(255,255,255,0.22); margin: 44px 14px 12px; border-radius: 4px; overflow: hidden; }
.story-progress-fill { height: 100%; width: 0%; background: var(--grad); transition: width 4s linear; }
.toast { position: absolute; top: 94px; left: 50%; transform: translateX(-50%); background: rgba(19, 27, 51, 0.96); border: 1px solid var(--cyan); color: #fff; padding: 9px 16px; border-radius: 999px; font-size: 12px; font-weight: 700; z-index: 90; opacity: 0; pointer-events: none; transition: opacity 0.25s; white-space: nowrap; }
.toast.show { opacity: 1; }
'@

# 9. www/js/app.js
Write-NovaFile "www/js/app.js" @'
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// =========================================================================
// SUPABASE CONFIGURATION
// =========================================================================
const SUPABASE_CONFIG = {
  url: localStorage.getItem("nova_sb_url") || "YOUR_SUPABASE_URL",
  anonKey: localStorage.getItem("nova_sb_key") || "YOUR_SUPABASE_ANON_KEY"
};

let sbClient = null;
let currentAuthUser = null;
let isPreviewOnly = false;
let regAvatarFile = null;
let userAvatarUrl = null;
let userHandle = "you_nova";

function isSupabaseConfigured() {
  return (
    SUPABASE_CONFIG.url.startsWith("https://") &&
    !SUPABASE_CONFIG.url.includes("YOUR_") &&
    SUPABASE_CONFIG.anonKey.length > 20 &&
    !SUPABASE_CONFIG.anonKey.includes("YOUR_") &&
    typeof window.supabase !== "undefined"
  );
}

function initSupabaseClient() {
  const pill = document.getElementById("backendStatusPill");
  const txt = document.getElementById("backendStatusText");
  if (!isSupabaseConfigured()) {
    sbClient = null;
    pill.classList.remove("connected");
    txt.textContent = "Connect Supabase";
    return false;
  }
  const remember = document.getElementById("rememberMe")?.checked ?? true;
  sbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: { persistSession: remember, autoRefreshToken: true }
  });
  pill.classList.add("connected");
  txt.textContent = "Supabase Ready";
  return true;
}

function saveSupabaseConfig() {
  const url = document.getElementById("cfgUrl").value.trim();
  const key = document.getElementById("cfgKey").value.trim();
  if (!url.startsWith("https://") || key.length < 20) {
    return showToast("Enter valid Supabase URL & Key");
  }
  localStorage.setItem("nova_sb_url", url);
  localStorage.setItem("nova_sb_key", key);
  SUPABASE_CONFIG.url = url;
  SUPABASE_CONFIG.anonKey = key;
  initSupabaseClient();
  closeModal("supabaseConfigModal");
  showToast("Supabase connected!");
  checkExistingSession();
}

async function checkExistingSession() {
  if (!initSupabaseClient()) return;
  const { data: { session } } = await sbClient.auth.getSession();
  if (session?.user) await enterAuthenticatedApp(session.user);
}

async function enterAuthenticatedApp(user) {
  currentAuthUser = user;
  isPreviewOnly = false;
  document.getElementById("previewModeBanner").classList.remove("visible");

  const meta = user.user_metadata || {};
  const { data: profile } = await sbClient.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const uname = profile?.username || meta.username || user.email?.split("@")[0] || "nova_user";
  const fname = profile?.full_name || meta.full_name || "NOVA Member";
  userHandle = uname;
  userAvatarUrl = profile?.avatar_url || null;

  applyUserProfileToUI(uname, fname, profile?.bio || "Designing tomorrow beyond limits.", userAvatarUrl);
  document.getElementById("authShell").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  switchTab("home");
}

function enterUiPreviewMode() {
  isPreviewOnly = true;
  document.getElementById("previewModeBanner").classList.add("visible");
  document.getElementById("authShell").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  switchTab("home");
}

function exitToWelcome() {
  currentAuthUser = null;
  isPreviewOnly = false;
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("authShell").classList.remove("hidden");
  showAuthScreen("welcome");
}

function applyUserProfileToUI(uname, fname, bio, avatarUrl) {
  document.getElementById("profileUsername").textContent = "@" + uname;
  document.getElementById("profileFullName").textContent = fname;
  document.getElementById("profileBio").textContent = bio;
  document.getElementById("profileAvatarInner").innerHTML = avatarUrl
    ? `<img src="${avatarUrl}" alt="avatar"/>`
    : fname[0].toUpperCase();
}

// =========================================================================
// AUTH SCREEN LOGIC & FORM VALIDATION
// =========================================================================
function showAuthScreen(name) {
  document.querySelectorAll(".auth-screen").forEach((s) => s.classList.remove("active"));
  document.getElementById("auth-" + name).classList.add("active");
  document.querySelectorAll(".auth-banner").forEach((b) => {
    b.className = "auth-banner";
    b.textContent = "";
  });
  document.querySelectorAll(".field-error").forEach((e) => {
    e.classList.remove("visible");
    e.textContent = "";
  });
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add("visible");
}

function showBanner(id, type, msg) {
  const el = document.getElementById(id);
  el.className = "auth-banner " + type;
  el.textContent = msg;
}

function toggleEye(id, btn) {
  const i = document.getElementById(id);
  const hidden = i.type === "password";
  i.type = hidden ? "text" : "password";
  btn.textContent = hidden ? "🙈" : "👁";
}

function setBtnLoad(id, load, txt) {
  const b = document.getElementById(id);
  b.disabled = load;
  b.innerHTML = load ? `<span class="spinner"></span><span>Please wait...</span>` : `<span>${txt}</span>`;
}

function previewRegAvatar(e) {
  const f = e.target.files[0];
  if (!f) return;
  regAvatarFile = f;
  const r = new FileReader();
  r.onload = (ev) => {
    document.getElementById("regAvatarCircle").innerHTML = `<img src="${ev.target.result}"/>`;
  };
  r.readAsDataURL(f);
}

const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userRx = /^[a-zA-Z0-9_.]{3,24}$/;

async function handleRegister(e) {
  e.preventDefault();
  showAuthScreen("signup");
  const fullName = document.getElementById("regName").value.trim();
  const username = document.getElementById("regUsername").value.trim().toLowerCase();
  const email = document.getElementById("regEmail").value.trim();
  const pass = document.getElementById("regPass").value;
  const confirm = document.getElementById("regConfirm").value;

  let ok = true;
  if (fullName.length < 2) { showErr("errRegName", "Enter your full name."); ok = false; }
  if (!userRx.test(username)) { showErr("errRegUser", "3–24 chars: letters, numbers, _ or ."); ok = false; }
  if (!emailRx.test(email)) { showErr("errRegEmail", "Enter a valid email address."); ok = false; }
  if (pass.length < 8) { showErr("errRegPass", "Password must be at least 8 characters."); ok = false; }
  if (confirm !== pass) { showErr("errRegConfirm", "Passwords do not match."); ok = false; }
  if (!ok) return;

  setBtnLoad("regSubmitBtn", true, "Create Account");
  if (!initSupabaseClient()) {
    return setTimeout(() => {
      setBtnLoad("regSubmitBtn", false, "Create Account");
      showBanner("regBanner", "error", "Supabase is not connected. Account was NOT saved.");
    }, 400);
  }

  try {
    const { data: taken } = await sbClient.from("profiles").select("id").eq("username", username).maybeSingle();
    if (taken) return showErr("errRegUser", "Username already taken.");

    const { data, error } = await sbClient.auth.signUp({
      email,
      password: pass,
      options: { data: { full_name: fullName, username } }
    });
    if (error) return showBanner("regBanner", "error", error.message);

    if (data.session) {
      if (regAvatarFile) {
        const p = `${data.user.id}/avatar_${Date.now()}`;
        await sbClient.storage.from("avatars").upload(p, regAvatarFile);
        const { data: pub } = sbClient.storage.from("avatars").getPublicUrl(p);
        await sbClient.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", data.user.id);
      }
      await enterAuthenticatedApp(data.user);
    } else {
      showBanner("regBanner", "info", "Verification email sent. Confirm your email before logging in.");
    }
  } finally {
    setBtnLoad("regSubmitBtn", false, "Create Account");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  showAuthScreen("login");
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;
  let ok = true;
  if (!emailRx.test(email)) { showErr("errLoginEmail", "Enter valid email."); ok = false; }
  if (!pass) { showErr("errLoginPass", "Enter password."); ok = false; }
  if (!ok) return;

  setBtnLoad("loginSubmitBtn", true, "Log In");
  if (!initSupabaseClient()) {
    return setTimeout(() => {
      setBtnLoad("loginSubmitBtn", false, "Log In");
      showBanner("loginBanner", "error", "Supabase is not connected. Cannot authenticate.");
    }, 400);
  }

  try {
    const { data, error } = await sbClient.auth.signInWithPassword({ email, password: pass });
    if (error) showBanner("loginBanner", "error", error.message);
    else if (data.session) await enterAuthenticatedApp(data.user);
  } finally {
    setBtnLoad("loginSubmitBtn", false, "Log In");
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  showAuthScreen("forgot");
  const email = document.getElementById("forgotEmail").value.trim();
  if (!emailRx.test(email)) return showErr("errForgotEmail", "Enter valid email.");

  setBtnLoad("forgotSubmitBtn", true, "Send Recovery Link");
  if (!initSupabaseClient()) {
    return setTimeout(() => {
      setBtnLoad("forgotSubmitBtn", false, "Send Recovery Link");
      showBanner("forgotBanner", "error", "Supabase is not connected.");
    }, 400);
  }

  try {
    const { error } = await sbClient.auth.resetPasswordForEmail(email);
    if (error) showBanner("forgotBanner", "error", error.message);
    else showBanner("forgotBanner", "info", "Recovery link sent to " + email);
  } finally {
    setBtnLoad("forgotSubmitBtn", false, "Send Recovery Link");
  }
}

async function handleGoogleAuth() {
  if (!initSupabaseClient()) {
    showToast("Connect Supabase first");
    return openModal("supabaseConfigModal");
  }
  const { error } = await sbClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin }
  });
  if (error) showToast(error.message);
}

async function handleLogout() {
  if (sbClient) await sbClient.auth.signOut();
  exitToWelcome();
  showToast("Logged out securely");
}

// =========================================================================
// MAIN APPLICATION DATA & SCREENS (HOME, PROFILE, EXPLORE, CREATE, REELS...)
// =========================================================================
const artSVGs = [
  `<svg viewBox="0 0 400 340" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g1" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#00E5FF"/><stop offset="45%" stop-color="#8B5CF6"/><stop offset="100%" stop-color="#05070E"/></radialGradient></defs><rect width="400" height="340" fill="#05070E"/><circle cx="200" cy="150" r="115" fill="url(#g1)" opacity="0.9"/><ellipse cx="200" cy="155" rx="165" ry="42" fill="none" stroke="#00E5FF" stroke-width="3" transform="rotate(-16 200 155)"/></svg>`,
  `<svg viewBox="0 0 400 340" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1E1B4B"/><stop offset="50%" stop-color="#8B5CF6"/><stop offset="100%" stop-color="#EC4899"/></linearGradient></defs><rect width="400" height="340" fill="url(#g2)"/><polygon points="0,340 120,170 230,340" fill="#05070E" opacity="0.85"/><polygon points="150,340 280,130 400,340" fill="#0B1020" opacity="0.92"/><circle cx="290" cy="85" r="38" fill="#00E5FF" opacity="0.85"/></svg>`,
  `<svg viewBox="0 0 400 340" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="340" fill="#070B19"/><g stroke="#00E5FF" stroke-opacity="0.35" stroke-width="1.5"><path d="M0 240 H400 M0 270 H400 M0 305 H400"/><path d="M200 170 L30 340 M200 170 L130 340 M200 170 L270 340 M200 170 L370 340"/></g><circle cx="200" cy="145" r="68" fill="#8B5CF6" opacity="0.7"/><circle cx="200" cy="145" r="46" fill="#00E5FF" opacity="0.65"/></svg>`,
  `<svg viewBox="0 0 400 340" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="340" fill="#05070E"/><path d="M0 210 Q110 120 210 200 T400 170 L400 340 L0 340 Z" fill="#8B5CF6" opacity="0.45"/><path d="M0 250 Q120 170 240 230 T400 200 L400 340 L0 340 Z" fill="#00E5FF" opacity="0.38"/><circle cx="110" cy="95" r="24" fill="#EC4899" opacity="0.85"/></svg>`
];

const creators = [
  { user: "aria_nova", name: "Aria Sol", initial: "A", following: false },
  { user: "kairo_vfx", name: "Kairo VFX", initial: "K", following: true },
  { user: "zayneb_art", name: "Zayneb M.", initial: "Z", following: false }
];

const stories = [
  { user: "you_nova", initial: "Y", seen: false, art: artSVGs[0], color: "#8B5CF6" },
  { user: "aria_nova", initial: "A", seen: false, art: artSVGs[1], color: "#00E5FF" },
  { user: "kairo_vfx", initial: "K", seen: false, art: artSVGs[2], color: "#EC4899" },
  { user: "zayneb_art", initial: "Z", seen: true, art: artSVGs[3], color: "#6366F1" }
];

const posts = [
  { id: 1, user: "aria_nova", initial: "A", verified: true, time: "12m ago", art: artSVGs[0], likes: 1284, liked: false, caption: "Orbital dawn above Neo-Algiers. #cyberpunk #future #space", tags: ["cyberpunk", "future", "space"], comments: [{ user: "kairo_vfx", text: "That cyan horizon ring is unreal!" }] },
  { id: 2, user: "kairo_vfx", initial: "K", verified: true, time: "1h ago", art: artSVGs[2], likes: 892, liked: true, caption: "Synthwave grid render running in real time. #aiart #cyberpunk", tags: ["aiart", "cyberpunk"], comments: [] },
  { id: 3, user: "zayneb_art", initial: "Z", verified: false, time: "3h ago", art: artSVGs[1], likes: 541, liked: false, caption: "Midnight peaks under plasma skies. #space #future", tags: ["space", "future"], comments: [] }
];

const notifications = [
  { id: 1, type: "like", user: "aria_nova", text: "liked your cosmic render", time: "2m", unread: true },
  { id: 2, type: "follow", user: "kairo_vfx", text: "started following you", time: "14m", unread: true },
  { id: 3, type: "comment", user: "zayneb_art", text: "commented on your post", time: "1h", unread: false }
];

const chats = [
  { id: 1, user: "aria_nova", initial: "A", messages: [{ from: "them", text: "Hey! Loved your latest NOVA drop ✨" }, { from: "me", text: "Thank you! Connecting beyond limits 🚀" }] },
  { id: 2, user: "kairo_vfx", initial: "K", messages: [{ from: "them", text: "Want to collab on a futuristic Reel?" }] }
];

let activeTab = "home";
let lastMainTab = "home";
let activeExploreTag = "all";
let profileTab = "all";
let notifFilter = "all";
let createMode = "post";
let selectedArt = artSVGs[0];
let uploadedDataUrl = null;
let activeCommentPostId = null;
let activeChatId = null;

function isFollowing(u) { return creators.find((c) => c.user === u)?.following ?? false; }

function toggleFollowUser(u) {
  const c = creators.find((x) => x.user === u);
  if (!c) return;
  c.following = !c.following;
  document.getElementById("followingCount").textContent = creators.filter((x) => x.following).length;
  renderFeed(); renderExplore(); renderReels(); renderNotifications();
  showToast(c.following ? `Following @${u}` : `Unfollowed @${u}`);
}

function switchTab(tab) {
  if (["home", "explore", "create", "reels", "profile"].includes(activeTab)) lastMainTab = activeTab;
  activeTab = tab;
  const sub = ["notifications", "messages", "settings"].includes(tab);
  document.getElementById("mainTopbar").classList.toggle("hidden", sub);
  document.getElementById("bottomNav").classList.toggle("hidden", sub);
  document.getElementById("mainViewport").classList.toggle("subpage", sub);
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById("screen-" + tab).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "messages") closeChatThread();
}

function goBackTab() { switchTab(lastMainTab || "home"); }

function renderStories() {
  document.getElementById("storiesRow").innerHTML = stories.map((s, idx) => `
    <div class="story-item" onclick="openStory(${idx})">
      <div class="story-ring ${s.seen ? "seen" : ""}">
        <div class="story-avatar" style="background:${s.color}33; color:#fff;">${s.initial}</div>
      </div>
      <div class="story-name">${s.user}</div>
    </div>`).join("");
}

function formatCaption(t) { return t.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>'); }

function renderFeed() {
  document.getElementById("feedList").innerHTML = posts.map((p) => {
    const f = isFollowing(p.user);
    return `
      <article class="post-card">
        <div class="post-header">
          <div class="post-user" onclick="switchTab('profile')">
            <div class="avatar-sm" style="background:rgba(139,92,246,0.22);">${p.initial}</div>
            <div><div class="username-row">@${p.user} ${p.verified ? '<span class="verified">✓</span>' : ""}</div><div class="post-time">${p.time}</div></div>
          </div>
          ${p.user !== userHandle ? `<button class="follow-pill ${f ? "following" : ""}" onclick="toggleFollowUser('${p.user}')">${f ? "Following" : "Follow"}</button>` : ""}
        </div>
        <div class="post-media" ondblclick="doubleTapLike(${p.id}, this)">${p.imageUrl ? `<img src="${p.imageUrl}"/>` : p.art}<div class="heart-burst">♥</div></div>
        <div class="post-actions">
          <div class="action-left">
            <button class="action-btn ${p.liked ? "liked" : ""}" onclick="toggleLike(${p.id})">${p.liked ? "♥" : "♡"} <span>${p.likes}</span></button>
            <button class="action-btn" onclick="openComments(${p.id})">💬 <span>${p.comments.length}</span></button>
            <button class="action-btn" onclick="showToast('Link copied!')">↗</button>
          </div>
          <button class="action-btn" onclick="showToast('Saved!')">🔖</button>
        </div>
        <div class="post-caption"><b>@${p.user}</b> ${formatCaption(p.caption)}</div>
      </article>`;
  }).join("");
}

function renderExplore() {
  const q = document.getElementById("exploreSearch").value.trim().toLowerCase();
  const mc = q ? creators.filter((c) => c.user.includes(q) || c.name.toLowerCase().includes(q)) : [];
  document.getElementById("exploreCreators").innerHTML = mc.map((c) => `
    <div class="creator-result">
      <div style="display:flex; align-items:center; gap:10px;"><div class="avatar-sm">${c.initial}</div><div><div style="font-weight:700; font-size:13px;">@${c.user}</div><div style="font-size:11px; color:var(--muted);">${c.name}</div></div></div>
      <button class="follow-pill ${c.following ? "following" : ""}" onclick="toggleFollowUser('${c.user}')">${c.following ? "Following" : "Follow"}</button>
    </div>`).join("");

  const f = posts.filter((p) => (activeExploreTag === "all" || p.tags.includes(activeExploreTag)) && (!q || p.user.includes(q) || p.caption.toLowerCase().includes(q)));
  document.getElementById("exploreGrid").innerHTML = f.map((p, i) => `
    <div class="explore-tile ${i === 0 ? "tall" : ""}" onclick="switchTab('home')">
      ${p.imageUrl ? `<img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover;"/>` : p.art}
      <div class="explore-tile-overlay"><div style="font-weight:700; font-size:12px;">@${p.user}</div><div style="font-size:11px; color:var(--cyan);">♥ ${p.likes}</div></div>
    </div>`).join("");
}

function renderReels() {
  document.getElementById("reelsContainer").innerHTML = posts.map((p) => `
    <div class="reel-card" onclick="this.querySelector('.reel-bg').classList.toggle('paused')">
      <div class="reel-bg">${p.imageUrl ? `<img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover;"/>` : p.art}</div>
      <div class="reel-overlay">
        <div style="max-width:75%;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;"><span style="font-weight:800; font-size:15px;">@${p.user}</span><button class="follow-pill ${isFollowing(p.user) ? "following" : ""}" onclick="event.stopPropagation(); toggleFollowUser('${p.user}')">${isFollowing(p.user) ? "Following" : "Follow"}</button></div>
          <div style="font-size:13px; color:#e2e8f0;">${formatCaption(p.caption)}</div>
        </div>
        <div class="reel-side" onclick="event.stopPropagation()">
          <button class="icon-btn" onclick="toggleLike(${p.id})">${p.liked ? "♥" : "♡"}</button>
          <span style="font-size:11px;">${p.likes}</span>
          <button class="icon-btn" onclick="openComments(${p.id})">💬</button>
        </div>
      </div>
    </div>`).join("");
}

function renderProfile() {
  const list = profileTab === "liked" ? posts.filter((p) => p.liked) : posts;
  document.getElementById("myPostsCount").textContent = posts.length;
  document.getElementById("followingCount").textContent = creators.filter((c) => c.following).length;
  document.getElementById("profileGrid").innerHTML = list.map((p) => `
    <div class="profile-grid-item" onclick="switchTab('home')">${p.imageUrl ? `<img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover;"/>` : p.art}</div>`).join("");
}

function renderNotifications() {
  const items = notifFilter === "all" ? notifications : notifications.filter((n) => n.type === notifFilter);
  document.getElementById("notifDot").classList.toggle("hidden", !notifications.some((n) => n.unread));
  document.getElementById("notificationsList").innerHTML = items.map((n) => `
    <div class="notif-card ${n.unread ? "unread" : ""}">
      <div style="font-size:13px;"><b>@${n.user}</b> ${n.text} <span style="color:var(--muted);">• ${n.time}</span></div>
      ${n.type === "follow" ? `<button class="follow-pill ${isFollowing(n.user) ? "following" : ""}" onclick="toggleFollowUser('${n.user}')">${isFollowing(n.user) ? "Following" : "Follow"}</button>` : ""}
    </div>`).join("");
}

function markAllNotifsRead() { notifications.forEach((n) => (n.unread = false)); renderNotifications(); showToast("All caught up!"); }
function setNotifFilter(f, el) { notifFilter = f; el.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.remove("active")); el.classList.add("active"); renderNotifications(); }

function renderChats() {
  const q = (document.getElementById("dmSearch")?.value || "").trim().toLowerCase();
  document.getElementById("chatList").innerHTML = chats.filter((c) => c.user.includes(q)).map((c) => {
    const l = c.messages[c.messages.length - 1];
    return `<div class="chat-row" onclick="openChatThread(${c.id})"><div class="avatar-sm">${c.initial}</div><div style="flex:1; overflow:hidden;"><div style="font-weight:700; font-size:14px;">@${c.user}</div><div style="font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${l.text || "📷 Photo"}</div></div><span style="color:var(--cyan);">›</span></div>`;
  }).join("");
}

function openChatThread(id) {
  activeChatId = id;
  const c = chats.find((x) => x.id === id);
  document.getElementById("chatInboxView").style.display = "none";
  document.getElementById("chatThreadView").style.display = "block";
  document.getElementById("chatThreadAvatar").textContent = c.initial;
  document.getElementById("chatThreadUser").textContent = "@" + c.user;
  renderChatMessages();
}

function closeChatThread() {
  document.getElementById("chatThreadView").style.display = "none";
  document.getElementById("chatInboxView").style.display = "block";
  renderChats();
}

function renderChatMessages() {
  const c = chats.find((x) => x.id === activeChatId);
  const a = document.getElementById("chatMessagesArea");
  a.innerHTML = c.messages.map((m) => `<div class="msg-bubble ${m.from === "me" ? "out" : "in"}">${m.text ? `<div>${m.text}</div>` : ""}${m.img ? `<img src="${m.img}"/>` : ""}</div>`).join("");
  a.scrollTop = a.scrollHeight;
}

function sendDM() { const i = document.getElementById("dmInput"); if (!i.value.trim()) return; chats.find((x) => x.id === activeChatId).messages.push({ from: "me", text: i.value.trim() }); i.value = ""; renderChatMessages(); }
function sendDMPhoto(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { chats.find((x) => x.id === activeChatId).messages.push({ from: "me", img: ev.target.result }); renderChatMessages(); }; r.readAsDataURL(f); }

async function uploadNewProfilePhoto(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => { userAvatarUrl = ev.target.result; document.getElementById("profileAvatarInner").innerHTML = `<img src="${userAvatarUrl}"/>`; showToast("Profile photo updated!"); };
  r.readAsDataURL(f);
  if (sbClient && currentAuthUser) {
    const p = `${currentAuthUser.id}/avatar_${Date.now()}`;
    await sbClient.storage.from("avatars").upload(p, f);
    const { data: pub } = sbClient.storage.from("avatars").getPublicUrl(p);
    await sbClient.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", currentAuthUser.id);
  }
}

async function saveProfileEdits() {
  const fn = document.getElementById("editFullName").value.trim(), un = document.getElementById("editUsername").value.trim().toLowerCase().replace(/^@/, ""), bio = document.getElementById("bioInput").value.trim();
  if (!userRx.test(un)) return showToast("Invalid username");
  userHandle = un;
  applyUserProfileToUI(un, fn || "NOVA Member", bio, userAvatarUrl);
  if (sbClient && currentAuthUser) await sbClient.from("profiles").update({ full_name: fn, username: un, bio }).eq("id", currentAuthUser.id);
  closeModal("editProfileModal");
  showToast("Profile updated!");
}

function toggleLike(id) { const p = posts.find((x) => x.id === id); p.liked = !p.liked; p.likes += p.liked ? 1 : -1; renderFeed(); renderReels(); renderProfile(); }
function doubleTapLike(id, el) { const p = posts.find((x) => x.id === id); if (!p.liked) toggleLike(id); const b = el.querySelector(".heart-burst"); b.classList.add("pop"); setTimeout(() => b.classList.remove("pop"), 550); }
function openComments(id) { activeCommentPostId = id; const p = posts.find((x) => x.id === id); document.getElementById("commentsList").innerHTML = p.comments.length ? p.comments.map((c) => `<div style="font-size:13px;"><b>@${c.user}</b> ${c.text}</div>`).join("") : `<div style="font-size:13px; color:var(--muted);">No comments yet.</div>`; openModal("commentsModal"); }
function submitComment() { const i = document.getElementById("commentInput"); if (!i.value.trim()) return; posts.find((x) => x.id === activeCommentPostId).comments.push({ user: userHandle, text: i.value.trim() }); i.value = ""; openComments(activeCommentPostId); renderFeed(); }
function renderPresets() { document.getElementById("presetRow").innerHTML = artSVGs.map((svg, idx) => `<div class="preset-thumb ${idx === 0 ? "selected" : ""}" onclick="selectPreset(${idx}, this)">${svg}</div>`).join(""); }
function selectPreset(idx, el) { uploadedDataUrl = null; selectedArt = artSVGs[idx]; document.querySelectorAll(".preset-thumb").forEach((n) => n.classList.remove("selected")); el.classList.add("selected"); document.getElementById("uploadPreview").innerHTML = selectedArt; }
function handleFileUpload(e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { uploadedDataUrl = ev.target.result; document.getElementById("uploadPreview").innerHTML = `<img src="${uploadedDataUrl}"/>`; }; r.readAsDataURL(f); }
function setCreateType(type, el) { createMode = type; el.parentElement.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active")); el.classList.add("active"); }
function generateAI(mode) { if (mode === "caption") { document.getElementById("createCaption").value = "Chasing electric horizons across the digital cosmos. #future"; showToast("✨ AI Caption ready"); } else if (mode === "hashtags") { const box = document.getElementById("createCaption"); box.value = (box.value + " #NOVA #Cyberpunk #AIArt").trim(); showToast("# AI Hashtags added"); } else { document.getElementById("bioInput").value = "Architect of futuristic pixels & neon worlds • Connect Beyond Limits."; showToast("✨ AI Bio ready"); } }

function publishPost() {
  const c = document.getElementById("createCaption").value.trim() || "New signal on NOVA. #future";
  if (createMode === "story") {
    stories.unshift({ user: userHandle, initial: userHandle[0].toUpperCase(), seen: false, art: uploadedDataUrl ? `<img src="${uploadedDataUrl}" style="width:100%;height:100%;object-fit:cover;"/>` : selectedArt, color: "#00E5FF" });
    renderStories(); showToast("24h Story published!");
  } else {
    const tags = (c.match(/#(\w+)/g) || ["#future"]).map((t) => t.slice(1).toLowerCase());
    posts.unshift({ id: Date.now(), user: userHandle, initial: userHandle[0].toUpperCase(), verified: true, time: "Just now", art: selectedArt, imageUrl: uploadedDataUrl, likes: 1, liked: true, caption: c, tags, comments: [] });
    renderFeed(); renderExplore(); renderReels(); renderProfile(); showToast("Published to NOVA!");
  }
  document.getElementById("createCaption").value = ""; uploadedDataUrl = null; switchTab("home");
}

function setExploreTag(tag, el) { activeExploreTag = tag; el.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.remove("active")); el.classList.add("active"); renderExplore(); }
function setProfileTab(t, el) { profileTab = t; el.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.remove("active")); el.classList.add("active"); renderProfile(); }

function openStory(idx) {
  const s = stories[idx]; s.seen = true; renderStories();
  document.getElementById("storyViewerAvatar").textContent = s.initial;
  document.getElementById("storyViewerUser").textContent = "@" + s.user;
  document.getElementById("storyViewerBody").innerHTML = `<div style="width:100%; border-radius:24px; overflow:hidden;">${s.art}</div>`;
  const v = document.getElementById("storyViewer"), f = document.getElementById("storyProgressFill");
  f.style.transition = "none"; f.style.width = "0%"; v.classList.add("open");
  setTimeout(() => { f.style.transition = "width 4s linear"; f.style.width = "100%"; }, 30);
}
function closeStory() { document.getElementById("storyViewer").classList.remove("open"); }

const i18n = {
  en: { dir: "ltr", home: "Home", explore: "Explore", reels: "Reels", profile: "Profile", publish: "Publish to NOVA" },
  ar: { dir: "rtl", home: "الرئيسية", explore: "استكشف", reels: "ريلز", profile: "ملفي", publish: "نشر في نوفا" },
  fr: { dir: "ltr", home: "Accueil", explore: "Explorer", reels: "Reels", profile: "Profil", publish: "Publier sur NOVA" }
};
function setLanguage(lang, el) {
  el.parentElement.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active")); el.classList.add("active");
  const d = i18n[lang]; document.documentElement.dir = d.dir;
  document.querySelectorAll("[data-i18n]").forEach((n) => (n.textContent = d[n.dataset.i18n]));
  document.getElementById("publishBtn").textContent = d.publish;
  showToast(`Language: ${lang.toUpperCase()}`);
}

function openModal(id) {
  if (id === "editProfileModal") {
    document.getElementById("editFullName").value = document.getElementById("profileFullName").textContent;
    document.getElementById("editUsername").value = userHandle;
    document.getElementById("bioInput").value = document.getElementById("profileBio").textContent;
  }
  if (id === "supabaseConfigModal") {
    document.getElementById("cfgUrl").value = SUPABASE_CONFIG.url.includes("YOUR_") ? "" : SUPABASE_CONFIG.url;
    document.getElementById("cfgKey").value = SUPABASE_CONFIG.anonKey.includes("YOUR_") ? "" : SUPABASE_CONFIG.anonKey;
  }
  document.getElementById(id).classList.add("open");
}
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
function showToast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2200); }

renderStories(); renderFeed(); renderExplore(); renderReels(); renderProfile(); renderPresets(); renderNotifications(); renderChats();
checkExistingSession();
'@

# Pack everything including .github folder cleanly into Nova.app.zip
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($root, $zipPath)

Write-Host "`nDone! Folder created at: $root" -ForegroundColor Green
Write-Host "ZIP archive created at: $zipPath" -ForegroundColor Green
