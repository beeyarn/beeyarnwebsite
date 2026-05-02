<?php
/**
 * BeeYarn — Invite landing page.
 *
 * Handles /invite/{code} requests:
 *   1. Fetches inviter data from the BeeYarn API (name + avatar)
 *   2. Renders a self-contained landing page with:
 *      - Correct OG / Twitter Card meta tags (for WhatsApp/Telegram previews)
 *      - Inviter name + avatar if available
 *      - Google Play download button
 *      - App Store download button (coming soon)
 *      - "Open in BeeYarn" deep link button for users who already have the app
 *      - Referral code preserved in all links
 */

// ── 1. Extract and validate invite code ──────────────────────────────────────

$code = isset($_GET['code']) ? trim($_GET['code']) : '';

if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $code)) {
    $code = '';
}

// ── 2. Defaults ───────────────────────────────────────────────────────────────

$inviter_name   = null;
$inviter_avatar = null;
$og_title       = 'Join me on BeeYarn';
$og_desc        = 'Be seen, be heard. Sign up with my link and get a bonus.';
$og_image       = 'https://www.beeyarn.com/assets/img/homepage.jpg';
$og_url         = $code
                ? 'https://www.beeyarn.com/invite/' . rawurlencode($code)
                : 'https://www.beeyarn.com/';

// ── 3. Fetch inviter data from the API ───────────────────────────────────────

if ($code && function_exists('curl_init')) {
    $api_url = 'https://api.beeyarn.com/api/invite/' . rawurlencode($code);
    $ch = curl_init($api_url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_USERAGENT      => 'BeeYarnBot/1.0 (invite page)',
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw    = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw !== false && $status === 200) {
        $data = json_decode($raw, true);
        $user = isset($data['data']) ? $data['data'] : $data;

        if (is_array($user)) {
            if (!empty($user['name']))   $inviter_name   = $user['name'];
            if (!empty($user['avatar'])) $inviter_avatar = $user['avatar'];

            // Personalise OG tags when we know who invited them
            if ($inviter_name) {
                $og_title = $inviter_name . ' invited you to join BeeYarn';
                $og_desc  = 'Be seen, be heard. Sign up with ' . $inviter_name . '\'s link and get a bonus.';
            }
        }
    }
}

// ── 4. Helpers ────────────────────────────────────────────────────────────────

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

// ── 5. Store links ────────────────────────────────────────────────────────────

$play_store_url = 'https://play.google.com/store/apps/details?id=com.beeyarn.beeyarn'
                . ($code ? '&referrer=' . rawurlencode('invite_code=' . $code) : '');

// App Store URL — add referral when iOS app launches
$app_store_url  = '#'; // coming soon

$deep_link      = $code
                ? 'beeyarn://invite/' . rawurlencode($code)
                : 'beeyarn://home';

