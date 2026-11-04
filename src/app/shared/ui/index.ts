/**
 * Biblioteca de componentes de interface do Nexus ERP. Importe tudo daqui: `import { DataTableComponent } from '@shared/ui';`
 * O catálogo, com seletor, inputs, outputs e exemplo de cada componente, está em `src/app/shared/ui/README.md`.
 *
 * As sobreposições (diálogo, gaveta, toast, banners) e os gráficos têm barris próprios:
 * `@shared/ui/overlay` e `@shared/ui/charts`.
 */
export * from './data';
export * from './display';
export * from './forms';
export { MOBILE_QUERY, mediaQuery } from './util/media';
export { uniqueId } from './util/ids';
export { rovingIndex } from './util/roving';
