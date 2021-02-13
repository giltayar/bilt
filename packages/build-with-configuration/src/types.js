/**
 * @typedef {{
 * jobs: Jobs
 * }} BuildConfiguration
 */

/**
 * @typedef {Record<string, Job>} Jobs
 */

/**
 * @typedef {{
 * steps: {
 *  before?: Steps
 *  after?: Steps
 *  during?: Steps
 * }
 * }} Job
 */

/**@typedef {Step[]} Steps */

/**
 * @typedef {{
 *  name: string
 *  enableOption?: string|string[]
 *  parameterOption?: string|string[]
 *  run: string
 *  condition?: BooleanValueOrFunctionText
 *  env?: EnvVars
 * }} Step
 */

/**
 * @typedef {{
 *  [varName: string]: StringValueOrFunctionText
 * }} EnvVars
 */

/**@typedef {string|{function: string}} StringValueOrFunctionText */
/**@typedef {boolean|{function: string}} BooleanValueOrFunctionText */

export {}
