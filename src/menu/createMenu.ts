import OBR, { buildLight } from "@owlbear-rodeo/sdk";

export function createMenu() {
  OBR.contextMenu.create({
    icons: [
      {
        icon: "/icon.svg",
        label: "Add Light",
        filter: {},
      },
    ],
    id: "test",
    async onClick(context) {
      const item = context.items[0];
      const light = buildLight()
        .position(item.position)
        .falloff(0)
        .attachedTo(item.id)
        .build();
      OBR.scene.local.addItems([light]);
    },
  });
}
