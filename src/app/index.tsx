import * as React from "react";
import ReactDOM from "react-dom";
import { Box, Paper, TextField } from "@mui/material";
import { DataGrid, GridColumns, GridSelectionModel } from "@mui/x-data-grid";
import { createFromReactState, ValueLink } from "valynx";
import "./index.css";

// A few simple types to represent state

type Person = {
  id: number;
  name: string;
  email: string;
  projects: number[];
};

type Project = {
  id: number;
  name: string;
  description: string;
};

type AppState = {
  people: Person[];
  projects: Project[];
  current: GridSelectionModel;
};

/**
 * Control for exposing a string's value link as a text field
 */
const LinkedField = (props: { state: ValueLink<string>; label?: string }) => {
  const { state, ...fieldProps } = props;

  return (
    <div className="form-item-vert">
      <TextField value={state.value} onChange={(e) => state.set(e.currentTarget.value)} {...fieldProps} />
    </div>
  );
};

/**
 * Detail form for editing a person - the state for each field is straightforward to pass
 * State of a single person is passed, without reference to app state
 */
const PersonDetail = (props: { state: ValueLink<Person> }) => {
  const state = props.state.props();
  return (
    <Paper className="fill-height">
      <LinkedField label="Name" state={state.name} />
      <LinkedField label="Email" state={state.email} />
    </Paper>
  );
};

/**
 * Detail form for editing a project
 */
const ProjectDetail = (props: { state: ValueLink<Project> }) => {
  const state = props.state.props();
  return (
    <Paper className="fill-height">
      <LinkedField label="Name" state={state.name} />
      <LinkedField label="Description" state={state.description} />
    </Paper>
  );
};

/**
 * The list of either people or projects
 */
function DataList<T>(props: { data: ValueLink<T[]>; selected: ValueLink<GridSelectionModel>; columns: GridColumns }) {
  return (
    <Paper className="fill-height">
      <DataGrid
        rows={props.data.value}
        selectionModel={props.selected.value}
        onSelectionModelChange={props.selected.set}
        columns={props.columns}
      />
    </Paper>
  );
}

/**
 * Our simple test app
 */
const App = () => {
  const reactState = React.useState<AppState>(() => ({
    people: [
      { id: 1000, name: "Sam", email: "sam@example.com", projects: [2000, 2001] },
      { id: 1001, name: "Ingo", email: "ingo@example.com", projects: [2001, 2002] },
      { id: 1002, name: "Ben", email: "ben@example.com", projects: [2002] },
    ],
    projects: [
      { id: 2000, name: "Fun", description: "Things that are fun" },
      { id: 2001, name: "Chores", description: "Things that are boring but you don't get paid for" },
      { id: 2002, name: "Work", description: "Things that pay" },
    ],
    current: [],
  }));

  // Valynx is easy to use with a useRate result
  const state = createFromReactState(reactState);

  // Find the current person, returns a value link to a person or null, making it easy to conditionally show the form below
  // state.data.find(predicate) returns a value link to the record matching that predicate, or null. Updates to the result
  // will be saved back into the global state
  // Relies at the moment on no overlap between project & person IDs
  const currentId = state.prop("current").item(0).value;
  const currentPerson = currentId ? state.prop("people").find((row) => row.id === currentId) : null;
  const currentProject = currentId ? state.prop("projects").find((row) => row.id === currentId) : null;

  return (
    <Box
      sx={{
        display: "grid",
        height: "100%",
        gridTemplateRows: "38px auto 38px auto",
        gridTemplateColumns: "49% auto",
        gap: "24px",
      }}>
      <Box sx={{ gridColumn: "1", gridRow: "1" }}>
        <h1>People</h1>
      </Box>
      <Box sx={{ gridColumn: "1", gridRow: "2" }}>
        <DataList
          data={state.prop("people")}
          selected={state.prop("current")}
          columns={[
            { field: "name", width: 200 },
            { field: "email", width: 200 },
          ]}
        />
      </Box>
      <Box sx={{ gridColumn: "1", gridRow: "3" }}>
        <h1>Projects</h1>
      </Box>
      <Box sx={{ gridColumn: "1", gridRow: "4" }}>
        <DataList
          data={state.prop("projects")}
          selected={state.prop("current")}
          columns={[
            { field: "name", width: 200 },
            { field: "description", width: 200 },
          ]}
        />
      </Box>
      <Box sx={{ gridColumn: "2", gridRowStart: "2", gridRowEnd: "5" }}>
        {currentPerson && <PersonDetail state={currentPerson} />}
        {currentProject && <ProjectDetail state={currentProject} />}
      </Box>
    </Box>
  );
};

ReactDOM.render(<App />, document.querySelector("#root"));
