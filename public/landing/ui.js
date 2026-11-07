const menu = document.getElementById('menu');
const openButton = document.getElementById('menu-open');
const closeButton = document.getElementById('menu-close');
const backdrop = document.getElementById('menu-backdrop');
let isOpen = false;
function setMenu(open) {
  isOpen = open;
  menu.classList.toggle('is-open', open);
  menu.inert = !open;
  menu.setAttribute('aria-hidden', String(!open));
  openButton.setAttribute('aria-expanded', String(open));
  (open ? closeButton : openButton).focus({ preventScroll: true });
}
openButton.addEventListener('click', () => setMenu(true));
closeButton.addEventListener('click', () => setMenu(false));
backdrop.addEventListener('click', () => setMenu(false));
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => {
  if (!isOpen) return;
  if (event.key === 'Escape') { event.preventDefault(); setMenu(false); }
  if (event.key === 'Tab') {
    const controls = [...menu.querySelectorAll('button,a[href]')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
const glassSurface = document.querySelector('[data-glass-card]');
glassSurface.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') return;
  const bounds = glassSurface.getBoundingClientRect();
  glassSurface.style.setProperty('--shine-x', `${100 * (event.clientX - bounds.left) / bounds.width}%`);
  glassSurface.style.setProperty('--shine-y', `${100 * (event.clientY - bounds.top) / bounds.height}%`);
});
glassSurface.addEventListener('pointerleave', () => {
  glassSurface.style.removeProperty('--shine-x');
  glassSurface.style.removeProperty('--shine-y');
});
