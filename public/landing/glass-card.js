const video = document.getElementById('bg-video');
const card = document.querySelector('[data-glass-card]');
const duplicate = document.getElementById('dup-video-container');
const canvas = document.getElementById('dup-image');
const context = canvas.getContext('2d', { alpha: false });
const DUP_PIXEL_RATIO = 1;

// Sizing the duplicate to the viewport rather than to the card is deliberate.
// The filter separates colour channels at its leading edges; viewport sizing
// puts those hard bands outside the card, leaving only clean refraction inside.
// The duplicate stays at 1× even on retina: this soft effect gains nothing from
// four times the SVG filter work.
function drawFrame() {
  if (context && !document.hidden && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
    const rect = card.getBoundingClientRect();
    if (rect.width && rect.height) {
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      Object.assign(duplicate.style, { left: `${-rect.left}px`, top: `${-rect.top}px`, width: `${vw}px`, height: `${vh}px` });
      const w = Math.round(vw * DUP_PIXEL_RATIO), h = Math.round(vh * DUP_PIXEL_RATIO);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const cover = Math.max(vw / video.videoWidth, vh / video.videoHeight);
      const sw = vw / cover, sh = vh / cover;
      const sx = (video.videoWidth - sw) / 2, sy = (video.videoHeight - sh) / 2;
      try { context.drawImage(video, sx, sy, sw, sh, 0, 0, w, h); } catch { /* The next video frame may not be decodable yet. */ }
    }
  }
  requestAnimationFrame(drawFrame);
}
video.play().catch(() => {
  // A browser that blocks autoplay can resume it after the first interaction.
  document.addEventListener('pointerdown', () => video.play().catch(() => {}), { once: true });
});
requestAnimationFrame(drawFrame);
