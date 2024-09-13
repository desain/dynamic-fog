import { buildBillboard, ImageContent, Item } from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import { Reconciler } from "../Reconciler";
import { getPluginId } from "../../../util/getPluginId";

import lightBillboard from "../../../assets/light-billboard.svg";

const lightImage: ImageContent = {
  url: `${window.location.origin}${lightBillboard}`,
  width: 80,
  height: 80,
  mime: "image/svg+xml",
};

export class LightOverlayActor extends Actor {
  // ID of the current light billboard
  private billboard: string;
  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    const item = this.parentToBillboard(parent);
    this.billboard = item.id;
    this.reconciler.patcher.addItems(item);
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(this.billboard);
  }

  update() {}

  private parentToBillboard(parent: Item) {
    const billboard = buildBillboard(lightImage, {
      dpi: 300,
      offset: { x: 40, y: 40 },
    })
      .attachedTo(parent.id)
      .position(parent.position)
      .disableAttachmentBehavior(["SCALE"])
      .maxViewScale(2)
      .locked(true)
      .metadata({ [getPluginId("light-overlay")]: true })
      .build();

    return billboard;
  }
}
