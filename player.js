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
    
    // Önce mevcut player'ı temizle
    cleanupCurrentPlayer();
    
    // Container'ı yeniden oluştur
    const container = document.querySelector('.player-container');
    container.innerHTML = `
        <video id="player" 
            controls 
            crossorigin="anonymous"
            referrerpolicy="no-referrer"
            x-webkit-airplay="allow"
            webkit-playsinline
            playsinline
            class="video-js vjs-default-skin">
        </video>
    `;
    
    // Yeni video elementini al
    const video = document.getElementById('player');
    
    // Seçilen player'ı başlat
    setTimeout(() => {
        switch(playerType) {
            case 'hls':
                initHlsPlayer(url, video, status);
                break;
            case 'plyr':
                initPlyrPlayer(url, video, status);
                break;
            case 'videojs':
                initVideoJSPlayer(url, video, status);
                break;
            default:
                initHlsPlayer(url, video, status);
                break;
        }
    }, 100);
}

// Headers oluşturucu
function getCustomHeaders() {
    return {
        'Origin': '*',
        'Referer': '',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    };
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
            debug: true,
            enableWorker: true,
            manifestLoadPolicy: {
                default: {
                    maxTimeToFirstByteMs: null,
                    maxLoadTimeMs: 20000,
                    timeoutRetry: {
                        maxNumRetry: 3,
                        retryDelayMs: 1000,
                        maxRetryDelayMs: 30000
                    },
                    errorRetry: {
                        maxNumRetry: 3,
                        retryDelayMs: 1000,
                        maxRetryDelayMs: 30000
                    }
                }
            },
            fragLoadPolicy: {
                default: {
                    maxTimeToFirstByteMs: null,
                    maxLoadTimeMs: 120000,
                    timeoutRetry: {
                        maxNumRetry: 4,
                        retryDelayMs: 1000,
                        maxRetryDelayMs: 30000
                    },
                    errorRetry: {
                        maxNumRetry: 4,
                        retryDelayMs: 1000,
                        maxRetryDelayMs: 30000
                    }
                }
            },
            pLoader: class ProxyLoader extends Hls.DefaultConfig.loader {
                constructor(config) {
                    super(config);
                    const load = this.load.bind(this);
                    this.load = function(context, config, callbacks) {
                        const url = context.url;
                        context.url = getProxyUrl(url);
                        load(context, config, callbacks);
                    };
                }
            }
        });

        currentPlayer = hls;
        
        try {
            const proxyUrl = getProxyUrl(url);
            console.log('Proxy deneniyor:', proxyUrl);
            
            hls.loadSource(proxyUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('Manifest yüklendi');
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
        controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        loadSprite: true,
        iconUrl: 'https://cdn.plyr.io/3.7.8/plyr.svg'
    });
    
    currentPlayer = player;
    
    if (Hls.isSupported()) {
        const hls = new Hls({
            debug: false,
            enableWorker: true,
            pLoader: class ProxyLoader extends Hls.DefaultConfig.loader {
                constructor(config) {
                    super(config);
                    const load = this.load.bind(this);
                    this.load = function(context, config, callbacks) {
                        const url = context.url;
                        context.url = getProxyUrl(url);
                        load(context, config, callbacks);
                    };
                }
            }
        });
        
        const proxyUrl = getProxyUrl(url);
        hls.loadSource(proxyUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            status.className = 'status success';
            status.textContent = 'Plyr: Yayın başarıyla yüklendi!';
            
            player.play().catch(() => {
                status.textContent = 'Plyr: Yayın hazır (Play tuşuna basın)';
            });
        });
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                status.className = 'status error';
                status.textContent = `Plyr: Yayın yüklenemedi (${data.type})`;
                console.error('HLS Error:', data);
            }
        });
        
        player.hls = hls;
    } 
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        
        video.addEventListener('loadedmetadata', function() {
            status.className = 'status success';
            status.textContent = 'Plyr: Yayın başarıyla yüklendi!';
            player.play().catch(() => {
                status.textContent = 'Plyr: Yayın hazır (Play tuşuna basın)';
            });
        });
        
        video.addEventListener('error', function(e) {
            status.className = 'status error';
            status.textContent = `Plyr: Yayın yüklenemedi (${video.error.message})`;
        });
    }
    else {
        status.className = 'status error';
        status.textContent = 'Plyr: HLS desteği bulunamadı';
        return;
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

function cleanupCurrentPlayer() {
    try {
        if (currentPlayer) {
            if (typeof currentPlayer.destroy === 'function') {
                currentPlayer.destroy();
            } else if (typeof currentPlayer.dispose === 'function') {
                currentPlayer.dispose();
            }
            currentPlayer = null;
        }
        
        const video = document.getElementById('player');
        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
            
            const newVideo = video.cloneNode(true);
            video.parentNode.replaceChild(newVideo, video);
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