const fs = require('fs');
const path = require('path');
const http = require('http');

async function exportBundledDatabase() {
  const fetchLocalApi = (endpoint) => {
    return new Promise((resolve) => {
      http.get(`http://localhost:3000${endpoint}`, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            resolve([]);
          }
        });
      }).on('error', () => {
        resolve([]);
      });
    });
  };

  try {
    const [shortages, deviceIots, catalog, techs] = await Promise.all([
      fetchLocalApi('/api/shortages'),
      fetchLocalApi('/api/device-iot'),
      fetchLocalApi('/api/catalog'),
      fetchLocalApi('/api/technicians'),
    ]);

    const targetFile = path.join(process.cwd(), 'src', 'data', 'bundledDatabase.json');
    let existingData = {};
    if (fs.existsSync(targetFile)) {
      try {
        existingData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
      } catch (e) {}
    }

    const output = {
      exportedAt: new Date().toISOString(),
      shortagesCount: shortages.length || (existingData.shortages?.length || 0),
      deviceIotsCount: deviceIots.length || (existingData.deviceIots?.length || 0),
      catalogCount: catalog.length || (existingData.catalog?.length || 0),
      techsCount: techs.length || (existingData.technicians?.length || 0),
      shortages: shortages.length > 0 ? shortages : (existingData.shortages || []),
      deviceIots: deviceIots.length > 0 ? deviceIots : (existingData.deviceIots || []),
      catalog: catalog.length > 0 ? catalog : (existingData.catalog || []),
      technicians: techs.length > 0 ? techs : (existingData.technicians || []),
    };

    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetFile, JSON.stringify(output), 'utf8');
    console.log(`[Export DB] Bundled database snapshot complete: ${output.shortages.length} shortages, ${output.deviceIots.length} device_iots, ${output.catalog.length} catalog items, ${output.technicians.length} techs.`);
  } catch (err) {
    console.warn('[Export DB] Notice:', err.message);
  }
}

exportBundledDatabase();
