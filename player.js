let currentPlayer = null;

async function testStream() {
    const url = document.getElementById('streamUrl').value;
    const playerType = document.getElementById('playerType').value;
    const status = document.getElementById('status');
    
    if (!url) {
        status.className = 'status error';
        status.textContent = 'Lütfen bir stream URL\'si girin';
        return;
    }
    
    status.className = 'status';
    status.textContent = 'Yayın test ediliyor...';
    
    cleanupCurrentPlayer();
    
    const video = document.getElementById('player');
    
    switch(playerType) {
        case 'plyr':
            await initPlyrPlayer(url, video, status);
            break;
        case 'jwplayer':
            await initJWPlayer(url, video, status);
            break;
        case 'videojs':
            await initVideoJsPlayer(url, video, status);
            break;

        default:
            await initHlsPlayer(url, video, status);
    }
}

async function getProxyUrl(url) {
    // Proxy sunucuları öncelik sırasına göre
    const proxyServers = [
        {
            name: 'CloudFlare',
            base: 'https://corsproxy.io/',
            urlFormatter: (url) => `${proxyServers[0].base}?${encodeURIComponent(url)}`
        },
        {
            name: 'AllOrigins',
            base: 'https://api.allorigins.win/raw',
            urlFormatter: (url) => `${proxyServers[1].base}?url=${encodeURIComponent(url)}`
        },
        {
            name: 'CORS Anywhere',
            base: 'https://cors-anywhere.herokuapp.com',
            urlFormatter: (url) => `${proxyServers[2].base}/${url}`
        }
    ];
    
    // URL zaten proxy ile başlıyorsa direkt döndür
    if (proxyServers.some(server => url.startsWith(server.base))) {
        return url;
    }
    
    // Proxy sunucularını sırayla dene
    for (const server of proxyServers) {
        try {
            const proxyUrl = server.urlFormatter(url);
            // Test et
            const response = await fetch(proxyUrl, { method: 'HEAD' });
            if (response.ok) {
                console.log(`${server.name} proxy başarıyla bağlandı`);
                return proxyUrl;
            }
        } catch (error) {
            console.warn(`${server.name} proxy bağlantı hatası:`, error);
            continue;
        }
    }
    
    // Hiçbir proxy çalışmıyorsa orijinal URL'yi döndür ve uyarı ver
    console.warn('Hiçbir proxy sunucusuna bağlanılamadı, orijinal URL kullanılıyor');
    return url;
}

async function initHlsPlayer(url, video, status) {
    if (Hls.isSupported()) {
        const hls = new Hls({
            debug: false,
            enableWorker: true
        });

        currentPlayer = hls;
        window.currentHls = hls; // Global referans için kaydet
        
        try {
            const proxyUrl = await getProxyUrl(url);
            console.log('Stream yükleniyor:', proxyUrl);
            
            hls.loadSource(proxyUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                status.className = 'status success';
                status.textContent = 'HLS: Yayın hazır';
                video.play().catch(error => {
                    console.warn('Autoplay prevented:', error);
                });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS hatası:', data);
                if (data.fatal) {
                    status.className = 'status error';
                    status.textContent = `HLS Hatası: Yayın yüklenemedi (${data.details})`;
                    cleanupCurrentPlayer(); // Hata durumunda temizle
                }
            });
            
        } catch (error) {
            console.error('HLS başlatma hatası:', error);
            status.className = 'status error';
            status.textContent = 'HLS: Yayın başlatılamadı';
            cleanupCurrentPlayer();
        }
    } else {
        status.className = 'status error';
        status.textContent = 'HLS: Tarayıcınız HLS formatını desteklemiyor';
    }
}

async function initPlyrPlayer(url, video, status) {
    const player = new Plyr(video, {
        controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        autoplay: true
    });
    
    currentPlayer = player;
    
    try {
        const proxyUrl = await getProxyUrl(url);
        video.src = proxyUrl;
        
        video.addEventListener('loadedmetadata', () => {
            status.className = 'status success';
            status.textContent = 'Plyr: Yayın hazır';
            video.play().catch(error => {
                console.warn('Autoplay prevented:', error);
            });
        });
        
        video.addEventListener('error', () => {
            status.className = 'status error';
            status.textContent = 'Plyr: Yayın yüklenemedi';
            cleanupCurrentPlayer();
        });
        
    } catch (error) {
        console.error('Plyr başlatma hatası:', error);
        status.className = 'status error';
        status.textContent = 'Plyr: Yayın başlatılamadı';
        cleanupCurrentPlayer();
    }
}

