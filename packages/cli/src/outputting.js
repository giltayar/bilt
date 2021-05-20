import chalk from 'chalk'

const outputFunction = console.error

/**
 * @param {string} msg
 */
export function globalHeader(msg) {
  outputFunction(chalk.green(msg))
}

/**
 * @param {string} msg
 */
export function globalFooter(msg) {
  outputFunction(chalk.green(`* ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo[]} packageInfos
 */
export function globalFailureFooter(msg, packageInfos) {
  console.log('\n')
  outputFunction(
    chalk.redBright.underline(`* ${msg}:`),
    packageInfos.map((pi) => pi.directory).join(','),
  )
}

/**
 * @param {string} msg
 */
export function globalOperation(msg) {
  outputFunction(chalk.grey.underline(`** ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 * @param {number | undefined} current
 * @param {number | undefined} length
 */
export function packageHeader(msg, packageInfo, current = undefined, length = undefined) {
  const counterMessage = current && length ? `#${current}/${length}` : ''
  outputFunction(
    chalk.greenBright.underline(`**** [${packageInfo.directory}] ${msg} ${counterMessage} `),
  )
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 */
export function packageFooter(msg, packageInfo) {
  outputFunction(chalk.green(`**** [${packageInfo.directory}] ${msg}`))
}

/**
 *
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 * @param {any} _error
 */
export function packageErrorFooter(msg, packageInfo, _error) {
  console.log()
  outputFunction(chalk.red(`**** [${packageInfo.directory}] ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 */
export function packageOperation(msg, packageInfo) {
  outputFunction(chalk.grey.underline(`****** [${packageInfo.directory}] ${msg}`))
}
