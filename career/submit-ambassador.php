<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['result' => 'error', 'message' => 'Invalid request']);
    exit;
}

$data = [
    'timestamp'      => date('Y-m-d H:i:s'),
    'fullName'       => trim($_POST['fullName'] ?? ''),
    'email'          => trim($_POST['email'] ?? ''),
    'phone'          => trim($_POST['phone'] ?? ''),
    'institution'    => trim($_POST['institution'] ?? ''),
    'department'     => trim($_POST['department'] ?? ''),
    'level'          => trim($_POST['level'] ?? ''),
    'socialPlatform' => trim($_POST['socialPlatform'] ?? ''),
    'whyAmbassador'  => trim($_POST['whyAmbassador'] ?? ''),
    'status'         => 'Pending'
];

// Basic validation
if (empty($data['fullName']) || empty($data['email'])) {
    echo json_encode(['result' => 'error', 'message' => 'Missing required fields']);
    exit;
}

$file = '/var/beeyarn-storage/ambassador-applications.csv';
$isNew = !file_exists($file);

$handle = fopen($file, 'a');
if (!$handle) {
    echo json_encode(['result' => 'error', 'message' => 'Could not open file']);
    exit;
}

// Write header row on first run
if ($isNew) {
    fputcsv($handle, ['Timestamp', 'Full Name', 'Email', 'Phone', 'Institution', 'Department', 'Level', 'Social Platform', 'Why They Want to Join', 'Status']);
}

fputcsv($handle, array_values($data));
fclose($handle);

echo json_encode(['result' => 'success']);
