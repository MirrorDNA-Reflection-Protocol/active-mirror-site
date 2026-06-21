# Component Contracts

## Memory Card

Shows one memory item and its authority state.

Required fields:

- title;
- type;
- scope;
- sensitivity;
- source type and reference;
- created and updated timestamps;
- confidence;
- freshness;
- consent rule;
- allowed agents;
- blocked agents;
- edit/delete/export controls.

## Source Badge

Shows where knowledge came from.

States:

- User-provided
- File
- Chat
- Web
- Tool output
- Inferred
- Imported
- Unknown

## Sensitivity Badge

Shows how carefully the item should be handled.

States:

- Public
- Internal
- Personal
- Sensitive
- Client-confidential
- Local-only
- Never share

## Consent Badge

Shows the permission state.

States:

- Allowed
- Blocked
- Needs approval
- Project-only
- Once only
- Local-only
- Redaction required
- Strong confirmation required

## Risk Badge

Shows task risk.

States:

- Low
- Medium
- High
- Critical

## Agent State Pill

Shows exact agent state.

States:

- Idle
- Listening
- Thinking
- Retrieving context
- Checking permissions
- Drafting
- Planning
- Waiting for approval
- Executing
- Verifying result
- Completed
- Failed
- Blocked
- Rolled back

## Context Packet Drawer

Shows the packet before it leaves the browser or enters a model route.

Required sections:

- task;
- scope;
- model target;
- memory used;
- memory excluded with reasons;
- tools requested;
- risk level;
- approval requirement;
- local-only state;
- token estimate.

Required actions:

- approve once;
- approve for project;
- remove context;
- add context;
- mark sensitive;
- force local-only;
- cancel.

## Approval Modal

Shows requested action and asks for explicit consent.

Required fields:

- action;
- destination;
- data used;
- risk;
- reversibility;
- sensitive data;
- expiration;
- approval options.

## Tool Permission Row

Shows a requested tool and exact scope.

Required fields:

- tool name;
- permission class;
- scope;
- destination;
- risk;
- reversibility;
- approval state.

## Audit Event Row

Shows one event from the receipt/audit trail.

Required fields:

- event id;
- timestamp;
- actor;
- action type;
- scope;
- memory ids;
- tools;
- model;
- risk level;
- approval state;
- result;
- rollback status.

## Conflict Resolver Panel

Shows contradictory memory before use.

Required actions:

- accept recommendation;
- keep both with scope;
- mark older as superseded;
- mark new as unverified;
- delete one;
- research or verify;
- require manual approval before use.

## Rollback Banner

Shows whether a result can be reversed.

States:

- Rollback available
- Not reversible
- Partially reversible
- Requires manual recovery

## Safe Mode Toggle

Switches to a restricted route.

Modes:

- Local-only
- Local-first with approved frontier help
- Cloud-assisted
- Client-confidential
- Public-safe
- Emergency lockdown

## Local/Cloud Status Indicator

Shows route truth.

Required fields:

- local memory status;
- cloud sync status;
- local model status;
- frontier model calls;
- external APIs used;
- data leaving device;
- data staying local;
- last export;
- last backup.
