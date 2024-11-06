//////////////////////////////////////////
// Types

/**
 * A function that will set the state to a new value
 */
export type Setter<T> = (newVal: T) => void;

/**
 * The updater function passed to a state updater.
 * Receives an old value and returns a new value.
 */
export type UpdaterFn<T> = (oldVal: T) => T;

/**
 * A function that will apply an updater to the state
 */
export type Updater<T> = (updater: UpdaterFn<T>) => void;

/**
 * Define a lens that can be applied to a value link to produce another value link
 * The first element of the tuple gets the child value, given the base
 * The second element of the tuple, given a base value and the updater to apply to the child, reutrns a modified base
 */
export type Lens<Base, Child> = [(base: Base) => Child, (base: Base, updater: UpdaterFn<Child>) => Base];

type ReactState<T> = [T, Updater<T>];

/**
 * Simpler type signature better for type-hinting - type inference works better
 */
export type SettableValue<T> = {
  name?: string;
  value: T;
  set: Setter<T>;
};

/**
 * Basic value link on a simple type - not a record or an array
 */
export type ValueLink<T> = SettableValue<T> & {
  update: Updater<T>;
  apply: <Child>(lens: Lens<T, Child>, name?: string) => ValueLink<Child>;

  // Record methods

  /**
   * Get a value link to a specific property
   */
  prop: <P extends AnyKeyOf<T>>(name: P) => ValueLink<AnyValueOf<T, P>>;

  /**
   * Get a record of value links to each property
   */
  props: () => PropLinks<T>;

  // Array methods

  /**
   * Get a value link to a specific value
   */
  item: (idx: number) => ValueLink<ArrayValue<T>>;

  /**
   * Get an array of value links to each value
   */
  items: () => ItemLinks<ArrayValue<T>>;

  /**
   * Vet a value link to the first item that matches the predicate or null.
   */
  find: (predicate: (item: ArrayValue<T>) => boolean) => ValueLink<ArrayValue<T>> | null;

  /**
   * Apply the given lens to each item of the array
   */
  applyItems: <Child>(lens: Lens<ArrayValue<T>, Child>) => ValueLink<Child>[];

  /**
   * Call the mapping function on each item of the array
   */
  mapItems: <Child>(fn: (item: ValueLink<ArrayValue<T>>) => Child) => Child[];
};

export type AnyRecord = Record<string, any>;

export type LinkValue<T> = T extends ValueLink<infer U> ? U : never;

/**
 * Record of value links, as returned by props()
 */
export type PropLinks<T> = {
  [P in NonOptionalKeys<T>]: ValueLink<T[P]>;
};

/**
 * Array of value links, as returned by items()
 */
export type ItemLinks<T> = ValueLink<T>[];

//////////////////////////////////////////
// Lenses

/**
 * Lens for modifying an element of an array
 */
export const arrayItem = <T>(idx: number): Lens<T[], T> => [
  (arr) => arr[idx],
  (arr, updater) => [...arr.slice(0, idx), updater(arr[idx]), ...arr.slice(idx + 1)],
];

/**
 * Lens for modifying a property of a record
 */
export const recordProp = <T, K extends AnyKeyOf<T>>(key: K): Lens<T, AnyValueOf<T, K>> => [
  (record) => record[key] as AnyValueOf<T, K>,
  (record, updater) => ({
    ...record,
    [key]: updater(record[key] as AnyValueOf<T, K>),
  }),
];

/**
 * Lens that removes a property
 */
export const omitProp = <T, K extends keyof T>(key: K): Lens<T, Omit<T, K>> => [
  ({ [key]: _, ...metric }) => metric,
  ({ [key]: keyVal, ...metric }, updater) => ({ ...(updater(metric) as T), [key]: keyVal }),
];

/**
 * Simple lens that provides an additional wrapper call to updates
 */
export const onChange = <T>(handler: UpdaterFn<T>): Lens<T, T> => [
  (value) => value,
  (value, updater) => handler(updater(value)),
];

/**
 * Lens that allows partial data
 */
export const partial = <T>(): Lens<T, Partial<T>> => [
  (value) => value,
  (value, updater) => ({ ...value, ...updater(value) }),
];

//////////////////////////////////////////
// Value link constructors

const emptyValueLink = createValueLink<any>(undefined, () => {});

/**
 * Create a ValueLink for the given value/updater pair
 * Ensures that arrays or records have extra methods
 */
export function createValueLink<T>(value: T, update: Updater<T>, name?: string): ValueLink<T> {
  const set = (value: T) => update((_) => value);

  const apply = <U>([getChild, updateChild]: Lens<T, U>, name?: string) =>
    createValueLink(getChild(value), (fn) => update((base) => updateChild(base, fn)), name);

  // Array helpers

  const item = (idx: number): ValueLink<ArrayValue<T>> =>
    // @ts-expect-error TS can't apply isArray back to a T guard
    Array.isArray(value) ? apply(arrayItem(idx)) : emptyValueLink;

  const items = (): Array<ValueLink<ArrayValue<T>>> =>
    // @ts-expect-error TS can't apply isArray back to a T guard
    Array.isArray(value) ? value.map((_, idx) => apply(arrayItem(idx))) : [];

  const applyItems = <U>(lens: Lens<ArrayValue<T>, U>): Array<ValueLink<U>> => items().map((item) => item.apply(lens));

  const mapItems = <U>(fn: (value: ValueLink<ArrayValue<T>>) => U) => items().map(fn);

  const find = (predicate: (item: T) => boolean) => {
    if (!Array.isArray(value)) {
      return null;
    }

    const idx = value.findIndex(predicate);
    if (idx !== -1) {
      return item(idx);
    } else {
      return null;
    }
  };

  // Record helpers

  const prop = (name: AnyKeyOf<T>) => apply(recordProp(name), typeof name === "string" ? name : undefined);

  const props = () => {
    if (typeof value !== "object" || value === null) return {};

    let built: any = {};
    Object.keys(value).forEach((name) => {
      built[name] = apply(recordProp(name as AnyKeyOf<T>), name);
    });
    return built;
  };

  return { value, update, name, set, apply, item, items, applyItems, mapItems, find, prop, props } as ValueLink<T>;
}

/**
 * Create a ValueLink for the given value/updater pair
 * Ensures that arrays or records have extra methods
 */
export function createFromReactState<T>(statePair: ReactState<T>) {
  const [value, updater] = statePair;
  return createValueLink(value, updater);
}

/**
 * Returns value & onChange
 */
export const inputProps = (valueLink: SettableValue<string> | SettableValue<string | undefined>) => {
  return {
    value: valueLink.value ?? "",
    onChange: (e: any) => {
      valueLink.set(e.target.value);
    },
  };
};

/**
 * Returns defaultValue & onBlur props for an input element
 */
export const blurInputProps = (valueLink: SettableValue<string> | SettableValue<string | undefined>) => ({
  defaultValue: valueLink.value ?? "",
  onBlur: (e: any) => valueLink.set(e.target.value),
});

// Utility types

/**
 * Remove optional keys from a type
 */
type NonOptionalKeys<T> = { [K in keyof T]-?: T extends { [K1 in K]: any } ? K : never }[keyof T];
/**
 * keyof T and T[K] that return all possible values in a union type
 */
export type AnyKeyOf<T> = T extends T ? keyof T : never;

export type AnyValueOf<T, K extends AnyKeyOf<T>> = T extends T ? (K extends keyof T ? T[K] : undefined) : never;

export type ArrayValue<T> = T extends Array<infer U> ? U : unknown;
