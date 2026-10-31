/**
 * True below the `lg` breakpoint.
 *
 * Layout should prefer Tailwind's own `lg:` variants — they render identically
 * on the server and the client, so they cannot desynchronise hydration. This is
 * for the cases CSS cannot express: choosing between a popover and a bottom
 * sheet, where the two are different *elements* and one of them teleports out of
 * the tree it was declared in.
 *
 * It starts false, which is what the server renders. Anything that reads it must
 * therefore be closed, hidden or absent on first paint.
 */
export function useIsPhone(): Readonly<Ref<boolean>> {
  const isPhone = ref(false)

  onMounted(() => {
    const query = window.matchMedia('(max-width: 1023.98px)')
    isPhone.value = query.matches

    const onChange = (event: MediaQueryListEvent): void => {
      isPhone.value = event.matches
    }

    query.addEventListener('change', onChange)
    onBeforeUnmount(() => query.removeEventListener('change', onChange))
  })

  return readonly(isPhone)
}
