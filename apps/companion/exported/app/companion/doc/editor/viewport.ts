/**
 * How much of the bottom of the window the on-screen keyboard covers.
 *
 * A phone page keeps its toolbar sitting on top of the keyboard, the way
 * Notes and Notion do. `position: fixed; bottom: 0` lands under the keyboard
 * in iOS Safari and in a WKWebView, so the toolbar is lifted by the gap
 * between the layout viewport and the visual one.
 */
export function useKeyboardInset(): Readonly<Ref<number>> {
  const inset = ref(0)

  onMounted(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = (): void => {
      inset.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    onBeforeUnmount(() => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    })
  })

  return readonly(inset)
}

/** True at the companion's phone widths (its layout switches at 900px). */
export function usePhoneWidth(): Readonly<Ref<boolean>> {
  const phone = ref(false)
  onMounted(() => {
    const query = window.matchMedia('(max-width: 899.98px)')
    phone.value = query.matches
    const onChange = (event: MediaQueryListEvent): void => {
      phone.value = event.matches
    }
    query.addEventListener('change', onChange)
    onBeforeUnmount(() => query.removeEventListener('change', onChange))
  })
  return readonly(phone)
}

/**
 * True on a touch-first device (phone, iPad without a trackpad). An iPad is
 * desktop-wide, so width alone would give it no keyboard toolbar.
 */
export function useCoarsePointer(): Readonly<Ref<boolean>> {
  const coarse = ref(false)
  onMounted(() => {
    const query = window.matchMedia('(pointer: coarse)')
    coarse.value = query.matches
    const onChange = (event: MediaQueryListEvent): void => {
      coarse.value = event.matches
    }
    query.addEventListener('change', onChange)
    onBeforeUnmount(() => query.removeEventListener('change', onChange))
  })
  return readonly(coarse)
}

/**
 * Grow a textarea to its text. Where the browser can do it in CSS
 * (`field-sizing: content`) it's left to the browser. Otherwise it's measured,
 * but never while detached: a node view is built before it's attached, and a
 * height measured then is zero.
 */
export function autosize(el: HTMLTextAreaElement | null | undefined): void {
  if (!el) return
  if (typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content')) return
  if (!el.isConnected) {
    // One more try once the node view is in the page; never a loop.
    requestAnimationFrame(() => {
      if (el.isConnected && el.scrollHeight) autosize(el)
    })
    return
  }
  // Hidden (a closed toggle): nothing to measure, keep the rows height.
  if (!el.offsetParent) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
