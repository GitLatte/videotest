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
    
    // Önce mevcut player'ı tamamen temizle
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
            case 'shaka':
                initShakaPlayer(url, video, status);
                break;
            case 'plyr':
                initPlyrPlayer(url, video, status);
                break;
            case 'dash':
                initDashPlayer(url, video, status);
                break;
            case 'videojs':
                initVideoJSPlayer(url, video, status);
                break;
            case 'flowplayer':
                initFlowPlayer(url, video, status);
                break;
            case 'jwplayer':
                initJWPlayer(url, video, status);
                break;
            case 'ivs':
                initIVSPlayer(url, video, status);
                break;
            default:
                tryAllPlayers(url, video, status);
                break;
        }
    }, 100); // Kısa bir gecikme ekleyerek DOM'un güncellenmesini bekle
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
    // Vercel proxy sunucumuz
    const proxyUrl = `https://videotest-sand.vercel.app/api/proxy?url=${encodeURIComponent(url)}`;
    return proxyUrl;
}

function initHlsPlayer(url, video, status) {
    if (Hls.isSupported()) {
        const hls = new Hls({
            debug: true,
            enableWorker: true,
            manifestLoadingMaxRetry: 3,
            manifestLoadingRetryDelay: 1000,
            manifestLoadingMaxRetryTimeout: 30000,
            xhrSetup: function(xhr) {
                xhr.withCredentials = false;
                // Sadece güvenli header'lar
                xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
            }
        });

        currentPlayer = hls;
        
        try {
            const proxyUrl = getProxyUrl(url);
            console.log('Proxy deneniyor:', proxyUrl);
            
            hls.loadSource(proxyUrl);
            hls.attachMedia(video);
            
            // Manifest yüklendiğinde
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('Manifest yüklendi');
                status.className = 'status success';
                status.textContent = 'HLS: Yayın hazır!';
                
                video.play().catch(error => {
                    console.warn('Oynatma hatası:', error);
                });
            });

            // Hata yönetimi
            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS hatası:', data);
                if (data.fatal) {
                    const nextProxyUrl = getProxyUrl(url);
                    if (nextProxyUrl !== url) {
                        console.log('Yeni proxy deneniyor:', nextProxyUrl);
                        hls.loadSource(nextProxyUrl);
                    } else {
                        status.className = 'status error';
                        status.textContent = `HLS Hatası: ${data.details}`;
                    }
                }
            });
            
        } catch (error) {
            console.error('HLS başlatma hatası:', error);
        }
    }
}

function initShakaPlayer(url, video, status) {
    shaka.Player.isBrowserSupported() ? (async () => {
        const player = new shaka.Player(video);
        
        // CORS ayarlarını yapılandır
        player.getNetworkingEngine().registerRequestFilter((type, request) => {
            request.allowCrossSiteCredentials = false;
            request.headers['Referrer-Policy'] = 'no-referrer';
            request.headers['Origin'] = location.origin;
        });
        
        currentPlayer = player;
        
        try {
            const proxyUrl = getProxyUrl(url);
            await player.load(proxyUrl);
            status.className = 'status success';
            status.textContent = 'Shaka: Yayın başarıyla yüklendi!';
            video.play();
        } catch (error) {
            status.className = 'status error';
            status.textContent = `Shaka Hatası: ${error.message}`;
        }
    })() : null;
}

function initPlyrPlayer(url, video, status) {
    const player = new Plyr(video, {
        controls: ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
        loadSprite: true,
        iconUrl: 'https://cdn.plyr.io/3.7.8/plyr.svg'
    });
    
    currentPlayer = player;
    
    // HLS.js ile entegre et
    if (Hls.isSupported()) {
        const hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true,
            xhrSetup: function(xhr, url) {
                xhr.withCredentials = false;
            }
        });
        
        // Yayını yükle
        hls.loadSource(url);
        hls.attachMedia(video);
        
        // HLS olaylarını dinle
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            status.className = 'status success';
            status.textContent = 'Plyr: Yayın başarıyla yüklendi!';
            
            // Manifest yüklendiğinde oynatmayı dene
            player.play().catch(() => {
                // Otomatik oynatma engellendiyse kullanıcıya bildir
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
        
        // Plyr'a HLS instance'ını ekle
        player.hls = hls;
    } 
    // Native HLS desteği varsa
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
    // Hiçbiri desteklenmiyorsa
    else {
        status.className = 'status error';
        status.textContent = 'Plyr: HLS desteği bulunamadı';
        return;
    }
    
    // Plyr olaylarını dinle
    player.on('ready', () => {
        console.log('Plyr hazır');
    });
    
    player.on('playing', () => {
        status.className = 'status success';
        status.textContent = 'Plyr: Yayın oynatılıyor';
    });
    
    player.on('error', (error) => {
        status.className = 'status error';
        status.textContent = `Plyr: Oynatma hatası (${error.detail})`;
    });
    
    // Temizleme fonksiyonunu güncelle
    const originalCleanup = cleanupCurrentPlayer;
    cleanupCurrentPlayer = function() {
        if (player.hls) {
            player.hls.destroy();
        }
        originalCleanup();
    };
}