// ── 6. Render ─────────────────────────────────────────────────────────────────

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: public, max-age=300');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- Open Graph -->
  <meta property="og:title"       content="<?= e($og_title) ?>" />
  <meta property="og:description" content="<?= e($og_desc) ?>" />
  <meta property="og:image"       content="<?= e($og_image) ?>" />
  <meta property="og:url"         content="<?= e($og_url) ?>" />
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="BeeYarn" />

  <!-- Twitter / X card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="<?= e($og_title) ?>" />
  <meta name="twitter:description" content="<?= e($og_desc) ?>" />
  <meta name="twitter:image"       content="<?= e($og_image) ?>" />

  <title><?= e($og_title) ?></title>
  <link rel="icon" type="image/jpeg" href="/assets/favicon.jpg" />
  <meta name="theme-color" content="#1C5B31" />

  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet" />

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --green:      #1C5B31;
      --green-dark: #145022;
      --green-bg:   #eaf5ee;
      --text:       #1c1c1c;
      --sub:        #6b7280;
      --border:     #e5e7eb;
      --bg:         #f6f7f8;
    }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }

    .card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 16px;
      max-width: 420px;
      width: 100%;
      padding: 36px 32px 32px;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.07);
    }

    /* Logo */
    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 28px;
      text-decoration: none;
    }

    .logo img { height: 36px; width: auto; }

    .logo-text {
      font-size: 22px;
      font-weight: 800;
      color: var(--green);
      letter-spacing: -0.5px;
    }

    /* Inviter */
    .inviter {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }

    .inviter-avatar {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid var(--green-bg);
      background: var(--green-bg);
    }

    .inviter-avatar-placeholder {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: var(--green-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      color: var(--green);
    }

    .inviter-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
    }

    /* Headline */
    .headline {
      font-size: 22px;
      font-weight: 800;
      color: var(--text);
      line-height: 1.3;
      margin-bottom: 10px;
      letter-spacing: -0.3px;
    }

    .tagline {
      font-size: 14px;
      color: var(--sub);
      line-height: 1.6;
      margin-bottom: 28px;
    }

    .tagline strong { color: var(--green); font-weight: 700; }

    /* Bonus badge */
    .bonus-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--green-bg);
      color: var(--green);
      font-size: 13px;
      font-weight: 700;
      padding: 7px 16px;
      border-radius: 20px;
      margin-bottom: 28px;
    }

    /* CTA buttons */
    .cta-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }

    .btn-store {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 13px 20px;
      border-radius: 12px;
      background: #000;
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: opacity 0.15s;
      border: none;
      cursor: pointer;
    }

    .btn-store:hover { opacity: 0.85; text-decoration: none; color: #fff; }

    .btn-store.google { background: #000; }
    .btn-store.apple  { background: #000; }

    .btn-store.soon {
      opacity: 0.45;
      cursor: not-allowed;
      pointer-events: none;
    }

    .btn-store img { height: 22px; width: auto; filter: invert(1); }

    .btn-store-label { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; }
    .btn-store-sub   { font-size: 10px; font-weight: 400; opacity: 0.8; }
    .btn-store-main  { font-size: 15px; font-weight: 700; }

    /* Deep link button */
    .btn-deeplink {
      display: none; /* shown by JS on mobile only */
      width: 100%;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 12px;
      background: var(--green-bg);
      color: var(--green);
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      border: 1.5px solid var(--green);
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
      margin-bottom: 16px;
    }

    .btn-deeplink:hover { background: #d4edda; text-decoration: none; color: var(--green); }

    /* Footer note */
    .footer-note {
      font-size: 11px;
      color: #aaa;
      margin-top: 20px;
    }

    /* Referral code pill */
    .code-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--bg);
      border: 1px dashed var(--border);
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 12px;
      color: var(--sub);
      margin-bottom: 20px;
      font-family: monospace;
      letter-spacing: 0.08em;
    }

    @media (max-width: 480px) {
      .card { padding: 28px 20px 24px; border-radius: 12px; }
      .headline { font-size: 20px; }
    }
  </style>
</head>
<body>

<div class="card">

  <!-- Logo -->
  <a href="https://www.beeyarn.com" class="logo">
    <img src="/assets/img/logo.png" alt="BeeYarn"
         onerror="this.style.display='none';this.nextElementSibling.style.display='inline'" />
    <span class="logo-text" style="display:none">BeeYarn</span>
    <span class="logo-text">BeeYarn</span>
  </a>

  <!-- Inviter -->
  <?php if ($inviter_name): ?>
  <div class="inviter">
    <?php if ($inviter_avatar): ?>
      <img class="inviter-avatar"
           src="<?= e($inviter_avatar) ?>"
           alt="<?= e($inviter_name) ?>"
           onerror="this.outerHTML='<div class=\'inviter-avatar-placeholder\'><i class=\'bi bi-person-fill\'></i></div>'" />
    <?php else: ?>
      <div class="inviter-avatar-placeholder"><i class="bi bi-person-fill"></i></div>
    <?php endif; ?>
    <span class="inviter-name"><?= e($inviter_name) ?> invited you</span>
  </div>
  <?php endif; ?>

  <!-- Headline -->
  <h1 class="headline">
    <?= $inviter_name ? 'Join ' . e($inviter_name) . ' on BeeYarn' : 'You\'ve been invited to BeeYarn' ?>
  </h1>

  <p class="tagline">
    <strong>Be seen, be heard.</strong> The platform where your voice earns you money.
    Sign up with this invite link and get a <strong>sign-up bonus</strong>.
  </p>

  <!-- Bonus badge -->
  <div class="bonus-badge">
    <i class="bi bi-gift-fill"></i> Referral bonus included
  </div>

  <?php if ($code): ?>
  <!-- Referral code display -->
  <div class="code-pill">
    <i class="bi bi-ticket-perforated"></i>
    Invite code: <strong><?= e($code) ?></strong>
  </div>
  <?php endif; ?>

  <!-- Deep link (shown on mobile via JS if app may be installed) -->
  <a id="btn-deeplink" class="btn-deeplink" href="<?= e($deep_link) ?>">
    <i class="bi bi-box-arrow-up-right"></i> Open in BeeYarn
  </a>

  <!-- Store buttons — visibility controlled by JS platform detection below -->
  <div class="cta-group" id="store-buttons">
    <a id="btn-google" href="<?= e($play_store_url) ?>" class="btn-store google" target="_blank" rel="noopener" style="display:none">
      <img src="/assets/img/google-play-badge.svg" alt="" />
      <span class="btn-store-label">
        <span class="btn-store-sub">Get it on</span>
        <span class="btn-store-main">Google Play</span>
      </span>
    </a>

    <a id="btn-apple" href="#" class="btn-store apple soon" aria-disabled="true" style="display:none">
      <img src="/assets/img/app-store-badge.svg" alt="" />
      <span class="btn-store-label">
        <span class="btn-store-sub">Download on the</span>
        <span class="btn-store-main">App Store <small style="font-size:10px;font-weight:400">(soon)</small></span>
      </span>
    </a>
  </div>

  <p class="footer-note">
    &copy; <?= date('Y') ?> BeeYarn. All rights reserved.<br />
    <a href="/privacy" style="color:#aaa">Privacy Policy</a> &middot;
    <a href="/termsofuse" style="color:#aaa">Terms of Use</a>
  </p>

</div>

<script>
  (function () {
    var code      = <?= $code ? json_encode($code) : 'null' ?>;
    var ua        = navigator.userAgent;
    var isIOS     = /iPhone|iPad|iPod/i.test(ua);
    var isAndroid = /Android/i.test(ua);

    var btnGoogle = document.getElementById('btn-google');
    var btnApple  = document.getElementById('btn-apple');
    var btnDeep   = document.getElementById('btn-deeplink');

    // ── 1. Platform detection — show the right store button(s) ───────────────
    if (isAndroid) {
      btnGoogle.style.display = 'flex';
    } else if (isIOS) {
      btnApple.style.display = 'flex';
    } else {
      // Desktop — show both
      btnGoogle.style.display = 'flex';
      btnApple.style.display  = 'flex';
    }

    // ── 2. Clipboard copy helper ──────────────────────────────────────────────
    // Copies the referral code to the system clipboard so the Flutter app can
    // read it on first launch (deferred deep link fallback).
    // This is the standard DIY approach when Play Install Referrer / SKAdNetwork
    // are not available. The user may see a clipboard permission prompt on some
    // Android versions — that is expected and unavoidable with this technique.
    function copyCodeToClipboard(callback) {
      if (!code) { callback(); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(callback, callback);
      } else {
        // Fallback for older browsers / restricted contexts
        try {
          var ta = document.createElement('textarea');
          ta.value = code;
          ta.style.position = 'fixed';
          ta.style.opacity  = '0';
          document.body.appendChild(ta);
          ta.focus(); ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (e) { /* silently ignore — app will just get no code */ }
        callback();
      }
    }

    // ── 3. Store button clicks — copy code then redirect ─────────────────────
    [btnGoogle, btnApple].forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        if (!code) return; // no code — let href navigate normally
        e.preventDefault();
        var dest = btn.href;
        copyCodeToClipboard(function () {
          window.location.href = dest;
        });
      });
    });

    // ── 4. Deep link attempt (mobile only, for already-installed app) ─────────
    // Fires beeyarn://invite/{code} silently. If the app is installed the OS
    // intercepts it and DeepLinkService handles it — no clipboard needed.
    // If not installed, nothing happens and the user taps the store button.
    if ((isIOS || isAndroid) && code) {
      var deepLink = 'beeyarn://invite/' + encodeURIComponent(code);

      // Show the "Open in BeeYarn" button
      btnDeep.style.display = 'flex';

      // Attempt silently via hidden iframe on page load
      var iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = deepLink;
      document.body.appendChild(iframe);
      setTimeout(function () {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 500);

      // Manual tap — re-attempt
      btnDeep.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = deepLink;
      });
    }
  })();
</script>

</body>
</html>
