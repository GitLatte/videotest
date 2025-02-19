const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// CORS ayarları
app.use(cors());

// Proxy endpoint
app.get('/proxy', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'URL parametresi gerekli' });
        }

        // İstek yap
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Origin': '*',
                'Referer': '',
                'Range': req.headers.range || 'bytes=0-'
            }
        });

        // Status code'u ayarla
        res.status(response.status);

        // Header'ları kopyala
        for (const [key, value] of response.headers.entries()) {
            if (key.toLowerCase() !== 'content-length') {
                res.setHeader(key, value);
            }
        }

        // Stream'i pipe et
        return response.body.pipe(res);

    } catch (error) {
        console.error('Proxy hatası:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

module.exports = app; 