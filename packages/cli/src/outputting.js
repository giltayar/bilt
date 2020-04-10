'use strict'
const chalk = require('chalk')

/**
 * @param {string} msg
 */
function globalHeader(msg) {
  console.error(chalk.green(msg))
}

/**
 * @param {string} msg
 */
function globalFooter(msg) {
  console.error(chalk.green(`* ${msg}`))
}

/**
 * @param {string} msg
 */
function globalOperation(msg) {
  console.error(chalk.green(`* ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 */
function packageHeader(msg, packageInfo) {
  console.error(chalk.greenBright.underline(`**** [${packageInfo.directory}] ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 */
function packageFooter(msg, packageInfo) {
  console.error(chalk.green(`**** [${packageInfo.directory}] ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 * @param {any} _error
 */
function packageErrorFooter(msg, packageInfo, _error) {
  console.error(chalk.redBright.underline(`**** [${packageInfo.directory}] ${msg}`))
}

/**
 * @param {string} msg
 * @param {import('@bilt/types').PackageInfo} packageInfo
 */
function packageOperation(msg, packageInfo) {
  console.error(chalk.grey.underline(`****** [${packageInfo.directory}] ${msg}`))
}

module.exports = {
  globalHeader,
  globalFooter,
  globalOperation,
  packageHeader,
  packageFooter,
  packageErrorFooter,
  packageOperation,
}
