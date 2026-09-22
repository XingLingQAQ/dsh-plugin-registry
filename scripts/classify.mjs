/**
 * DSH plugin category classifier.
 *
 * Deterministic: the same {id, description, topics, keywords, hasClient,
 * hasHost} always yields the same category. Pure rule-based — no LLM, no
 * network, no clocks — so the catalog stays zero diff when upstream is
 * unchanged. First matching category wins; the priority order is tuned so a
 * specific signal (safety/sandbox) outranks a broad one (agent-skill).
 *
 * Keep this in sync with the frontend CATEGORIES list in data.ts.
 */

/** Canonical category order. `other` is always last and always present. */
export const CATEGORY_IDS = [
  'safety',
  'manager',
  'integration',
  'provider',
  'ui-theme',
  'ui-enhancement',
  'tool',
  'automation',
  'session',
  'agent-skill',
  'other',
]

/**
 * Weak signals: words about *where a plugin renders* or what it extends, rather
 * than what it is about.
 *
 * These are checked only after every strong tier has failed, because on their own
 * they invert the decision. `dsh-weather` describes itself as a plugin for the
 * conversation top bar; matching `顶栏` in the strong tier filed it under
 * "interface enhancement", which is true of its plumbing and wrong about the
 * plugin. The same trap sits in `panel`, `widget`, `bubble`, `icon`, `toolbar`,
 * `status bar` and every other mounting point.
 *
 * Kept deliberately small: each entry is a word that really does mean "this is an
 * interface change" when it is the only thing left to go on.
 */
const WEAK_SIGNALS = [
  ['ui-enhancement', [
    '侧边栏', '顶栏', '状态栏', 'navbar', 'jumpbar', 'composer', 'sidebar',
    '状态栏', '面板', '悬浮', '气泡', 'dock', 'toolbar', 'widget', 'calendar',
  ]],
]

/** Lowercased signal terms. Matched as substrings against the normalized text
 *  blob (id + description + topics + keywords), so `restore` also covers
 *  `restore-point`, `agent` covers `agent-skills`, etc. Ambiguous short terms
 *  (`ui`, `api`, `im`, `web`, `chat`) are deliberately omitted — they fire on
 *  too much unrelated text.
 *
 *  Terms are checked in this order and the first hit wins, so the table is also
 *  a priority list: a specific signal (safety, sandbox) has to outrank a broad
 *  one (agent-skill, tool) or the broad one would swallow it. `longest` matches
 *  are preferred over shorter ones inside a category for the same reason — see
 *  {@link classifyCategory}.
 *
 *  Chinese terms are not decoration. Roughly a third of the topic's plugins
 *  describe themselves only in Chinese, and a table written purely in English
 *  sent them to `other` at twice the rate of the English ones. Each Chinese term
 *  is therefore the word that actually appears in those descriptions, not a
 *  translation of the English one. */
