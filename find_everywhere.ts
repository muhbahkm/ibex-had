import * as fs from 'fs';
import * as path from 'path';

function findAnywhere(dir: string, depth = 0) {
  if (depth > 6) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (!file.startsWith('.') && file !== 'node_modules' && file !== 'usr' && file !== 'lib' && file !== 'var' && file !== 'proc' && file !== 'sys' && file !== 'dev' && file !== 'etc' && file !== 'bin' && file !== 'boot') {
            findAnywhere(fullPath, depth + 1);
          }
        } else {
          const lower = file.toLowerCase();
          if (lower.includes('bahkm') || lower.includes('honey') || lower.includes('logo') || lower.includes('ready')) {
            console.log('Match:', fullPath, 'size:', stat.size);
          }
        }
      } catch (e) {}
    }
  } catch (e) {}
}

console.log('Searching everywhere for bahkm/honey/logo/ready files...');
findAnywhere('/');
