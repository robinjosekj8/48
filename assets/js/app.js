document.addEventListener('DOMContentLoaded', () => {
    // ── STABILITY: PERIODIC PAGE RELOAD ──────────────────────────────────────────
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    setTimeout(() => window.location.reload(), FOUR_HOURS);

    const params = new URLSearchParams(window.location.search);
    const sourcePath = params.get('source');
    const type = params.get('type') || 'video';
    const container = document.getElementById('content-container');

    if (!sourcePath) return;

    let activeContentKey = ''; // Stores the URL or image list signature to detect changes

    // ── WATCHER CORE ────────────────────────────────────────────────────────────
    async function checkForUpdates() {
        if (type === 'video') {
            try {
                const res = await fetch(`${sourcePath}/url.txt?t=${Date.now()}`);
                if (res.ok) {
                    const url = (await res.text()).trim();
                    if (url && url !== activeContentKey) {
                        activeContentKey = url;
                        playVideoUrl(url);
                    }
                } else {
                    // Fallback to local 1.mp4 if url.txt is missing/removed
                    const localUrl = `${sourcePath}/1.mp4`;
                    if (localUrl !== activeContentKey) {
                        activeContentKey = localUrl;
                        playVideoUrl(localUrl);
                    }
                }
            } catch (err) { console.warn("Update check failed", err); }
        } else {
            // Image mode update check
            const newList = await probeImages();
            const newKey = newList.join(',');
            if (newKey !== activeContentKey) {
                activeContentKey = newKey;
                startSlideshow(newList);
            }
        }
    }

    // ── VIDEO PLAYER ─────────────────────────────────────────────────────────────
    function playVideoUrl(url) {
        container.innerHTML = '';
        const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);

        if (ytMatch) {
            const videoId = ytMatch[1];
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}`;
            iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;background:#000;';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            container.appendChild(iframe);
            requestAnimationFrame(() => requestAnimationFrame(() => iframe.classList.add('media-visible')));
            return;
        }

        const video = document.createElement('video');
        video.src = url;
        video.autoplay = video.loop = video.muted = true;
        video.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
        container.appendChild(video);
        requestAnimationFrame(() => requestAnimationFrame(() => video.classList.add('media-visible')));
        video.play().catch(err => console.warn('Autoplay blocked:', err));
    }

    // ── IMAGE PROBER ─────────────────────────────────────────────────────────────
    async function probeImages() {
        const extensions = ['png', 'jpg', 'jpeg', 'gif'];
        const found = [];
        for (let i = 1; i <= 100; i++) {
            let foundThisIndex = false;
            for (const ext of extensions) {
                const path = `${sourcePath}/${i}.${ext}`;
                const exists = await new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                    img.src = path;
                });
                if (exists) {
                    found.push(path);
                    foundThisIndex = true;
                    break;
                }
            }
            if (!foundThisIndex) break; // Stop at first missing number
        }
        return found;
    }

    // ── SLIDESHOW ────────────────────────────────────────────────────────────────
    let slideshowTimer = null;
    function startSlideshow(playlist) {
        if (slideshowTimer) clearInterval(slideshowTimer);
        if (playlist.length === 0) {
            container.innerHTML = '<p style="color:white;">No images found</p>';
            return;
        }
        let idx = 0;
        const showNext = () => {
            container.innerHTML = '';
            const img = document.createElement('img');
            img.src = playlist[idx % playlist.length];
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
            container.appendChild(img);
            requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('media-visible')));
            idx++;
        };
        showNext();
        if (playlist.length > 1) slideshowTimer = setInterval(showNext, 5000);
    }

    // Initialize and Start Watcher
    checkForUpdates();
    setInterval(checkForUpdates, 60000); // Check for hardware/content updates every 60s
});
