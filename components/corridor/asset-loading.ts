import { DefaultLoadingManager } from "three";
import { assetURL } from "./asset-url";
// One shared resolver preserves Fiber's original batch/cache keys.
DefaultLoadingManager.setURLModifier(assetURL);
