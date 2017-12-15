module.exports = {
  plugins: {
    jobDispatcher: '@bilt/leveldb-job-dispatcher',
    events: '@bilt/in-memory-events',
    'agent:npm': '@bilt/host-agent',
    'agent:docker': '@bilt/host-agent',
    'agent:repository': '@bilt/host-agent',
    jobState: '@bilt/in-memory-job-state',
    'builder:repository': {package: '@bilt/repo-build-job'},
    'builder:npm': {
      package: '@bilt/npm-build-job',
    },
    'builder:docker': {package: '@bilt/docker-build-job'},
    'binaryRunner:npm': '@bilt/npm-binary-runner',
    vcs: '@bilt/git-vcs',
    repositoryFetcher: '@bilt/noop-repository-fetcher',
    'commander:npm': '@bilt/npm-commander',
    'commander:git': '@bilt/git-commander',
  },
}
