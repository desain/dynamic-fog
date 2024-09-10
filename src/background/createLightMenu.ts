import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "./util/getPluginId";

export function createLightMenu() {
  OBR.contextMenu.create({
    icons: [
      {
        icon: "/icon.svg",
        label: "Add Light",
        filter: {
          every: [
            { key: "type", value: "IMAGE" },
            { key: ["metadata", getPluginId("light")], value: undefined },
          ],
        },
      },
    ],
    id: getPluginId("light-menu/add"),
    async onClick(context) {
      const dpi = await OBR.scene.grid.getDpi();
      // 6 grid cell radius or 30ft in a 5ft grid
      const attenuationRadius = 6 * dpi;
      await OBR.scene.items.updateItems(context.items, (items) => {
        for (const item of items) {
          item.metadata[getPluginId("light")] = { attenuationRadius };
        }
      });
    },
  });

  OBR.contextMenu.create({
    icons: [
      {
        icon: "/icon.svg",
        label: "Remove Light",
        filter: {
          every: [
            {
              key: ["metadata", getPluginId("light")],
              value: undefined,
              operator: "!=",
            },
          ],
        },
      },
    ],
    id: getPluginId("light-menu/remove"),
    async onClick(context) {
      await OBR.scene.items.updateItems(context.items, (items) => {
        for (const item of items) {
          delete item.metadata[getPluginId("light")];
        }
      });
    },
  });
}
