const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'Range'],
    exposedHeaders: ['Content-Length', 'Content-Range']
}));

app.get('/proxy', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'URL parametresi gerekli' });
        }

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

        // Response header'larını kopyala
        const headers = response.headers.raw();
        Object.keys(headers).forEach(key => {
            if (key.toLowerCase() !== 'content-length') {
                res.setHeader(key, headers[key]);
            }
        });

        // Stream'i pipe et
        response.body.pipe(res);

    } catch (error) {
        console.error('Proxy hatası:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = app; 