'use strict'
const debug = require('debug')('bilt:jobs:build')
const {executeCommand} = require('@bilt/host-agent')
const {publish} = require('@bilt/in-memory-events')

async function executeBuild({
  builder,
  job,
  state,
  awakenedFrom,
  disabledSteps,
  enabledSteps,
  events,
}) {
  const builderArtifact = {
    ...builder.artifactDefaults,
    steps: mergeSteps((builder.artifactDefaults || {}).steps, builder.defaultSteps),
  }
  const jobArtifact = job.artifact || {}

  const jobWithArtifact = {
    ...job,
    artifact: {
      ...builderArtifact,
      ...jobArtifact,
      steps: mergeSteps(
        jobArtifact.steps,
        builderArtifact.steps,
        mergeDisabledSteps(builderArtifact.disabledSteps, disabledSteps, enabledSteps),
      ),
    },
  }
  debug('final steps: %o', jobWithArtifact.artifact.steps)
  const {buildContext} = await builder.setupBuildSteps({
    job: jobWithArtifact,
    state,
    awakenedFrom,
  })
  try {
    const {buildSteps = [], state, jobs} = builder.getBuildSteps({
      buildContext: {...jobWithArtifact, ...buildContext},
      events,
    })

    await executeSteps(jobWithArtifact, buildSteps, events)

    return {state, jobs, success: true}
  } catch (err) {
    return {state, success: false, err}
  } finally {
    if (builder.cleanupBuild) {
      await builder.cleanupBuild({buildContext})
    }
  }
}

function mergeDisabledSteps(builderDisabledSteps, disabledStepsOverride, enabledStepsOverride) {
  return (builderDisabledSteps || [])
    .concat(disabledStepsOverride || [])
    .filter(disabledStep => !(enabledStepsOverride || []).includes(disabledStep))
}

function mergeSteps(jobSteps, builderSteps, disabledSteps = []) {
  if (!jobSteps) return (builderSteps || []).filter(isStepEnabled)

  return jobSteps
    .map(jobStep => ({
      ...(builderSteps.find(cs => cs.id === jobStep.id) || {}),
      ...jobStep,
    }))
    .filter(isStepEnabled)

  function isStepEnabled(step) {
    return !disabledSteps.includes(step.id)
  }
}

async function executeSteps(job, buildSteps, events) {
  for (const command of buildSteps) {
    if (events) {
      await publish(events, 'START_STEP', {
        job,
        step: {name: command.stepName},
      })
    }
    if (typeof command === 'function') {
      await command()
    } else {
      await executeCommand({
        ...command,
        callOnEachLine:
          events && (({line, outTo}) => publish(events, 'STEP_LINE_OUT', {job, line, outTo})),
      })
    }
  }
}

module.exports = {executeBuild}
