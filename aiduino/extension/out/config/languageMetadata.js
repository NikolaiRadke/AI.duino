/*
 * AI.duino - Language Metadata Configuration
 * Copyright 2025 Monster Maker
 * 
 * Licensed under the Apache License, Version 2.0
 */

"use strict";

/**
 * Language Metadata - Static configuration for all supported languages
 * 
 * Contains display information for language selection and UI
 * This is completely static data with no dependencies
 */
const LANGUAGE_METADATA = {
    'en': { name: 'English', flag: '🇺🇸', region: 'English' },
    'de': { name: 'Deutsch', flag: '🇩🇪', region: 'German' },
    'es': { name: 'Español', flag: '🇪🇸', region: 'Spanish' },
    'fr': { name: 'Français', flag: '🇫🇷', region: 'French' },
    'it': { name: 'Italiano', flag: '🇮🇹', region: 'Italian' },
    'pt': { name: 'Português', flag: '🇵🇹', region: 'Portuguese' },
    'zh': { name: '中文', flag: '🇨🇳', region: 'Chinese' },
    'ja': { name: '日本語', flag: '🇯🇵', region: 'Japanese' },
    'ko': { name: '한국어', flag: '🇰🇷', region: 'Korean' },
    'ru': { name: 'Русский', flag: '🇷🇺', region: 'Russian' },
    'nl': { name: 'Nederlands', flag: '🇳🇱', region: 'Dutch' },
    'pl': { name: 'Polski', flag: '🇵🇱', region: 'Polish' },
    'tr': { name: 'Türkçe', flag: '🇹🇷', region: 'Turkish' },
    'el': { name: 'Ελληνικά', flag: '🇬🇷', region: 'Greek' },
    'cs': { name: 'Čeština', flag: '🇨🇿', region: 'Czech' },
    'sv': { name: 'Svenska', flag: '🇸🇪', region: 'Swedish' },
    'ro': { name: 'Română', flag: '🇷🇴', region: 'Romanian' },
    'da': { name: 'Dansk', flag: '🇩🇰', region: 'Danish' },
    'no': { name: 'Norsk', flag: '🇳🇴', region: 'Norwegian' },
    'fi': { name: 'Suomi', flag: '🇫🇮', region: 'Finnish' },
    'hu': { name: 'Magyar', flag: '🇭🇺', region: 'Hungarian' },
    'bg': { name: 'Български', flag: '🇧🇬', region: 'Bulgarian' },
    'hr': { name: 'Hrvatski', flag: '🇭🇷', region: 'Croatian' },
    'sk': { name: 'Slovenčina', flag: '🇸🇰', region: 'Slovak' },
    'sl': { name: 'Slovenščina', flag: '🇸🇮', region: 'Slovenian' },
    'lt': { name: 'Lietuvių', flag: '🇱🇹', region: 'Lithuanian' },
    'lv': { name: 'Latviešu', flag: '🇱🇻', region: 'Latvian' },
    'et': { name: 'Eesti', flag: '🇪🇪', region: 'Estonian' },
    'uk': { name: 'Українська', flag: '🇺🇦', region: 'Ukrainian' },
    'be': { name: 'Беларуская', flag: '🇧🇾', region: 'Belarusian' },
    'mk': { name: 'Македонски', flag: '🇲🇰', region: 'Macedonian' },
    'sr': { name: 'Српски', flag: '🇷🇸', region: 'Serbian' },
    'bs': { name: 'Bosanski', flag: '🇧🇦', region: 'Bosnian' },
    'me': { name: 'Crnogorski', flag: '🇲🇪', region: 'Montenegrin' },
    'mt': { name: 'Malti', flag: '🇲🇹', region: 'Maltese' },
    'is': { name: 'Íslenska', flag: '🇮🇸', region: 'Icelandic' },
    'hi': { name: 'हिन्दी', flag: '🇮🇳', region: 'Hindi' },
    'bn': { name: 'বাংলা', flag: '🇧🇩', region: 'Bengali' },
    'ta': { name: 'தமிழ்', flag: '🇱🇰', region: 'Tamil' },
    'te': { name: 'తెలుగు', flag: '🇮🇳', region: 'Telugu' },
    'mr': { name: 'मराठी', flag: '🇮🇳', region: 'Marathi' },
    'gu': { name: 'ગુજરાતી', flag: '🇮🇳', region: 'Gujarati' },
    'pa': { name: 'ਪੰਜਾਬੀ', flag: '🇮🇳', region: 'Punjabi' },
    'ur': { name: 'اردو', flag: '🇵🇰', region: 'Urdu' },
    'fa': { name: 'فارسی', flag: '🇮🇷', region: 'Persian' },
    'ar': { name: 'العربية', flag: '🇸🇦', region: 'Arabic' },
    'he': { name: 'עברית', flag: '🇮🇱', region: 'Hebrew' },
    'th': { name: 'ไทย', flag: '🇹🇭', region: 'Thai' },
    'vi': { name: 'Tiếng Việt', flag: '🇻🇳', region: 'Vietnamese' },
    'id': { name: 'Bahasa Indonesia', flag: '🇮🇩', region: 'Indonesian' },
    'ms': { name: 'Bahasa Malaysia', flag: '🇲🇾', region: 'Malay' },
    'tl': { name: 'Filipino', flag: '🇵🇭', region: 'Filipino' },
    'my': { name: 'မြန်မာ', flag: '🇲🇲', region: 'Burmese' },
    'km': { name: 'ខ្មែរ', flag: '🇰🇭', region: 'Khmer' },
    'lo': { name: 'ລາວ', flag: '🇱🇦', region: 'Lao' },
    'sw': { name: 'Kiswahili', flag: '🇰🇪', region: 'Swahili' },
    'af': { name: 'Afrikaans', flag: '🇿🇦', region: 'Afrikaans' },
    'am': { name: 'አማርኛ', flag: '🇪🇹', region: 'Amharic' }
};

/**
 * Get language information for a locale code
 * @param {string} locale - Language code (e.g., 'en', 'de')
 * @returns {Object} Language info with name, flag, region
 */
function getLanguageInfo(locale) {
    return LANGUAGE_METADATA[locale] || { 
        name: locale.toUpperCase(), 
        flag: '🌐', 
        region: locale.toUpperCase() 
    };
}

module.exports = {
    LANGUAGE_METADATA,
    getLanguageInfo
};
