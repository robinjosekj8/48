document.addEventListener('DOMContentLoaded', () => {

    // ── STABILITY: DISABLED (Run offline, do not reload) ─────────────────────

    // ── URL PARAMS ───────────────────────────────────────────────────────────
    const params     = new URLSearchParams(window.location.search);
    const sourcePath = params.get('source');
    const type       = params.get('type') || 'video';
    const container  = document.getElementById('content-container');

    if (!sourcePath) return;

    let activeContentKey = '';   // URL or image-list signature to detect changes
    let currentMode      = type; // Track active display mode

    // ── WATCHER CORE ─────────────────────────────────────────────────────────
    async function checkForUpdates() {
        try {
            // First, always check for url.txt regardless of the original 'type'
            const res = await fetch(`${sourcePath}/url.txt?t=${Date.now()}`);
            if (res.ok) {
                const url = (await res.text()).trim();
                if (url) {
                    currentMode = 'video';
                    if (url !== activeContentKey) {
                        activeContentKey = url;
                        playVideoUrl(url);
                    }
                    return; // Stop here if url.txt has a valid URL
                }
            }
            
            // If url.txt doesn't exist or is empty, fallback to original type logic
            if (type === 'video') {
                currentMode = 'video';
                const localUrl = `${sourcePath}/1.mp4`;
                if (localUrl !== activeContentKey) {
                    activeContentKey = localUrl;
                    playVideoUrl(localUrl);
                }
            } else {
                currentMode = 'image';
                const newList = await probeImages();
                const newKey  = newList.join(',');
                if (newKey !== activeContentKey) {
                    activeContentKey = newKey;
                    startSlideshow(newList);
                }
            }
        } catch (err) {
            console.warn('Update check failed:', err);
        }
    }



    // ── VIDEO PLAYER ─────────────────────────────────────────────────────────
    // We keep a single DOM element alive and swap src rather than
    // rebuilding innerHTML every call — this prevents GPU/memory churn.
    let currentVideoEl  = null;
    let currentIframeEl = null;

    function playVideoUrl(url) {

        const ytMatch = url.match(
            /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
        );

        if (ytMatch) {
            const videoId = ytMatch[1];
            const newSrc  = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&rel=0`;

            // Reuse existing iframe if one already exists to avoid DOM thrash
            if (currentIframeEl && container.contains(currentIframeEl)) {
                if (currentIframeEl.src !== newSrc) {
                    currentIframeEl.src = newSrc;
                }
                return;
            }

            // First time — clear container and build iframe
            clearContainer();
            const iframe = document.createElement('iframe');
            iframe.src     = newSrc;
            iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;background:#000;opacity:0;transition:opacity 0.5s ease-in-out;';
            iframe.allow   = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.setAttribute('allowfullscreen', '');

            // Fade in via onload (most reliable for iframes) + rAF fallback
            iframe.onload = () => { iframe.style.opacity = '1'; };
            container.appendChild(iframe);
            requestAnimationFrame(() =>
                requestAnimationFrame(() => { iframe.style.opacity = '1'; })
            );

            currentIframeEl = iframe;
            currentVideoEl  = null;
            return;
        }

        // ── LOCAL VIDEO ───────────────────────────────────────────────────────
        if (currentVideoEl && container.contains(currentVideoEl)) {
            if (currentVideoEl.src !== new URL(url, location.href).href) {
                currentVideoEl.src = url;
                currentVideoEl.load();
                currentVideoEl.play().catch(e => console.warn('Autoplay blocked:', e));
            }
            return;
        }

        clearContainer();
        const video        = document.createElement('video');
        video.src          = url;
        video.autoplay     = true;
        video.loop         = true;
        video.muted        = true;
        video.playsInline  = true;   // Prevents kiosk/mobile from hijacking fullscreen
        video.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;opacity:0;transition:opacity 0.5s ease-in-out;';
        container.appendChild(video);
        requestAnimationFrame(() =>
            requestAnimationFrame(() => { video.style.opacity = '1'; })
        );
        video.play().catch(e => console.warn('Autoplay blocked:', e));

        currentVideoEl  = video;
        currentIframeEl = null;
    }

    // ── IMAGE PROBER ─────────────────────────────────────────────────────────
    // Explicitly nulls out each Image object after use to release memory.
    async function probeImages() {
        const extensions = ['png', 'jpg', 'jpeg', 'gif'];
        const found      = [];

        for (let i = 1; i <= 100; i++) {
            let foundThisIndex = false;

            for (const ext of extensions) {
                const path   = `${sourcePath}/${i}.${ext}?t=${Date.now()}`;
                const exists = await new Promise(resolve => {
                    let probe    = new Image();
                    probe.onload  = () => { probe = null; resolve(true);  };
                    probe.onerror = () => { probe = null; resolve(false); };
                    probe.src     = path;
                });

                if (exists) {
                    // Store path without cache-bust so the actual <img> loads clean
                    found.push(`${sourcePath}/${i}.${ext}`);
                    foundThisIndex = true;
                    break;
                }
            }

            if (!foundThisIndex) break; // Stop at first gap
        }

        return found;
    }

    // ── SLIDESHOW ────────────────────────────────────────────────────────────
    // Reuses a single <img> element — swaps src only — instead of destroying
    // and recreating a DOM node on every 5-second tick.
    let slideshowTimer = null;
    let slideshowImg   = null;

    function startSlideshow(playlist) {

        if (slideshowTimer) {
            clearInterval(slideshowTimer);
            slideshowTimer = null;
        }

        if (!playlist || playlist.length === 0) {
            clearContainer();
            const msg = document.createElement('p');
            msg.textContent = 'No images found';
            msg.style.color = 'white';
            container.appendChild(msg);
            slideshowImg = null;
            return;
        }

        // Build or reuse the <img> element
        if (!slideshowImg || !container.contains(slideshowImg)) {
            clearContainer();
            slideshowImg = document.createElement('img');
            slideshowImg.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;opacity:0;transition:opacity 0.5s ease-in-out;';
            container.appendChild(slideshowImg);
        }

        currentVideoEl  = null;
        currentIframeEl = null;

        let idx = 0;
        const showNext = () => {
            const nextSrc = playlist[idx % playlist.length];
            idx++;

            // Fade out → swap src → fade in (avoids flash between images)
            slideshowImg.style.opacity = '0';
            setTimeout(() => {
                slideshowImg.src = nextSrc;
                slideshowImg.onload = () => { slideshowImg.style.opacity = '1'; };
                // Fallback fade-in if onload already fired (cached image)
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => { slideshowImg.style.opacity = '1'; })
                );
            }, 300); // Wait for fade-out before swapping
        };

        showNext();
        if (playlist.length > 1) {
            slideshowTimer = setInterval(showNext, 5000);
        }
    }

    // ── DOM HELPER ───────────────────────────────────────────────────────────
    // Safe container clear that nulls our element refs.
    function clearContainer() {
        container.innerHTML = '';
        currentVideoEl  = null;
        currentIframeEl = null;
        slideshowImg    = null;
    }

    // ── INIT ─────────────────────────────────────────────────────────────────
    checkForUpdates();
    setInterval(checkForUpdates, 60_000); // Poll for content changes every 60s
});
