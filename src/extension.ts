import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DbmlPreviewPanel } from './previewPanel';
import { generatePdfFromHtml } from './pdfGenerator';
import { parseDbmlContent } from './parser';
import { renderHtmlDocument } from './renderer';

export function activate(context: vscode.ExtensionContext) {
  const openPreviewCmd = vscode.commands.registerCommand(
    'dbmlPreview.openPreview',
    (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (targetUri) {
        DbmlPreviewPanel.createOrShow(context.extensionUri, targetUri);
      } else {
        vscode.window.showErrorMessage('アクティブなDBMLファイルが見つかりません。');
      }
    }
  );

  const togglePreviewCmd = vscode.commands.registerCommand(
    'dbmlPreview.togglePreview',
    (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (targetUri) {
        DbmlPreviewPanel.togglePreview(context.extensionUri, targetUri);
      } else {
        vscode.window.showErrorMessage('アクティブなDBMLファイルが見つかりません。');
      }
    }
  );

  const exportPdfCmd = vscode.commands.registerCommand(
    'dbmlPreview.exportPdf',
    async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        vscode.window.showErrorMessage('アクティブなDBMLファイルが見つかりません。');
        return;
      }

      // Calculate output PDF path
      const dirPath = path.dirname(targetUri.fsPath);
      const extName = path.extname(targetUri.fsPath);
      const baseName = path.basename(targetUri.fsPath, extName);

      let pdfFileName = `${baseName}.pdf`;
      let targetPdfPath = path.join(dirPath, pdfFileName);

      // Check if file already exists -> append timestamp
      if (fs.existsSync(targetPdfPath)) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timestamp = `${year}${month}${day}-${hours}${minutes}${seconds}`;

        pdfFileName = `${baseName}_${timestamp}.pdf`;
        targetPdfPath = path.join(dirPath, pdfFileName);
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `PDFを出力中... (${pdfFileName})`,
            cancellable: false
          },
          async () => {
            const document = await vscode.workspace.openTextDocument(targetUri);
            const text = document.getText();
            const theme = vscode.workspace.getConfiguration('dbmlPreview').get<string>('theme', 'system');
            const lang = vscode.workspace.getConfiguration('dbmlPreview').get<string>('language', 'auto');
            const pageSize = vscode.workspace.getConfiguration('dbmlPreview').get<string>('pdfPageSize', 'A4');
            const orientation = vscode.workspace.getConfiguration('dbmlPreview').get<string>('pdfOrientation', 'portrait');

            const parsed = parseDbmlContent(text, targetUri.fsPath);
            const htmlContent = renderHtmlDocument(parsed, baseName, theme, lang, pageSize, orientation);

            await generatePdfFromHtml(htmlContent, targetPdfPath, pageSize, orientation);
          }
        );

        vscode.window.showInformationMessage(`PDFファイルを出力しました: ${pdfFileName}`, 'ファイルを開く').then(selection => {
          if (selection === 'ファイルを開く') {
            vscode.env.openExternal(vscode.Uri.file(targetPdfPath));
          }
        });
      } catch (err) {
        vscode.window.showErrorMessage(`PDF出力中にエラーが発生しました: ${String(err)}`);
      }
    }
  );

  context.subscriptions.push(openPreviewCmd, togglePreviewCmd, exportPdfCmd);
}

export function deactivate() {}
