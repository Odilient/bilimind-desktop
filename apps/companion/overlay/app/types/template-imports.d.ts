// Nuxt declares template auto-imports on 'vue', but Vue's component types read them from '@vue/runtime-core' and,
// with pnpm's layout, the two stay separate interfaces. This joins them, for the typecheck only.
import type { ComponentCustomProperties as AutoImports } from 'vue'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties extends AutoImports {}
}
