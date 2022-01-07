# Valynx

Valynx is a state-management library based on 'value links', and object-friendly twist on the
functional notion of lenses.

Valynx lets you create a single global state tree, but pass fragments of that state to components
such as form fields as if it were a local state. Arguably, it provides the integrity of global state
with the simplicity of per-component state.

## Status

This repo isn't yet usable as a library - right now it's just an example app.

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

## Still to come

- Adding / deleting records
- Interaction with server-side state
- Non-CRUD actions
