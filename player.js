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
    
    if (playerType === 'plyr') {
        initPlyrPlayer(url, video, status);
    } else {
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
        
        try {
            const proxyUrl = getProxyUrl(url);
            console.log('Stream yükleniyor:', proxyUrl);
            
            hls.loadSource(proxyUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                status.className = 'status success';
                status.textContent = 'HLS: Yayın hazır!';
                video.play().catch(error => {
                    console.warn('Oynatma hatası:', error);
                });
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS hatası:', data);
                if (data.fatal) {
                    status.className = 'status error';
                    status.textContent = `HLS Hatası: ${data.details}`;
                }
            });
            
        } catch (error) {
            console.error('HLS başlatma hatası:', error);
        }
    }
}

function initPlyrPlayer(url, video, status) {
    const player = new Plyr(video, {
        controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen']
    });
    
    currentPlayer = player;
    
    if (Hls.isSupported()) {
        const hls = new Hls({
            debug: false,
            enableWorker: true
        });
        
        const proxyUrl = getProxyUrl(url);
        hls.loadSource(proxyUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            status.className = 'status success';
            status.textContent = 'Plyr: Yayın hazır!';
            player.play().catch(() => {
                status.textContent = 'Plyr: Yayın hazır (Play tuşuna basın)';
            });
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                status.className = 'status error';
                status.textContent = `Plyr: Yayın yüklenemedi (${data.type})`;
                console.error('HLS Error:', data);
            }
        });
        
        player.hls = hls;
    } 
}

function cleanupCurrentPlayer() {
    try {
        if (currentPlayer) {
            if (typeof currentPlayer.destroy === 'function') {
                currentPlayer.destroy();
            }
            currentPlayer = null;
        }
        
        const video = document.getElementById('player');
        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
        
    } catch (error) {
        console.warn('Player temizleme hatası:', error);
    }
}

// Sayfa kapatılırken temizle
window.onbeforeunload = function() {
    if (currentPlayer) {
        cleanupCurrentPlayer();
    }
}; 