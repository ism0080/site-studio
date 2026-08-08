// Workerd/bun provide `import.meta.url`; the alchemy Worker resource relies
// on it for bundling. `@cloudflare/workers-types` doesn't declare it.
interface ImportMeta {
  readonly url: string
}
