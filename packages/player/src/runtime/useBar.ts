// Top bar scroll states: .scrolled once the page moves (frosted), .away while scrolling down (hidden),
// back on scroll up (player-design §3.1).
import { onBeforeUnmount, onMounted, ref } from 'vue';

export function useBarState() {
  const scrolled = ref(false);
  const away = ref(false);
  let last = 0;
  const on = () => {
    const y = window.scrollY;
    scrolled.value = y > 8;
    if (y > 240 && y > last + 4) away.value = true;
    else if (y < last - 4 || y < 240) away.value = false;
    last = y;
  };
  onMounted(() => { window.addEventListener('scroll', on, { passive: true }); on(); });
  onBeforeUnmount(() => window.removeEventListener('scroll', on));
  return { scrolled, away };
}
