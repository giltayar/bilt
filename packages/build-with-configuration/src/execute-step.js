'use strict'
const vm = require('vm')
const {constantCase} = require('constant-case')
const {sh} = require('@bilt/scripting-commons')
const {arrayify} = require('./arrayify')

/**
 * @typedef {{
    name: string;
    enableOptions: string[];
    parameterOptions: string[];
}} StepInfo
 */

/**
 * @param {import('./types').Step} step
 * @returns {StepInfo}
 */
function stepInfo(step) {
  return {
    name: step.name,
    enableOptions: arrayify(step.enableOption),
    parameterOptions: arrayify(step.parameterOption),
  }
}

/**
 * @param {import('./types').Step} step
 * @param {string} cwd
 * @param {{[x: string]: boolean|string}} buildOptions
 * @param {{[x: string]: any}} javascriptOptionsParameter
 * @returns {Promise<void>}
 */
async function executeStep(step, cwd, buildOptions, javascriptOptionsParameter) {
  const name = step.name
  const runCommand = step.run
  const runCondition = step.condition
  const runEnv = step.env

  if (await executeCondition(runCondition, javascriptOptionsParameter)) {
    await executeCommand(name, runCommand, runEnv, cwd, buildOptions, javascriptOptionsParameter)
  }
}

/**
 * @param {import('./types').BooleanValueOrFunctionText} condition
 * @param {{[x: string]: any}} javascriptOptionsParameter
 * @returns {Promise<boolean>}
 */
async function executeCondition(condition, javascriptOptionsParameter) {
  if (!condition) {
    return true
  }
  return await executeFunction(condition, javascriptOptionsParameter)
}

/**
 * @param {string} name
 * @param {string} command
 * @param {import('./types').EnvVars} env
 * @param {string} cwd
 * @param {{[x: string]: any}} javascriptOptionsParameter
 * @param {any} buildOptions
 */
async function executeCommand(name, command, env, cwd, buildOptions, javascriptOptionsParameter) {
  if (!command) throw new Error(`Step ${name} must have a command`)

  const envVars = envVarsFromBuildOptions(buildOptions)
  if (env) {
    if (typeof env !== 'object')
      throw new Error(`Step ${name} has an "env", but it is not an object`)

    for (const [envVar, value] of Object.entries(env)) {
      envVars[envVar] = await executeFunction(value, javascriptOptionsParameter)
    }
  }

  await sh(command, {env: {...process.env, ...envVars}, cwd})
}

const contextWithRequire = vm.createContext({require})

/**
 * @param {any|{function: string}} functionAsText
 * @param {{[x: string]: any}} javascriptOptionsParameter
 */
async function executeFunction(functionAsText, javascriptOptionsParameter) {
  if (typeof functionAsText === 'object')
    return await vm.compileFunction(
      `
    return (${functionAsText.function})(options)
  `,
      ['options'],
      {parsingContext: contextWithRequire},
    )(javascriptOptionsParameter)

  return functionAsText
}

/**
 * @param {{ [s: string]: any; } | ArrayLike<any>} buildOptions
 */
function envVarsFromBuildOptions(buildOptions) {
  const ret = {}

  for (const [option, value] of Object.entries(buildOptions)) {
    if (value !== false) {
      ret[`BILT_OPTION_${constantCase(option)}`] = value.toString()
    }
  }

  return ret
}

function validateStep(step, i, phaseName, jobId, configPath) {
  if (typeof step !== 'object') {
    throw new Error(
      `Step #${i} in phase ${phaseName} of job ${jobId} must be an object but isnt in ${configPath}`,
    )
  }

  if (typeof step.run !== 'string') {
    throw new Error(
      `"run" property of step #${i} in phase ${phaseName} of job ${jobId} is required and must be a string in ${configPath}`,
    )
  }

  if (typeof step.name !== 'string') {
    throw new Error(
      `"name" property of step #${i} in phase ${phaseName} of job ${jobId} is required and must be a string in ${configPath}`,
    )
  }

  if (
    step.condition != null &&
    typeof step.condition !== 'string' &&
    (typeof step.condition !== 'object' || typeof step.condition.function !== 'string')
  ) {
    throw new Error(
      `"condition" property of step #${i} in phase ${phaseName} of job ${jobId} must to be a boolean or a function text in ${configPath}`,
    )
  }

  if (step.env != null && typeof step.env !== 'object') {
    throw new Error(
      `"env" property of step #${i} in phase ${phaseName} of job ${jobId} must to be an object in ${configPath}`,
    )
  }
  for (const [envVar, value] of Object.entries(step.env || {})) {
    if (typeof envVar !== 'string') {
      throw new Error(
        `"env" name ${envVar} of step #${i} in phase ${phaseName} of job ${jobId} must be a string in ${configPath}`,
      )
    }
    if (
      typeof value !== 'string' &&
      (typeof value !== 'object' || typeof value.function !== 'string')
    ) {
      throw new Error(
        `"env" value ${envVar} of step #${i} in phase ${phaseName} of job ${jobId} must be a string or a function text in ${configPath}`,
      )
    }
  }

  if (
    step.enableOption != null &&
    typeof step.enableOption !== 'string' &&
    !Array.isArray(step.enableOption) &&
    !step.enableOption.every((p) => typeof p === 'string')
  ) {
    throw new Error(
      `"enableOption" property of step #${i} in phase ${phaseName} of job ${jobId} must be a string or an array of strings in ${configPath}`,
    )
  }

  if (
    step.parameterOption != null &&
    typeof step.parameterOption !== 'string' &&
    !Array.isArray(step.parameterOption) &&
    !step.parameterOption.every((p) => typeof p === 'string')
  ) {
    throw new Error(
      `"parameterOption" property of step #${i} in phase ${phaseName} of job ${jobId} must be a string or an array of strings in ${configPath}`,
    )
  }
}

module.exports = {
  executeStep,
  stepInfo,
  validateStep,
}
