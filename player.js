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
        case 'flowplayer':
            initFlowPlayer(url, video, status);
            break;
        case 'mediaelement':
            initMediaElementPlayer(url, video, status);
            break;
        case 'openplayer':
            initOpenPlayer(url, video, status);
            break;
        case 'afterglow':
            initAfterglowPlayer(url, video, status);
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

function initJWPlayer(url, video, status) {
    const container = document.createElement('div');
    container.id = 'jwplayer-container';
    video.parentNode.replaceChild(container, video);
    
    const proxyUrl = getProxyUrl(url);
    const player = jwplayer('jwplayer-container').setup({
        file: proxyUrl,
        width: '100%',
        aspectratio: '16:9',
        stretching: 'uniform',
        primary: 'html5'
    });
    
    currentPlayer = player;
    
    player.on('ready', () => {
        status.className = 'status success';
        status.textContent = 'JWPlayer: Yayın hazır!';
    });
    
    player.on('error', () => {
        status.className = 'status error';
        status.textContent = 'JWPlayer: Yayın yüklenemedi';
    });
}

function initFlowPlayer(url, video, status) {
    const container = document.createElement('div');
    container.className = 'flowplayer';
    video.parentNode.replaceChild(container, video);
    
    const proxyUrl = getProxyUrl(url);
    const player = flowplayer(container, {
        clip: {
            sources: [{
                type: 'application/x-mpegurl',
                src: proxyUrl
            }]
        }
    });
    
    currentPlayer = player;
    
    player.on('ready', () => {
        status.className = 'status success';
        status.textContent = 'Flowplayer: Yayın hazır!';
    });
    
    player.on('error', (e, api, err) => {
        status.className = 'status error';
        status.textContent = `Flowplayer: Yayın yüklenemedi (${err.message})`;
    });
}

function initMediaElementPlayer(url, video, status) {
    const proxyUrl = getProxyUrl(url);
    
    const player = new MediaElementPlayer(video, {
        stretching: 'responsive',
        hls: {
            debug: false,
            enableWorker: true
        },
        success: function(mediaElement) {
            currentPlayer = player;
            mediaElement.setSrc(proxyUrl);
            mediaElement.load();
            
            mediaElement.addEventListener('loadedmetadata', () => {
                status.className = 'status success';
                status.textContent = 'MediaElement: Yayın hazır!';
                mediaElement.play();
            });
            
            mediaElement.addEventListener('error', (e) => {
                status.className = 'status error';
                status.textContent = `MediaElement: Yayın yüklenemedi (${e.message})`;
            });
        },
        error: function(e) {
            status.className = 'status error';
            status.textContent = 'MediaElement: Player başlatılamadı';
        }
    });
}

function initOpenPlayer(url, video, status) {
    const player = new OpenPlayer(video, {
        mode: 'hls',
        autoplay: true
    });
    
    currentPlayer = player;
    
    const proxyUrl = getProxyUrl(url);
    player.src = proxyUrl;
    
    player.on('loadedmetadata', () => {
        status.className = 'status success';
        status.textContent = 'OpenPlayer: Yayın hazır!';
        player.play();
    });
    
    player.on('error', (error) => {
        status.className = 'status error';
        status.textContent = `OpenPlayer: Yayın yüklenemedi (${error.message})`;
    });
}

function initAfterglowPlayer(url, video, status) {
    const container = document.createElement('div');
    container.className = 'afterglow';
    container.id = 'afterglow-player';
    video.parentNode.replaceChild(container, video);
    
    const proxyUrl = getProxyUrl(url);
    
    const player = afterglow.getPlayer('afterglow-player');
    currentPlayer = player;
    
    player.initialize({
        source: proxyUrl,
        autoplay: true,
        streaming: {
            type: 'hls'
        }
    });
    
    player.on('ready', () => {
        status.className = 'status success';
        status.textContent = 'Afterglow: Yayın hazır!';
    });
    
    player.on('error', (error) => {
        status.className = 'status error';
        status.textContent = `Afterglow: Yayın yüklenemedi (${error.message})`;
    });
}

function cleanupCurrentPlayer() {
    try {
        if (currentPlayer) {
            if (typeof currentPlayer.destroy === 'function') {
                currentPlayer.destroy();
            } else if (typeof currentPlayer.dispose === 'function') {
                currentPlayer.dispose();
            } else if (typeof currentPlayer.remove === 'function') {
                currentPlayer.remove();
            } else if (typeof currentPlayer.cleanup === 'function') {
                currentPlayer.cleanup();
            }
            currentPlayer = null;
        }
        
        // Container'ı temizle ve video elementini yeniden oluştur
        const container = document.querySelector('.player-container');
        container.innerHTML = `
            <video id="player" 
                controls 
                crossorigin="anonymous"
                playsinline
                class="video-js vjs-default-skin">
            </video>
        `;
        
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