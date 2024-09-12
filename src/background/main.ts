import OBR from "@owlbear-rodeo/sdk";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit";
import wasm from "canvaskit-wasm/bin/full/canvaskit.wasm?url";
import { createLightMenu } from "./createLightMenu";
import { createDoorMode } from "./createDoorMode";
import { Reconciler } from "./reconcile/Reconciler";
import { LightReactor } from "./reconcile/reactors/LightReactor";
import { DoorReactor } from "./reconcile/reactors/DoorReactor";
import { WallReactor } from "./reconcile/reactors/WallReactor";

async function waitUntilOBRReady() {
  return new Promise<void>((resolve) => {
    OBR.onReady(() => {
      resolve();
    });
  });
}

async function init() {
  const CanvasKit = await CanvasKitInit({ locateFile: () => wasm });
  await waitUntilOBRReady();
  createLightMenu();
  createDoorMode(CanvasKit);
  const reconciler = new Reconciler(CanvasKit);
  reconciler.register(new LightReactor(reconciler));
  reconciler.register(new DoorReactor(reconciler));
  reconciler.register(new WallReactor(reconciler));
}

init();
