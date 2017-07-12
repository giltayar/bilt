# Design

## Job System

* Each job has a set of properties which act as:
  * input for the job
  * information for the job runner:
    * rerun if failed
    * job can be awakened via event, and will receive event information
* If a job is dispatchd with the same set of properties, it will not create another one, so the set of properties
  with the job type must be unique.
* Each job can have state associated with it, that can change and is important if it is re-run

## Event System

* Dispatch an event with arguments.
* Events are handled by jobs. A job is registered on an even with specific event properties.
* Jobs can go to sleep and be awakened by an event.
* Events can be deffered (via timer) and if multiple happen while deferred, they are aggregated.
  The job will get the aggregated information.
* Jobs can be registered for an event and start by that event happening

## Job that is triggered on a commit

Properties: rerun if failed
Properties: repo + commithash + files that changed

1. This job has a `job.json`, with a type `repo-build-job`.
1. Fetch repo with commit
1. Determine artifacts to build from files that changed
1. Determine dependency tree of all artifacts within repo
1. Determine build tree
1. Dispatch build tree orchestrator job with this build tree

## Build tree orchestrator job

Properties: rerun if failed
Properties: repo + commithash + build tree
If awoken from sleep due to build job run, the the event information will be build status + job (or something)

1. If not awakened by event, write build tree status to DB (i.e. no jobs have started)
1. Otherwise, awakened by a job that is finished, write to the status which jobs are built.
1. Dispatch jobs that have no parents that are not yet built (or stop some due to failure)
1. If all artifacts are built, job is done.
1. Add event handler to dispatch this job when any of the jobs are finished
1. Goto sleep

## Artifact Build Job

* What is a job?
  * It is a json describing what to do (see `job.json` below).
    It does not describe what commands to run, how to run them, or where to run them.
* How is it dispatched?
  * A dispatcher plugin is given the `job.json` and will create a "job environment" for it to run, and
    a set of plugin that can execute (at minimum) "run commands" in the job environment, and maybe
    other types of commands. (see below what a "run command" is)
* How is it run?
  * Plugins will know how to execute the specific type of job. Given a job, it exports
    a set of commands to execute to make the job happen.
  * A command has the structure: [type, command, args...], and is written "type:command arg1 arg2...",
    e.g. "run:npm test" or "checkout:git://... master 493829374203"
  * Plugins execute commands - each plugin executes commands for a specific type.
  * A plugin that executes a command returns success/fail and can return more information
    (e.g. checkout command will return where it checked out the code)
    It is also an event emitter for the logs of the command
  * a command plugin can also execute other commands.
  * The "run" type command is executed by the plugin that dispatched the job.
* How is the code fetched?
  * Plugins can execute a "checkout" command, which will be done by another plugin that knows
    how to checkout the source

### `job.json`

* type: npm-lib|npm-docker|maven...
* repo+commit+branch
* path to source code


## Principles

* All plugins are a module that exports a factory function that receives _something_ not sure what exactly,
  and return an object with a set of functions that conform to an interface for that plugin.
* All functions return a promise. Never a raw value.