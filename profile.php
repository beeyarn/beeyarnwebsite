<?php
/**
 * BeeYarn — Server-side Open Graph meta tag injector for profile share links.
 *
 * Handles /profile/{username} requests by:
 *   1. Fetching profile data from the BeeYarn API
 *   2. Injecting profile-specific OG / Twitter Card meta tags into the HTML head
 *   3. Serving the full SPA so regular users experience the site normally
 *
 * Social crawlers (WhatsApp, Telegram, Facebook, etc.) never execute JavaScript,
 * so the tags MUST be present in the initial server-rendered HTML.
 */

// ── 1. Extract and validate username ─────────────────────────────────────────

$username = isset($_GET['username']) ? trim($_GET['username']) : '';

// Accept only URL-safe characters; reject anything suspicious
if (!preg_match('/^[a-zA-Z0-9_\-.]+$/', $username)) {
    $username = '';
}

// ── 1b. Real browsers go straight to the Flutter web app ─────────────────────
//
// Social/search crawlers never execute JavaScript, so they still need this
// script to serve pre-rendered OG tags (below). Everyone else skips the API
// fetch entirely and is sent straight to the Flutter app's profile route.
$ua       = $_SERVER['HTTP_USER_AGENT'] ?? '';
$is_crawler = (bool) preg_match(
    '/facebookexternalhit|Facebot|WhatsApp|TelegramBot|Twitterbot|LinkedInBot|' .
    'Slackbot|Discordbot|SkypeUriPreview|Pinterest|redditbot|vkShare|' .
    'Googlebot|bingbot|YandexBot|Applebot|ia_archiver/i',
    $ua
);

if ($username && !$is_crawler) {
    header('Location: https://www.beeyarn.com/home/profile/' . rawurlencode($username), true, 302);
    exit;
}

// ── 2. Defaults (used when the API call fails or username is missing) ─────────

$og_title   = 'BeeYarn — Be Seen, Be Heard';
$og_desc    = 'A social platform connecting people through real-time messaging, '
            . 'video calls, and discussion forums. Everyone gets paid.';
$og_image   = 'https://www.beeyarn.com/assets/img/homepage.jpg';
$og_url     = $username
            ? 'https://www.beeyarn.com/profile/' . rawurlencode($username)
            : 'https://www.beeyarn.com/';
$og_type    = 'profile';
$page_title = 'BeeYarn';

// ── 3. Fetch profile data (with file-based cache) ─────────────────────────────

// Cache profile API responses for 5 minutes so repeated hits (crawlers
// re-fetching) don't hammer the backend API.
define('CACHE_DIR', sys_get_temp_dir() . '/beeyarn_og_cache');
define('CACHE_TTL', 300); // 5 minutes

function cache_get(string $key): ?array
{
    $file = CACHE_DIR . '/' . $key . '.json';
    if (!file_exists($file)) return null;
    if (time() - filemtime($file) > CACHE_TTL) {
        @unlink($file);
        return null;
    }
    $data = @json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : null;
}

function cache_set(string $key, array $data): void
{
    if (!is_dir(CACHE_DIR)) @mkdir(CACHE_DIR, 0755, true);
    @file_put_contents(CACHE_DIR . '/' . $key . '.json', json_encode($data), LOCK_EX);
}

