<?php
/**
 * BeeYarn — Landing page for shared live links.
 *
 * Handles /live/{id} requests:
 *   1. Fetches the live's public preview from the BeeYarn API
 *   2. Renders preview tags for WhatsApp, Telegram and similar apps
 *   3. On a phone, tries to open the live in the app, with store buttons as the fallback
 */

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

// ── 1. Extract and validate the live id ──────────────────────────────────────

$id = isset($_GET['id']) && is_string($_GET['id']) ? trim($_GET['id']) : '';

if (!preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $id)) {
    $id = '';
}

// ── 2. Fetch the preview ─────────────────────────────────────────────────────

$live       = null;
$api_status = 0;

if ($id && function_exists('curl_init')) {
    $ch = curl_init('https://api.beeyarn.com/api/public/live/' . rawurlencode($id));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_USERAGENT      => 'BeeYarnBot/1.0 (live page)',
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $raw        = curl_exec($ch);
    $api_status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw !== false && $api_status === 200) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded['data'] ?? null)) {
            $live = $decoded['data'];
        }
    }
}

// ── 3. Work out what to show ─────────────────────────────────────────────────

// If the API can't be reached, the live may still be running, so the link is still offered.
$not_found  = !$id || $api_status === 404;
$is_live    = !$not_found && ($live === null || ($live['status'] ?? '') === 'live');

$host_name  = is_string($live['host']['name'] ?? null) ? $live['host']['name'] : '';
$host_user  = is_string($live['host']['username'] ?? null) ? $live['host']['username'] : '';
$avatar     = is_string($live['host']['avatar'] ?? null) ? $live['host']['avatar'] : '';
$title      = is_string($live['title'] ?? null) ? $live['title'] : '';
$thumbnail  = is_string($live['thumbnail_url'] ?? null) ? $live['thumbnail_url'] : '';
$image      = $thumbnail ?: ($avatar ?: 'https://www.beeyarn.com/assets/img/homepage.jpg');

if ($not_found) {
    $headline = 'This live could not be found';
    $tagline  = 'It may have been removed. There is always more to watch on BeeYarn.';
} elseif (!$is_live) {
    $headline = $host_name ? $host_name . '\'s live has ended' : 'This live has ended';
    $tagline  = $title ?: 'Open BeeYarn to find other lives happening now.';
} else {
    $headline = $host_name ? $host_name . ' is live on BeeYarn' : 'Live now on BeeYarn';
    $tagline  = $title ?: 'Join the live on the BeeYarn app.';
}

$page_url  = $id ? 'https://www.beeyarn.com/live/' . rawurlencode($id) : 'https://www.beeyarn.com/';
$deep_link = ($id && $is_live) ? 'beeyarn://live/' . rawurlencode($id) : 'beeyarn://home';
$play_url  = 'https://play.google.com/store/apps/details?id=com.beeyarn.beeyarn';

// ── 4. Render ────────────────────────────────────────────────────────────────

if ($not_found) {
    http_response_code(404);
}

