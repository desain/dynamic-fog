import {
  Billboard,
  buildBillboard,
  buildPath,
  ImageContent,
  isBillboard,
  isPath,
  Item,
  MathM,
  Path,
  PathCommand,
  Vector2,
} from "@owlbear-rodeo/sdk";
import { Actor } from "../Actor";
import { Reconciler } from "../Reconciler";
import { PathHelpers } from "../../util/PathHelpers";
import { Door } from "../../../types/Door";
import { Drawing, isDrawing } from "../../../types/Drawing";
import { getMetadata } from "../../util/getMetadata";
import { getPluginId } from "../../../util/getPluginId";
import { transformPoint } from "../../util/math";

import doorClosedBillboard from "../../../assets/door-closed-billboard.svg";
import doorOpenBillboard from "../../../assets/door-open-billboard.svg";

const doorClosedImage: ImageContent = {
  url: `${window.location.origin}${doorClosedBillboard}`,
  width: 80,
  height: 80,
  mime: "image/svg+xml",
};

const doorOpenImage: ImageContent = {
  url: `${window.location.origin}${doorOpenBillboard}`,
  width: 80,
  height: 80,
  mime: "image/svg+xml",
};

const OPEN_COLOR = "#85ff66";
const CLOSE_COLOR = "#ff4d4d";

export interface DoorOverlayComponent {
  base: Door;
  billboard: Billboard;
  path: Path;
}

export class DoorOverlayActor extends Actor {
  private doors: DoorOverlayComponent[] = [];
  constructor(reconciler: Reconciler, parent: Item) {
    super(reconciler);
    if (isDrawing(parent)) {
      this.doors = this.drawingToDoorOverlayComponents(parent);
      this.reconciler.patcher.addItems(
        ...this.doors.flatMap((door) => [door.billboard, door.path])
      );
    }
  }

  delete(): void {
    this.reconciler.patcher.deleteItems(
      ...this.doors.flatMap((door) => [door.billboard.id, door.path.id])
    );
  }

  update(parent: Item) {
    if (!isDrawing(parent)) {
      return;
    }
    const prev = this.doors;
    const next = getMetadata<Door[]>(parent.metadata, getPluginId("doors"), []);
    if (prev.length < next.length) {
      // Need to add more doors as there are new ones
      for (let i = prev.length; i < next.length; i++) {
        const door = next[i];
        const visual = this.doorToDoorOverlayComponent(parent, door, i);
        if (visual) {
          prev.push(visual);
          this.reconciler.patcher.addItems(visual.billboard, visual.path);
        }
      }
    } else if (prev.length > next.length) {
      // Need to remove doors as there are less
      const numRemoved = prev.length - next.length;
      const toDelete = prev.splice(prev.length - numRemoved, numRemoved);
      this.reconciler.patcher.deleteItems(
        ...toDelete.flatMap((door) => [door.billboard.id, door.path.id])
      );
    }
    // Update remaining doors
    for (let i = 0; i < prev.length; i++) {
      const door = prev[i];
      const nextDoor = next[i];
      door.base = nextDoor;
      const values = this.getDoorCenterAndCommands(parent, nextDoor);
      if (values) {
        const [center, commands] = values;
        door.billboard = {
          ...door.billboard,
          image: {
            ...door.billboard.image,
            url: door.base.open ? doorOpenImage.url : doorClosedImage.url,
          },
          position: center,
          metadata: {
            [getPluginId("door-index")]: i,
          },
        };
        door.path = {
          ...door.path,
          commands: commands,
          metadata: {
            [getPluginId("door-index")]: i,
          },
          style: {
            ...door.path.style,
            strokeColor: door.base.open ? OPEN_COLOR : CLOSE_COLOR,
          },
        };
        this.reconciler.patcher.updateItems(
          [
            door.billboard.id,
            (item) => {
              item.position = center;
              item.metadata = {
                [getPluginId("door-index")]: i,
              };
              if (isBillboard(item)) {
                item.image.url = door.base.open
                  ? doorOpenImage.url
                  : doorClosedImage.url;
              }
            },
          ],
          [
            door.path.id,
            (item) => {
              item.metadata = {
                [getPluginId("door-index")]: i,
              };
              if (isPath(item)) {
                item.commands = commands;
                item.style.strokeColor = door.base.open
                  ? OPEN_COLOR
                  : CLOSE_COLOR;
              }
            },
          ]
        );
      }
    }
  }

  private drawingToDoorOverlayComponents(
    drawing: Drawing
  ): DoorOverlayComponent[] {
    const visuals: DoorOverlayComponent[] = [];
    const doors = getMetadata<Door[]>(
      drawing.metadata,
      getPluginId("doors"),
      []
    );
    for (let i = 0; i < doors.length; i++) {
      const door = doors[i];
      const visual = this.doorToDoorOverlayComponent(drawing, door, i);
      if (!visual) {
        continue;
      }
      visuals.push(visual);
    }
    return visuals;
  }

  private doorToDoorOverlayComponent(
    drawing: Drawing,
    door: Door,
    index: number
  ): DoorOverlayComponent | null {
    const values = this.getDoorCenterAndCommands(drawing, door);
    if (!values) {
      return null;
    }
    const [center, commands] = values;
    return {
      base: door,
      billboard: this.getBillboard(drawing, door.open, index, center),
      path: this.getPath(drawing, door.open, index, commands),
    };
  }

  private getDoorCenterAndCommands(
    drawing: Drawing,
    door: Door
  ): [Vector2, PathCommand[]] | null {
    const skPath = this.getDoorSkPath(drawing, door);
    if (!skPath) {
      return null;
    }
    const relativeCenter = PathHelpers.getSkPathPoint(
      this.reconciler.CanvasKit,
      skPath
    );
    const center =
      relativeCenter && transformPoint(MathM.fromItem(drawing), relativeCenter);
    if (!center) {
      return null;
    }
    const commands = PathHelpers.skPathToPathCommands(skPath);
    skPath.delete();

    return [center, commands];
  }

  private getDoorSkPath(drawing: Drawing, door: Door) {
    const skPath = PathHelpers.drawingToSkPath(
      drawing,
      this.reconciler.CanvasKit
    );
    if (!skPath) {
      return null;
    }
    const segment = PathHelpers.getSkPathBetween(
      this.reconciler.CanvasKit,
      skPath,
      door.start,
      door.end
    );
    skPath.delete();

    return segment;
  }

  private getBillboard(
    parent: Item,
    open: boolean,
    index: number,
    position: Vector2
  ) {
    const billboard = buildBillboard(open ? doorOpenImage : doorClosedImage, {
      dpi: 300,
      offset: { x: 40, y: 40 },
    })
      .attachedTo(parent.id)
      .position(position)
      .disableAttachmentBehavior(["SCALE"])
      .metadata({ [getPluginId("door-index")]: index })
      .locked(true)
      .build();

    return billboard;
  }

  private getPath(
    parent: Drawing,
    open: boolean,
    index: number,
    commands: PathCommand[]
  ) {
    return buildPath()
      .attachedTo(parent.id)
      .position(parent.position)
      .rotation(parent.rotation)
      .scale(parent.scale)
      .fillOpacity(0)
      .strokeWidth(parent.style.strokeWidth)
      .strokeColor(open ? OPEN_COLOR : CLOSE_COLOR)
      .commands(commands)
      .layer("CONTROL")
      .metadata({ [getPluginId("door-index")]: index })
      .locked(true)
      .build();
  }
}
