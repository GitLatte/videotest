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
                'Accept-Encoding': 'identity', // Sıkıştırmayı devre dışı bırak
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Status code'u ayarla
        res.status(response.status);
        
        // Header'ları kopyala (content-encoding hariç)
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
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = app; 