/**
 * Value links
 */

/**
 * A function that will set the state to a new value
 */
type Setter<T> = (newVal: T) => void;

/**
 * The updater function passed to a state updater.
 * Receives an old value and returns a new value.
 */
type UpdaterFn<T> = (oldVal: T) => T;

/**
 * A function that will apply an updater to the state
 */
type Updater<T> = (updater: UpdaterFn<T>) => void;

type ReactState<T> = [T, Setter<T>];

/**
 * Basic value link on a simple type - not a record or an array
 */
type BaseValueLink<T> = {
  value: T;
  set: Setter<T>;
  update: Updater<T>;
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
  item: (idx: number) => ValueLink<T>;
  items: () => ValueLink<T>[];
  find: (predicate: (item: T) => boolean) => ValueLink<T> | null;
};

/**
 * The ValueLink type, that may be an ArrayValueLink for arrays or a RecordValueLink for records
 */
export type ValueLink<T> = [T] extends [Array<any>] // [p] needed around elements for union types to work
  ? ArrayValueLink<T[number]>
  : [T] extends [AnyRecord]
  ? RecordValueLink<T>
  : BaseValueLink<T>;

export type ValueLink2<T> = BaseValueLink<T>;

// Immutably update an array item
function updateItem<V>(arr: V[], idx: number, updater: UpdaterFn<V>) {
  return [...arr.slice(0, idx), updater(arr[idx]), ...arr.slice(idx + 1)];
}

// Immutably update a record property
function updateProp<K extends keyof V, V extends AnyRecord>(record: V, key: K, updater: UpdaterFn<V[K]>) {
  return {
    ...record,
    [key]: updater(record[key]),
  };
}

export function createValueLink<T>(value: T, updater: Updater<T>): ValueLink<T> {
  const base = <U>(value: U, updater: Updater<U>): BaseValueLink<U> => ({
    value: value,
    set: (value) => updater((_) => value),
    update: updater,
  });

  function addArrayMethods<U>(base: BaseValueLink<U[]>): ArrayValueLink<U> {
    return {
      ...base,

      item: (idx) =>
        createValueLink(base.value[idx], (itemUpdater) => base.update((arr) => updateItem(arr, idx, itemUpdater))),
      items: () =>
        base.value.map((item, idx) =>
          createValueLink(item, (itemUpdater) => base.update((arr) => updateItem(arr, idx, itemUpdater)))
        ),
      find: (predicate) => {
        const idx = base.value.findIndex(predicate);
        if (idx !== -1) {
          return createValueLink(base.value[idx], (itemUpdater) =>
            base.update((arr) => updateItem(arr, idx, itemUpdater))
          );
        } else {
          return null;
        }
      },
    };
  }

  function addRecordMethods<U>(base: BaseValueLink<U>): RecordValueLink<U> {
    return {
      ...base,

      prop: (name) =>
        createValueLink(base.value[name], (itemUpdater) => base.update((arr) => updateProp(arr, name, itemUpdater))),
      props: () => {
        let built: any = {};
        Object.keys(base.value).forEach((name) => {
          built[name] = createValueLink(base.value[name as keyof U], (itemUpdater) =>
            base.update((arr) => updateProp(arr, name as keyof U, itemUpdater))
          );
        });
        return built;
      },
    };
  }

  if (Array.isArray(value)) {
    return addArrayMethods(base(value as any[], updater as unknown as Updater<any[]>)) as ValueLink<T>;
  } else if (value && typeof value === "object" && !("get" in value) && !("set" in value)) {
    return addRecordMethods(base(value, updater)) as ValueLink<T>;
  }

  return base(value, updater) as ValueLink<T>;
}

export function createFromReactState<T>(statePair: ReactState<T>) {
  const [value, setter] = statePair;
  return createValueLink(value, (updater) => setter(updater(value)));
}
