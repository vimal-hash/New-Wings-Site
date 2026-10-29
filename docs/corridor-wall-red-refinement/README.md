# Left corridor wall readability preparation

Preparation ONLY, no bake/site changes. Wall identified from actual PAGE_POSE and runtime mesh raycasts as corridor-wall-red. The existing Blender source also reads dark, so this is an intentional wall-only fill improvement. Images before/after use the actual page-panel camera (without the website-only white panel), not an invented orbit view.

Prepared working file: D:/CodexOutputs/Corridor_Left_Wall_Lighting_20261024/Left_Wall_Lighting_Prepared.blend. Source work copy and prepared corridor master remain unchanged. New active material: LEFT WALL | Soft readable charcoal fill. OBJECT-linked slot is authoritative.

Changed material controls: wall-relative height fade and a gentle textured camera-visible ambient fill, peak0.18. Original steel/texture/reflection branches retained. No new physical scene lights or global exposure changes. Lower26percent of wall height fades to a dark floor junction. Camera-only fill avoids illuminating other surfaces.

Copy claude-prompt.txt for the single-item bake handoff. Full change/camera metadata: preparation.json. Protected website-file hashes and result: baseline.json / verification.json. Source-generation script: scripts/blender/prepare-left-wall-readable-fill.py.

## Result (2026-10-24)
Baked at 6144 x 6144 from this prepared copy via an item-only source override, one bend-camera bake, and integrated as
`public/textures/corridor/wall-red/corridor-wall-red-6k.ktx2` (old texture backed up and removed from public).
Agent-verified — awaiting user review. Details, camera-ray validation and the page-pose diagnosis:
[corridor-wall-red report](../corridor-wall-red-audit/README.md) and [6K report](../restoration/6k-upgrade.md).
