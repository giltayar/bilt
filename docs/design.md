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

1. Fetch repo with commit
1. Determine artifacts to build from files that changed
1. Determine dependency tree of all artifacts within repo
1. Determine build tree
1. Dispatch build tree orchestrator job with this build tree

## Build tree orchestrator job

Properties: rerun if failed
Properties: repo + commithash + build tree

1. If not a re-run, write build tree status to DB (i.e. no jobs have started)
1. Otherwise write to the status which jobs are built.
1. Dispatch jobs that have no parents that are not yet built (or stop some due to failure)
1. Add event handler to dispatch this job when any of the jobs are finished

## Job Dispatching

* What is a job?
* How is it dispatched?
* How is it run?