function initDashPlayer(url, video, status) {
    const player = dashjs.MediaPlayer().create();
    
    player.extend('RequestModifier', () => ({
        modifyRequestHeader: xhr => {
            xhr.withCredentials = false;
            xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
            return xhr;
        }
    }));
    
    currentPlayer = player;
    
    // Hata yönetimini geliştir
    player.on(dashjs.MediaPlayer.events.ERROR, (error) => {
        let errorMessage = 'Bilinmeyen hata';
        
        try {
            // Hata detaylarını kontrol et
            if (error.error) {
                if (error.error.message) {
                    errorMessage = error.error.message;
                } else if (error.error.code) {
                    switch (error.error.code) {
                        case 1:
                            errorMessage = 'Yayın yüklenemedi';
                            break;
                        case 2:
                            errorMessage = 'Medya hatası';
                            break;
                        case 3:
                            errorMessage = 'Ağ hatası';
                            break;
                        default:
                            errorMessage = `Hata kodu: ${error.error.code}`;
                    }
                }
            }
            
            // Hata detaylarını konsola yaz
            console.error('Dash hatası:', {
                code: error.error.code,
                message: error.error.message,
                data: error.error.data,
                error: error
            });
            
        } catch (e) {
            console.warn('Hata detayları alınamadı:', e);
        }
        
        status.className = 'status error';
        status.textContent = `Dash Hatası: ${errorMessage}`;
        
        // Hata durumunda alternatif oynatıcıyı dene
        cleanupCurrentPlayer();
        initHlsPlayer(url, video, status);
    });
    
    // Yayın başladığında
    player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, () => {
        status.className = 'status success';
        status.textContent = 'Dash: Yayın başarıyla yüklendi!';
    });
    
    // Yayın yüklenirken
    player.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, () => {
        status.className = 'status success';
        status.textContent = 'Dash: Manifest yüklendi, yayın başlatılıyor...';
    });
    
    // Kalite değişimlerini izle
    player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e) => {
        const quality = player.getBitrateInfoListFor('video')[e.newQuality];
        if (quality) {
            console.log(`Dash: Kalite değişti - ${quality.width}x${quality.height} @ ${Math.round(quality.bitrate/1000)}kbps`);
        }
    });
    
    try {
        player.initialize(video, url, true);
        player.setAutoPlay(true);
        
        // Timeout kontrolü ekle
        setTimeout(() => {
            if (!player.isPlaying()) {
                status.className = 'status error';
                status.textContent = 'Dash: Yayın zaman aşımına uğradı';
                
                cleanupCurrentPlayer();
                initHlsPlayer(url, video, status);
            }
        }, 10000);
        
    } catch (error) {
        console.error('Dash başlatma hatası:', error);
        status.className = 'status error';
        status.textContent = `Dash: Başlatma hatası - ${error.message || 'Bilinmeyen hata'}`;
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
    
    player.src({
        src: url,
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

function initFlowPlayer(url, video, status) {
    const container = video.parentElement;
    container.innerHTML = '<div id="flowplayer"></div>';
    
    const player = flowplayer('#flowplayer', {
        clip: {
            sources: [{
                type: 'application/x-mpegurl',
                src: url
            }]
        },
        autoplay: true
    });
    
    currentPlayer = player;
    
    player.on('ready', () => {
        status.className = 'status success';
        status.textContent = 'Flowplayer: Yayın başarıyla yüklendi!';
    });
    
    player.on('error', (e, api, err) => {
        status.className = 'status error';
        status.textContent = `Flowplayer: Yayın yüklenemedi (${err.message})`;
    });
}

function initJWPlayer(url, video, status) {
    // Önce container'ı hazırla
    const container = video.parentElement;
    if (!container) return;
    
    container.innerHTML = '<div id="jwplayer"></div>';
    
    try {
        const player = jwplayer('jwplayer').setup({
            file: url,
            width: '100%',
            height: '100%',
            autostart: true,
            hlshtml: true,
            primary: 'html5',
            // CORS ayarları
            setupConfig: {
                requestSettings: {
                    credentials: 'omit',
                    mode: 'cors',
                    headers: {
                        'Access-Control-Allow-Origin': '*'
                    }
                }
            },
            // HLS yapılandırması
            hlsjsConfig: {
                xhrSetup: function(xhr) {
                    xhr.withCredentials = false;
                    xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
                },
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            }
        });
        
        currentPlayer = player;
        
        player.on('ready', () => {
            console.log('JWPlayer hazır');
            status.className = 'status success';
            status.textContent = 'JWPlayer: Yayın yükleniyor...';
        });
        
        player.on('play', () => {
            status.className = 'status success';
            status.textContent = 'JWPlayer: Yayın başarıyla yüklendi!';
        });
        
        player.on('error', (e) => {
            console.error('JWPlayer hatası:', e);
            status.className = 'status error';
            status.textContent = `JWPlayer: ${e.message || 'Yayın yüklenemedi'}`;
            
            // Hata durumunda alternatif oynatıcıyı dene
            cleanupCurrentPlayer();
            initHlsPlayer(url, video, status);
        });
        
        // Timeout kontrolünü güncelle
        const timeoutCheck = setTimeout(() => {
            try {
                if (player && player.getState() !== 'playing') {
                    status.className = 'status error';
                    status.textContent = 'JWPlayer: Yayın zaman aşımına uğradı';
                    
                    cleanupCurrentPlayer();
                    initHlsPlayer(url, video, status);
                }
            } catch (error) {
                console.warn('Timeout kontrolü hatası:', error);
            }
        }, 10000);
        
        // Player temizlendiğinde timeout'u da temizle
        player.on('remove', () => {
            clearTimeout(timeoutCheck);
        });
        
    } catch (error) {
        console.error('JWPlayer başlatma hatası:', error);
        status.className = 'status error';
        status.textContent = 'JWPlayer başlatılamadı';
    }
}

function initIVSPlayer(url, video, status) {
    if (IVSPlayer.isPlayerSupported) {
        const player = IVSPlayer.create();
        player.attachHTMLVideoElement(video);
        
        currentPlayer = player;
        
        player.load(url);
        player.play();
        
        player.addEventListener(IVSPlayer.PlayerState.PLAYING, () => {
            status.className = 'status success';
            status.textContent = 'IVS: Yayın başarıyla yüklendi!';
        });
        
        player.addEventListener(IVSPlayer.PlayerEventType.ERROR, (err) => {
            status.className = 'status error';
            status.textContent = `IVS: Yayın yüklenemedi (${err.message})`;
        });
    }
}

async function tryAllPlayers(url, video, status) {
    const players = [
        { name: 'HLS', init: initHlsPlayer },
        { name: 'Shaka', init: initShakaPlayer },
        { name: 'Plyr', init: initPlyrPlayer },
        { name: 'Dash', init: initDashPlayer },
        { name: 'VideoJS', init: initVideoJSPlayer },
        { name: 'Flowplayer', init: initFlowPlayer },
        { name: 'JWPlayer', init: initJWPlayer },
        { name: 'IVS', init: initIVSPlayer }
    ];
    
    for (const player of players) {
        try {
            player.init(url, video, status);
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (video.readyState > 0) {
                        resolve();
                    } else {
                        reject();
                    }
                }, 3000);
            });
            return; // Başarılı olursa döngüyü sonlandır
        } catch (error) {
            cleanupCurrentPlayer();
            continue; // Başarısız olursa sonraki player'ı dene
        }
    }
    
    // Hiçbiri başarılı olamadıysa
    status.className = 'status error';
    status.textContent = 'Hiçbir oynatıcı yayını açamadı';
}

function cleanupCurrentPlayer() {
    try {
        // Önce mevcut player'ı temizle
        if (currentPlayer) {
            if (typeof currentPlayer.destroy === 'function') {
                currentPlayer.destroy();
            } else if (typeof currentPlayer.dispose === 'function') {
                currentPlayer.dispose();
            } else if (typeof currentPlayer.remove === 'function') {
                currentPlayer.remove();
            }
            
            // JWPlayer için özel temizleme
            if (window.jwplayer && typeof window.jwplayer === 'function') {
                const jwInstance = window.jwplayer('jwplayer');
                if (jwInstance && typeof jwInstance.remove === 'function') {
                    jwInstance.remove();
                }
            }
            
            currentPlayer = null;
        }
        
        // Video elementini temizle
        const video = document.getElementById('player');
        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
            
            // Tüm event listener'ları temizle
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
