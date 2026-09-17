/**
 * Stands in for the `server-only` package under test.
 *
 * That package deliberately throws when imported outside a React Server
 * Component graph, which is exactly what we want in the app and exactly what
 * would stop the service layer from being testable. The vitest integration
 * config aliases it here.
 */
export {};
