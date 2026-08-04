import * as vscode from 'vscode';
import { DbmlPreviewPanel } from './previewPanel';

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

  context.subscriptions.push(openPreviewCmd, togglePreviewCmd);
}

export function deactivate() {}
