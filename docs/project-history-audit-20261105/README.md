# Project history audit — 5 November 2026

The old project conversation and many project backups are present on D:. This inspection created only new audit/export files under the current project on D:. It did not restore or alter app databases, move archived data, or change the website.

## Why history is missing from the app

The running app returned only the current Codex chat and no archived Codex chats. The cleanup folder contains an older Codex data home at `D:\Cleanup_20261103\codex\dot-codex`, including its databases, transcripts, project catalog and saved app state. This supports the explanation that the old local data was relocated during cleanup and the app now uses a separate data home. The cleanup operation itself was not independently verified: `move.log` did not contain useful readable entries.

The archived state database contains 31 thread records and 9 project records, including duplicate records for `new_si_two`. These are catalog records, not a guarantee that every old conversation or project file survives. Most historical rollout paths still point to the former C: data home, so simply opening the archived database would not by itself repair those paths.

## Confirmed project conversation

- Saved name: **Optimize 3D site assets and code**.
- Main thread ID: `01a12012-6bd4-7681-9f97-1b59a739ff3b`.
- Originally filed under `D:\New folio\new site code\new_si_two`.
- Its main thread and two continuation segments explicitly reference `new_site_three` in 4,142 stored history items combined.
- The three transcript files total 6,097,103,341 bytes, approximately 6.10 GB (5.68 GiB). Their opening metadata identifies the same logical main conversation.
- Available user/assistant history runs from 9 October through 1 November 2026. The last assistant message is at 09:51:37 IST on 1 November and discusses a real-device mobile check after desktop work.
- [project-chat-export.md](project-chat-export.md) contains 3,126 readable messages: 885 user messages and 2,241 assistant messages, across those three segments. Tool outputs, reasoning and binary images are excluded. The export does not recreate the app sidebar.
- `state_5.sqlite` and `thread_history_1.sqlite` both returned `ok` from SQLite `PRAGMA quick_check`. Queries used read-only connections. The multi-gigabyte transcript files were inventoried and their first metadata records inspected, not exhaustively parsed.
- Other matching catalog entries include **Match sofa appearance in R3F**, **Respond to greeting**, and an unnamed sofa optimization task.

The transcript files are under `D:\Cleanup_20261103\codex\dot-codex\sessions`. History also remains in `thread_history_1.sqlite`, with the thread catalog in `state_5.sqlite`. Keep each database's WAL/SHM companions with it when preserving the archive.

## Project files and backups

`D:\CodexOutputs` contains 141 top-level directories. The scoped inventory counted 12,353 files and 124,282,087,903 bytes (124.28 GB / 115.75 GiB) inside those directories. This is a combined output collection, not a claim that every file is exclusively part of this project or a complete standalone backup.

Relevant locations include:

| Area | Locations under D:\CodexOutputs |
| --- | --- |
| Project source backup | `ProjectBackups\new_si_two_before_laptop_optimization_20261014_140525` |
| Approved theatre/corridor | `Approved_Theatre_Corridor_20261020`, `R3F_Approved_Corridor_6K_20261011` |
| Eye checkpoint identity records | `Eye_One_Checkpoint_20261027`, `Eye_Two_Checkpoint_20261029`, `Eye_Three_Checkpoint_20261029` |
| Cinema opening and glasses | `Theatre_Glasses_Dark_20261030`, `Cinema_Full_Glasses_20261030`, `Glasses_Close_Nose_20261030`, `Glasses_Rebuild_20261031` |
| Brand and final sequence | `Brand_Artwork_Reveal_20261030`, `Brand_Letter_Motion_20261030`, `Brand_Object_Motion_20261030`, `Sequence_Refinement_20261031` |
| Recent rope work | `Loki_Rope_20261103`, `Rope_Bake_20261104`, `Rope_Restart_20261104`, `Rope_Sections_20261105` |

The current repository still has all three protected Git checkpoint references:

| Reference | Commit |
| --- | --- |
| `refs/checkpoints/eye-one` | `fe1ad8ec53c888be42f08c814ff0192513aae31a` |
| `refs/checkpoints/eye-two` | `a060785cebd69ff66fcf1a73b4bed339ca1d8a4b` |
| `refs/checkpoints/eye-three` | `d2d9cd01fb96e6b5798af4ec2a7c39d2201b7160` |

The cleanup folder also has:

- `blender-autosaves`: 20 Blender files, approximately 2.97 GB. Their individual association with this project was not verified.
- `rope_r3f_duplicates`: four large GLB files, approximately 498 MB.
- `claude-projects`: 13 JSONL files plus five JSON files. A search for the exact project folder names found no matches, so these were not presented as recovered project conversations.
- `claude-temp\D--New-folio-new-site-code-new-site-three`: project-specific scratch scripts, screenshots and image attachments, including theatre glasses, projector and big-screen work. These are working artifacts, not confirmed chat transcripts.
- `claude-temp\D--New-folio-new-site-code-new-si-two`: session directory names were present; see the inventory for actual file counts.

## Scope and limitations

[inventory.json](inventory.json) records per-folder counts, file types, transcript metadata and the archived thread/project catalog. The scan excluded dependency directories, nested Git metadata, symbolic links and the rope `_render_tmp` directory. Some temporary render subdirectories denied access during the initial filename search; the final scoped inventory excluded that temporary tree and otherwise completed without access errors. Top-level loose files in `D:\CodexOutputs` are not included in the directory totals.

Old chat image references may still point to former temporary C: paths. Finding their text references does not establish that the corresponding images survive. The original archives and current project were left in place; no old files were copied over newer work.

Per the user's storage preference, future agent-created project artifacts, backups, caches and temporary outputs should use D: where configurable. This inspection does not change the desktop app's own storage configuration or installed runtime locations.
