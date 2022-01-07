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
  get: () => T;
  set: Setter<T>;
  update: Updater<T>;
};

/**
 * A record that doesn't contain properties conflicting with the 'get' and 'set' helpers
 */
type SafeRecord = Omit<Record<any, any>, "get" | "set">;

/**
 * Value links for records have properties that return value links of the source property
 */
type RecordValueLink<T extends SafeRecord> = BaseValueLink<T> & {
  // Replicating the ValueLink logic error led to a better type for a union property type
  [P in keyof T]: T[P] extends Array<any>
    ? ArrayValueLink<T[P][number]>
    : T[P] extends SafeRecord
    ? RecordValueLink<T[P]>
    : BaseValueLink<T[P]>;
};

/**
 * Value links for arrays have item() and find() methods
 */
type ArrayValueLink<T> = BaseValueLink<T[]> & {
  item: (idx: number) => ValueLink<T>;
  find: (predicate: (item: T) => boolean) => ValueLink<T> | null;
};

/**
 * The ValueLink type, that may be an ArrayValueLink for arrays or a RecordValueLink for records
 */
export type ValueLink<T> = T extends Array<any>
  ? ArrayValueLink<T[number]>
  : T extends SafeRecord
  ? RecordValueLink<T>
  : BaseValueLink<T>;

// Immutably update an array item
function updateItem<V>(arr: V[], idx: number, updater: UpdaterFn<V>) {
  return [...arr.slice(0, idx), updater(arr[idx]), ...arr.slice(idx + 1)];
}

// Immutably update a record property
function updateProp<K extends keyof V, V extends SafeRecord>(record: V, key: K, updater: UpdaterFn<V[K]>) {
  console.log("updateProp", record, key);
  return {
    ...record,
    [key]: updater(record[key]),
  };
}

export function createValueLink<T>(value: T, updater: Updater<T>): ValueLink<T> {
  const base = <U>(value: U, updater: Updater<U>): BaseValueLink<U> => ({
    get: () => value,
    set: (value) => updater((_) => value),
    update: updater,
  });

  function addArrayMethods<U>(base: BaseValueLink<U[]>, value: U[]): ArrayValueLink<U> {
    return {
      ...base,
      item: (idx) => createValueLink(base.get()[idx], (itemUpdater) => updateItem(value, idx, itemUpdater)),
      find: (predicate) => {
        const idx = base.get().findIndex(predicate);
        if (idx !== -1) {
          return createValueLink(base.get()[idx], (itemUpdater) =>
            base.update((arr) => updateItem(arr, idx, itemUpdater))
          );
        } else {
          return null;
        }
      },
    };
  }

  function addRecordMethods<U>(base: BaseValueLink<U>, value: U): RecordValueLink<U> {
    let built: any = base;

    Object.keys(value).forEach((key) => {
      built[key] = createValueLink(value[key as keyof U], (propUpdater) =>
        base.update((record) => updateProp(record, key as keyof U, propUpdater))
      );
    });

    return built;
  }

  if (Array.isArray(value)) {
    return addArrayMethods(base(value as any[], updater as unknown as Updater<any[]>), value) as ValueLink<T>;
  } else if (value && typeof value === "object" && !("get" in value) && !("set" in value)) {
    return addRecordMethods(base(value, updater), value as SafeRecord) as ValueLink<T>;
  }

  return base(value, updater) as ValueLink<T>;
}

export function createFromReactState<T>(statePair: ReactState<T>) {
  const [value, setter] = statePair;
  return createValueLink(value, (updater) => setter(updater(value)));
}
