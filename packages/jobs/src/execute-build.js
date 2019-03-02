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
  disableSteps,
  enableSteps,
  events,
  repositoryDirectory,
}) {
  const arrizeFunction = f => f || (() => [])

  const jobArtifact = job.artifact || {}

  const availableSteps = mergeSteps(
    arrizeFunction(builder.buildSteps)({buildConfig}),
    jobArtifact.steps,
  )
  const steps = calculateBuildSteps(
    availableSteps,
    arrizeFunction(builder.enableSteps)({buildConfig}).concat(
      jobArtifact.enableSteps || [],
      enableSteps || [],
    ),
    arrizeFunction(builder.disableSteps)({buildConfig}).concat(
      jobArtifact.disableSteps || [],
      disableSteps || [],
    ),
  )

  const jobWithArtifact = {
    ...job,
    artifact: {
      ...jobArtifact,
      steps,
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

function mergeSteps(...availableStepsArray) {
  return availableStepsArray.reduce(mergeTwoAvailableSteps, [])

  function mergeTwoAvailableSteps(accumulatedAvailableSteps, currentAvailableSteps) {
    if (!currentAvailableSteps) return accumulatedAvailableSteps

    return currentAvailableSteps.map(currentAvailableStep => ({
      ...currentAvailableStep,
      ...accumulatedAvailableSteps.find(as => as.id === currentAvailableStep.id),
    }))
  }
}

function calculateBuildSteps(steps, enableSteps, disableSteps) {
  return steps.filter(step => isPartOf(step, enableSteps) && !isPartOf(step, disableSteps))

  function isPartOf({id}, collectiveStepIds) {
    return collectiveStepIds.some(
      collectiveStepId =>
        id === collectiveStepId ||
        (id.startsWith(collectiveStepId) && !/[a-z0-9]/i.test(id.charAt(collectiveStepId.length))),
    )
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

module.exports = executeBuild
