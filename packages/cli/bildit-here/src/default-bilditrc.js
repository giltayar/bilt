module.exports = {
  plugins: {
    jobDispatcher: '@bildit/leveldb-job-dispatcher',
    events: '@bildit/in-memory-events',
    'agent:npm': '@bildit/host-agent',
    'agent:docker': '@bildit/host-agent',
    'agent:repository': '@bildit/host-agent',
    jobState: '@bildit/in-memory-job-state',
    'builder:repository': {package: '@bildit/repo-build-job'},
    'builder:npm': {
      package: '@bildit/npm-build-job',
    },
    'builder:docker': {package: '@bildit/docker-build-job'},
    'binaryRunner:npm': '@bildit/npm-binary-runner',
    vcs: '@bildit/git-vcs',
    repositoryFetcher: '@bildit/noop-repository-fetcher',
    'commander:npm': '@bildit/npm-commander',
    'commander:git': '@bildit/git-commander',
  },
}
