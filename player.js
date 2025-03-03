let currentPlayer = null;

function testStream() {
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
            initPlyrPlayer(url, video, status);
            break;
        case 'jwplayer':
            initJWPlayer(url, video, status);
            break;
        case 'videojs':
            initVideoJsPlayer(url, video, status);
            break;

        default:
            initHlsPlayer(url, video, status);
    }
}

function getProxyUrl(url) {
    const proxyBase = 'https://videotest-sand.vercel.app';
    
    if (url.startsWith(proxyBase)) {
        return url;
    }
    
    return `${proxyBase}/api/proxy?url=${encodeURIComponent(url)}`;
}

function initHlsPlayer(url, video, status) {
    if (Hls.isSupported()) {
        const hls = new Hls({
            debug: false,
            enableWorker: true
        });

        currentPlayer = hls;
        window.currentHls = hls; // Global referans için kaydet
        
        try {
            const proxyUrl = getProxyUrl(url);
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

function initPlyrPlayer(url, video, status) {
    const player = new Plyr(video, {
        controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        autoplay: true
    });
    
    currentPlayer = player;
    
    try {
        const proxyUrl = getProxyUrl(url);
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

function initJWPlayer(url, video, status) {
    const container = document.createElement('div');
    container.id = 'jwplayer-container';
    if (video.parentNode) {
        video.parentNode.replaceChild(container, video);
        
        try {
            const proxyUrl = getProxyUrl(url);
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

function initVideoJsPlayer(url, video, status) {
    try {
        const player = videojs('player', {
            controls: true,
            autoplay: true,
            preload: 'auto'
        });
        
        currentPlayer = player;
        
        const proxyUrl = getProxyUrl(url);
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