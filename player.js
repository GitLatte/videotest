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
            name: 'AllOrigins (Global)',
            base: 'https://api.allorigins.win/raw?url=',
            urlFormatter: (url) => `${proxyServers[0].base}${encodeURIComponent(url)}`,
            location: 'Global'
        },
        {
            name: 'CORS.SH (USA)',
            base: 'https://cors.sh/',
            urlFormatter: (url) => `${proxyServers[1].base}${url}`,
            location: 'USA'
        },
        {
            name: 'CORS Bridge (EU)',
            base: 'https://api.codetabs.com/v1/proxy?quest=',
            urlFormatter: (url) => `${proxyServers[2].base}${encodeURIComponent(url)}`,
            location: 'EU'
        },
        {
            name: 'CroxyProxy (Asia)',
            base: 'https://www.croxyproxy.com/proxy?url=',
            urlFormatter: (url) => `${proxyServers[3].base}${encodeURIComponent(url)}`,
            location: 'Asia'
        },
        {
            name: 'Webshare (UK)',
            base: 'https://proxy.webshare.io/proxy?url=',
            urlFormatter: (url) => `${proxyServers[4].base}${encodeURIComponent(url)}`,
            location: 'UK'
        }
    ];
    
    // Seçili lokasyonu al
    const selectedLocation = document.getElementById('proxyLocation')?.value || 'Global';
    
    // URL zaten proxy ile başlıyorsa direkt döndür
    if (proxyServers.some(server => url.startsWith(server.base))) {
        return url;
    }
    
    // Stream URL'sini doğrula
    try {
        const urlObj = new URL(url);
        if (!urlObj.protocol.startsWith('http')) {
            throw new Error('Geçersiz URL protokolü');
        }
    } catch (error) {
        console.error('Geçersiz stream URL adresi:', error);
        throw new Error('Geçersiz stream URL adresi');
    }
    
    // Seçili lokasyona göre proxy sunucularını filtrele ve sırala
    const filteredServers = selectedLocation === 'Global' 
        ? proxyServers 
        : proxyServers.filter(server => server.location === selectedLocation);

    if (filteredServers.length === 0) {
        console.warn(`${selectedLocation} lokasyonu için uygun proxy bulunamadı, global proxy'ler kullanılacak`);
        filteredServers.push(...proxyServers);
    }

    // Filtrelenmiş proxy sunucularını sırayla dene
    for (const server of filteredServers) {
        try {
            const proxyUrl = server.urlFormatter(url);
            // Test et - timeout ekle
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 saniye timeout
            
            const response = await fetch(proxyUrl, { 
                method: 'HEAD',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                console.log(`${server.name} proxy başarıyla bağlandı (${server.location})`);
                return proxyUrl;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`${server.name} proxy timeout`);
            } else {
                console.warn(`${server.name} proxy bağlantı hatası:`, error);
            }
            continue;
        }
    }
    
    // Hiçbir proxy çalışmıyorsa hata fırlat
    throw new Error('Hiçbir proxy sunucusuna bağlanılamadı');
}

async function initHlsPlayer(url, video, status) {
    if (Hls.isSupported()) {
        const hls = new Hls({
            debug: false,
            enableWorker: true,
            xhrSetup: function(xhr, url) {
                xhr.timeout = 10000; // 10 saniye timeout
            }
        });

        currentPlayer = hls;
        window.currentHls = hls; // Global referans için kaydet
        
        try {
            const proxyUrl = await getProxyUrl(url);
            console.log('Stream yükleniyor:', proxyUrl);
            
            hls.loadSource(proxyUrl);
            hls.attachMedia(video);
            
            let manifestParsed = false;
            let timeoutId = setTimeout(() => {
                if (!manifestParsed) {
                    status.className = 'status error';
                    status.textContent = 'HLS: Manifest yüklenemedi - Zaman aşımı';
                    cleanupCurrentPlayer();
                }
            }, 15000); // 15 saniye manifest timeout
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                clearTimeout(timeoutId);
                manifestParsed = true;
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
                    let errorMessage = 'HLS: ';
                    switch(data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            errorMessage += 'Ağ bağlantı hatası';
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            errorMessage += 'Medya yürütme hatası';
                            break;
                        default:
                            errorMessage += `Yayın yüklenemedi (${data.details})`;
                    }
                    status.textContent = errorMessage;
                    cleanupCurrentPlayer();
                }
            });
            
        } catch (error) {
            console.error('HLS başlatma hatası:', error);
            status.className = 'status error';
            if (error.message === 'Hiçbir proxy sunucusuna bağlanılamadı') {
                status.textContent = 'HLS: Proxy sunucularına erişilemiyor';
            } else if (error.message === 'Geçersiz stream URL\'si') {
                status.textContent = 'HLS: Geçersiz yayın adresi';
            } else {
                status.textContent = 'HLS: Yayın başlatılamadı';
            }
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
        
        let loadTimeout = setTimeout(() => {
            status.className = 'status error';
            status.textContent = 'Plyr: Yayın yüklenemedi - Zaman aşımı';
            cleanupCurrentPlayer();
        }, 15000); // 15 saniye yükleme timeout
        
        video.addEventListener('loadedmetadata', () => {
            clearTimeout(loadTimeout);
            status.className = 'status success';
            status.textContent = 'Plyr: Yayın hazır';
            video.play().catch(error => {
                console.warn('Autoplay prevented:', error);
                status.textContent = 'Plyr: Otomatik oynatma engellendi';
            });
        });
        
        video.addEventListener('error', (e) => {
            clearTimeout(loadTimeout);
            status.className = 'status error';
            let errorMessage = 'Plyr: ';
            switch(e.target.error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    errorMessage += 'Yayın durduruldu';
                    break;
                case MediaError.MEDIA_ERR_NETWORK:
                    errorMessage += 'Ağ bağlantı hatası';
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                    errorMessage += 'Medya çözümleme hatası';
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage += 'Yayın formatı desteklenmiyor';
                    break;
                default:
                    errorMessage += 'Yayın yüklenemedi';
            }
            status.textContent = errorMessage;
            cleanupCurrentPlayer();
        });
        
    } catch (error) {
        console.error('Plyr başlatma hatası:', error);
        status.className = 'status error';
        if (error.message === 'Hiçbir proxy sunucusuna bağlanılamadı') {
            status.textContent = 'Plyr: Proxy sunucularına erişilemiyor';
        } else if (error.message === 'Geçersiz stream URL\'si') {
            status.textContent = 'Plyr: Geçersiz yayın adresi';
        } else {
            status.textContent = 'Plyr: Yayın başlatılamadı';
        }
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