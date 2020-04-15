'use strict'
const {compileFunction} = require('vm')
const camelcase = require('camelcase')
const {sh} = require('@bilt/scripting-commons')
const {arrayify} = require('./arrayify')
/**
 *
 * @returns {{
 *  name: string
 * enableOptions: string[]
 * parameterOptions: string[]
 * }}
 */
function stepInfo(stepConfiguration) {
  return {
    name: stepConfiguration.name,
    enableOptions: arrayify(stepConfiguration.enableOption),
    parameterOptions: arrayify(stepConfiguration.parameterOption),
  }
}

async function executeStep(stepConfiguration, cwd, buildOptions) {
  const name = stepConfiguration.name
  const runCommand = stepConfiguration.run
  const runCondition = stepConfiguration.condition
  const runEnv = stepConfiguration.env

  if (await executeCondition(runCondition, cwd)) {
    await executeCommand(name, runCommand, runEnv, cwd, buildOptions)
  }
}

async function executeCondition(condition, cwd) {
  if (!condition) {
    return true
  }
  return await executeFunction(condition, {directory: cwd})
}

async function executeCommand(name, command, env, cwd, buildOptions) {
  if (!command) throw new Error(`Step ${name} must have a command`)

  const envVars = envVarsFromBuildOptions(buildOptions)
  if (env) {
    if (typeof env !== 'object')
      throw new Error(`Step ${name} has an "env", but it is not an object`)

    for (const [envVar, value] of Object.entries(env)) {
      envVars[envVar] = await executeFunction(value, {directory: cwd})
    }
  }

  await sh(command, {env: envVars, cwd})
}

async function executeFunction(functionAsText, optionsParameter) {
  return await compileFunction(`
    return (${functionAsText})(options)
  `)(optionsParameter)
}

function envVarsFromBuildOptions(buildOptions) {
  const ret = {}

  for (const [option, value] of Object.entries(buildOptions)) {
    if (value !== false) {
      ret[`BILT_OPTION_${camelcase(option).toUpperCase()}`] = value.toString()
    }
  }

  return ret
}

function validateStep(step, i, stepsConfigurationName, configPath) {
  if (typeof step !== 'object') {
    throw new Error(
      `Step #${i} of steps ${stepsConfigurationName} must be an object but isnt in ${configPath}`,
    )
  }

  if (typeof step.run !== 'string') {
    throw new Error(
      `"run" property of step #${i} of steps ${stepsConfigurationName} is required and must be a string in ${configPath}`,
    )
  }

  if (typeof step.name !== 'string') {
    throw new Error(
      `"name" property of step #${i} of steps ${stepsConfigurationName} is required and must be a string in ${configPath}`,
    )
  }

  if (step.condition != null && typeof step.condition !== 'string') {
    throw new Error(
      `"name" property of step #${i} of steps ${stepsConfigurationName} must to be a string in ${configPath}`,
    )
  }

  if (step.env != null && typeof step.env !== 'string') {
    throw new Error(
      `"env" property of step #${i} of steps ${stepsConfigurationName} must to be an object in ${configPath}`,
    )
  }

  if (
    step.enableOption != null &&
    typeof step.enableOption !== 'string' &&
    !Array.isArray(step.enableOption) &&
    !step.enableOption.every((p) => typeof p === 'string')
  ) {
    throw new Error(
      `"enableOption" property of step #${i} of steps ${stepsConfigurationName} must be a string or an array of strings in ${configPath}`,
    )
  }

  if (
    step.parameterOption != null &&
    typeof step.parameterOption !== 'string' &&
    !Array.isArray(step.parameterOption) &&
    !step.parameterOption.every((p) => typeof p === 'string')
  ) {
    throw new Error(
      `"parameterOption" property of step #${i} of steps ${stepsConfigurationName} must be a string or an array of strings in ${configPath}`,
    )
  }
}

module.exports = {
  executeStep,
  stepInfo,
  validateStep,
}
