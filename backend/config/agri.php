<?php

// Planning values for estimates. Yields (t/ha) and reference prices (BDT/kg) are approximate
// national figures; rice, potato and tomato come from the earlier BBS seed, the rest should be
// checked against current BBS/DAM data before they are quoted as official.
$stages = fn (array $names) => array_map(fn ($s) => ['id' => $s[0], 'en' => $s[1], 'bn' => $s[2], 'until' => $s[3]], $names);

$grain = $stages([
    ['seedling', 'Seedling', 'চারা', 0.16],
    ['vegetative', 'Growing', 'কুশি ও বৃদ্ধি', 0.42],
    ['flowering', 'Flowering', 'থোড় ও ফুল', 0.70],
    ['ripening', 'Ripening', 'দানা পাকা', 1.0],
]);
$root = $stages([
    ['sprout', 'Sprouting', 'অঙ্কুরোদগম', 0.18],
    ['vegetative', 'Leaf growth', 'পাতার বৃদ্ধি', 0.50],
    ['bulking', 'Bulking', 'কন্দ বৃদ্ধি', 0.85],
    ['ripening', 'Ready soon', 'তোলার সময়', 1.0],
]);
$fruit = $stages([
    ['seedling', 'Seedling', 'চারা', 0.20],
    ['vegetative', 'Growing', 'গাছের বৃদ্ধি', 0.45],
    ['flowering', 'Flowering', 'ফুল', 0.65],
    ['ripening', 'Fruiting', 'ফল ধরা', 1.0],
]);

