import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as puppeteer from 'puppeteer-core';

export function findBrowserExecutable(): string | null {
  if (process.platform === 'win32') {
    const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local');

    const candidates = [
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
  } else if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
  } else if (process.platform === 'linux') {
    const candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/microsoft-edge'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
  }
  return null;
}

export async function generatePdfFromHtml(
  htmlContent: string,
  outputPath: string,
  pageSize: string = 'A4',
  orientation: string = 'portrait'
): Promise<void> {
  const executablePath = findBrowserExecutable();
  if (!executablePath) {
    throw new Error('PDF生成に使用するブラウザ (Edge / Chrome) がシステム上に見つかりませんでした。');
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load' });

    // Wait for Mermaid rendering completion if present
    await page.evaluate(async () => {
      // Small delay to ensure mermaid SVG rendering completes
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    const isLandscape = orientation.toLowerCase() === 'landscape';

    await page.pdf({
      path: outputPath,
      format: pageSize as any,
      landscape: isLandscape,
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm'
      }
    });
  } finally {
    await browser.close();
  }
}
