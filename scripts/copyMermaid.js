const fs = require('fs');
const path = require('path');

const srcPath = path.resolve(__dirname, '../node_modules/mermaid/dist/mermaid.min.js');
const destDir = path.resolve(__dirname, '../out');
const destPath = path.join(destDir, 'mermaid.min.js');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(srcPath, destPath);
console.log(`Copied Mermaid runtime to ${destPath}`);
