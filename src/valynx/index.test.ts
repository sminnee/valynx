import { createValueLink, Lens, UpdaterFn, valueLinkCreator } from "./index";
import assert from "assert";

function createStateSource<T>(initialValue: T) {
  const value = { current: initialValue };
  const updater = (update: UpdaterFn<T>) => {
    value.current = update(value.current);
  };
  return () => [value.current, updater] as const;
}

it("prop()", () => {
  const createLink = valueLinkCreator();

  const stateSource = createStateSource({ firstName: "Sam", lastName: "Minnee" });
  const state = createLink(...stateSource());

  assert.equal(state.value.firstName, "Sam");

  const firstName = state.prop("firstName");
  assert.equal(firstName.value, "Sam");
  firstName.set("John");

  const state2 = createValueLink(...stateSource());
  assert.deepEqual(state2.value, { firstName: "John", lastName: "Minnee" });
});

it("props()", () => {
  const createLink = valueLinkCreator();

  const stateSource = createStateSource({ firstName: "Sam", lastName: "Minnee" });
  const state = createLink(...stateSource());

  const props = state.props();

  assert.equal(props.firstName.value, "Sam");
  assert.equal(props.lastName.value, "Minnee");

  props.lastName.update((x) => x.toUpperCase());

  const state2 = createLink(...stateSource());
  assert.deepEqual(state2.value, { firstName: "Sam", lastName: "MINNEE" });
});

it("item()", () => {
  const createLink = valueLinkCreator();

  const stateSource = createStateSource({ items: ["a", "b", "c"] });
  const state = createLink(...stateSource());

  const second = state.prop("items").item(1);

  assert.equal(second.value, "b");
  second.set("B");

  const state2 = createLink(...stateSource());
  assert.deepEqual(state2.value, { items: ["a", "B", "c"] });
});

describe("memoization", () => {
  it("creating value link on the same object pair should return the same instance", () => {
    const createLink = valueLinkCreator();

    const stateSource = createStateSource({ firstName: "Sam", lastName: "Minnee" });

    const state = stateSource();
    const state2 = stateSource();

    assert.equal(state[0], state2[0]);
    assert.equal(state[1], state2[1]);

    assert.equal(createLink(...state), createLink(...state2));
  });

  it("access prop() & props() should memoize", () => {
    const createLink = valueLinkCreator();

    const stateSource = createStateSource({ firstName: "Sam", lastName: "Minnee" });

    const state = stateSource();
    const state2 = stateSource();

    const link1 = createLink(...state);
    const link2 = createLink(...state2);

    assert.equal(link1.prop("firstName"), link1.prop("firstName"));
    assert.equal(link1.prop("firstName"), link2.prop("firstName"));

    assert.equal(link1.props(), link1.props());
    assert.equal(link1.props(), link2.props());
  });

  it("access item() & items() should memoize", () => {
    const createLink = valueLinkCreator();

    const stateSource = createStateSource({ firstName: "Sam", lastName: "Minnee" });

    const state = stateSource();
    const state2 = stateSource();

    const link1 = createLink(...state);
    const link2 = createLink(...state2);

    assert.equal(link1.prop("firstName"), link1.prop("firstName"));
    assert.equal(link1.prop("firstName"), link2.prop("firstName"));

    assert.equal(link1.props(), link1.props());
    assert.equal(link1.props(), link2.props());
  });

  it("apply() should memoize", () => {
    const createLink = valueLinkCreator();

    const stateSource = createStateSource({ firstName: "sam", lastName: "minnee" });

    const state = stateSource();
    const state2 = stateSource();

    const link1 = createLink(...state);
    const link2 = createLink(...state2);

    const upperCaseLens: Lens<string, string> = [
      (val) => val.toUpperCase(),
      (val, update) => update(val.toLowerCase()),
    ];

    const applied1 = link1.prop("firstName").apply(upperCaseLens);
    const applied2 = link1.prop("firstName").apply(upperCaseLens);
    const applied3 = link2.prop("firstName").apply(upperCaseLens);

    assert.equal(applied1, applied2);
    assert.equal(applied1, applied3);
  });
});
