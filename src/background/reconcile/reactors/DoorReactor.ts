import { Reactor } from "../Reactor";
import { Reconciler } from "../Reconciler";
import { Item } from "@owlbear-rodeo/sdk";
import { isDrawing } from "../../../types/Drawing";
import { DoorActor, DoorComponent } from "../actors/DoorActor";

export class DoorReactor extends Reactor {
  // Keep track of all the children door components
  // so that the walls can use them for intersections
  private doors: DoorComponent[] = [];

  // Keep track of the last update state so that walls
  // can update when any door changes
  private didUpdate: boolean = false;

  constructor(reconciler: Reconciler) {
    super(reconciler, DoorActor);
  }

  filter(item: Item): boolean {
    return item.layer === "FOG" && isDrawing(item);
  }

  process(added: Item[], deleted: Item[], updated: Item[]): void {
    super.process(added, deleted, updated);
    // Cache the doors array after processing is done
    this.doors = [];
    for (const actor of this.actors.values()) {
      if (actor instanceof DoorActor) {
        this.doors.push(...actor.doors);
      }
    }
    this.didUpdate =
      updated.length > 0 || added.length > 0 || deleted.length > 0;
  }

  getDoors(): DoorComponent[] {
    return this.doors;
  }

  getDidUpdate(): boolean {
    return this.didUpdate;
  }
}
