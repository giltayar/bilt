async function executeBuild({builder, agent, job, state, awakenedFrom}) {
  const agentInstance = agent ? await agent.acquireInstanceForJob() : undefined
  try {
    const builderArtifact = builder.artifactDefaults || {}
    const jobArtifact = job.artifact || {}

    const jobWithArtifact = {
      ...job,
      artifact: {
        ...builderArtifact,
        ...jobArtifact,
        steps: mergeSteps(jobArtifact.steps, builderArtifact.steps),
      },
    }
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

function mergeSteps(jobSteps, builderSteps) {
  if (!jobSteps) return builderSteps

  return jobSteps.map(jobStep => ({
    ...(builderSteps.find(cs => cs.id === jobStep.id) || {}),
    ...jobStep,
  }))
}

async function executeSteps(buildSteps, agent) {
  for (const executeCommandArg of buildSteps) {
    await agent.executeCommand(executeCommandArg)
  }
}

module.exports = {executeBuild}
