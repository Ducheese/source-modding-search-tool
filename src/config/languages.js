/**
 * 语言配置常量
 */

export const SUPPORTED_LANGS = [
  { id: 'schinese', label: '简体中文' },
  { id: 'tchinese_hk', label: '繁體中文 (香港)' },
  { id: 'tchinese_tw', label: '繁體中文 (台灣)' },
  { id: 'english', label: 'English' },
  { id: 'russian', label: 'Русский' },
  { id: 'latam', label: 'Español (Latinoamérica)' },
  { id: 'brazilian', label: 'Português (Brasil)' },
  { id: 'indonesian', label: 'Bahasa Indonesia' },
  { id: 'vietnamese', label: 'Tiếng Việt' },
  { id: 'turkish', label: 'Türkçe' },
  { id: 'koreana', label: '한국어' },
  { id: 'german', label: 'Deutsch' },
  { id: 'thai', label: 'ไทย' },
  { id: 'polish', label: 'Polski' },
  { id: 'ukrainian', label: 'Українська' },
  { id: 'japanese', label: '日本語' },
  { id: 'french', label: 'Français' },
  { id: 'italian', label: 'Italiano' },
  { id: 'portuguese', label: 'Português (Portugal)' },
  { id: 'spanish', label: 'Español (España)' },
  { id: 'hindi', label: 'हिन्दी' },
];

export const BROWSER_TO_VALVE_MAP = {
  // 中文系列
  'zh': 'schinese',           // 通用中文默认简体
  'zh-cn': 'schinese',
  'zh-sg': 'schinese',
  'zh-hans': 'schinese',      // 简体中文脚本
  'zh-tw': 'tchinese_tw',
  'zh-hk': 'tchinese_hk',
  'zh-mo': 'tchinese_hk',
  'zh-hant': 'tchinese_tw',   // 繁体脚本默认台湾
  'zh-hant-tw': 'tchinese_tw',
  'zh-hant-hk': 'tchinese_hk',
  'zh-hant-mo': 'tchinese_hk',
  'ru': 'russian', 
  'es': 'latam',
  'es-es': 'spanish',
  'pt': 'brazilian',
  'pt-pt': 'portuguese',
  'id': 'indonesian', 
  'vi': 'vietnamese', 
  'tr': 'turkish', 
  'en': 'english',
  'ko': 'koreana',
  'de': 'german',
  'th': 'thai',
  'pl': 'polish',
  'uk': 'ukrainian',
  'ja': 'japanese',
  'fr': 'french',
  'it': 'italian',
  'hi': 'hindi',
};

export const VALVE_TO_HTML_MAP = {
  schinese: 'zh-Hans', 
  tchinese_hk: 'zh-Hant-HK', 
  tchinese_tw: 'zh-Hant-TW', 
  english: 'en',
  russian: 'ru', 
  latam: 'es-419', 
  brazilian: 'pt-BR',
  indonesian: 'id', 
  vietnamese: 'vi', 
  turkish: 'tr',
  koreana: 'ko',
  german: 'de',
  thai: 'th',
  polish: 'pl',
  ukrainian: 'uk',
  japanese: 'ja',
  french: 'fr',
  italian: 'it',
  portuguese: 'pt-PT',
  spanish: 'es',
  hindi: 'hi',
};