header('Content-Type: text/html; charset=UTF-8');
// A live ends at any moment, so this page can only be cached briefly.
header('Cache-Control: public, max-age=30');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <?php if ($not_found): ?><meta name="robots" content="noindex" /><?php endif; ?>

  <!-- Open Graph -->
  <meta property="og:title"       content="<?= e($headline) ?>" />
  <meta property="og:description" content="<?= e($tagline) ?>" />
  <meta property="og:image"       content="<?= e($image) ?>" />
  <meta property="og:url"         content="<?= e($page_url) ?>" />
  <meta property="og:type"        content="website" />
  <meta property="og:site_name"   content="BeeYarn" />

  <!-- Twitter / X card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="<?= e($headline) ?>" />
  <meta name="twitter:description" content="<?= e($tagline) ?>" />
  <meta name="twitter:image"       content="<?= e($image) ?>" />

  <title><?= e($headline) ?></title>
  <link rel="icon" type="image/jpeg" href="/assets/favicon.jpg" />
  <meta name="theme-color" content="#1C5B31" />

  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" rel="stylesheet" />

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --green:      #1C5B31;
      --green-bg:   #eaf5ee;
      --text:       #1c1c1c;
      --sub:        #6b7280;
      --border:     #e5e7eb;
      --bg:         #f6f7f8;
      --live:       #dc2626;
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

    .logo {
      display: block;
      font-size: 22px;
      font-weight: 800;
      color: var(--green);
      letter-spacing: -0.5px;
      text-decoration: none;
      margin-bottom: 28px;
    }

    .thumbnail {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 12px;
      background: var(--green-bg);
      margin-bottom: 20px;
    }

    .avatar {
      width: 76px;
      height: 76px;
      border-radius: 50%;
      object-fit: cover;
      background: var(--green-bg);
      border: 3px solid var(--green-bg);
      margin-bottom: 14px;
    }

    .avatar.is-live { border-color: var(--live); }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--live);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 14px;
    }

    .badge::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #fff;
    }

    .headline {
      font-size: 22px;
      font-weight: 800;
      line-height: 1.3;
      letter-spacing: -0.3px;
      margin-bottom: 6px;
      overflow-wrap: anywhere;
    }

    .username {
      font-size: 13px;
      color: var(--sub);
      margin-bottom: 10px;
      overflow-wrap: anywhere;
    }

    .tagline {
      font-size: 14px;
      color: var(--sub);
      line-height: 1.6;
      margin-bottom: 24px;
      overflow-wrap: anywhere;
    }

    .btn-open {
      display: none; /* shown by JS on phones only */
      width: 100%;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 20px;
      border-radius: 12px;
      background: var(--green);
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      margin-bottom: 12px;
    }

    .desktop-note {
      display: none; /* shown by JS on computers only */
      font-size: 13px;
      color: var(--sub);
      margin-bottom: 14px;
    }

    .stores { display: flex; flex-direction: column; gap: 12px; }

    .btn-store {
      display: none; /* JS shows the right one for the device */
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 13px 20px;
      border-radius: 12px;
      background: #000;
      color: #fff;
      text-decoration: none;
    }

    .btn-store:hover { opacity: 0.85; }
    .btn-store.soon { opacity: 0.45; pointer-events: none; }
    .btn-store img { height: 22px; width: auto; filter: invert(1); }
    .btn-store-label { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; }
    .btn-store-sub { font-size: 10px; font-weight: 400; opacity: 0.8; }
    .btn-store-main { font-size: 15px; font-weight: 700; }

    .footer-note { font-size: 11px; color: #aaa; margin-top: 20px; }
    .footer-note a { color: #aaa; }

    @media (max-width: 480px) {
      .card { padding: 28px 20px 24px; border-radius: 12px; }
      .headline { font-size: 20px; }
    }
  </style>
</head>
<body>

<main class="card">
  <a href="https://www.beeyarn.com" class="logo">BeeYarn</a>

  <?php if ($thumbnail): ?>
    <img class="thumbnail" src="<?= e($thumbnail) ?>" alt="" onerror="this.style.display='none'" />
  <?php elseif ($avatar): ?>
    <img class="avatar <?= $is_live ? 'is-live' : '' ?>" src="<?= e($avatar) ?>" alt="" onerror="this.style.display='none'" />
  <?php endif; ?>

  <?php if ($is_live): ?>
    <div><span class="badge">LIVE</span></div>
  <?php endif; ?>

  <h1 class="headline"><?= e($headline) ?></h1>
  <?php if ($host_user): ?>
    <p class="username">@<?= e($host_user) ?></p>
  <?php endif; ?>
  <p class="tagline"><?= e($tagline) ?></p>

  <a id="btn-open" class="btn-open" href="<?= e($deep_link) ?>">
    <i class="bi bi-box-arrow-up-right"></i>
    <?= $is_live ? 'Watch in the BeeYarn app' : 'Open BeeYarn' ?>
  </a>

  <p id="desktop-note" class="desktop-note">Get the BeeYarn app on your phone to watch.</p>

  <div class="stores">
    <a id="btn-google" href="<?= e($play_url) ?>" class="btn-store" target="_blank" rel="noopener">
      <img src="/assets/img/google-play-badge.svg" alt="" />
      <span class="btn-store-label">
        <span class="btn-store-sub">Get it on</span>
        <span class="btn-store-main">Google Play</span>
      </span>
    </a>
    <a id="btn-apple" href="#" class="btn-store soon" aria-disabled="true">
      <img src="/assets/img/app-store-badge.svg" alt="" />
      <span class="btn-store-label">
        <span class="btn-store-sub">Download on the</span>
        <span class="btn-store-main">App Store <small style="font-size:10px;font-weight:400">(soon)</small></span>
      </span>
    </a>
  </div>

  <p class="footer-note">
    &copy; <?= date('Y') ?> BeeYarn. All rights reserved.<br />
    <a href="/privacy">Privacy Policy</a> &middot;
    <a href="/termsofuse">Terms of Use</a>
  </p>
</main>

<script>
  (function () {
    var ua        = navigator.userAgent;
    var isIOS     = /iPhone|iPad|iPod/i.test(ua);
    var isAndroid = /Android/i.test(ua);
    var isLive    = <?= $is_live ? 'true' : 'false' ?>;
    var deepLink  = <?= json_encode($deep_link, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES) ?>;

    var google = document.getElementById('btn-google');
    var apple  = document.getElementById('btn-apple');

    if (isAndroid) {
      google.style.display = 'flex';
    } else if (isIOS) {
      apple.style.display = 'flex';
    } else {
      google.style.display = 'flex';
      apple.style.display  = 'flex';
      document.getElementById('desktop-note').style.display = 'block';
    }

    if (isIOS || isAndroid) {
      document.getElementById('btn-open').style.display = 'flex';

      // If the app is installed the phone opens it. If not, nothing happens and the page stays.
      if (isLive) {
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLink;
        document.body.appendChild(iframe);
        setTimeout(function () {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 500);
      }
    }
  })();
</script>

</body>
</html>
