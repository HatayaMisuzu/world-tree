# World Tree Desktop UI/Product Review

Date: 2026-06-06

## Fixed In This Pass

- Utility pages now scroll inside the main content area in small windows.
- Home background uses DPR-aware `image-set()` assets.
- UI icons use `srcset` with `@1x`, `@2x`, and `@3x`.
- Settings navigation is now functional instead of decorative.
- Advanced commands, paths, and diagnostics are hidden behind the advanced section.
- Portable ZIP is built from a staging directory to avoid active-file locks.

## Remaining Product Risks

1. The current `background@2x` and `background@3x` files are upscaled from a 1672x941 source. The render pipeline is correct, but the art needs native high-detail generation.
2. `styles.css` still contains older rules that are neutralized by final overrides. A future cleanup should split CSS into `base`, `home`, `page`, and `responsive` files.
3. Settings sections now switch correctly, but they do not persist the last selected section after re-render.
4. Monitor is conceptually closer to a player-facing "Observatory", but proposal adoption/rejection workflows still need a friendlier queue UI.
5. The application still uses the default Electron icon in packaged builds.

## Recommended Next Iteration

- Replace background images with native image2 outputs at 1366x768, 2732x1536, and 4098x2304.
- Add a real app icon generated from the world tree badge.
- Persist settings section selection in UI state.
- Add a compact "World Pulse" strip to the dialogue page.
- Move raw JSON, command previews, and path catalogs into an explicit "Developer Tools" modal.
- Run screenshot QA at 1366x768, 1000x650, 1920x1080, and 2560x1440.
