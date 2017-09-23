'use strict'
const path = require('path')

module.exports = ({appConfig: directory}) => {
  return {
    fetchRepository({subdir}) {
      return {directory: subdir ? path.join(directory, subdir) : directory}
    },
  }
}
