import module from 'module'
import {createContext, compileFunction} from 'vm'
import {constantCase} from 'constant-case'
import {sh} from '@bilt/scripting-commons'
import {arrayify} from './arrayify.js'

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
export function stepInfo(step) {
  return {
    name: step.name,
    enableOptions: arrayify(step.enableOption),
    parameterOptions: arrayify(step.parameterOption),
  }
}

/**
 * @param {import('./types').Step} step
 * @param {string} cwd
 * @param {Record<string, boolean|string|undefined>} buildOptions
 * @param {Record<string, any>} javascriptOptionsParameter
 * @returns {Promise<void>}
 */
export async function executeStep(step, cwd, buildOptions, javascriptOptionsParameter) {
  const name = step.name
  const runCommand = step.run
  const runCondition = step.condition
  const runEnv = step.env

  if (await executeCondition(runCondition, javascriptOptionsParameter)) {
    await executeCommand(name, runCommand, runEnv, cwd, buildOptions, javascriptOptionsParameter)
  }
}

/**
 * @param {import('./types').BooleanValueOrFunctionText | undefined} condition
 * @param {{[x: string]: any}} javascriptOptionsParameter
 * @returns {Promise<boolean>}
 */
export async function executeCondition(condition, javascriptOptionsParameter) {
  if (condition == null) {
    return true
  }
  return await executeFunction(condition, javascriptOptionsParameter)
}

/**
 * @param {string} name
 * @param {string} command
 * @param {import('./types').EnvVars | undefined} env
 * @param {string} cwd
 * @param {{[x: string]: any}} javascriptOptionsParameter
 * @param {any} buildOptions
 */
export async function executeCommand(
  name,
  command,
  env,
  cwd,
  buildOptions,
  javascriptOptionsParameter,
) {
  if (!command) throw new Error(`Step ${name} must have a command`)

  const envVars = envVarsFromBuildOptions(buildOptions)
  if (env) {
    if (typeof env !== 'object')
      throw new Error(`Step ${name} has an "env", but it is not an object`)

    for (const [envVar, value] of Object.entries(env)) {
      envVars[envVar] = String(await executeFunction(value, javascriptOptionsParameter))
    }
  }

  await sh(command, {env: {...process.env, ...envVars}, cwd})
}

const contextWithRequire = createContext({require: module.createRequire(import.meta.url), console})

/**
 * @param {any|{function: string}} functionAsText
 * @param {{[x: string]: any}} javascriptOptionsParameter
 */
async function executeFunction(functionAsText, javascriptOptionsParameter) {
  if (typeof functionAsText === 'object')
    return await compileFunction(
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
 * @returns {Record<string, string>}
 */
function envVarsFromBuildOptions(buildOptions) {
  /**@type {Record<string, string>} */
  const ret = {}

  for (const [option, value] of Object.entries(buildOptions)) {
    if (value !== false && value != null) {
      ret[`BILT_OPTION_${constantCase(option)}`] = value.toString()
    }
  }

  return ret
}

/**
 * @param {import('./types').Step} step
 * @param {number} i
 * @param {string} phaseName
 * @param {string} jobId
 * @param {string} configPath
 */
export function validateStep(step, i, phaseName, jobId, configPath) {
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
    typeof step.condition !== 'boolean' &&
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
    !Array.isArray(step.enableOption)
  ) {
    throw new Error(
      `"enableOption" property of step #${i} in phase ${phaseName} of job ${jobId} must be a string or an array of strings in ${configPath}`,
    )
  }

  if (
    step.enableOption !== null &&
    Array.isArray(step.enableOption) &&
    step.enableOption.length > 2
  ) {
    throw new Error(
      `"enableOption" property of step #${i} in phase ${phaseName} of job ${jobId} must be a string or an array of strings of length <=2 in ${configPath}`,
    )
  }

  if (
    step.parameterOption != null &&
    typeof step.parameterOption !== 'string' &&
    !Array.isArray(step.parameterOption)
  ) {
    throw new Error(
      `"parameterOption" property of step #${i} in phase ${phaseName} of job ${jobId} must be a string or an array of strings in ${configPath}`,
    )
  }
}
