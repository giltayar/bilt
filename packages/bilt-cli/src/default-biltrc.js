module.exports = {
  plugins: {
    events: '@bilt/in-memory-events',
    'builder:repository': '@bilt/repo-build-job',
    'builder:npm': '@bilt/npm-build-job',
    jobDispatcher: '@bilt/in-memory-job-dispatcher',
    lastBuildInfo: '@bilt/last-build-info',
  },
}
