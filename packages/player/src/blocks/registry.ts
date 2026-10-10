// Auto-registers every src/blocks/*Block.vue by file name: WorkedExampleBlock.vue <-> 'worked_example'.
// Unknown types fall back to UnknownBlock (a dt/dd dump, never a crash).
import type { Component } from 'vue';
import { ENABLED_TYPES, blockComponentName } from '@bilimind/core';
import UnknownBlock from './UnknownBlock.vue';

const modules = import.meta.glob<{ default: Component }>('./*Block.vue', { eager: true });
const byName = new Map<string, Component>();
for (const [path, mod] of Object.entries(modules)) {
  const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.vue$/, '');
  byName.set(name, mod.default);
}

export function blockComponent(type: string): Component {
  return byName.get(blockComponentName(type)) ?? UnknownBlock;
}

/** Enabled types without a component file (should be empty; shown in dev). */
export const missingBlockComponents = (): string[] => ENABLED_TYPES.filter(t => !byName.has(blockComponentName(t)));
