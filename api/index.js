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

        const response = await fetch(url);
        const contentType = response.headers.get('content-type');
        
        // Tüm response header'larını kopyala
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });

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