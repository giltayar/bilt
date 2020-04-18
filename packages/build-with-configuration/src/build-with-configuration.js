'use strict'
const {executeStep, stepInfo, validateStep} = require('./execute-step')

/**
 * @param {import('./types').Job} jobConfiguration
 * @param {'before'|'during'|'after'} phase
 * @param {string} directoryToExecuteIn
 * @param {{[x: string]: boolean|string}} buildOptions
 * @param {{[x: string]: any}} javascriptOptionsParameter
 * @returns {AsyncGenerator<import('./execute-step').StepInfo, void, void>}
 */
async function* executeJob(
  jobConfiguration,
  phase,
  directoryToExecuteIn,
  buildOptions,
  javascriptOptionsParameter,
) {
  yield* executePhase(
    jobConfiguration.steps[phase],
    directoryToExecuteIn,
    buildOptions,
    javascriptOptionsParameter,
  )
}

/**
 * @param {import('./types').BuildConfiguration} buildConfiguration
 * @param {string} jobId
 * @returns {{
 * enableOptions: string[]
 * dependentEnableOptions: Map<string, string>
 * parameterOptions: string[]
 * }}
 */
function jobInfo(buildConfiguration, jobId) {
  const jobConfiguration = buildConfiguration.jobs[jobId]

  const enableOptions = []
  const parameterOptions = []
  /**@type {Map<string, string>} */
  const dependentOptions = new Map()
  for (const phase of Object.values(jobConfiguration.steps)) {
    for (const step of phase) {
      const stepEnableOptions = stepInfo(step).enableOptions
      for (const enableOption of stepEnableOptions) {
        enableOptions.push(enableOption)
      }

      if (stepEnableOptions.length === 2) {
        const strongOption = stepEnableOptions[0]
        const weakOption = stepEnableOptions[1]
        if (
          dependentOptions.has(strongOption) &&
          dependentOptions.get(strongOption) !== weakOption
        ) {
          throw new Error(
            `${strongOption} cannot depend on both ${weakOption} && ${dependentOptions.get(
              strongOption,
            )} in job ${jobId}`,
          )
        }
        dependentOptions.set(strongOption, weakOption)
      }

      for (const parameterOption of stepInfo(step).parameterOptions) {
        parameterOptions.push(parameterOption)
      }
    }
  }

  return {
    enableOptions: [...new Set(enableOptions)],
    parameterOptions: [...new Set(parameterOptions)],
    dependentEnableOptions: dependentOptions,
  }
}

/**
 * @param {import('./types').Steps} steps
 * @param {string} directoryToExecuteIn
 * @param {{[x: string]: boolean|string}} buildOptions
 * @param {{[x: string]: any}} javascriptOptionsParameter
 * @returns {AsyncGenerator<import('./execute-step').StepInfo>}
 */
async function* executePhase(
  steps,
  directoryToExecuteIn,
  buildOptions,
  javascriptOptionsParameter,
) {
  for (const step of steps) {
    if (isStepEnabled(stepInfo(step).enableOptions, buildOptions)) {
      yield stepInfo(step)
      await executeStep(step, directoryToExecuteIn, buildOptions, javascriptOptionsParameter)
    }
  }
}

function isStepEnabled(enableOptions, buildOptions) {
  if (!enableOptions || enableOptions.length === 0) return true

  return buildOptions[enableOptions[0]] === true
}

/**
 *
 * @param {import('./types').BuildConfiguration} buildConfiguration
 * @param {string} configPath
 */
function validateBuildConfiguration(buildConfiguration, configPath) {
  const jobs = buildConfiguration.jobs
  if (!jobs) {
    throw new Error(`could not find "jobs" section in build configuration ${configPath}`)
  }
  if (typeof jobs !== 'object') {
    throw new Error(`"jobs" must be an object, and isnt in build configuration ${configPath}`)
  }

  for (const [jobId, job] of Object.entries(jobs)) {
    if (!job) {
      throw new Error(`could not find job ${job} in build configuration ${configPath}`)
    }
    if (typeof job !== 'object') {
      throw new Error(
        `The job ${job} must be an object, and isnt in build configuration ${configPath}`,
      )
    }

    const phases = job.steps
    if (!phases) {
      throw new Error(`could not find "steps" section in job ${jobId} in build configuration`)
    }
    if (typeof phases !== 'object') {
      throw new Error(`"steps" must be an object in job ${jobId} in build configuration`)
    }

    validateStepsConfiguration(phases.before, 'before', jobId, configPath)
    validateStepsConfiguration(phases.during, 'during', jobId, configPath)
    validateStepsConfiguration(phases.after, 'after', jobId, configPath)
  }
}

/**
 *
 * @param {import('./types').Step[]|undefined} steps
 * @param {string} phaseName
 * @param {string} jobId
 * @param {string} configPath
 */
function validateStepsConfiguration(steps, phaseName, jobId, configPath) {
  if (steps === undefined) return

  if (!Array.isArray(steps)) {
    throw new Error(
      `The step ${phaseName} must be an array, and isnt in job ${jobId} in build configuration ${configPath}`,
    )
  }

  let i = 0
  for (const step of steps) {
    validateStep(step, ++i, phaseName, jobId, configPath)
  }
}

module.exports = {
  validateBuildConfiguration,
  executeJob,
  jobInfo,
}
