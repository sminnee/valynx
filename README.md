# Valynx

Valynx is a state-management library based on 'value links', an object-friendly twist on the
functional notion of lenses.

Valynx lets you create a single shared state tree, but pass fragments of that state to components
such as form fields as if it were a local state. It's aim is to combine the **integrity of global
state** with the **simplicity of component state**.

## Why another state management library?

React (and similar) apps generally have to choose between two approaches to managing state:
_component state_ or _global state_.

- Component state is simple - any component can define a piece of state and manage it itself.
  However, state often ends up being inconsistent or replicated across components and/or routes, and
  as an application grows, it can get harder & harder to maintain.

- With global state, it it much easier to keep your state DRY, and have each piece of data stored
  only once, and updated everywhere in your app immediately whenever it changes. However, as your
  app grows, the the state can get very large. The mechanisms for updating state (e.g. in redux)
  don't always follow the same patterns as for reading state, and so passing state down often
  requires double-handling or component-specific mapping.

At the level of small components, such as a single text field, it's usually assumed that it's
impractical to bind global state to the component, and so these components might recieve customised
value/onChange properties, or a specialised "form management" library might be used.

I wasn't happy with this status quo, and thought that **Lenses** could be used to break the
dichotomy between component & global state. Lenses are a concept from functional programming
typically wrapped in estoric category theory. In essense, composable getter/updater pairs.

- You could start with a pair of references to a global state (similar to what we receive from
  useState & useReducer)
  - Then nest a reference to an `records` property in that state
  - Then nest a reference to a single record in that array (e.g. the 5th item)
    - Then nest a reference to the `firstName` property of that record.

Valynx provides something similar called a **Value Link**. It is a simple object with a `value`
property, a `set(val)` method, and an `update(old => new)` method. IMO it's more ergonomic for the
typical TypeScript/React app than a purely functional approach.

Valynx can be used for a single global state, or for a shared state for a single piece of your app,
such as the state for:

- An editable dashboard of nested widgets (this was my first use-case)
- A form

In Valynx, given a value link to your global state, `state`, you would retrieve this nested state as
follows:

```ts
const fieldState = state.prop("records").item(5).prop("firstName");
```

The result is a value/updater pair that works on a string - a very generic type similar to component
state for a text field. When the updater is called with the new value, the global state will be
updated without the text field needing to know what happens. Similarly, the

## Status

Valynx is experimental. I've used this on two production apps. I am very keen to get feedback from
other developers:

- Is this a problem worth solving?
- Is this approach a good one?
- Has someone else already done this?

**Note:** I wouldn't recommend using the current release of Valynx for a large global state - it
lacks the memoization needed to prevent this from performing poorly, as every component would
re-render on any state change.

## Usage

Install the `valynx` package in your preferred way; it comes with TypeScript bindings.

`npm install valynx`

### Creating a shared state

Valynx operates well with a single nested state object, defined with a TypeScript type. In this
example we will create a simple email address book app. Our AppState has:

- an array of people, with name, email, and id.
- a marker for the currently-selected person that can be optionally set to a person id.

```ts
type Person = {
  id: number;
  name: string;
  email: string;
};

type AppState = {
  data: Person[];
  current: number | null;
};
```

If you're using React, Valynx will work well with React.useState.

```ts
const reactState = React.useState<AppState>(() => ({
  data: [
    { id: 1000, name: "Sam", email: "sam@example.com" },
    { id: 1001, name: "Ingo", email: "ingo@example.com" },
    { id: 1002, name: "Ben", email: "ben@example.com" },
  ],
  current: null,
}));
```

`createFromReactState()` will accept an array containing the state value, and a state-setter
function, exact as useState returns:

```ts

// Valynx is easy to use with a useState result
import { valueLinkCreator } from "valynx";

// Sets up a memoization cache for value-link results
const useValueLink = valueLinkCreator();

const state = useValueLink(..reactState); // Returns type ValueLink<AppState>
```

### Value link API

A basic value link has the following properties are available:

- `state.value` contains the current state value
- `state.set(newState)` updates the state without reference to the old value
- `state.update(oldState => newState)` updates the state using a function that is passed the old
  state value
- `state.apply(lens)` create a new value link by applying the a lens (see below)

For value link of an array, the following additional methods are available:

