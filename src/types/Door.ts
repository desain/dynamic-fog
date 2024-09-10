import { ContourMarker } from "../background/util/PathHelpers";

export interface Door {
  open: boolean;
  start: ContourMarker;
  end: ContourMarker;
}
