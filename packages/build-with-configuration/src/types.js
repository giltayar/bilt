'use strict'

/**@typedef {{
 * jobs: Jobs
 * }} BuildConfiguration
 */

/**@typedef {{
 * [jobId: string]: Job
 * }} Jobs
 */

/**@typedef {{
 * steps: {
 * before?: Steps
 * after?: Steps
 * during?: Steps
 * }
 * }} Job
 */

/**@typedef {Step[]} Steps */

/**@typedef {{
 * name: string
 * run: string
 * condition?: string
 * env?: EnvVars
 * enableOption?: string|string[]
 * parameterOption?: string|string[]
 * }} Step
 */

/**@typedef {{
 * [varName: string]: boolean|number|string
 * }} EnvVars
 */

module.exports = 'this module contains only type definitions'
