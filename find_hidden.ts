import * as fs from 'fs';
import * as path from 'path';

function searchHidden(dir: string, depth = 0) {
  if (depth > 6) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          // Only skip heavy directories
          if (file !== 'node_modules' && file !== '.git' && file !== 'usr' && file !== 'lib' && file !== 'var' && file !== 'proc' && file !== 'sys' && file !== 'dev' && file !== 'etc') {
            searchHidden(fullPath, depth + 1);
          }
        } else {
          const lower = file.toLowerCase();
          // Print ANY file that was modified recently or contains png, jpeg, svg, logo
          if (lower.includes('png') || lower.includes('png') || lower.includes('jpg') || lower.includes('jpeg') || lower.includes('ready') || lower.includes('bahkm') || lower.includes('honey')) {
            console.log('Found:', fullPath, 'size:', stat.size, 'mtime:', stat.mtime);
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
}

console.log('Searching all files (including hidden) in /app...');
searchHidden('/app');
console.log('Searching all files (including hidden) in /tmp...');
searchHidden('/tmp');
console.log('Searching /home/node...');
searchHidden('/home/node');
console.log('Searching /serve...');
searchHidden('/serve');