const SIGNALS = [
  ['safety', [
    'security', 'audit', 'sandbox', 'vet', 'trust', 'verifier', 'malware',
    'safety', 'supply-chain', 'ransomware', 'honeypot', 'exfiltration',
    'typosquat', 'vulnerab', 'static-analysis', 'integrity', 'plugin-audit',
    'plugin-vetting', 'pre-install-audit', 'guard', 'pentest', '渗透测试',
    '安全审计', '安全检测', '安全检查', '安全防护', '越权', '权限校验', '走私',
    '注入检测', '脱敏', '合规', '风控', '防护', '审计', '沙箱', '红队', '漏洞',
    // `安全` is intentionally *not* a term on its own. It is ordinary prose —
    // "remote access and 安全" describes a feature, not a subject — and matching
    // it filed a mobile remote-access plugin as a security tool. The compound
    // forms above only fire when security really is the subject.
  ]],
  ['manager', [
    'market', 'marketplace', 'config-manager', 'config', 'migration', 'migrate',
    'inject', 'installer', 'plugin-market', 'export', 'webdav', 'preset-store',
    '排行', '管理', '管理器', '配置', '迁移', '市场', '插件管理', '导入', '导出',
    '备份',
  ]],
  ['integration', [
    'feishu', 'lark', 'dingtalk', 'telegram', 'qqbot', 'slack', 'discord',
    'wechat', 'wecom', 'wxpusher', 'pushplus', 'serverchan', 'bark', 'webhook',
    'notify', 'notification', 'ringcentral', 'team-messaging', 'instant-messag',
    '飞书', '钉钉', '企业微信', '微信', '群聊',
    // `通知`/`推送` are deliberately absent: they name a delivery channel, and
    // half the ecosystem pushes a notification for something. A cost meter that
    // can message you is a cost meter. The named platforms above are subjects;
    // these two are plumbing.
  ]],
  ['provider', [
    'provider', 'balance', 'wallet', 'account-pool', 'multi-account',
    'account-switch', 'auth-gateway', 'oauth', 'proxy', 'token-usage',
    'cost-tracking', 'recharge', 'quota', 'api-key', 'balance-monitor',
    'quota-monitor', 'usage-track', 'token-track', 'cost tracking',
    'token usage', 'billing', '消费', '计费', '热图', 'token heatmap',
    '余额', '额度', '账号', '模型别名', '用量', '网关', '中转', '路由',
    // `成本` alone is too loose: it is a common noun for "trade-off" as well as
    // for money ("交接成本" is a handover cost, not a bill). The compound forms
    // below are the ones that actually mean spend.
    '成本账', '成本统计', '成本控制', '费用',
  ]],
  ['ui-theme', [
    'theme', 'skin', 'splash', 'sidor', 'glass', 'dark-mode', 'light-mode',
    'appearance', 'color-scheme', 'font-scale', 'animation', 'font',
    '主题', '皮肤', '壁纸', '配色', '外观', '暗黑', '深夜', '字体大小', '启动动画',
    '换肤', '字体',
  ]],
  ['ui-enhancement', [
    'sidebar', 'statusbar', 'status-bar', 'navbar', 'jumpbar', 'composer',
    'caret', 'cursor', 'streaming', 'smooth-stream', 'auto-continue',
    'auto-collapse', 'collapse', 'annotation', 'notebook', 'md-notes',
    'taskboard', 'favorites', 'widgets', 'widget', 'pet',
    'desktop-pet', 'companion', 'emoji', 'inline-emoji', 'meme', 'stickers',
    'popout', 'genui', 'generative-ui', 'univer', 'markdown-editor',
    'notes', 'knowledge-base', 'knowledge-graph', 'context-management',
    'compaction', 'reference', 'ref-lib', 'zh-labels', 'i18n', 'label',
    'knowledge base', 'knowledge bases', 'mind map', '思维导图', 'status bar',
    '状态栏', 'task board', '任务看板', 'context management', 'dockable',
    'docking', 'table of contents', 'keyboard shortcut',
    '侧边栏', '看板', '视图', '阅读', '预览',
    '界面', '拖拽', '折叠', '树', '浏览器', '文件预览', '会话页',
    '标签页', '详情栏', '桌面',
  ]],
  ['tool', [
    'vision', 'ocr', 'image-to-text', 'web-fetch', 'mcp-server', 'mineru',
    'document-parsing', 'screenshot', 'screencapture', 'appshot', 'pdf-edit',
    'scraping', 'enrichment', 'web-search', 'page-fetch', 'mcp server',
    'terminal', 'shell', 'ssh', 'vps', 'git', 'worktree', 'browser-agent',
    'playwright', 'puppeteer', 'simulator', 'xcode', 'android', 'ios',
    '地图', '天气', '翻译', '图片', '视频', '音频',
    '文档', '解析', '截图', '终端', '命令行', '搜索', '抓取', '爬虫', '远程',
    'weather', 'map', 'routing', 'translate', 'image', 'video', 'audio',
    'document', 'parse', 'screenshot',
  ]],
  ['automation', [
    'cron', 'schedule', 'workflow', 'automation', 'pipeline', 'timer',
    'batch-process', '定时', '计划任务', '自动化', '工作流', '流程', '编排',
    '批处理',
  ]],
  ['session', [
    'rewind', 'undo', 'redo', 'rollback', 'snapshot', 'savepoint',
    'restore-point', 'message-edit', 'crash-recovery', 'change-ledger',
    'turn-rewind', 'history-rewind', 'turn-delete', 'edit-turn',
    '回滚', '撤销', '快照', '恢复', '回退',
    '编辑历史', '会话管理', '历史记录', '删除会话', '编辑消息',
  ]],
  ['agent-skill', [
    'agent-preset', 'agent-skill', 'agent-mode', 'agent-memory',
    'persistent-memory', 'agent-review', 'agentic', 'ai-agent', 'ai-agents',
    'coding-agent', 'subagent', 'plan-mode', 'acceptance', 'prompt-engineer',
    'minimal', 'preset', 'skill', 'memory', 'multi-agent', 'multi-agent team',
    'agent-team', '智能体', '子代理', '预设', '技能', '记忆', '提示词',
    '角色卡', '人格', '规划',
  ]],
]


