# Theatre screen artwork — 30 October 2026

User requested the supplied ghosted New Wings Solutions image on the existing cinema screen, without squeezing it. Glasses/material refinement is deferred.

- `/images/theatre-screen-ghosted.png` is now the user's supplied 4096×1504 wide PNG (SHA256 `A16F63AC8EF70C12451024A5BD81899AF638063B00F828FEFB57081F4815D77F`), copied byte-for-byte. Its existing displaced/ghosted edges are intentional source pixels. The previous 16:9 source is backed up in `D:/CodexOutputs/Theatre_Screen_Wide_20261030/previous-16x9.png`.
- `theatre-screen-artwork.ts` identifies front-facing triangles in the existing screen and derives coordinates by the curved surface's horizontal arc length and physical height. The complete image uses a contain fit with its own original aspect. The wide replacement matches the measured 2.7233:1 screen, removing the former side margins (ratio rounding leaves under 0.2 source pixels). No cropping or independent X/Y scaling.
- `baked-surfaces.tsx` preloads this one image alongside the theatre atlases, clones the cached texture for mount ownership, and adds one texture lookup to the screen's existing material. No overlay mesh, extra draw call, new render pass or continuous animation. The original rear/edge bake and stage-lighting hook remain.
- GLBs, camera, glasses, eye/stars, pulse and white brand section are unchanged.

Validation: TypeScript, scoped ESLint and production build passed. Aspect-fit numerical check passed; Chrome opening view displayed the correctly oriented full image, with its own artwork visible in the existing side mirrors. Screenshot: `D:/CodexOutputs/Theatre_Screen_Artwork_20261030/theatre-screen-after.jpg`.

Immediate rollback: restore `baked-surfaces.tsx` from `D:/CodexOutputs/Theatre_Screen_Artwork_20261030/`, and remove only the new helper/image/this note. Protected eye-one/two/three references stay unchanged.
