<?php
/**
 * BeeYarn: iOS launch waitlist.
 * Stores email addresses of people who want to be told when the iOS app is ready.
 * Data lives outside the web root, next to the ambassador applications.
 */
header('Content-Type: application/json');
header('Cache-Control: no-store');

function respond($ok, $message, $code = 200) {
    http_response_code($code);
    echo json_encode(['result' => $ok ? 'success' : 'error', 'message' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Invalid request.', 405);
}

// Honeypot: real users never fill this hidden field. Pretend success to bots.
if (!empty($_POST['website'] ?? '')) {
    respond(true, "You're on the list.");
}

$email = strtolower(trim($_POST['email'] ?? ''));
// Leading = + - @ would be treated as a formula if the CSV is opened in a spreadsheet.
if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strpbrk($email[0], '=+-@') !== false) {
    respond(false, 'Please enter a valid email address.', 422);
}

$file = '/var/beeyarn-storage/ios-waitlist.csv';
$handle = fopen($file, 'c+');
if (!$handle) {
    respond(false, 'Something went wrong. Please try again later.', 500);
}
flock($handle, LOCK_EX);

// Skip duplicates (still tell the user they're on the list).
$isNew = (fstat($handle)['size'] === 0);
if (!$isNew) {
    rewind($handle);
    fgetcsv($handle); // header
    while (($row = fgetcsv($handle)) !== false) {
        if (isset($row[1]) && strtolower($row[1]) === $email) {
            flock($handle, LOCK_UN);
            fclose($handle);
            respond(true, "You're already on the list.");
        }
    }
}

fseek($handle, 0, SEEK_END);
if ($isNew) {
    fputcsv($handle, ['Timestamp', 'Email', 'Source']);
}
fputcsv($handle, [date('Y-m-d H:i:s'), $email, 'website']);
flock($handle, LOCK_UN);
fclose($handle);

respond(true, "You're on the list. We'll email you when the iOS app is ready.");