/** Build the lowercase text blob the signal terms are matched against. */
function blob(input) {
  const id = input.id.replace(/^@[^/]+\//, '')
  const hasHost = input.hasHost === true
  const hasClient = input.hasClient === true
  // The halves are appended as pseudo-terms because they are real evidence about
  // what a plugin does, and the manifest already proved them. A host-only plugin
  // with an unhelpful description is at least knowable as "something that runs
  // on the host".
  const halves = `${hasClient ? ' client' : ''}${hasHost ? ' host' : ''}`
  return `${id} ${input.description} ${input.topics.join(' ')} ${input.keywords.join(' ')}${halves}`.toLowerCase()
}

/** Longest term in `terms` that appears in `text`, or null. */
function bestTerm(text, terms) {
  let best = null
  for (const term of terms) {
    if (text.includes(term) && (best === null || term.length > best.length)) best = term
  }
  return best
}

/**
 * Classify one plugin into a canonical category.
 *
 * The category order is the primary key — a specific signal must outrank a broad
 * one — and within the winning category the *longest* matching term decides,
 * which only matters for reporting: knowing that `marketplace` beat `market`
 * is what makes a surprising result explainable.
 *
 * Matching is plain substring, deliberately: `plugin-market` should match inside
 * `dsh-plugin-marketplace`, and word boundaries would break that. The cost is
 * that a short term can fire on an unrelated word, which is why the ambiguous
 * ones (ui, api, web, im, chat, tree, host) are either absent or paired with the
 * longer form that actually appears in real descriptions.
 *
 * The weak tier is consulted only after every strong one has failed, so a plugin
 * whose subject is knowable is never filed by the container it happens to render
 * into.
 * @param {{ id: string, description: string, topics: string[], keywords: string[],
 *           hasClient?: boolean, hasHost?: boolean }} input - manifest signals.
 * @returns {string} one of {@link CATEGORY_IDS}.
 */
export function classifyCategory(input) {
  return explainCategory(input).category
}

/**
 * Same decision, with the reason and the tier attached.
 *
 * Kept beside {@link classifyCategory} rather than folded into it so the common
 * path stays allocation-free, and so the catalog's own classifier cannot drift
 * from the one an audit tool reports on.
 * @param {Parameters<typeof classifyCategory>[0]} input - manifest signals.
 * @returns {{ category: string, term: string | null, weak: boolean }} bucket, the
 *   term that chose it, and whether only a weak signal was left to go on.
 */
export function explainCategory(input) {
  const text = blob(input)
  for (const [cat, terms] of SIGNALS) {
    const term = bestTerm(text, terms)
    if (term !== null) return { category: cat, term, weak: false }
  }
  for (const [cat, terms] of WEAK_SIGNALS) {
    const term = bestTerm(text, terms)
    if (term !== null) return { category: cat, term, weak: true }
  }
  return { category: 'other', term: null, weak: false }
}