return [
    'chemical_note' => [
        'en' => 'Confirm any chemical with your local agriculture officer before use (BRRI/DAE guidance).',
        'bn' => 'রাসায়নিক ব্যবহারের আগে স্থানীয় কৃষি কর্মকর্তার সাথে নিশ্চিত করুন (BRRI/DAE নির্দেশনা)।',
    ],

    'crops' => [
        'rice' => ['en' => 'Rice', 'bn' => 'ধান', 'emoji' => '🌾', 'family' => 'cereal', 'days' => 130, 't_per_ha' => 3.2, 'price' => 30, 'water' => 'high', 'sow_months' => [1, 2, 6, 7, 8, 12], 'stages' => $grain, 'fertilize_at' => ['vegetative', 'flowering']],
        'wheat' => ['en' => 'Wheat', 'bn' => 'গম', 'emoji' => '🌿', 'family' => 'cereal', 'days' => 110, 't_per_ha' => 3.2, 'price' => 38, 'water' => 'medium', 'sow_months' => [11, 12], 'stages' => $grain, 'fertilize_at' => ['vegetative']],
        'maize' => ['en' => 'Maize', 'bn' => 'ভুট্টা', 'emoji' => '🌽', 'family' => 'cereal', 'days' => 120, 't_per_ha' => 7.0, 'price' => 28, 'water' => 'medium', 'sow_months' => [10, 11, 12, 2, 3], 'stages' => $grain, 'fertilize_at' => ['vegetative', 'flowering']],
        'potato' => ['en' => 'Potato', 'bn' => 'আলু', 'emoji' => '🥔', 'family' => 'solanaceae', 'days' => 90, 't_per_ha' => 20.0, 'price' => 25, 'water' => 'medium', 'sow_months' => [10, 11, 12], 'stages' => $root, 'fertilize_at' => ['vegetative']],
        'tomato' => ['en' => 'Tomato', 'bn' => 'টমেটো', 'emoji' => '🍅', 'family' => 'solanaceae', 'days' => 100, 't_per_ha' => 15.0, 'price' => 40, 'water' => 'medium', 'sow_months' => [9, 10, 11], 'stages' => $fruit, 'fertilize_at' => ['vegetative', 'flowering']],
        'brinjal' => ['en' => 'Brinjal', 'bn' => 'বেগুন', 'emoji' => '🍆', 'family' => 'solanaceae', 'days' => 130, 't_per_ha' => 14.0, 'price' => 40, 'water' => 'medium', 'sow_months' => [6, 7, 8, 9, 10], 'stages' => $fruit, 'fertilize_at' => ['vegetative', 'flowering']],
        'onion' => ['en' => 'Onion', 'bn' => 'পেঁয়াজ', 'emoji' => '🧅', 'family' => 'allium', 'days' => 110, 't_per_ha' => 10.0, 'price' => 60, 'water' => 'medium', 'sow_months' => [10, 11, 12], 'stages' => $root, 'fertilize_at' => ['vegetative']],
        'mustard' => ['en' => 'Mustard', 'bn' => 'সরিষা', 'emoji' => '🌼', 'family' => 'brassica', 'days' => 85, 't_per_ha' => 1.4, 'price' => 80, 'water' => 'low', 'sow_months' => [10, 11], 'stages' => $grain, 'fertilize_at' => ['vegetative']],
        'lentil' => ['en' => 'Lentil', 'bn' => 'মসুর', 'emoji' => '🫘', 'family' => 'legume', 'days' => 105, 't_per_ha' => 1.1, 'price' => 110, 'water' => 'low', 'sow_months' => [10, 11], 'stages' => $grain, 'fertilize_at' => []],
        'jute' => ['en' => 'Jute', 'bn' => 'পাট', 'emoji' => '🌱', 'family' => 'fiber', 'days' => 120, 't_per_ha' => 2.2, 'price' => 65, 'water' => 'medium', 'sow_months' => [3, 4, 5], 'stages' => $grain, 'fertilize_at' => ['vegetative']],
    ],

    'diseases' => [
        'rice_blast' => ['en' => 'Rice blast', 'bn' => 'ধানের ব্লাস্ট রোগ', 'severity' => 'high',
            'steps_en' => ['Remove and burn affected leaves', 'Keep water controlled and avoid long waterlogging', 'Use an approved fungicide only on local advice'],
            'steps_bn' => ['আক্রান্ত পাতা ও গাছ সরিয়ে পুড়িয়ে ফেলুন', 'ক্ষেতে পানি নিয়ন্ত্রণ রাখুন, অতিরিক্ত জলাবদ্ধতা এড়ান', 'প্রয়োজনে অনুমোদিত ছত্রাকনাশক স্থানীয় পরামর্শ অনুযায়ী ব্যবহার করুন']],
        'brown_spot' => ['en' => 'Brown spot', 'bn' => 'বাদামি দাগ রোগ', 'severity' => 'medium',
            'steps_en' => ['Use balanced fertilizer with potash', 'Use disease-free seed next season', 'Spray an approved fungicide only on local advice'],
            'steps_bn' => ['সুষম সার ও পটাশ ব্যবহার করুন', 'পরের মৌসুমে রোগমুক্ত বীজ ব্যবহার করুন', 'প্রয়োজনে অনুমোদিত ছত্রাকনাশক পরামর্শ অনুযায়ী স্প্রে করুন']],
        'leaf_yellowing' => ['en' => 'Leaf yellowing', 'bn' => 'পাতা হলুদ হওয়া', 'severity' => 'medium',
            'steps_en' => ['Check for nutrient shortage or standing water', 'Do not add extra nitrogen until an officer confirms', 'Take a closer photo of both leaf sides'],
            'steps_bn' => ['পুষ্টির ঘাটতি বা জমে থাকা পানি পরীক্ষা করুন', 'কর্মকর্তা নিশ্চিত না করা পর্যন্ত বাড়তি নাইট্রোজেন দেবেন না', 'পাতার দুই পাশের কাছ থেকে ছবি তুলুন']],
        'healthy' => ['en' => 'Looks healthy', 'bn' => 'ফসল সুস্থ মনে হচ্ছে', 'severity' => 'none',
            'steps_en' => ['Keep checking regularly', 'Follow today\'s water and fertilizer advice'],
            'steps_bn' => ['নিয়মিত পর্যবেক্ষণ চালিয়ে যান', 'আজকের সেচ ও সার পরামর্শ মেনে চলুন']],
        'unknown' => ['en' => 'Not sure yet', 'bn' => 'নিশ্চিত শনাক্ত করা যায়নি', 'severity' => 'low',
            'steps_en' => ['Take another clear photo in daylight', 'Wait for the officer\'s review before using chemicals'],
            'steps_bn' => ['দিনের আলোয় আরেকটি পরিষ্কার ছবি তুলুন', 'রাসায়নিক ব্যবহারের আগে কর্মকর্তার পর্যালোচনার অপেক্ষা করুন']],
    ],
];
