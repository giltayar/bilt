module.exports = {
  plugins: {
    jobDispatcher: '@bilt/in-memory-job-dispatcher',
    events: '@bilt/in-memory-events',
    jobState: '@bilt/in-memory-job-state',
    'builder:repository': {package: '@bilt/repo-build-job'},
    lastBuildInfo: '@bilt/last-build-info',
    'builder:npm': {
      package: '@bilt/npm-build-job',
    },
    'builder:docker': {package: '@bilt/docker-build-job'},
    vcs: '@bilt/git-vcs',
    repositoryFetcher: '@bilt/noop-repository-fetcher',
    'commander:npm': '@bilt/npm-commander',
    'commander:git': '@bilt/git-commander',
  },
}
