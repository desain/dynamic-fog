import OBR, { isWall, Item, MathM, type Player } from "@owlbear-rodeo/sdk";
import { LightConfig } from "../../../types/LightConfig";
import { getMetadata } from "../../../util/getMetadata";
import { getPluginId } from "../../../util/getPluginId";
import { transformPoint } from "../../util/math";
import type { LineString } from "../../util/WallHelpers";
import { LightActor } from "../actors/LightActor";
import { Reactor } from "../Reactor";
import { Reconciler } from "../Reconciler";

export class LightReactor extends Reactor {
  playerId: Player["id"];
  playerRole: Player["role"];

  walls: LineString[];
  private wallsLastModified: number;
  private wallsDirty = false;

  private subscriptions: VoidFunction[] = [];

  constructor(reconciler: Reconciler) {
    super(reconciler, LightActor);
    this.playerId = "unset";
    this.playerRole = "PLAYER";
    this.walls = [];
    this.wallsLastModified = 0;
    OBR.player.getRole().then(this.handlePlayerRole);
    OBR.player.getId().then(this.handlePlayerId);
    OBR.scene.isReady().then(this.handleSceneReady);
    this.subscriptions.push(
      OBR.scene.onReadyChange(this.handleSceneReady),
      OBR.player.onChange((player) => {
        this.handlePlayerId(player.id);
        this.handlePlayerRole(player.role);
      })
    );
  }

  override filter(item: Item): boolean {
    return (
      getPluginId("light") in item.metadata &&
      (this.playerRole === "GM" ||
        !getMetadata<LightConfig>(item.metadata, getPluginId("light"), {})
          .onlyVisibleToOwner ||
        item.createdUserId === this.playerId)
    );
  }

  override diff(a: Item, b: Item): boolean {
    return this.wallsDirty || super.diff(a, b);
  }

  private handlePlayerRole = (role: Player["role"]) => {
    if (role !== this.playerRole) {
      this.playerRole = role;
      this.refresh();
    }
  };

  private handleSceneReady = (ready: boolean) => {
    if (ready) {
      OBR.scene.local.getItems().then(this.handleLocalItems);
      this.subscriptions.push(OBR.scene.local.onChange(this.handleLocalItems));
    }
  };

  private handlePlayerId = (id: Player["id"]) => {
    if (id !== this.playerId) {
      this.playerId = id;
      this.refresh();
    }
  };

  private refresh() {
    this.reconciler.refresh();
  }

  private handleLocalItems = (items: Item[]) => {
    const walls = items.filter(isWall);
    const lastModified = Math.max(
      ...walls.map((wall) => Date.parse(wall.lastModified))
    );
    if (
      lastModified <= this.wallsLastModified &&
      walls.length === this.walls.length
    ) {
      return;
    }

    this.walls = walls.map((wall) =>
      wall.points.map((pt) => {
        const transform = MathM.fromItem(wall);
        const transformedPt = transformPoint(transform, pt);
        return [transformedPt.x, transformedPt.y] as const;
      })
    );

    // set dirty flag so when refreshing, all lights will rebuild
    this.wallsDirty = true;
    this.refresh();
    this.wallsDirty = false;
  };
}
