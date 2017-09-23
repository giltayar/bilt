'use strict'

module.exports = function(repository) {
  return repository.replace(/[^a-zA-Z0-9\-]+/g, '_')
}
