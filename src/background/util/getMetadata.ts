import { Metadata } from "@owlbear-rodeo/sdk";

/**
 * Helper to widen the type definition passed to `getMetadata`.
 * For example if the value `1` is passed in the type will become `number` instead of `1`.
 */
type ToPrimitive<T> = T extends string
  ? string
  : T extends number
  ? number
  : T extends boolean
  ? boolean
  : T;

/** Get a value from a Metadata object with a fallback if it doesn't exist or the type is incorrect */
export function getMetadata<T>(
  metadata: Metadata,
  key: string,
  defaultValue: ToPrimitive<T>
): ToPrimitive<T> {
  const value = metadata[key];
  if (typeof value === typeof defaultValue) {
    return value as ToPrimitive<T>;
  } else {
    return defaultValue;
  }
}
