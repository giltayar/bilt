'use strict'
const {executeStep, stepInfo, validateStep} = require('./execute-step')
const {arrayify} = require('./arrayify')

/**
 * @param {object} buildConfiguration
 * @param {string} job
 * @param {'before'|'during'|'after'} phase
 * @param {string} phaseDirectory
 * @returns {Promise<void>}
 */
async function executeJob(buildConfiguration, job, phase, phaseDirectory, buildOptions) {
  const jobConfiguration = buildConfiguration.jobs[job]

  if (phase === 'before' && jobConfiguration[phase]) {
    await executePhase(buildConfiguration, jobConfiguration[phase], phaseDirectory, buildOptions)
  }
  if (phase === 'after' && jobConfiguration[phase]) {
    await executePhase(buildConfiguration, jobConfiguration[phase], phaseDirectory, buildOptions)
  }
  if (phase === 'during' && jobConfiguration[phase]) {
    await executePhase(buildConfiguration, jobConfiguration[phase], phaseDirectory, buildOptions)
  }
}

/**
 *
 * @returns {{enableOptions: string[], parameterOptions: string[]}}
 */
function jobInfo(buildConfiguration, job) {
  const jobConfiguration = buildConfiguration.jobs[job]
  const steps = buildConfiguration.steps

  const enableOptions = []
  const parameterOptions = []
  for (const stepsConfigurationName of jobConfiguration) {
    const stepsConfigurations = steps[stepsConfigurationName]

    for (const stepConfiguration of stepsConfigurations) {
      for (const enableOption of arrayify(stepInfo(stepConfiguration).enableOptions)) {
        enableOptions.push(enableOption)
      }

      for (const parameterOption of arrayify(stepInfo(stepConfiguration).parameterOptions)) {
        enableOptions.push(parameterOption)
      }
    }
  }

  return {enableOptions, parameterOptions}
}

/**
 * @param {any} buildConfiguration
 * @param {string} phaseStepsName
 * @param {string} phaseDirectory
 */
async function* executePhase(buildConfiguration, phaseStepsName, phaseDirectory, buildOptions) {
  const steps = buildConfiguration.steps

  const phaseSteps = steps[phaseStepsName]

  if (!phaseSteps) {
    throw new Error(`could not find steps for "${phaseStepsName}" in build configuration`)
  }

  if (!Array.isArray(phaseSteps)) {
    throw new Error(`"${phaseStepsName}" in build configuration MUST be an array of steps`)
  }

  for (const step of phaseSteps) {
    if (stepInfo(step).enableOptions) yield await executeStep(step, phaseDirectory, buildOptions)
  }
}

function validateBuildConfiguration(buildConfiguration, configPath) {
  const steps = buildConfiguration.steps
  if (!steps) {
    throw new Error(`could not find "steps" section in build configuration`)
  }
  if (typeof steps !== 'object') {
    throw new Error(`"steps" must be an object, and isnt in build configuration ${configPath}`)
  }

  const jobs = buildConfiguration.jobs
  if (!jobs) {
    throw new Error(`could not find "jobs" section in build configuration ${configPath}`)
  }

  if (!Array.isArray(jobs)) {
    throw new Error(`"jobs" must be an array, and isnt in build configuration ${configPath}`)
  }

  for (const job of jobs) {
    const jobConfiguration = jobs[job]

    if (!jobConfiguration) {
      throw new Error(`could not find job ${job} in build configuration ${configPath}`)
    }
    if (typeof jobConfiguration !== 'object') {
      throw new Error(
        `The job ${job} must be an object, and isnt in build configuration ${configPath}`,
      )
    }

    validateStepsConfiguration(buildConfiguration, jobConfiguration.before, configPath)
    validateStepsConfiguration(buildConfiguration, jobConfiguration.during, configPath)
    validateStepsConfiguration(buildConfiguration, jobConfiguration.during, configPath)
  }
}

function validateStepsConfiguration(buildConfiguration, stepsConfigurationName, configPath) {
  const steps = buildConfiguration.steps

  const stepsConfiguration = steps[stepsConfigurationName]

  if (!stepsConfiguration) {
    throw new Error(
      `could not find step ${stepsConfiguration} in build configuration ${configPath}`,
    )
  }
  if (!Array.isArray(stepsConfiguration)) {
    throw new Error(
      `The step ${stepsConfigurationName} must be an array, and isnt in build configuration ${configPath}`,
    )
  }

  let i = 0
  for (const stepConfiguration of steps) {
    validateStep(stepConfiguration, ++i, stepsConfigurationName, configPath)
  }
}

module.exports = {
  executeJob,
  validateBuildConfiguration,
  jobInfo,
}
