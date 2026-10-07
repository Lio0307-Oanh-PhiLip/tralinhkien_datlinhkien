const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, 'electron', 'main.cjs');
let mainCode = fs.readFileSync(mainPath, 'utf8');

const linuxFallbackCode = `  // Linux CUPS fallback (lpstat)
  if (process.platform === 'linux') {
    try {
      const output = await new Promise((resolve) => {
        exec('lpstat -p', { timeout: 3500 }, (err, stdout) => {
          if (err || !stdout) resolve(null);
          else resolve(stdout.trim());
        });
      });
      const defaultOutput = await new Promise((resolve) => {
        exec('lpstat -d', { timeout: 3500 }, (err, stdout) => {
          if (err || !stdout) resolve(null);
          else resolve(stdout.trim());
        });
      });
      if (output) {
        const lines = output.split('\\n');
        const defaultMatch = defaultOutput ? defaultOutput.match(/system default destination:\\s*(.+)/i) : null;
        const defaultName = defaultMatch ? defaultMatch[1].trim() : null;
        
        const extractedPrinters = [];
        for (const line of lines) {
          const match = line.match(/^printer\\s+([^\\s]+)/i);
          if (match && match[1]) {
            const pName = match[1];
            extractedPrinters.push({
              name: pName,
              displayName: pName.replace(/_/g, ' '),
              isDefault: pName === defaultName,
              status: 0
            });
          }
        }
        if (extractedPrinters.length > 0) {
          printers = extractedPrinters;
        }
      }
    } catch (e) {}
  }
`;

if (!mainCode.includes('lpstat -p')) {
  mainCode = mainCode.replace('return printers || [];', linuxFallbackCode + '\n  return printers || [];');
  fs.writeFileSync(mainPath, mainCode, 'utf8');
  console.log('Patched electron/main.cjs with Linux lpstat fallback.');
} else {
  console.log('Already patched.');
}
