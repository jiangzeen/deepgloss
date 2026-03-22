import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'DeepGloss',
  version: '0.1.0',
  description: 'AI-powered text selection translation',
  permissions: ['storage', 'activeTab', 'contextMenus', 'webRequest', 'declarativeNetRequest', 'tabs'],
  host_permissions: [
    'https://api.openai.com/*',
    'https://translate.googleapis.com/*',
    '<all_urls>',
  ],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  icons: {
    '16': 'icons/icon-16.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
  sandbox: {
    pages: ['src/pdfviewer/index.html'],
  },
  web_accessible_resources: [
    {
      resources: ['src/pdfviewer/index.html', 'src/pdfviewer/*'],
      matches: ['<all_urls>'],
    },
  ],
});
