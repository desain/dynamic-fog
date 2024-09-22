import { Patcher } from "./Patcher";
import { Reactor } from "./Reactor";
import OBR, { Item } from "@owlbear-rodeo/sdk";
import { CanvasKit } from "canvaskit-wasm";

/**
 * The Reconciler is responsible for hooking into the shared scene item
 * state and producing diffs when changes happen.
 * These diffs are passed into registered Reactors who manage creating local children
 * for these shared items.
 * This is a one way data binding not two way.
 * This means it is simpler but has some caveats to be aware of.
 * As it can only react to changes in the shared scene (not the local scene) we need to limit
 * the types of local children created.
 * Specifically they should be unselectable (disable hit) and have COPY attachment disabled.
 * This is because if a local item is deleted or added outside of the reconciler we don't know about it.
 * This could lead to an invalid state if not careful.
 * If this is an issue a two way data binding system should be used instead.
 */
export class Reconciler {
  CanvasKit: CanvasKit;
  private reactors: Reactor[] = [];
  private prevItems: Map<string, Item> = new Map();

  // Subscriptions that need to be cleaned up later
  private subscriptions: VoidFunction[] = [];

  // Helper that will gather all patches together for a single reconcile step
  // and submit then at then end
  patcher: Patcher = new Patcher();

  constructor(CanvasKit: CanvasKit) {
    this.CanvasKit = CanvasKit;
    OBR.scene.isReady().then(this.handleSceneReady);
    this.subscriptions.push(
      OBR.scene.items.onChange(this.reconcile),
      OBR.scene.onReadyChange(this.handleSceneReady)
    );
  }

  delete() {
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }
    for (const reactor of this.reactors) {
      reactor.delete();
    }
    this.patcher.submitChanges();
  }

  private handleSceneReady = (ready: boolean) => {
    this.patcher.setReady(ready);
    if (ready) {
      OBR.scene.items.getItems().then(this.reconcile);
    } else {
      // Clear reactors when scene swaps
      for (const reactor of this.reactors) {
        reactor.delete();
      }
      this.patcher.submitChanges();
    }
  };

  /**
   * Calculate the diff between the previous items and incoming.
   * Spread that diff through the registered reactors
   */
  private reconcile = (items: Item[]) => {
    for (const reactor of this.reactors) {
      this.processReactor(reactor, items);
    }

    this.patcher.submitChanges();

    this.prevItems.clear();
    for (const item of items) {
      this.prevItems.set(item.id, item);
    }
  };

  /**
   * Register new reactors with the reconciler.
   * Upon registration the reactor will be hydrated with the current
   * shared item state.
   */
  register(...reactors: Reactor[]) {
    this.reactors.push(...reactors);

    // Hydrate new reactors with current values
    for (const reactor of reactors) {
      const added: Item[] = [];
      for (const item of this.prevItems.values()) {
        if (reactor.filter(item)) {
          added.push(item);
        }
      }
      reactor.process(added ?? [], [], []);
    }

    this.patcher.submitChanges();
  }

  /**
   * Unregister a reactor and delete all the children it is managing
   */
  unregister(...reactors: Reactor[]) {
    for (const reactor of reactors) {
      const index = this.reactors.indexOf(reactor);
      if (index >= 0) {
        this.reactors.splice(index, 1);
        reactor.delete();
      }
    }
    this.patcher.submitChanges();
  }

  find<R extends Reactor>(reactor: new (...args: any[]) => R): R | null {
    return (this.reactors.find((r) => r instanceof reactor) as R) ?? null;
  }

  private processReactor(reactor: Reactor, items: Item[]) {
    const added: Item[] = [];
    const deleted: Item[] = [];
    const updated: Item[] = [];

    // Find deleted items by starting with a full array of previous keys and removing
    // them as the new items are processed
    const deletedIds = new Set<string>([...this.prevItems.keys()]);
    for (const item of items) {
      if (reactor.filter(item)) {
        const prev = this.prevItems.get(item.id);
        if (prev && reactor.has(item.id)) {
          // If we have a previous item perform a diff as defined by the reactor
          if (reactor.diff(prev, item)) {
            updated.push(item);
          }
        } else {
          added.push(item);
        }
        deletedIds.delete(item.id);
      }
    }

    for (const id of deletedIds) {
      const prev = this.prevItems.get(id);
      if (prev && reactor.filter(prev)) {
        deleted.push(prev);
      }
    }

    reactor.process(added ?? [], deleted ?? [], updated ?? []);
  }
}
