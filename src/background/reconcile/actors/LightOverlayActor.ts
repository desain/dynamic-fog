import {
  Billboard,
  buildBillboard,
  ImageContent,
  Item,
} from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import { Reconciler } from "../Reconciler";

import lightBillboard from "../../../assets/light-billboard.svg";

const lightImage: ImageContent = {
  url: `${window.location.origin}${lightBillboard}`,
  width: 80,
  height: 80,
  mime: "image/svg+xml",
};

export class LightOverlayActor extends Actor {
  private billboard: Billboard;
  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    this.billboard = this.parentToBillboard(parent);
    this.reconciler.patcher.addItems(this.billboard);
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(this.billboard.id);
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
      .disableHit(true)
      .build();

    return billboard;
  }
}
