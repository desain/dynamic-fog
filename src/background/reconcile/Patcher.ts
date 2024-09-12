import OBR, { Item } from "@owlbear-rodeo/sdk";

/**
 * A helper class that buffers incoming changes to the local OBR scene and submits
 * those changes as a batch update at a later time
 */
export class Patcher {
  // Staged changes
  private additions: Item[] = [];
  private deletions: string[] = [];
  private updates: Map<string, ((item: Item) => void)[]> = new Map();
  private ready = false;

  setReady(ready: boolean) {
    this.ready = ready;
  }

  /**
   * Stage additions to the local scene that will be submitted after this reconcile step
   */
  addItems(...items: Item[]) {
    this.additions.push(...items);
  }

  /**
   * Stage deletions to the local scene that will be submitted after this reconcile step
   */
  deleteItems(...ids: string[]) {
    this.deletions.push(...ids);
  }

  /**
   * Stage updates to the local scene that will be submitted after this reconcile step
   */
  updateItems(...updates: [string, (item: Item) => void][]) {
    for (const [id, updater] of updates) {
      const values = this.updates.get(id);
      if (values) {
        values.push(updater);
      } else {
        this.updates.set(id, [updater]);
      }
    }
  }

  /**
   * Submit all staged changes to the OBR local scene
   */
  async submitChanges() {
    if (this.deletions.length > 0) {
      if (this.ready) {
        await OBR.scene.local.deleteItems(this.deletions);
      }
      this.deletions = [];
    }
    if (this.additions.length > 0) {
      if (this.ready) {
        await OBR.scene.local.addItems(this.additions);
      }
      this.additions = [];
    }
    if (this.updates.size > 0) {
      if (this.ready) {
        await OBR.scene.local.updateItems([...this.updates.keys()], (items) => {
          for (const item of items) {
            const updates = this.updates.get(item.id);
            if (updates) {
              for (const update of updates) {
                update(item);
              }
            }
          }
        });
      }
      this.updates.clear();
    }
  }
}
