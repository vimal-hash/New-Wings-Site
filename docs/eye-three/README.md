# eye-three checkpoint

The user requested this exact named checkpoint on 2026-10-29 after adding the blank white section following the final eye. Ref: `refs/checkpoints/eye-three`. Commit/tree identity is recorded outside the checkout in `D:/CodexOutputs/Eye_Three_Checkpoint_20261029/checkpoint.json`.

This is the restored eye-two scene with a scroll-controlled, reversible diagonal white section. The section is one viewport tall (100dvh), enters from bottom-right, and fully covers the eye. Its DOM-only motion uses transient refs and a finite animation frame loop. Wheel, one-finger touch and keyboard inputs are supported only after `logoDone`; tuning controls retain their independent input. `finalCovered` changes only at the complete-cover boundary, allowing the covered authored-eye and post rendering to sleep; the pupil clock pauses/resumes without restarting. The current camera samplers, source assets, point data, material/LUT/blending, approved presets and pupil sequence are preserved. The shaft and Claude View 1 experiments are not present.

Verification before saving: production build, TypeScript, scoped lint and all 96 tests passed. Unit checks cover diagonal orientation, complete coverage in wide/portrait viewports, reversible scroll distance, finite settling and reduced motion. Native Chrome reached the existing final reveal and confirmed unchanged final controls. The final transition/return visual check was not completed: Computer Use stopped because it could not reliably identify the browser URL. Do not claim that check passed.

The checkpoint contains all non-ignored project source/assets, including these notes. Dependencies, generated builds and ignored environment files are excluded. The ordinary working index and current branch are not reset or committed by saving the checkpoint. Eye-one and eye-two remain independent protected refs.

"Restore eye-three" means restoring the exact named snapshot, not recreating its appearance manually. Use the external manifest to verify its tree.
