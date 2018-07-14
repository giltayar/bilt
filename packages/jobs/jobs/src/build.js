'use strict'
const debug = require('debug')('bilt:jobs:build')
async function executeBuild({
  builder,
  agent,
  job,
  state,
  awakenedFrom,
  disabledSteps,
  enabledSteps,
}) {
  const agentInstance = agent ? await agent.acquireInstanceForJob() : undefined
  try {
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
      agentInstance,
      state,
      awakenedFrom,
    })
    try {
      const {buildSteps = [], state, jobs} = builder.getBuildSteps({
        buildContext: {...jobWithArtifact, ...buildContext},
      })

      await executeSteps(buildSteps, agent, job)

      return {state, jobs, success: true}
    } catch (err) {
      return {state, success: false, err}
    } finally {
      if (builder.cleanupBuild) {
        await builder.cleanupBuild({buildContext})
      }
    }
  } finally {
    agent && agent.releaseInstanceForJob(agentInstance)
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

async function executeSteps(buildSteps, agent) {
  for (const command of buildSteps) {
    if (typeof command === 'function') {
      await command()
    } else {
      await agent.executeCommand(command)
    }
  }
}

module.exports = {executeBuild}
