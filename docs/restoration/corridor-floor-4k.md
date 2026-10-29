# Corridor floor 4K

2026-10-24. Only corridor-floor changes from6144x6144 to4096x4096, with the same atlas/UVs, sRGB handling and baked appearance. Derived from the latest user-compressed6K source.

Texture:5,964,611 ->2,833,446 bytes; saves3,131,165 bytes. Estimated BC7/ASTC4x4 GPU memory48 ->21.3MiB. Total inventoried scene assets57,431,856 ->54,300,691 bytes. Opening unchanged at42,832,682 bytes; deferred corridor assets now11,468,009 bytes. These figures exclude JS/decoders/fonts.

Build and TypeScript pass. All19 GLBs, all existing texture/UV files and other manifest entries unchanged. New LAN HTTP texture hash matches the encoded file. Original6K texture and manifest backed up in D:/CodexOutputs/Corridor_Floor_4K_20261024/. No rebake, camera or lighting changes.

User reports18s laptop and20s mobile loading. This floor is deferred until after first opening frame, so reducing it mainly helps subsequent download and memory, not the opening critical path. Next investigation should measure real-device network and decode timings and examine opening texture costs, particularly the12,376,809-byte6K moon steel atlas, while retaining user-approved6K dimensions. No promise of4.9s user-device load from the earlier localhost sample.

Browser journey reached corridor endpoint with all6 models and no console errors; screenshot after-corridor.jpg saved.
