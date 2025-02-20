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
        case 'videojs':
            initVideoJSPlayer(url, video, status);
            break;
        case 'shaka':
            initShakaPlayer(url, video, status);
            break;
        case 'dash':
            initDashPlayer(url, video, status);
            break;
        case 'jwplayer':
            initJWPlayer(url, video, status);
            break;
        case 'flowplayer':
            initFlowPlayer(url, video, status);
            break;
        case 'clappr':
            initClapprPlayer(url, video, status);
            break;
        case 'ivs':
            initIVSPlayer(url, video, status);
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

function initVideoJSPlayer(url, video, status) {
    const player = videojs(video, {
        html5: {
            hls: {
                overrideNative: true,
                enableLowInitialPlaylist: true
            },
            nativeVideoTracks: false,
            nativeAudioTracks: false,
            nativeTextTracks: false
        }
    });
    
    currentPlayer = player;
    
    const proxyUrl = getProxyUrl(url);
    player.src({
        src: proxyUrl,
        type: 'application/x-mpegURL'
    });
    
    player.on('loadedmetadata', () => {
        status.className = 'status success';
        status.textContent = 'VideoJS: Yayın başarıyla yüklendi!';
        player.play();
    });
    
    player.on('error', () => {
        status.className = 'status error';
        status.textContent = `VideoJS: Yayın yüklenemedi (${player.error().message})`;
    });
}

function initShakaPlayer(url, video, status) {
    const player = new shaka.Player(video);
    currentPlayer = player;
    
    player.configure({
        streaming: {
            bufferingGoal: 30,
            rebufferingGoal: 15
        }
    });
    
    const proxyUrl = getProxyUrl(url);
    player.load(proxyUrl).then(() => {
        status.className = 'status success';
        status.textContent = 'Shaka: Yayın başarıyla yüklendi!';
        video.play();
    }).catch(error => {
        status.className = 'status error';
        status.textContent = `Shaka: Yayın yüklenemedi (${error.message})`;
        console.error('Shaka error:', error);
    });
}

function initDashPlayer(url, video, status) {
    const player = dashjs.MediaPlayer().create();
    currentPlayer = player;
    
    const proxyUrl = getProxyUrl(url);
    player.initialize(video, proxyUrl, true);
    
    player.on(dashjs.MediaPlayer.events.PLAYBACK_METADATA_LOADED, () => {
        status.className = 'status success';
        status.textContent = 'DashJS: Yayın başarıyla yüklendi!';
    });
    
    player.on(dashjs.MediaPlayer.events.ERROR, (error) => {
        status.className = 'status error';
        status.textContent = `DashJS: Yayın yüklenemedi (${error.message})`;
    });
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

function initClapprPlayer(url, video, status) {
    const container = document.createElement('div');
    container.id = 'clappr-container';
    video.parentNode.replaceChild(container, video);
    
    const proxyUrl = getProxyUrl(url);
    const player = new Clappr.Player({
        source: proxyUrl,
        parentId: '#clappr-container',
        width: '100%',
        height: '100%',
        autoPlay: true
    });
    
    currentPlayer = player;
    
    player.on(Clappr.Events.PLAYER_READY, () => {
        status.className = 'status success';
        status.textContent = 'Clappr: Yayın hazır!';
    });
    
    player.on(Clappr.Events.PLAYER_ERROR, () => {
        status.className = 'status error';
        status.textContent = 'Clappr: Yayın yüklenemedi';
    });
}

function initIVSPlayer(url, video, status) {
    if (IVSPlayer.isPlayerSupported) {
        const player = IVSPlayer.create();
        currentPlayer = player;
        
        player.attachHTMLVideoElement(video);
        
        const proxyUrl = getProxyUrl(url);
        player.load(proxyUrl);
        player.play();
        
        player.addEventListener(IVSPlayer.PlayerState.PLAYING, () => {
            status.className = 'status success';
            status.textContent = 'IVS: Yayın başarıyla yüklendi!';
        });
        
        player.addEventListener(IVSPlayer.PlayerEventType.ERROR, (error) => {
            status.className = 'status error';
            status.textContent = `IVS: Yayın yüklenemedi (${error.message})`;
        });
    } else {
        status.className = 'status error';
        status.textContent = 'IVS Player bu tarayıcıda desteklenmiyor';
    }
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