document.addEventListener('DOMContentLoaded', () => {
    // URL Parameters: ?source=content/stream1&type=video
    const params = new URLSearchParams(window.location.search);
    const sourcePath = params.get('source');
    const type = params.get('type') || 'video'; // 'video' or 'image'

    if (!sourcePath) {
        console.log("No source specified. Idle mode.");
        return;
    }

    const container = document.getElementById('content-container');

    // ── VIDEO MODE ──────────────────────────────────────────────────────────────
    if (type === 'video') {
        // Check for url.txt first (single remote URL → loop it forever)
        fetch(`${sourcePath}/url.txt`)
            .then(res => {
                if (res.ok) return res.text();
                throw new Error('No url.txt');
            })
            .then(text => {
                const url = text.trim();
                if (url) {
                    playVideoUrl(url);
                } else {
                    throw new Error('Empty url.txt');
                }
            })
            .catch(() => {
                // No url.txt — try local file 1.mp4 / 1.webm
                const localPath = `${sourcePath}/1.mp4`;
                playVideoUrl(localPath);
            });

        function playVideoUrl(url) {
            container.innerHTML = '';

            // ── YouTube ──────────────────────────────────────────────────────
            const ytMatch = url.match(
                /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
            );

            if (ytMatch) {
                const videoId = ytMatch[1];
                const iframe = document.createElement('iframe');
                iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&vq=hd1080`;
                iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
                iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                iframe.allowFullscreen = true;
                container.appendChild(iframe);
                return;
            }

            // ── Local / direct MP4 ───────────────────────────────────────────
            const video = document.createElement('video');
            video.src = url;
            video.autoplay = true;
            video.loop = true;       // ← single video: just loop, no transitions
            video.controls = true;
            video.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';

            video.addEventListener('error', (e) => {
                console.error('Video error:', e);
                container.innerHTML = `<p style="color:white;text-align:center;">Error loading video.<br>${url}</p>`;
            });

            container.appendChild(video);
            requestAnimationFrame(() => requestAnimationFrame(() => video.classList.add('media-visible')));
            video.play().catch(err => console.warn('Autoplay blocked:', err));
        }

    // ── IMAGE / SLIDESHOW MODE ──────────────────────────────────────────────────
    } else {
        const extensions = ['png', 'jpg', 'jpeg', 'gif'];
        const MAX_FILES = 100;
        let playlist = [];
        let currentIndex = 0;

        // Probe images by actually loading them (works on file:// and http://)
        probeFile(1);

        function probeFile(index) {
            if (index > MAX_FILES) { startSlideshow(); return; }
            probeExtensions(index, 0);
        }

        function probeExtensions(index, extIndex) {
            if (extIndex >= extensions.length) {
                // No extension matched for this index — stop scanning
                startSlideshow();
                return;
            }
            const filePath = `${sourcePath}/${index}.${extensions[extIndex]}`;
            const tester = new Image();
            tester.onload = () => {
                playlist.push(filePath);
                probeFile(index + 1); // found one, try next number
            };
            tester.onerror = () => {
                probeExtensions(index, extIndex + 1); // try next extension
            };
            tester.src = filePath;
        }

        function startSlideshow() {
            if (playlist.length === 0) {
                container.innerHTML = `<p style="color:white;text-align:center;">No images found in ${sourcePath}</p>`;
                return;
            }
            showImage(0);
        }

        function showImage(index) {
            currentIndex = index % playlist.length;
            container.innerHTML = '';
            const img = document.createElement('img');
            img.src = playlist[currentIndex];
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
            img.onerror = () => {
                console.error('Failed to load image:', playlist[currentIndex]);
                if (playlist.length > 1) setTimeout(() => showImage(currentIndex + 1), 1000);
            };
            container.appendChild(img);
            requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('media-visible')));
            // Auto-advance only if there are multiple images
            if (playlist.length > 1) {
                setTimeout(() => showImage(currentIndex + 1), 5000);
            }
        }
    }
});
