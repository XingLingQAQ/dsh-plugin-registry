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

/** Lowercased signal terms. Matched as substrings against the normalized text
 *  blob (id + description + topics + keywords), so `restore` also covers
 *  `restore-point`, `agent` covers `agent-skills`, etc. Ambiguous short terms
 *  (`ui`, `api`, `im`, `web`, `chat`) are deliberately omitted — they fire on
 *  too much unrelated text. */
const SIGNALS = [
  ['safety', [
    'security', 'audit', 'sandbox', 'vet', 'trust', 'verifier', 'malware',
    'safety', 'supply-chain', 'ransomware', 'honeypot', 'exfiltration',
    'typosquat', 'vulnerab', 'static-analysis', 'integrity', 'plugin-audit',
    'plugin-vetting', 'pre-install-audit', 'guard', 'pentest', '渗透测试',
  ]],
  ['manager', [
    'market', 'marketplace', 'config-manager', 'config', 'migration', 'migrate',
    'inject', 'installer', 'plugin-market', 'export', 'webdav', 'preset-store',
    '排行',
  ]],
  ['integration', [
    'feishu', 'lark', 'dingtalk', 'telegram', 'qqbot', 'slack', 'discord',
    'wechat', 'wecom', 'wxpusher', 'pushplus', 'serverchan', 'bark', 'webhook',
    'notify', 'notification', 'ringcentral', 'team-messaging', 'instant-messag',
  ]],
  ['provider', [
    'provider', 'balance', 'wallet', 'account-pool', 'multi-account',
    'account-switch', 'auth-gateway', 'oauth', 'proxy', 'token-usage',
    'cost-tracking', 'recharge', 'quota', 'api-key', 'balance-monitor',
    'quota-monitor', 'usage-track', 'token-track', 'cost tracking',
    'token usage', 'billing', '消费', '计费', '热图', 'token heatmap',
  ]],
  ['ui-theme', [
    'theme', 'skin', 'splash', 'sidor', 'glass', 'dark-mode', 'light-mode',
    'appearance', 'color-scheme', 'font-scale', 'animation',
  ]],
  ['ui-enhancement', [
    'sidebar', 'statusbar', 'status-bar', 'navbar', 'jumpbar', 'composer',
    'caret', 'cursor', 'streaming', 'smooth-stream', 'auto-continue',
    'auto-collapse', 'collapse', 'annotation', 'notebook', 'md-notes',
    'taskboard', 'favorites', 'calendar', 'widgets', 'widget', 'pet',
    'desktop-pet', 'companion', 'emoji', 'inline-emoji', 'meme', 'stickers',
    'popout', 'genui', 'generative-ui', 'univer', 'markdown-editor',
    'notes', 'knowledge-base', 'knowledge-graph', 'context-management',
    'compaction', 'reference', 'ref-lib', 'zh-labels', 'i18n', 'label',
    'knowledge base', 'knowledge bases', 'mind map', '思维导图', 'status bar',
    '状态栏', 'task board', '任务看板', 'context management', 'dockable',
    'docking', 'table of contents', 'keyboard shortcut',
  ]],
  ['tool', [
    'vision', 'ocr', 'image-to-text', 'web-fetch', 'mcp-server', 'mineru',
    'document-parsing', 'screenshot', 'screencapture', 'appshot', 'pdf-edit',
    'scraping', 'enrichment', 'web-search', 'page-fetch', 'mcp server',
  ]],
  ['automation', [
    'cron', 'schedule', 'workflow', 'automation', 'pipeline', 'timer',
    'batch-process',
  ]],
  ['session', [
    'rewind', 'undo', 'redo', 'rollback', 'snapshot', 'savepoint',
    'restore-point', 'message-edit', 'crash-recovery', 'change-ledger',
    'turn-rewind', 'history-rewind',
  ]],
  ['agent-skill', [
    'agent-preset', 'agent-skill', 'agent-mode', 'agent-memory',
    'persistent-memory', 'agent-review', 'agentic', 'ai-agent', 'ai-agents',
    'coding-agent', 'subagent', 'plan-mode', 'acceptance', 'prompt-engineer',
    'minimal', 'preset', 'skill', 'memory', 'multi-agent', 'multi-agent team',
    'agent-team',
  ]],
]

/** Build the lowercase text blob the signal terms are matched against. */
function blob(input) {
  const id = input.id.replace(/^@[^/]+\//, '')
  return `${id} ${input.description} ${input.topics.join(' ')} ${input.keywords.join(' ')}`.toLowerCase()
}

export function classifyCategory(input) {
  const text = blob(input)
  for (const [cat, terms] of SIGNALS) {
    for (const term of terms) {
      if (text.includes(term)) return cat
    }
  }
  return 'other'
}
