// Compatibility façade (TRUE V2 Phase 1). The world layout now lives in
// engine/world/layout.mjs; this file re-exports it so every existing import
// (renderers, tests) keeps working unchanged.
export * from '../world/layout.mjs';