if ($username) {
    $api_url   = 'https://api.beeyarn.com/api/profile/' . rawurlencode($username);
    $cache_key = 'profile_' . preg_replace('/[^a-zA-Z0-9_\-]/', '', $username);
    $profile   = cache_get($cache_key);

    if ($profile === null) {
        // Cache miss — fetch from API
        if (function_exists('curl_init')) {
            $ch = curl_init($api_url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 5,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_USERAGENT      => 'BeeYarnBot/1.0 (OG meta fetcher)',
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS      => 3,
                CURLOPT_SSL_VERIFYPEER => true,
            ]);
            $raw    = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($raw !== false && $status === 200) {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    $profile = isset($decoded['data']) ? $decoded['data'] : $decoded;
                }
            }
        } else {
            $ctx = stream_context_create(['http' => [
                'timeout'       => 5,
                'user_agent'    => 'BeeYarnBot/1.0 (OG meta fetcher)',
                'ignore_errors' => true,
            ]]);
            $raw = @file_get_contents($api_url, false, $ctx);
            if ($raw !== false) {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    $profile = isset($decoded['data']) ? $decoded['data'] : $decoded;
                }
            }
        }

        if (is_array($profile) && !empty($profile)) {
            cache_set($cache_key, $profile);
        }
    }

    // ── 4. Extract fields from profile data ───────────────────────────────────

    if (is_array($profile) && !empty($profile)) {

        // Title: prefer display name; fall back to "@username on BeeYarn"
        $display_name = $profile['name'] ?? $profile['full_name'] ?? '';
        if ($display_name !== '') {
            $og_title   = $display_name . ' (@' . $username . ') on BeeYarn';
            $page_title = $display_name . ' on BeeYarn';
        } else {
            $og_title   = '@' . $username . ' on BeeYarn';
            $page_title = '@' . $username . ' on BeeYarn';
        }

        // Description: bio if present, else a generic profile tagline
        $bio = trim((string)($profile['bio'] ?? $profile['about'] ?? ''));
        if ($bio !== '') {
            $og_desc = mb_strlen($bio) > 200 ? mb_substr($bio, 0, 197) . '...' : $bio;
        } else {
            $og_desc = 'Check out @' . $username . '\'s profile on BeeYarn — be seen, be heard.';
        }

        // Image: avatar / profile picture; else default logo
        $avatar = $profile['avatar']
               ?? $profile['profile_picture']['thumb']
               ?? $profile['profile_picture']['url']
               ?? null;
        if (!empty($avatar)) {
            $og_image = $avatar;
        }
    }
}

// ── 5. Build the meta tag block ───────────────────────────────────────────────

function e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

$meta_block = '  <meta property="og:title" content="'       . e($og_title) . '" />' . "\n"
            . '  <meta property="og:description" content="' . e($og_desc)  . '" />' . "\n"
            . '  <meta property="og:image" content="'       . e($og_image) . '" />' . "\n"
            . '  <meta property="og:url" content="'         . e($og_url)   . '" />' . "\n"
            . '  <meta property="og:type" content="'        . e($og_type)  . '" />' . "\n"
            . '  <meta property="og:site_name" content="BeeYarn" />' . "\n"
            . '  <meta name="twitter:card" content="summary_large_image" />' . "\n"
            . '  <meta name="twitter:title" content="'       . e($og_title) . '" />' . "\n"
            . '  <meta name="twitter:description" content="' . e($og_desc)  . '" />' . "\n"
            . '  <meta name="twitter:image" content="'       . e($og_image) . '" />';

// ── 6. Load the SPA shell and inject the new meta tags ───────────────────────

$html = file_get_contents(__DIR__ . '/home.html');

if ($html === false) {
    // Absolute fallback: bare-bones page with only meta tags + JS redirect
    header('Content-Type: text/html; charset=UTF-8');
    echo '<!DOCTYPE html><html><head>' . "\n"
       . $meta_block . "\n"
       . '<meta http-equiv="refresh" content="0;url=/" />'  . "\n"
       . '</head><body></body></html>';
    exit;
}

// Remove every pre-existing OG and Twitter meta tag so we don't end up with duplicates
$html = preg_replace(
    '/<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*\/?\s*>\s*/i',
    '',
    $html
);

// Replace <title>BeeYarn</title> with the profile-specific title
$html = preg_replace(
    '/<title>[^<]*<\/title>/i',
    '<title>' . e($page_title) . '</title>',
    $html,
    1
);

// Inject the new meta block just before </head>
$html = str_replace('</head>', $meta_block . "\n</head>", $html);

// ── 7. Send the response ─────────────────────────────────────────────────────

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: public, max-age=300');
echo $html;
