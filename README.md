# Valynx

Valynx is a state-management library based on 'value links', and object-friendly twist on the
functional notion of lenses.

Valynx lets you create a single global state tree, but pass fragments of that state to components
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

In Valynx, given a value link to your global state, `state`, you would retrieve this nested state as
follows:

```ts
const fieldState = state.prop("records").item(5).prop("firstName");
```

The result is a value/updater pair that works on a string - a very generic type similar to component
state for a text field. When the updater is called with the new value, the global state will be
updated without the text field needing to know what happens. Similarly, the

## Status

Valynx is currently **experimental**: I am keen to try some of these concepts out at
[my day job](https://www.tellfrankie.com), and also get feedback from other developers about **is
this a problem worth solving?**, and **has someone else already done this?**.

This repo isn't yet usable as a library - right now it's just an example app with the library
contained in src/valynx. Once the concept has been fleshed out more fully I will make it usable as
an NPM package.

## Example

See the content of [src/app/index.tsx](./src/app/index.tsx)

To run this example, do the usual thing:

```
npm install
npm start
```

Then open http://localhost:3000

## Usage

### Creating the application state

Valynx assumes that your application state is a single nested state object, defined with a
TypeScript type. In this example we will create a simple email address book app. Our AppState has:

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
// Valynx is easy to use with a useRate result
import { createFromReactState } from "valynx";
const state = createFromReactState(reactState); // Returns type ValueLink<AppState>
```

### What is a value link

- `state.value` contains the current state value
- `state.set(newState)` updates the state without reference to the old value
- `state.update(oldState => newState)` updates the state using a function that is passed the old
  state value

### Deriving nested value links

Valynx power is that you can create _nested_ value links, with both a value, and a setter that
mutates the global state.

For objects:

- `state.prop("data")` returns a value link of the data property of the app state
- `state.props()` returns a new object with value links for each property - so `state.props().data`
  is the same as `state.prop("data")`

For arrays:

- `state.item(idx)` returns a value link to the element of the array at the given index
- `state.items()` returns an array of value links
- `state.find(predicate)` finds the first value in the array matching the given predicate, and
  ensures that updates are applied back to that record

This can be used to expose related data for manipulation. This will set currentPerson to
`ValueLink<Person> | null`.

```ts
const currentPersonId = state.props("current").value;
const currentPerson =
  currentPersonId && state.props("data").find((row) => row.id === currentPersonId);
```

Putting that all together into a react App componet, <PersonDetail> is now passed a Person value
link, and needn't know where that object is persisted.

```ts
const App = () => {
  const reactState = React.useState<AppState>(/* () => defaultState */);
  const state = createFromReactState(reactState);

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

## Under the hood

Interally, the state nesting is handled by applying lenses.We have two functions that produce
lenses:

- `arrayItem(idx)`: Access an array element by index
- `recordProp(name)`: Access an object's property by name

`valueLink.apply(lens)` returns a new value link with the lens applied. So,
`valueLink.apply(recordProp("firstName"))` does the same thing as `valueLink.prop("firstName")`.

Lenses are a simple tuple of [ getter, updater ]. For example, this is the definition of recordProp,
complete with its generic type signature:

```ts
const recordProp = <T, K extends keyof T>(key: K): Lens<T, T[K]> => [
  (record) => record[key],
  (record, updater) => ({
    ...record,
    [key]: updater(record[key]),
  }),
];
```

If necessary, you could write and `apply()` your own lenses for more estoeric navigation through a
state.

If you want to know more, go read [src/valynx/index.ts](./src/valynx/index.ts) - it's only 150 lines
(for now).

## Prior art / references

- [Value Link: Painless React forms, validation, and state management](https://www.npmjs.com/package/valuelink)
- [Functional lenses: Composable Getters and Setters for Functional Programming](https://medium.com/javascript-scene/lenses-b85976cb0534)

## Still to come

- Adding / deleting records
- Interaction with server-side state
- Non-CRUD actions
