<?php
/**
 * BeeYarn — Server-side Open Graph meta tag injector for post share links.
 *
 * Handles /p/{slug} requests by:
 *   1. Fetching post data from the BeeYarn API
 *   2. Injecting post-specific OG / Twitter Card meta tags into the HTML head
 *   3. Serving the full SPA so regular users experience the site normally
 *
 * Social crawlers (WhatsApp, Telegram, Facebook, etc.) never execute JavaScript,
 * so the tags MUST be present in the initial server-rendered HTML.
 */

// ── 1. Extract and validate slug ─────────────────────────────────────────────

$slug = isset($_GET['slug']) ? trim($_GET['slug']) : '';

// Accept only URL-safe characters; reject anything suspicious
if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $slug)) {
    $slug = '';
}

// ── 1b. Real browsers go straight to the Flutter web app ─────────────────────
//
// Social/search crawlers never execute JavaScript, so they still need this
// script to serve pre-rendered OG tags (below). Everyone else skips the API
// fetch entirely and is sent straight to the Flutter app's post route.
$ua       = $_SERVER['HTTP_USER_AGENT'] ?? '';
$is_crawler = (bool) preg_match(
    '/facebookexternalhit|Facebot|WhatsApp|TelegramBot|Twitterbot|LinkedInBot|' .
    'Slackbot|Discordbot|SkypeUriPreview|Pinterest|redditbot|vkShare|' .
    'Googlebot|bingbot|YandexBot|Applebot|ia_archiver/i',
    $ua
);

if ($slug && !$is_crawler) {
    header('Location: https://www.beeyarn.com/home/p/' . rawurlencode($slug), true, 302);
    exit;
}

// ── 2. Defaults (used when the API call fails or slug is missing) ─────────────

$og_title = 'BeeYarn — Be Seen, Be Heard';
$og_desc  = 'A social platform connecting people through real-time messaging, '
           . 'video calls, and discussion forums. Everyone gets paid.';
$og_image = 'https://www.beeyarn.com/assets/img/homepage.jpg';
$og_url   = $slug
           ? 'https://www.beeyarn.com/p/' . rawurlencode($slug)
           : 'https://www.beeyarn.com/';
$og_type  = 'article';
$page_title = 'BeeYarn';

// ── 3. Fetch post data (with file-based cache) ───────────────────────────────

// Cache post API responses for 1 hour so repeated hits (viral posts, crawlers
// re-fetching) don't hammer the backend API.
define('CACHE_DIR', sys_get_temp_dir() . '/beeyarn_og_cache');
define('CACHE_TTL', 300); // 5 minutes — purge endpoint handles instant invalidation on post update

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

if ($slug) {
    $api_url   = 'https://api.beeyarn.com/api/posts/' . rawurlencode($slug);
    $cache_key = 'post_' . preg_replace('/[^a-zA-Z0-9_\-]/', '', $slug);
    $post      = cache_get($cache_key);

    if ($post === null) {
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
                    $post = isset($decoded['data']) ? $decoded['data'] : $decoded;
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
                    $post = isset($decoded['data']) ? $decoded['data'] : $decoded;
                }
            }
        }

        if (is_array($post) && !empty($post)) {
            cache_set($cache_key, $post);
        }
    }

    // ── 4. Extract fields from post data ─────────────────────────────────────

    if (is_array($post) && !empty($post)) {

        // Title: prefer explicit post title; fall back to "@username on BeeYarn"
        if (!empty($post['title'])) {
            $og_title   = $post['title'] . ' — BeeYarn';
            $page_title = $post['title'] . ' — BeeYarn';
        } elseif (!empty($post['user']['username'])) {
            $og_title   = '@' . $post['user']['username'] . ' on BeeYarn';
            $page_title = '@' . $post['user']['username'] . ' on BeeYarn';
        }

        // Description: first 200 chars of body, stripped of markup
        $raw_body = isset($post['body']) ? (string)$post['body'] : '';
        $body     = strip_tags($raw_body);
        $body     = preg_replace('/\s+/', ' ', trim($body));
        if ($body !== '') {
            $og_desc = mb_strlen($body) > 200
                ? mb_substr($body, 0, 197) . '...'
                : $body;
        }

        // Image: first media file — prefer thumbnail, then full URL; else default logo
        $files = isset($post['post_media']['files']) && is_array($post['post_media']['files'])
               ? $post['post_media']['files']
               : [];

        if (!empty($files)) {
            $first = $files[0];
            if (!empty($first['thumb'])) {
                $og_image = $first['thumb'];
            } elseif (!empty($first['url'])) {
                $og_image = $first['url'];
            }
            // (if neither thumb nor url, og_image stays as the default BeeYarn logo)
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

// Replace <title>BeeYarn</title> with the post-specific title
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
// TTL matches the internal file cache (300s). The purge endpoint handles
// instant invalidation on post update, so this is just a safety-net ceiling.
header('Cache-Control: public, max-age=300');
echo $html;
