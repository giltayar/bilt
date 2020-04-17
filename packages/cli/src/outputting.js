'use strict'
const chalk = require('chalk')

const outputFunction = console.error

/**
 * @param {string} msg
 */
function globalHeader(msg) {
  outputFunction(chalk.green(msg))
}

/**
 * @param {string} msg
 */
function globalFooter(msg) {
  outputFunction(chalk.green(`* ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo[]} packageInfos
 */
function globalFailureFooter(msg, packageInfos) {
  console.log('\n')
  outputFunction(
    chalk.redBright.underline(`* ${msg}:`),
    packageInfos.map((pi) => pi.directory).join(','),
  )
}

/**
 * @param {string} msg
 */
function globalOperation(msg) {
  outputFunction(chalk.grey.underline(`** ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 */
function packageHeader(msg, packageInfo) {
  outputFunction(chalk.greenBright.underline(`**** [${packageInfo.directory}] ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 */
function packageFooter(msg, packageInfo) {
  outputFunction(chalk.green(`**** [${packageInfo.directory}] ${msg}`))
}

/**
 *
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 * @param {any} _error
 */
function packageErrorFooter(msg, packageInfo, _error) {
  console.log()
  outputFunction(chalk.red(`**** [${packageInfo.directory}] ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 */
function packageOperation(msg, packageInfo) {
  outputFunction(chalk.grey.underline(`****** [${packageInfo.directory}] ${msg}`))
}

module.exports = {
  globalHeader,
  globalFooter,
  globalFailureFooter,
  globalOperation,
  packageHeader,
  packageFooter,
  packageErrorFooter,
  packageOperation,
}
