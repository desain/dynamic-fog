import { ContourMarker } from "./util/PathHelpers";

export interface Door {
  open: boolean;
  start: ContourMarker;
  end: ContourMarker;
}
