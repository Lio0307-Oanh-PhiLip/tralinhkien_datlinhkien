const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldStr = `  if (process.env.NODE_ENV !== 'production' && !process.env.K_SERVICE) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(indexHtmlPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }`;

const newStr = `  if (process.env.NODE_ENV !== 'production' && !process.env.K_SERVICE) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite not found, falling back to static serving");
      app.use(express.static(distPath));
      app.get('*', (req, res) => res.sendFile(indexHtmlPath));
    }
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(indexHtmlPath);
    });
  }`;

code = code.replace(oldStr, newStr);
fs.writeFileSync('server.ts', code);
console.log('Fixed server.ts');
