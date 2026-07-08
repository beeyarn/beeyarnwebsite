<?php
/**
 * BeeYarn — OG cache purge endpoint.
 *
 * Called by the BeeYarn API server whenever a post is created, updated, or
 * deleted. Deletes the cached OG meta data for that slug so the next visitor
 * gets fresh tags.
 *
 * Usage (from the API server):
 *   POST https://www.beeyarn.com/purge-og-cache.php
 *   Content-Type: application/json
 *   X-Purge-Token: <PURGE_SECRET>
 *
 *   { "slug": "ef-70" }
 *
 * Set PURGE_SECRET to a long random string and store the same value in the
 * API server's environment — this prevents anyone on the internet from
 * arbitrarily busting the cache.
 */

define('PURGE_SECRET', $_SERVER['BEEYARN_PURGE_SECRET'] ?? getenv('BEEYARN_PURGE_SECRET') ?: 'change-me-to-a-long-random-secret');
define('CACHE_DIR',    sys_get_temp_dir() . '/beeyarn_og_cache');

header('Content-Type: application/json');

// ── Auth ─────────────────────────────────────────────────────────────────────

$token = $_SERVER['HTTP_X_PURGE_TOKEN'] ?? '';
if (!hash_equals(PURGE_SECRET, $token)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Unauthorized']);
    exit;
}

// ── Method ───────────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

// ── Payload ──────────────────────────────────────────────────────────────────

$body = json_decode(file_get_contents('php://input'), true);
$slug = isset($body['slug']) ? trim((string)$body['slug']) : '';

if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $slug)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid or missing slug']);
    exit;
}

// ── Purge ────────────────────────────────────────────────────────────────────

$cache_key  = 'post_' . preg_replace('/[^a-zA-Z0-9_\-]/', '', $slug);
$cache_file = CACHE_DIR . '/' . $cache_key . '.json';

if (file_exists($cache_file)) {
    @unlink($cache_file);
    echo json_encode(['ok' => true, 'purged' => $slug]);
} else {
    // Not cached — nothing to purge, still a success
    echo json_encode(['ok' => true, 'purged' => null, 'note' => 'not in cache']);
}
