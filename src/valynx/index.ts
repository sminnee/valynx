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

type ReactState<T> = [T, Updater<T>];

/**
 * Basic value link on a simple type - not a record or an array
 */
export type BaseValueLink<T> = {
  value: T;
  set: Setter<T>;
  update: Updater<T>;
  apply: <Child>(lens: Lens<T, Child>) => ValueLink<Child>;
};

type AnyRecord = Record<any, any>;

/**
 * Value links for records have properties that return value links of the source property
 */
type RecordValueLink<T extends AnyRecord> = BaseValueLink<T> & {
  prop: <P extends keyof T>(name: P) => ValueLink<T[P]>;
  props: () => {
    [P in keyof T]: ValueLink<T[P]>;
  };
};

/**
 * Value links for arrays have item() and find() methods
 */
type ArrayValueLink<T> = BaseValueLink<T[]> & {
  /**
   * Get a value link to a specific value
   */
  item: (idx: number) => ValueLink<T>;

  /**
   * Get an array of value links to each value
   */
  items: () => ValueLink<T>[];

  /**
   * Vet a value link to the first item that matches the predicate or null.
   */
  find: (predicate: (item: T) => boolean) => ValueLink<T> | null;

  /**
   * Apply the given lens to each item of the array
   */
  applyItems: <Child>(lens: Lens<T, Child>) => ValueLink<Child>[];

  /**
   * Call the mapping function on each item of the array
   */
  mapItems: <Child>(fn: (item: ValueLink<T>) => Child) => Child[];
};

/**
 * The ValueLink type, that may be an ArrayValueLink for arrays or a RecordValueLink for records
 */
export type ValueLink<T> = [T] extends [Array<any>] // [p] needed around elements for union types to work
  ? ArrayValueLink<T[number]>
  : [T] extends [AnyRecord]
  ? RecordValueLink<T>
  : BaseValueLink<T>;

/**
 * Define a lens that can be applied to a value link to produce another value link
 * The first element of the tuple gets the child value, given the base
 * The second element of the tuple, given a base value and the updater to apply to the child, reutrns a modified base
 */
export type Lens<Base, Child> = [(base: Base) => Child, (base: Base, updater: UpdaterFn<Child>) => Base];

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
export const recordProp = <T, K extends keyof T>(key: K): Lens<T, T[K]> => [
  (record) => record[key],
  (record, updater) => ({
    ...record,
    [key]: updater(record[key]),
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

/**
 * Create a ValueLink for the given value/updater pair
 * Ensures that arrays or records have extra methods
 */
export function createValueLink<T>(value: T, updater: Updater<T>): ValueLink<T> {
  // Build a BaseValueLink
  const base = <U>(value: U, updater: Updater<U>): BaseValueLink<U> => ({
    value: value,
    set: (value) => updater((_) => value),
    update: updater,
    apply: ([getChild, updateChild]) =>
      createValueLink(getChild(value), (fn) => updater((base) => updateChild(base, fn))),
  });

  // Add array-specific methods to a BaseValueLink
  function addArrayMethods<U>(base: BaseValueLink<U[]>): ArrayValueLink<U> {
    const item = (idx: number) => base.apply(arrayItem(idx));
    const items = () => base.value.map((_, idx) => base.apply(arrayItem(idx)));

    return {
      ...base,
      item,
      items,
      find: (predicate) => {
        const idx = base.value.findIndex(predicate);
        if (idx !== -1) {
          return item(idx);
        } else {
          return null;
        }
      },
      // @ts-expect-error lens polymorphism getting confused
      applyItems: (lens) => items().map((item: ValueLink<U>) => item.apply(lens)),
      mapItems: (fn) => items().map(fn),
    };
  }

  // Add record-specific methods to a BaseValueLink
  function addRecordMethods<U extends AnyRecord>(base: BaseValueLink<U>): RecordValueLink<U> {
    return {
      ...base,

      prop: (name) => base.apply(recordProp(name)),
      props: () => {
        let built: any = {};
        Object.keys(base.value).forEach((name) => {
          built[name] = base.apply(recordProp(name as keyof U));
        });
        return built;
      },
    };
  }

  // Polymorphic creation of value-links for array or records
  if (Array.isArray(value)) {
    return addArrayMethods(base(value as any[], updater as unknown as Updater<any[]>)) as ValueLink<T>;
  } else if (value && typeof value === "object" && !("get" in value) && !("set" in value)) {
    return addRecordMethods(base(value as AnyRecord, updater as Updater<AnyRecord>)) as ValueLink<T>;
  }

  // Default
  return base(value, updater) as ValueLink<T>;
}

/**
 * Create a ValueLink for the given value/updater pair
 * Ensures that arrays or records have extra methods
 */
export function createFromReactState<T>(statePair: ReactState<T>) {
  const [value, updater] = statePair;
  return createValueLink(value, updater);
}
