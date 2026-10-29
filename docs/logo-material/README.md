# Central logo colour — 27 October 2026

The user requested the cool steel-grey central mark shown in `/eye-study`, replacing the live logo's blue/orange/red enamel. Scope is the three `Swoosh` meshes only.

`components/corridor/logo-material.ts` assigns one private `MeshStandardMaterial` to those meshes in the existing mount-owned corridor clone. It retains the study's `#828d96` steel base, 0.95 metalness and 0.32 roughness. A restrained `#30373d` self-fill with tone mapping disabled keeps the grey visible under the darker production lighting; this affects the logo's own pixels and creates no scene light. It is an appearance match to the supplied web preview, not a new Blender/PBR bake.

The source GLB, loaded/cache materials, geometry and transformations remain intact. Corridor cleanup disposes the private logo material once. No added texture, model, light, draw or animation pass is required. The theatre, corridor surfaces, particle eye, star field and latest 1.5× champagne/teal gains are unchanged.

28 October trial: the two exterior close views now exchange some self-fill for restrained reflections from the existing shared environment. The previous final-eye response is restored before the pullback ends. See [foreground lighting trial](../foreground-light/README.md) for scope, controls and the pre-trial restore files.

Evidence: `D:/CodexOutputs/Logo_Grey_20261027/`. Production build and full browser journey passed without console/shader errors. The final logo's dominant face pixel is RGB (49, 56, 62), also the dominant grey face pixel in the supplied reference; the study has different illumination gradients, so this is not a claim of identical shading. Protected-file hashes confirm the eye, stars, camera, stage lights, environment and source GLB are unchanged.
