import { Item } from "@owlbear-rodeo/sdk";
import { Actor } from "./Actor";
import { Reconciler } from "./Reconciler";

// interface DiffInfo {
//   item: Item;
//   playerId: Player["id"];
//   playerRole: Player["role"];
//   walls: LineString[];
// }

/**
 * A Reactor is responsible for defining a filter of incoming shared items
 * and mapping those to a local Actor that will keep extra state for that item
 */
export abstract class Reactor {
  protected reconciler: Reconciler;
  // A mapping of parent IDs to their associated child actor
  protected actors: Map<string, Actor> = new Map();
  // The type of Actor that will be created when a new item matching the filter is added
  private ActorClass: new (reconciler: Reconciler, parent: Item) => Actor;

  constructor(
    reconciler: Reconciler,
    ActorClass: new (reconciler: Reconciler, parent: Item) => Actor
  ) {
    this.reconciler = reconciler;
    this.ActorClass = ActorClass;
  }

  /**
   * A filter that returns true if this reactor should attach to this item
   */
  abstract filter(item: Item): boolean;

  delete(): void {
    for (const actor of this.actors.values()) {
      actor.delete();
    }
    this.actors.clear();
  }

  /**
   * Manage creating/updating/deleting child actors based off of reconciler updates
   */
  process(added: Item[], deleted: Item[], updated: Item[]): void {
    for (const parent of added) {
      const actor = new this.ActorClass(this.reconciler, parent);
      this.actors.set(parent.id, actor);
    }
    for (const parent of deleted) {
      const actor = this.actors.get(parent.id);
      if (actor) {
        actor.delete();
        this.actors.delete(parent.id);
      }
    }
    for (const parent of updated) {
      const actor = this.actors.get(parent.id);
      if (!actor) {
        continue;
      }
      actor.update(parent);
    }
  }

  /**
   * A check to see whether an incoming item should be added to the updated list.
   * By default a simple comparison of OBR items using the lastModified property
   * is used.
   */
  diff(a: Item, b: Item) {
    try {
      const aLastMod = new Date(a.lastModified).valueOf();
      const bLastMod = new Date(b.lastModified).valueOf();
      return aLastMod !== bLastMod;
    } catch {
      return false;
    }
  }

  /**
   * Does this reactor currently have an Actor for this ID
   */
  has(id: string) {
    return this.actors.has(id);
  }
}
