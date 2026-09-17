# Build notes

Things that cost time on this build, recorded so they cost less next time.

## Solution and deployment

**Cloud project names are unique organisation-wide.** Registering the pivoted
projects failed with "Project name already exists" because the property
solution was still live. Every one of the 15 project directories *and* the
`Name` field inside each `project.uiproj` had to be renamed before registering.

**`uip solution deploy upgrade` refuses when the package contains a resource the
current deployment already installed.** Here that resource was
`injury-claims-console_1`, a duplicate app the server mints on install because an
app of that name already exists in the tenant. Editing the generated resource
files does not help: `solution pack` regenerates them from the case project's
`bindings_v2.json` and the live server state. The path that works is
`deploy uninstall` followed by a fresh `deploy run`.

**A fresh `deploy run` rotates the folder key and every process key.** Anything
holding those has to be updated afterwards — for this build, the case app's
`.env` and then a rebuild, repack, republish and redeploy of the app itself.

**`codedapp deploy` matches an existing deployment on display name, not package
name.** Without `--display-name`, a redeploy of an app whose display name
differs is treated as a new app and fails with "This app name is already
deployed in this folder." Pass the display name exactly as the Apps tab shows
it. Also omit `--path-name` on an upgrade: it collides with the existing routing
name.

**The case plan's app binding resolves by name inside a folder path.** The case
carries `{"resource": "app", "value": {"name": "...", "folderPath": "Shared"}}`.
If no app of exactly that name exists at that path, the first HITL task faults at
runtime with `170015 — No app: <name> found in folder: Shared`. Nothing catches
this earlier: the plan validates, the solution packs, the deploy succeeds. It
only surfaces when an instance reaches the task.

## The event trigger

**`resourceKey` on the global event is the Data Fabric *connection* id, not the
entity GUID.** The entity is identified only by `objectName`. Putting the entity
GUID there fails at runtime.

**`eventMode` is `webhooks`.** The reference implementation disagrees with
itself, carrying `webhooks` at the top of `activityPropertyConfiguration` and
`polling` inside the nested `instanceParameters`. `uip maestro case spec` emits
`webhooks` in both places for a `CREATED` operation; the nested `polling` is
vestigial designer state.

**The `CaseId` filter must be a structured filter tree, not just an expression
string.** A bare `filterExpression` is silently dropped by Studio Web, and a
null `groupOperator` silently widens the trigger to match every event on every
instance. Both failures are quiet.

## Tooling

**`uip` can be shadowed.** Check which binary is on the path; mixed CLI versions
silently drop Api and Agent projects from a pack. `uip update` fixes it.

**Transient `fetch failed` and `Connection not found or inaccessible` are
common** on `case spec`, `codedapp publish` and `solution resources list`.
Retry before investigating.

## Renaming

A blanket identifier rename across the app source collided with local variables
that already used the target name — three components held a money total in a
local called `claim`. Bulk substitutions over source need a compile afterwards,
not a re-read of the diff.

Shell loops over filenames containing spaces need `while IFS= read -r f`; an
unquoted variable word-splits and `sed` treats the fragments as one filename.
