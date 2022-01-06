import * as React from "react";
import ReactDOM from "react-dom";
import { Box, Grid, Paper, TextField } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { createFromReactState, ValueLink } from "valynx";
import "./index.css";

// A few simple types to represent state

type Person = {
  id: number;
  name: string;
  email: string;
};

type AppState = {
  data: Person[];
  current: number | null;
};

/**
 * Control for exposing a string's value link as a text field
 */
const LinkedField = (props: { state: ValueLink<string>; label?: string }) => {
  const { state, ...fieldProps } = props;

  return (
    <div className="form-item-vert">
      <TextField value={state.get()} onChange={(e) => state.set(e.currentTarget.value)} {...fieldProps} />
    </div>
  );
};

/**
 * Detail form for editing a person - the state for each field is straightforward to pass
 * State of a single person is passed, without reference to app state
 */
const DetailForm = (props: { state: ValueLink<Person> }) => (
  <Paper className="fill-height">
    <LinkedField label="Name" state={props.state.name} />
    <LinkedField label="Email" state={props.state.email} />
  </Paper>
);

/**
 * The list of people.
 * Full AppState is passed, as we need to deal with both the items and the currently selected item.
 * @param props Control
 */
const PersonList = (props: { state: ValueLink<AppState> }) => (
  // props.state.edata nad props.state.current return more value links, and we call .get() and .set() on them directly

  <Paper className="fill-height">
    <DataGrid
      columns={[
        { field: "name", width: 200 },
        { field: "email", width: 200 },
      ]}
      rows={props.state.data.get()}
      onRowClick={(person) => props.state.current.set(person.row.id)}
    />
  </Paper>
);

/**
 * Our simple test app
 */
const App = () => {
  const reactState = React.useState<AppState>(() => ({
    data: [
      { id: 1000, name: "Sam", email: "sam@example.com" },
      { id: 1001, name: "Ingo", email: "ingo@example.com" },
      { id: 1002, name: "Ben", email: "ben@example.com" },
    ],
    current: null,
  }));

  // Valynx is easy to use with a useRate result
  const state = createFromReactState(reactState);

  // Find the current person, returns a value link to a person or null, making it easy to conditionally show the form below
  // state.data.find(predicate) returns a value link to the record matching that predicate, or null. Updates to the result
  // will be saved back into the global state
  const currentPerson = state.current.get() === null ? null : state.data.find((row) => row.id === state.current.get());

  return (
    <Box sx={{ display: "grid", height: "100%", gridTemplateRows: "80px auto" }}>
      <Box>
        <h1>People</h1>
      </Box>
      <Box>
        <Grid container item spacing={3} className="fill-height">
          <Grid item xs={12} sm={6}>
            <PersonList state={state} />
          </Grid>
          <Grid item xs={12} sm={6}>
            {currentPerson && <DetailForm state={currentPerson} />}
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

ReactDOM.render(<App />, document.querySelector("#root"));