- `state.item(idx)` returns a value link for the given array item
- `state.items()` returns an array of value links, one for each item
- `state.find(predicate)` returns a value link for the matching item, or null. updates are applied
  back to that record.
- `state.applyItems(lens)` returns an array of value links, with the given lense applied to each
  item
- `state.mapItems(mapperFn)` shortcut for state.items().map(mapperFn)

And for a value link of a non-array object, the following methods are available:

- `state.prop(name)`: return a value link for the given property
- `state.props()` return a record mapping the object properties to a value link for each, so
  `state.props().key` is the same as `state.prop("key")`

### Lenses

Interally, the state nesting is handled by applying lenses. Lenses are a simple tuple of [
getter, updater ].

```ts
type Lens<Base, Child> = [(base: Base) => Child, (base: Base, updater: UpdaterFn<Child>) => Base];
```

For example, this is the definition of recordProp, complete with its generic type signature. Note
that we memoize lens creators to ensure that the results of applying them are also memoized.

```ts
import { memoize } from "valynx";

const recordProp = memoize(
  <T, K extends keyof T>(key: K): Lens<T, T[K]> => [
    (record) => record[key],
    (record, updater) => ({
      ...record,
      [key]: updater(record[key]),
    }),
  ]
);
```

We have a number of built-in lenses:

- `arrayItem(idx)`: Access an array element by index, which is used by state.items(), etc.
- `recordProp(name)`: Access an object's property by name, which is used by state.props(), etc.
- `omitProp(name)`: Omits a property from the record, which can be useful to get a simpler type
- `onChange(handler)`: Applies the handler to the result before saving, which can be useful for
  example for setting default fields
- `partial()`: Turns T into Partial<T> by keeping any omitted fields the same

In addition to these, you can write your own lenses, or functions that produce lenses.

## Examples

Putthing these all together, you can drill down to the state you need. For example, this will set
currentPerson to `ValueLink<Person> | null`.

```ts
const currentPersonId = state.props("current").value;
const currentPerson =
  currentPersonId && state.props("data").find((row) => row.id === currentPersonId);
```

Putting that all together into a react App component, <PersonDetail> is now passed a Person value
link, and needn't know where that object is persisted.

```ts
const App = () => {
  const reactState = React.useState<AppState>(/* () => defaultState */);
  const state = useValueLink(...reactState);

  const currentPersonId = state.props("current").value;
  const currentPerson =
    currentPersonId && state.props("data").find((row) => row.id === currentPersonId);

  return (
    <div>
      <h1>People</h1>
      <div class="lhs">
        <PersonList state={state} />
      </div>
      <div class="rhs">{currentPerson && <PersonDetail state={currentPerson} />}</div>
    </div>
  );
};

const useValueLink = valueLinkCreator();

```

### Linking to form fields

Value links make it easy to create "generic" form controls. This TextField control takes a string
value link, and will manage its own state updating, without needing to know about where that state
comes from.

```ts
const TextField = (props: { state: ValueLink<string>; label?: string }) => {
  const { state, ...fieldProps } = props;

  const inputField = (
    <input value={state.value} onChange={(e) => state.set(e.currentTarget.value)} />
  );

  if (props.state.label) {
    return (
      <label>
        <span>{props.state.label}</span> {inputField}
      </label>
    );
  } else {
    return inputField;
  }
};
```

With such a control in place, you can easily make a form control that exposes all the fields of an
object for editing.

```ts
const PersonDetail = (props: { state: ValueLink<Person> }) => {
  const state = props.state.props();

  <form className="person-detail">
    <TextField label="Name" state={state.name} />
    <TextField label="Email" state={state.email} />
  </form>;
};
```

If you want to know more, go read [src/valynx/index.ts](./src/valynx/index.ts) - it's only a couple
of hundred lines (for now).

## Prior art / references

- [Value Link: Painless React forms, validation, and state management](https://www.npmjs.com/package/valuelink).
  This is a similar API but AFAIK it doesn't use lenses internally, which makes it harder to build
  custom operators.

- [Functional lenses: Composable Getters and Setters for Functional Programming](https://medium.com/javascript-scene/lenses-b85976cb0534).
  This is the theoretical foundation but I don't find the API exposed to be very ergonomic.

Valynx combines benefits of these two approaches.

## Still to come

- Adding / deleting records
- Interaction with server-side state
- Non-CRUD actions
