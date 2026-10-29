# Restoration inventory and checklist (2026-10-24)

Runtime sources: `theatre-marked.glb` (one merged colour-ID mesh, 564 objects, POSITION/NORMAL/COLOR_0, no UVs),
`projector-floor-marked.glb` (1 object), `corridor-ribbons-balanced.glb` (58 nodes, POSITION/NORMAL, no UVs).
All 564 theatre runtime objects match Blender objects by name in
`Theatre_Moon_Projector_optimized.blend` (all render-visible). Full joins: `D:/CodexOutputs/Restoration_20261024/inventory/`.
Baseline hashes: `docs/restoration/baseline-hashes.json` (`node scripts/restoration-baseline.mjs --check`).

## Theatre
| Item | Runtime objects | Class | Status |
|---|---|---|---|
| Ceiling (HALO II fascia, cove, soffit, inset, LED shelves, crown closures; 10 objects) | 10 | ALREADY ACCEPTED | untouched |
| Left wall `ET \| Side structural wall 1` | 1 | ALREADY ACCEPTED | untouched |
| Right wall `ET \| Side structural wall -1` | 1 | INCLUDED | Agent-verified — awaiting user review ([report](../right-wall-audit/README.md)) |
| Front (screen) wall `ET \| Front structural wall` | 1 | INCLUDED | Agent-verified — awaiting user review ([report](../front-wall-audit/README.md)) |
| Cinema screen `ET \| Blank curved CinemaScope screen` (no runtime content exists) | 1 | INCLUDED | Agent-verified — awaiting user review ([report](../screen-audit/README.md)) |
| Stage `ET \| Floating curved screen dais` | 1 | INCLUDED | Agent-verified — awaiting user review ([report](../stage-audit/README.md)) |
| Floor `ET \| Foundation slab` | 1 | INCLUDED | Agent-verified — awaiting user review ([report](../floor-slab-audit/README.md)) |
| Terraces/aisles/treads `ET \| Aisle -7.4 row 2 tread 1` (smoked walnut) | 1 | INCLUDED | Agent-verified — awaiting user review ([report](../terraces-audit/README.md)) |
| Stair nosings (27) + inlaid aisle edge reveals (4) | 31 | INCLUDED | Agent-verified with known limitation (edge-reveal rims darker) — awaiting user review ([report](../step-nosings-audit/README.md)) |
| Aisle/step/stage-cove lights: tread optics (24), first-step optics (3), recessed terrace nosings (10), stage lower cove (1), step-light channels (27), aisle light ribbons (20), channel hoods (20) | 105 | INCLUDED | Agent-verified with known limitation (off-axis diffusers ~20% dimmer) — awaiting user review ([report](../aisle-lights-audit/README.md)) |
| Wall trim: side wall top caps (2) + graphite end reveals (4) | 6 | INCLUDED | Agent-verified — awaiting user review ([report](../wall-trim-audit/README.md)) |
| Lower acoustic slats `ET \| ATELIER reeded ash dado` | 308 | INCLUDED | Agent-verified — awaiting user review ([report](../acoustic-slats-audit/README.md)) |
| Speakers (6) + grille slots (60) | 66 | INCLUDED | Agent-verified — awaiting user review ([report](../speakers-audit/README.md)) |
| Wall sconces: carved backing (6) + opal optics (6) | 12 | INCLUDED | Agent-verified — awaiting user review ([report](../light-fixtures-audit/README.md)) |
| Moon steel border rings: Cylinder.018, .020, .024, .026 (848 triangles) | 4 | INCLUDED (user-approved scope) | Agent-verified — awaiting user review ([report](../moon-steel-border-audit/README.md)) |
| Rest of the design moons (mirror discs, Material.005, white plastic, unassigned parts; 21 objects) | 21 | EXCLUDED | untouched |
| Seating (`sofa-lowpoly-draco.glb`) and projector (`projector-animated.glb`) | – | EXCLUDED | untouched |
| `PROJECTOR FLOOR \| Original` (`projector-floor-marked.glb`, 12 triangles) = source `Second_floor` | INCLUDED (user-approved scope) | Agent-verified — awaiting user review ([report](../projector-floor-audit/README.md)) |
| Original` (`projector-floor-marked.glb`, 12 triangles) | 1 | AMBIGUOUS | untouched — belongs to the projector export; question for user |

## Corridor (resolved with the prepared runtime-matching scene, 2026-10-24)
Receiver: `D:/CodexOutputs/Corridor_Bake_Preparation_20261024/Corridor_Runtime_Material_Prepared.blend` (see docs/corridor-preparation/).
Runtime world to Blender is (x,-z,y); the earlier "geometry does not match" blocker (original 4K geometry) is superseded.
| Item | Class | Status |
|---|---|---|
| Red corridor wall | INCLUDED | Agent-verified — awaiting user review ([report](../corridor-wall-red-audit/README.md)) |
| Connecting-plane wall | INCLUDED | Agent-verified — awaiting user review ([report](../corridor-wall-connecting-audit/README.md)) |
| Plain slate floor | INCLUDED | Agent-verified — awaiting user review ([report](../corridor-floor-audit/README.md)) |
| Pathway slot light assemblies (10 x diffuser/bronze face/dark interior) | INCLUDED | Agent-verified — awaiting user review ([report](../corridor-pathway-lights-audit/README.md)) |
| Fine slab joints (12) | INCLUDED | Agent-verified — awaiting user review ([report](../corridor-floor-joints-audit/README.md)) |
| Capped wall tops (2) | INCLUDED | Agent-verified — awaiting user review ([report](../corridor-wall-caps-audit/README.md)) |
| Restrained roof datums (2) | INCLUDED | Agent-verified — awaiting user review ([report](../corridor-roof-datums-audit/README.md)) |
| Swoosh ribbons (outer logo pieces), centre emblem | EXCLUDED | untouched |
| Slide A/B end walls (6 nodes) | PENDING USER SCOPE | untouched (visible as diagnostic colours at the corridor ends and through one sliver gap) |
| Blue curtain/spectral background | EXCLUDED / not in runtime | untouched |

## Order of work
right-wall → front-wall → screen → stage → floor-slab → terraces → step-nosings → aisle-lights → wall-trim →
acoustic-slats → speakers → light-fixtures → corridor-wall-red → corridor-wall-connecting → corridor-floor → corridor-pathway-lights → corridor-floor-joints → corridor-wall-caps → corridor-roof-datums → final integrated check.

## 6K upgrade (2026-10-24)
Upgraded to fresh 6144 x 6144 bakes, each Agent-verified — awaiting user review ([full report](6k-upgrade.md)):
theatre left wall, theatre right wall, theatre floor slab, theatre ceiling (incl. trim and cove), corridor left wall
(`corridor-wall-red`, prepared readable-fill source), corridor right wall (`corridor-wall-connecting`), corridor slate floor.
Every other item, all GLBs and all UV sidecars are unchanged. Previous textures: `D:/CodexOutputs/Restoration_6K_20261024/backup/`.
