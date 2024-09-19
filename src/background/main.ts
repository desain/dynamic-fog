import OBR from "@owlbear-rodeo/sdk";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit";
import wasm from "canvaskit-wasm/bin/full/canvaskit.wasm?url";
import { createLightMenu } from "./createLightMenu";
import { createDoorMode } from "./createDoorMode";
import { Reconciler } from "./reconcile/Reconciler";
import { LightReactor } from "./reconcile/reactors/LightReactor";
import { DoorReactor } from "./reconcile/reactors/DoorReactor";
import { WallReactor } from "./reconcile/reactors/WallReactor";
import { initOverlay } from "./overlay";

async function waitUntilOBRReady() {
  return new Promise<void>((resolve) => {
    OBR.onReady(() => {
      resolve();
    });
  });
}

let reconciler: Reconciler | null = null;
async function init() {
  const CanvasKit = await CanvasKitInit({ locateFile: () => wasm });
  await waitUntilOBRReady();
  createLightMenu();
  createDoorMode(CanvasKit);
  reconciler = new Reconciler(CanvasKit);
  reconciler.register(new LightReactor(reconciler));
  reconciler.register(new DoorReactor(reconciler));
  reconciler.register(new WallReactor(reconciler));
  initOverlay(reconciler);
}

init();

// Clean up on HMR refresh
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    reconciler?.delete();
  });
}
