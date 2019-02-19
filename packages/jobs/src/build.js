'use strict'
const path = require('path')
const vm = require('vm')
const debug = require('debug')('bilt:jobs:build')
const {executeCommand} = require('@bilt/host-agent')
const {publish} = require('@bilt/in-memory-events')

async function executeBuild({
  builder,
  job,
  buildConfig,
  state: jobState,
  awakenedFrom,
  disabledSteps,
  enabledSteps,
  events,
  repositoryDirectory,
}) {
  const artifactDefaults = (buildConfig && buildConfig.artifactDefaults) || {}
  const builderArtifact = {
    ...artifactDefaults,
    steps: mergeSteps(
      artifactDefaults.steps,
      builder.defaultSteps ? builder.defaultSteps({buildConfig}) : [],
    ),
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
  try {
    const {buildContext} = builder.setupBuildSteps
      ? await builder.setupBuildSteps({
          job: jobWithArtifact,
          buildConfig,
          state: jobState,
          awakenedFrom,
        })
      : {}
    const buildSteps = getBuildSteps({
      buildContext,
      artifact: jobWithArtifact.artifact,
      repositoryDirectory,
    })

    await executeSteps(jobWithArtifact, buildSteps, events)

    const {state, jobs} = builder.getJobsToDispatch
      ? builder.getJobsToDispatch({
          buildContext: {...jobWithArtifact, ...buildContext},
          events,
        })
      : {}

    return {state, jobs, success: true}
  } catch (err) {
    return {success: false, err}
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

function getBuildSteps({buildContext, artifact, repositoryDirectory}) {
  const buildSteps = artifact.steps
    .filter(s => evaluateStepCondition(s, buildContext))
    .map(
      s =>
        s.funcCommand != null
          ? s
          : typeof s.command === 'function'
            ? {...s, command: s.command(buildContext)}
            : s,
    )
    .map(
      s =>
        s.funcCommand != null
          ? Object.assign(() => s.funcCommand(buildContext), {stepName: s.name})
          : Object.assign(
              {cwd: path.join(repositoryDirectory, artifact.path), ...s},
              {stepName: s.name},
            ),
    )

  return buildSteps
}

function evaluateStepCondition({condition}, context) {
  if (!condition) return true
  if (typeof condition === 'string') {
    return vm.runInContext(condition, vm.createContext(context))
  } else {
    return condition(context)
  }
}

module.exports = {executeBuild}
