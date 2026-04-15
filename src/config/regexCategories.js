/**
 * 正则表达式快捷分类配置
 * 用于 SearchPanel 的正则快捷插入面板
 */

/**
 * 获取正则表达式分类配置
 * @param {function} t - 翻译函数
 * @returns {Array} 分类数组
 */
export const getRegexCategories = (t) => [
  {
    title: t('regexCat.anchors'),
    items: [
      { label: t('regexSnippet.lineStart'), value: '^' },
      { label: t('regexSnippet.lineEnd'), value: '\\r?$' },
      { label: t('regexSnippet.wordBoundary'), value: '\\b' },
      { label: t('regexSnippet.nonWordBoundary'), value: '\\B' },
    ]
  },
  {
    title: t('regexCat.wildcards'),
    items: [
      { label: t('regexSnippet.anyChar'), value: '.' },
      { label: t('regexSnippet.tab'), value: '\\t' },
      { label: t('regexSnippet.newline'), value: '\\r?\\n' },
      { label: t('regexSnippet.whitespace'), value: '\\s' },
      { label: t('regexSnippet.word'), value: '\\w' },
      { label: t('regexSnippet.digit'), value: '\\d' },
    ]
  },
  {
    title: t('regexCat.quantifiers'),
    items: [
      { label: t('regexSnippet.optional'), value: '?' },
      { label: t('regexSnippet.zeroOrMore'), value: '*' },
      { label: t('regexSnippet.oneOrMore'), value: '+' },
      { label: t('regexSnippet.lazy'), value: '*?' },
      { label: t('regexSnippet.count'), value: '{}' },
    ]
  },
  {
    title: t('regexCat.charsets'),
    items: [
      { label: t('regexSnippet.hexColor'), value: '#[0-9a-fA-F]{6}' },
      { label: t('regexSnippet.chineseCharCount'), value: '[\\u4e00-\\u9fa5]{}' },
    ]
  },
  {
    title: t('regexCat.escape'),
    items: [
      { label: '(', value: '\\(' }, { label: ')', value: '\\)' },
      { label: '[', value: '\\[' }, { label: ']', value: '\\]' },
      { label: '{', value: '\\{' }, { label: '}', value: '\\}' },
      { label: '.', value: '\\.' }, { label: '?', value: '\\?' },
      { label: '*', value: '\\*' }, { label: '+', value: '\\+' },
      { label: '^', value: '\\^' }, { label: '$', value: '\\$' },
      { label: '\\', value: '\\\\' }, { label: '-', value: '\\-' },
      { label: '|', value: '\\|' },
    ]
  },
  {
    title: t('regexCat.csExamples'),
    items: [
      { label: t('regexSnippet.csWeapon'), value: '^[ ]*"Weapon_[^\\.\\r\\n]+\\.Single"' },
      { label: t('regexSnippet.csAmmo'), value: '"(clip_size|primary_ammo)"\\s+"[^"]+?"' },
      { label: t('regexSnippet.csPropData'), value: 'GetEntProp\\s*\\(\\s*[^,)]+?\\s*,\\s*Prop_Data\\s*,\\s*"[^"]+?"\\s*\\)' },
    ]
  },
];