async function initJWPlayer(url, video, status) {
    const container = document.createElement('div');
    container.id = 'jwplayer-container';
    if (video.parentNode) {
        video.parentNode.replaceChild(container, video);
        
        try {
            const proxyUrl = await getProxyUrl(url);
            const player = jwplayer('jwplayer-container').setup({
                file: proxyUrl,
                width: '100%',
                height: '100%',
                autostart: true
            });
            
            currentPlayer = player;
            
            player.on('ready', () => {
                status.className = 'status success';
                status.textContent = 'JWPlayer: Yayın hazır';
            });
            
            player.on('error', () => {
                status.className = 'status error';
                status.textContent = 'JWPlayer: Yayın yüklenemedi';
                cleanupCurrentPlayer();
            });
            
        } catch (error) {
            console.error('JWPlayer başlatma hatası:', error);
            status.className = 'status error';
            status.textContent = 'JWPlayer: Yayın başlatılamadı';
            cleanupCurrentPlayer();
        }
    } else {
        status.className = 'status error';
        status.textContent = 'JWPlayer: Player container not found';
    }
}

async function initVideoJsPlayer(url, video, status) {
    try {
        const player = videojs('player', {
            controls: true,
            autoplay: true,
            preload: 'auto'
        });
        
        currentPlayer = player;
        
        const proxyUrl = await getProxyUrl(url);
        player.src({
            src: proxyUrl,
            type: 'application/x-mpegURL'
        });
        
        player.ready(() => {
            status.className = 'status success';
            status.textContent = 'Video.js: Yayın hazır';
            player.play().catch(error => {
                console.warn('Autoplay prevented:', error);
            });
        });
        
        player.on('error', () => {
            status.className = 'status error';
            status.textContent = 'Video.js: Yayın yüklenemedi';
            cleanupCurrentPlayer();
        });
        
    } catch (error) {
        console.error('Video.js başlatma hatası:', error);
        status.className = 'status error';
        status.textContent = 'Video.js: Yayın başlatılamadı';
        cleanupCurrentPlayer();
    }
}


function cleanupCurrentPlayer() {
    try {
        if (window.currentHls) {
            window.currentHls.destroy();
            window.currentHls = null;
        }

        if (currentPlayer) {
            try {
                if (typeof currentPlayer.destroy === 'function') {
                    currentPlayer.destroy();
                } else if (typeof currentPlayer.dispose === 'function') {
                    currentPlayer.dispose();
                } else if (typeof currentPlayer.remove === 'function') {
                    currentPlayer.remove();
                } else if (typeof currentPlayer.cleanup === 'function') {
                    currentPlayer.cleanup();
                }
            } catch (cleanupError) {
                console.warn('Player cleanup error:', cleanupError);
            }
            currentPlayer = null;
        }
        
        const existingContainers = document.querySelectorAll('#jwplayer-container, #clappr-container');
        existingContainers.forEach(container => {
            container.remove();
        });
        
        const container = document.querySelector('.player-container');
        if (container) {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            const video = document.createElement('video');
            video.id = 'player';
            video.controls = true;
            video.crossOrigin = 'anonymous';
            video.playsinline = true;
            video.className = 'video-js';
            container.appendChild(video);
        }

        if (window.jwplayer && typeof window.jwplayer.remove === 'function') {
            window.jwplayer.remove();
        }
    } catch (error) {
        console.warn('Player cleanup error:', error);
    }
}

window.onbeforeunload = function() {
    if (currentPlayer) {
        cleanupCurrentPlayer();
    }
};

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const streamUrl = urlParams.get('url');
    
    if (streamUrl) {
        document.getElementById('streamUrl').value = streamUrl;
        testStream();
    }
});