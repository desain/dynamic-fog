import OBR, { buildLight } from "@owlbear-rodeo/sdk";
import { getPluginId } from "./util/getPluginId";

export function createLightMenu() {
  OBR.contextMenu.create({
    icons: [
      {
        icon: "/icon.svg",
        label: "Add Light",
        filter: {},
      },
    ],
    id: getPluginId("light-menu"),
    async onClick(context) {
      const item = context.items[0];
      const light = buildLight()
        .position(item.position)
        .attachedTo(item.id)
        .build();
      OBR.scene.local.addItems([light]);
    },
  });
}
