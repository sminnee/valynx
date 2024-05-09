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
  addProp: <K extends string, V>(name: K, value: ValueLink<V>) => RecordValueLink<T & { [col in K]: V }>;
  addOptProp: <K extends string, V>(
    name: K,
    value: ValueLink<V> | null
  ) => RecordValueLink<T & { [col in K]: V | null }>;
};

/**
 * Value links for arrays have item() and find() methods
 */
type ArrayValueLink<T> = BaseValueLink<T[]> & {
  item: (idx: number) => ValueLink<T>;
  items: () => ValueLink<T>[];
  map: <U>(mapper: (orig: ValueLink<T>) => ValueLink<U>) => ArrayValueLink<U>;
  find: (predicate: (item: T) => boolean) => ValueLink<T> | null;
  lookup: <K extends keyof T>(idLink: ValueLink<T[K]>, idCol: K) => ValueLink<T> | null;
  lookupMany: <K extends keyof T>(idsLink: ValueLink<Array<T[K]>>, idCol: K) => ArrayValueLink<T> | null;
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
    return {
      ...base,

      item: (idx) => base.apply(arrayItem(idx)),
      items: () => base.value.map((_, idx) => base.apply(arrayItem(idx))),
      find: (predicate)  {
        const idx = base.value.findIndex(predicate);
        if (idx !== -1) {
          return base.apply(arrayItem(idx));
        } else {
          return null;
        }
      },
      lookup: (idLink, idCol)  => {
        const idx = base.value.findIndex((row) => row[idCol] == idLink.value);
        if (idx !== -1) {
          return base.apply(arrayItem(idx));
        } else {
          return null;
        }
      },
      lookup: (idsLink, idCol)  => {
        return idsLink.value.map(id => {
        const idx = base.value.findIndex((row) => row[idCol] == id);
        if (idx !== -1) {
          return base.apply(arrayItem(idx));
        } else {
          return null;
        }
      })
      },
      map: (mapper) => {
        return base.value.map((_, idx) => mapper(base.apply(arrayItem(idx)))),
      }
    };
  }

  // Add record-specific methods to a BaseValueLink
  function addRecordMethods<U>(base: BaseValueLink<U>): RecordValueLink<U> {
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
    return addRecordMethods(base(value, updater)) as ValueLink<T>;
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
