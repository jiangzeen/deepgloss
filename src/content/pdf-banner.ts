import bannerStyles from './pdf-banner.css?inline';

/**
 * Detects if the current page is a PDF and shows a banner
 * offering to open it in DeepGloss's PDF viewer for translation support.
 */
export class PdfBanner {
  private host: HTMLDivElement | null = null;

  /**
   * Check if the current page is a PDF.
   */
  static isPdfPage(): boolean {
    // Check MIME type via content-type (embed element)
    const embed = document.querySelector('embed[type="application/pdf"]');
    if (embed) return true;

    // Check URL extension
    const url = window.location.href;
    if (/\.pdf(\?|#|$)/i.test(url)) return true;

    // Chrome PDF viewer sets a specific plugin element
    const plugin = document.querySelector('embed[name="plugin"]');
    if (plugin?.getAttribute('type') === 'application/pdf') return true;

    return false;
  }

  /**
   * Show the banner at the top of the page.
   */
  show(): void {
    if (this.host) return;

    this.host = document.createElement('div');
    this.host.id = 'deepgloss-pdf-banner-host';

    const shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = bannerStyles;
    shadow.appendChild(style);

    const banner = document.createElement('div');
    banner.className = 'dg-pdf-banner';

    // Description text
    const text = document.createElement('span');
    text.className = 'dg-pdf-banner-text';
    text.textContent = 'Chrome 内置 PDF 查看器不支持划词翻译，点击下方按钮可在支持划词翻译的查看器中打开此 PDF';

    // Open button
    const btn = document.createElement('button');
    btn.className = 'dg-pdf-banner-btn';
    btn.textContent = '在翻译查看器中打开';
    btn.title = '使用 DeepGloss 内置的 PDF 查看器打开当前文档，支持选中文字进行划词翻译';
    btn.addEventListener('click', () => {
      this.openInViewer();
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'dg-pdf-banner-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.title = '关闭提示';
    closeBtn.addEventListener('click', () => {
      this.hide();
    });

    banner.append(text, btn, closeBtn);
    shadow.appendChild(banner);

    document.body.prepend(this.host);
  }

  hide(): void {
    this.host?.remove();
    this.host = null;
  }

  /**
   * Open current PDF in the extension's PDF.js viewer.
   */
  private openInViewer(): void {
    const pdfUrl = encodeURIComponent(window.location.href);
    const viewerUrl = chrome.runtime.getURL(`src/pdfviewer/index.html?url=${pdfUrl}`);
    window.location.href = viewerUrl;
  }
}
