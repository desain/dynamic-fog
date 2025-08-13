import { buildLight, Item } from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import { Reconciler } from "../Reconciler";

export class SelfLightActor extends Actor {
  // ID of the current light item
  private light: string;
  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    const item = this.buildSelfLight(parent);
    this.light = item.id;
    this.reconciler.patcher.addItems(item);
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(this.light);
  }

  update() {}

  private buildSelfLight(parent: Item) {
    const light = buildLight()
      .attachedTo(parent.id)
      .position(parent.position)
      .rotation(parent.rotation)
      .visible(parent.visible)
      .disableAttachmentBehavior(["SCALE", "COPY"])
      .attenuationRadius(75)
      .falloff(2)
      .sourceRadius(0)
      .build();

    return light;
  }
}
