'use strict'
const path = require('path')

module.exports = ({appConfig: {directory}}) => {
  return {
    fetchRepository({subdirectory}) {
      return {directory: subdirectory ? path.join(directory, subdirectory) : directory}
    },
  }
}
