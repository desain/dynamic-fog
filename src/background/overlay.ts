import OBR from "@owlbear-rodeo/sdk";
import { Reconciler } from "./reconcile/Reconciler";
import { LightOverlayReactor } from "./reconcile/reactors/LightOverlayReactor";
import { DoorOverlayReactor } from "./reconcile/reactors/DoorOverlayReactor";

export async function initOverlay(reconciler: Reconciler) {
  OBR.tool.getActiveTool().then((id) => handleToolChange(id, reconciler));
  OBR.tool.onToolChange((id) => handleToolChange(id, reconciler));
}

function handleToolChange(id: string, reconciler: Reconciler) {
  if (id === "rodeo.owlbear.tool/fog") {
    showOverlay(reconciler);
  } else {
    removeOverlay(reconciler);
  }
}
async function showOverlay(reconciler: Reconciler) {
  reconciler.register(
    new LightOverlayReactor(reconciler),
    new DoorOverlayReactor(reconciler)
  );
}

async function removeOverlay(reconciler: Reconciler) {
  const lightOverlay = reconciler.find(LightOverlayReactor);
  if (lightOverlay) {
    reconciler.unregister(lightOverlay);
  }
  const doorOverlay = reconciler.find(DoorOverlayReactor);
  if (doorOverlay) {
    reconciler.unregister(doorOverlay);
  }
}
