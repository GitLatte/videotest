const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// CORS ayarları
app.use(cors());

// Root endpoint
app.get('/', (req, res) => {
    res.json({ status: 'Proxy server is running' });
});

// Proxy endpoint
app.all('/api/proxy', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'URL parametresi gerekli' });
        }

        console.log('Proxy request for:', url);

        const response = await fetch(url, {
            headers: {
                'Accept': '*/*',
                'Accept-Encoding': 'identity',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        res.status(response.status);
        
        const contentType = response.headers.get('content-type');
        
        // M3U8 dosyası için özel işlem
        if (contentType && contentType.includes('application/vnd.apple.mpegurl')) {
            let m3u8Content = await response.text();
            
            // Base URL'yi al
            const baseUrl = new URL(url);
            const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
            
            // .ts uzantılı dosyaların URL'lerini düzelt
            m3u8Content = m3u8Content.replace(
                /^([^#].+?\.ts)$/gm,
                (match) => {
                    let tsUrl;
                    if (match.startsWith('http')) {
                        tsUrl = match;
                    } else if (match.startsWith('/')) {
                        tsUrl = `${baseUrl.origin}${match}`;
                    } else {
                        tsUrl = `${baseUrl.origin}${basePath}${match}`;
                    }
                    return `https://videotest-sand.vercel.app/api/proxy?url=${encodeURIComponent(tsUrl)}`;
                }
            );
            
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(m3u8Content);
        }
        
        // Diğer dosyalar için header'ları kopyala
        for (const [key, value] of response.headers.entries()) {
            if (key.toLowerCase() !== 'content-encoding' && 
                key.toLowerCase() !== 'content-length') {
                res.setHeader(key, value);
            }
        }

        // Stream response
        response.body.pipe(res);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = app; 