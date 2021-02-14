import {executeStep, stepInfo, validateStep} from './execute-step.js'

/**
 * @typedef {import('./types').Job} Job
 * @typedef {import('./types').BuildConfiguration} BuildConfiguration
 */

/**
 * @param {Job} jobConfiguration
 * @param {'before'|'during'|'after'} phase
 * @param {string} directoryToExecuteIn
 * @param {{[x: string]: boolean|string|undefined}} buildOptions
 * @param {{[x: string]: any}} javascriptOptionsParameter
 * @returns {AsyncGenerator<import('./execute-step').StepInfo, void, void>}
 */
export async function* executeJob(
  jobConfiguration,
  phase,
  directoryToExecuteIn,
  buildOptions,
  javascriptOptionsParameter,
) {
  if (jobConfiguration.steps[phase]) {
    yield* executePhase(
      jobConfiguration.steps[phase],
      directoryToExecuteIn,
      buildOptions,
      javascriptOptionsParameter,
    )
  }
}

/**
 * @param {BuildConfiguration} buildConfiguration
 * @param {string} jobId
 * @returns {{
 * enableOptions: string[]
 * aggregateOptions: Map<string, string[]>
 * inAggregateOptions: Map<string, string>
 * parameterOptions: string[]
 * }}
 */
export function jobInfo(buildConfiguration, jobId) {
  const jobConfiguration = buildConfiguration.jobs[jobId]

  const enableOptions = []
  const parameterOptions = []
  /**@type {Map<string, string>} */
  const inAggregateOptions = new Map()
  /**@type {Map<string, string[]>} */
  const aggregateOptions = new Map()
  for (const phase of Object.values(jobConfiguration.steps)) {
    for (const step of phase || []) {
      const stepEnableOptions = stepInfo(step).enableOptions
      for (const enableOption of stepEnableOptions) {
        enableOptions.push(enableOption)
      }

      if (stepEnableOptions.length === 2) {
        const inAggregateOption = stepEnableOptions[0]
        const aggregateOption = stepEnableOptions[1]
        if (
          inAggregateOptions.has(inAggregateOption) &&
          inAggregateOptions.get(inAggregateOption) !== aggregateOption
        ) {
          throw new Error(
            `${inAggregateOption} cannot depend on both ${aggregateOption} && ${inAggregateOptions.get(
              inAggregateOption,
            )} in job ${jobId}`,
          )
        }
        inAggregateOptions.set(inAggregateOption, aggregateOption)
        aggregateOptions.set(
          aggregateOption,
          (aggregateOptions.get(aggregateOption) || []).concat(inAggregateOption),
        )
      }

      for (const parameterOption of stepInfo(step).parameterOptions) {
        parameterOptions.push(parameterOption)
      }
    }
  }

  return {
    enableOptions: [...new Set(enableOptions)],
    parameterOptions: [...new Set(parameterOptions)],
    aggregateOptions,
    inAggregateOptions,
  }
}

/**
 * @param {import('./types').Steps | undefined} steps
 * @param {string} directoryToExecuteIn
 * @param {Record<string, boolean|string|undefined>} buildOptions
 * @param {Record<string, any>} javascriptOptionsParameter
 * @returns {AsyncGenerator<import('./execute-step').StepInfo>}
 */
async function* executePhase(
  steps,
  directoryToExecuteIn,
  buildOptions,
  javascriptOptionsParameter,
) {
  for (const step of steps || []) {
    if (isStepEnabled(stepInfo(step).enableOptions, buildOptions)) {
      yield stepInfo(step)
      await executeStep(step, directoryToExecuteIn, buildOptions, javascriptOptionsParameter)
    }
  }
}

/**
 * @param {string[]} enableOptions
 * @param {Record<string, boolean|string|undefined>} buildOptions
 */
function isStepEnabled(enableOptions, buildOptions) {
  if (!enableOptions || enableOptions.length === 0) return true

  return buildOptions[enableOptions[0]] === true
}

/**
 *
 * @param {import('./types').BuildConfiguration} buildConfiguration
 * @param {string} configPath
 */
export function validateBuildConfiguration(buildConfiguration, configPath) {
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
 * @param {import('./types').Step[] | undefined} steps
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
