import OBR from "@owlbear-rodeo/sdk";
import { getPluginId } from "./util/getPluginId";

import lightOnIcon from "../assets/light-on.svg";
import lightSettingsIcon from "../assets/light-settings.svg";

export function createLightMenu() {
  OBR.contextMenu.create({
    id: getPluginId("light-menu/add"),
    icons: [
      {
        icon: lightOnIcon,
        label: "Add Light",
        filter: {
          every: [
            { key: "type", value: "IMAGE" },
            { key: ["metadata", getPluginId("light")], value: undefined },
          ],
        },
      },
    ],
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
    id: getPluginId("light-menu/settings"),
    icons: [
      {
        icon: lightSettingsIcon,
        label: "Light Settings",
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
    embed: {
      url: "/menu.html",
      height: 194,
    },
  });
}
