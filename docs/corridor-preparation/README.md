# Verified corridor baking preparation

Prepared file: `D:/CodexOutputs/Corridor_Bake_Preparation_20261024/Corridor_Runtime_Material_Prepared.blend`.

This is an authoring-only material/lighting setup. No texture bake, GLB export or website change was made. `protected-verification.json` confirms108 protected site/source files unchanged and no new runtime files.

## Geometry

Runtime `public/models/corridor-ribbons-balanced.glb` corresponds to `Logo_balanced_ribbon_gaps.blend`, not the original4K geometry.58 objects /25,410 triangles match the saved prepared file within0.071mm at corners and0.056degrees at normals (Draco quantization). Full results: `saved-file-verification.json`.

The prepared scene preserves this geometry.49 corridor objects have source material assignments;3 logo ribbons are excluded,6 slide objects remain pending. The centre emblem is absent from runtime and hidden in this authoring copy only. Other layout objects remain as context, not bake targets.

## Materials and lighting

The original4K material graphs, source-local coordinate references, source shading UVs, AgX Medium High Contrast / exposure-0.65 and world are restored on the matching layout.9 relevant lights use the documented original authoring transform with positions/orientations evaluated BEFORE library append; energy/size are converted for the70.646052 scale. No extra artistic lights were introduced.

Generated capped tops receive parent-wall shading UV correspondence (zero collapsed triangles checked). These shading UVs must remain separate from runtime bake UVs. Source camera-ray shader branches require explicit validation during baking; see preparation-report warnings. Do not brighten the reference arbitrarily.

The original-source bend and prepared bend were rendered at corresponding cameras. They show matching dark charcoal walls, warm fixtures and slate detail. Layout changes near the entrance/terminal can naturally alter shadows/reflections. No universal exact-match claim is made.

## Handoff and reproduction

Copy `claude-baking-prompt.txt` to Claude. The prepared file is the bake receiver. Runtime world-to-Blender is simply(x,-z,y); no source-corridor fitting required. Full runtime decoded data: `runtime-meshes.json` in the authoring directory.

Scripts (preparation only, never site installers): export-corridor-preparation.mjs, inspect-corridor-preparation.py, prepare-corridor-material-context.py, finalize-corridor-preparation.py, render-corridor-preparation.py, render-corridor-original-comparison.py, verify-corridor-preparation.py and verify-corridor-preparation-files.mjs under scripts/blender/. Finalization tags slides pending and hides the absent emblem in the working copy. Do not run preparation over future baked working copies.

Original source paths and exact object/material/light/camera mappings: preparation-report.json. Images: prepared-entry.png, prepared-bend.png, prepared-exit.png, original-source-bend.png.

A generated working-file.blend1 backup is retained; automatic approval blocked its deletion without a stated reason. No source master was deleted or overwritten.
