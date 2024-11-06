import { createValueLink, UpdaterFn } from "./index";
import assert from "assert";

function createStateSource<T>(initialValue: T) {
  const value = { current: initialValue };
  return () =>
    [
      value.current,
      (update: UpdaterFn<T>) => {
        value.current = update(value.current);
      },
    ] as const;
}

it("prop()", () => {
  const stateSource = createStateSource({ firstName: "Sam", lastName: "Minnee" });
  const state = createValueLink(...stateSource());

  assert.equal(state.value.firstName, "Sam");

  const firstName = state.prop("firstName");
  assert.equal(firstName.value, "Sam");
  firstName.set("John");

  const state2 = createValueLink(...stateSource());
  assert.deepEqual(state2.value, { firstName: "John", lastName: "Minnee" });
});

it("props()", () => {
  const stateSource = createStateSource({ firstName: "Sam", lastName: "Minnee" });
  const state = createValueLink(...stateSource());

  const props = state.props();

  assert.equal(props.firstName.value, "Sam");
  assert.equal(props.lastName.value, "Minnee");

  props.lastName.update((x) => x.toUpperCase());

  const state2 = createValueLink(...stateSource());
  assert.deepEqual(state2.value, { firstName: "Sam", lastName: "MINNEE" });
});

it("item()", () => {
  const stateSource = createStateSource({ items: ["a", "b", "c"] });
  const state = createValueLink(...stateSource());

  const second = state.prop("items").item(1);

  assert.equal(second.value, "b");
  second.set("B");

  const state2 = createValueLink(...stateSource());
  assert.deepEqual(state2.value, { items: ["a", "B", "c"] });
});
