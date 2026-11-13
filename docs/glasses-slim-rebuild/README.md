# Slim camera glasses — 31 October 2026

Runtime asset: `public/models/cinema-glasses-slim.glb?v=slim-touching-4`.
Source/reproduction: `scripts/build-slim-cinema-glasses.py`; saved Blender file and geometry report are in `D:/CodexOutputs/Glasses_Rebuild_20261031/`.

The latest user-directed revision has two **separate** watertight rim meshes. Their inner edges touch exactly on the symmetry plane, without boolean union, overlap or nonuniform scaling. The lower nasal curves begin at -18 mm (raised from -26 mm). Rims have 1.9–2.185 mm face width and 2 mm depth. There are no side arms, dangling ends or separate bridge tab.

Runtime fitting derives one uniform scale from the exported bounds. Frame-only separable Gaussian defocus defaults to 4 CSS px sigma on the outside, with 1.75× extra softness at the inner rims. Frame materials remain opaque: there is no central alpha cutout, screen-bound fade or special transparent nasal material. Scene detail stays sharp; neutral smoke lenses exclude the theatre artwork using its actual geometry mask.

## Approved split blur and centre lens fill

Updated outer blur to **5 CSS px** and inner blur to **8 CSS px**, with independent controls and a smooth transition in both blur passes. The stronger region follows the projected nasal rims only, between -18 mm and +22 mm, rather than affecting a full-height screen stripe. These are absolute values, not an extra multiplier. Old single-blur drafts migrate once to 5/8 while retaining their fit and tint; subsequent split-blur edits persist normally.

A narrow 3×40 mm runtime lens insert covers only the opening between the nasal curves (-18 mm to +22 mm). It uses the exact same smoke shader, original scene capture and theatre-screen exclusion as the two existing lenses. It does not blur the scene or multiply the tint where lens geometry overlaps, and its geometry is disposed with the optics renderer. The Blender asset, two separate touching rims, camera and scene assets are unchanged by this update.

The split-blur update was subsequently checked in local Chrome on port 3100, including the visible 5/8 controls. Nine control/geometry tests, targeted ESLint and TypeScript pass. No new FPS claim was measured for this update. The console's existing hydration warning identifies the browser-extension-injected `cz-shortcut-listen` attribute, not a WebGL shader failure.

Controls use `cinema-glasses-slim-v2`. Previous `cinema-glasses-v1` drafts and old models are retained. Width now scales the entire pair uniformly; legacy half-spacing/bridge/duplicate-size fields are hidden. Distance, width, vertical placement, blur, tint and width lock remain editable.

Verification: exported topology/contact-plane tests, control tests, TypeScript and targeted ESLint. Theatre and projector screenshots were checked during earlier revisions. **The final touching-rim revision could not be browser-verified**: Computer Use stopped because it could not confidently determine the Windows browser URL. Earlier screenshots in the output folder do not represent this last revision. Existing camera paths, eye effects and Claude's corridor work were not edited.
