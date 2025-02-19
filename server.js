const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());

// Statik dosyaları serve et
app.use(express.static(__dirname));

// Proxy endpoint
app.get('/proxy', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).send('URL parametresi gerekli');
    }
    
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // Orijinal header'ları aktar
        Object.keys(response.headers).forEach(header => {
            res.setHeader(header, response.headers[header]);
        });
        
        // CORS header'larını ekle
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Stream'i doğrudan aktar
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).send('Yayın alınamadı: ' + error.message);
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Proxy sunucu http://localhost:${PORT} adresinde çalışıyor`);
}); 