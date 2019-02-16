module.exports = {
  plugins: {
    'builder:repository': '@bilt/repo-build-job',
    'builder:npm': '@bilt/npm-build-job',
    jobDispatcher: '@bilt/in-memory-job-dispatcher',
  },
}
