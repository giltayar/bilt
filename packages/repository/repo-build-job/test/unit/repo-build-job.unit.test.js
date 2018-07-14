'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const repoBuildJobModule = require('../..')

describe('repo-build-job', function() {
  const repoBuildJobRunner = repoBuildJobModule({plugins: [undefined, {publish: () => true}]})
  const names = artifacts => artifacts.map(a => a.name)
  const jobNames = jobs => jobs.map(j => j.artifact.name)

  it('should execute a simple job', () => {
    const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}, {name: 'c', path: 'ccc'}]
    const repoJob = {filesChangedSinceLastBuild: {}, justBuildArtifacts: names(artifacts)}

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['a', 'b', 'c'])
  })

  it('should execute only builds that have changed files', () => {
    const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}, {name: 'c', path: 'ccc'}]
    const repoJob = {
      justBuildArtifacts: names(artifacts),
      filesChangedSinceLastBuild: {
        a: {'a/foo.js': 'sha1afoo'},
        b: {},
        ccc: {'ccc/x.js': 'sha1cccx', 'ccc/z.z': 'sha1cccz'},
      },
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['a', 'c'])
  })

  it('should execute only builds that have changed files or are dependent on changed arficats', () => {
    const artifacts = [
      {name: 'a', path: 'a'},
      {name: 'b', path: 'b'},
      {name: 'c', path: 'ccc', dependencies: ['a']},
    ]
    const repoJob = {
      justBuildArtifacts: names(artifacts),
      filesChangedSinceLastBuild: {
        a: {'a/foo.js': 'sha1afoo'},
        b: {},
        ccc: {},
      },
      artifactBuildTimestamps: {c: new Date(2017, 1, 1), a: new Date(2018, 1, 1)},
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['a', 'c'])
  })

  it('should execute only builds that have changed files', () => {
    const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}, {name: 'c', path: 'ccc'}]
    const repoJob = {
      justBuildArtifacts: names(artifacts),
      filesChangedSinceLastBuild: {
        a: {'a/foo.js': 'sha1afoo'},
        b: {},
        ccc: {'ccc/x.js': 'sha1cccx', 'ccc/z.z': 'sha1cccz'},
      },
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['a', 'c'])
  })

  it('should ignore changed files if "force" is on', () => {
    const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}, {name: 'c', path: 'ccc'}]
    const repoJob = {
      justBuildArtifacts: names(artifacts),
      force: true,
      filesChangedSinceLastBuild: {
        a: {'a/foo.js': 'sha1afoo'},
        b: {},
        ccc: {'ccc/x.js': 'sha1cccx', 'ccc/z.z': 'sha1cccz'},
      },
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['a', 'c'])
  })

  it('should execute builds based on dependency order', () => {
    const artifacts = [
      {name: 'b', path: 'b', dependencies: ['c']},
      {name: 'c', path: 'ccc', dependencies: ['d', 'd2']},
      {name: 'd', path: 'd', dependencies: ['a']},
      {name: 'd2', path: 'd2', dependencies: []},
      {name: 'a', path: 'a'},
    ]
    const repoJob = {
      justBuildArtifacts: names(artifacts),
      filesChangedSinceLastBuild: {},
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['d2', 'a', 'd', 'c', 'b'])
  })

  it('should execute builds based on dependency order, even if they all have dependencies (even to non-existant stuff)', () => {
    const artifacts = [
      {name: 'b', path: 'b', dependencies: ['c']},
      {name: 'c', path: 'ccc', dependencies: ['d', 'd2']},
      {name: 'd', path: 'd', dependencies: ['a']},
      {name: 'd2', path: 'd2', dependencies: ['x']},
      {name: 'a', path: 'a', dependencies: ['x']},
    ]
    const repoJob = {
      justBuildArtifacts: names(artifacts),
      filesChangedSinceLastBuild: {},
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['d2', 'a', 'd', 'c', 'b'])
  })

  it('should execute only builds in justBuildArtifacts', () => {
    const artifacts = [
      {name: 'b', path: 'b', dependencies: ['c']},
      {name: 'c', path: 'ccc', dependencies: ['d', 'd2']},
      {name: 'd', path: 'd', dependencies: ['a']},
      {name: 'd2', path: 'd2', dependencies: []},
      {name: 'a', path: 'a'},
    ]
    const repoJob = {
      justBuildArtifacts: ['a', 'c', 'd2'],
      filesChangedSinceLastBuild: {},
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['a', 'd2', 'c'])
  })

  it('should execute only uptoArtifacts builds as expected', () => {
    const artifacts = [
      {name: 'b', path: 'b', dependencies: ['c']},
      {name: 'c', path: 'ccc', dependencies: ['d', 'd2']},
      {name: 'd', path: 'd', dependencies: ['a']},
      {name: 'd2', path: 'd2', dependencies: []},
      {name: 'a', path: 'a'},
    ]
    const repoJob = {
      uptoArtifacts: ['c'],
      filesChangedSinceLastBuild: {},
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['d2', 'a', 'd', 'c'])
  })

  it('should execute only fromArtifacts builds as expected', () => {
    const artifacts = [
      {name: 'b', path: 'b', dependencies: ['c']},
      {name: 'c', path: 'ccc', dependencies: ['d', 'd2']},
      {name: 'd', path: 'd', dependencies: ['a']},
      {name: 'd2', path: 'd2', dependencies: []},
      {name: 'a', path: 'a'},
    ]
    const repoJob = {
      fromArtifacts: ['d2'],
      filesChangedSinceLastBuild: {},
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['d2', 'c', 'b'])
  })

  it('should execute builds based on dependency order', () => {
    const artifacts = [
      {name: 'b', path: 'b', dependencies: ['c']},
      {name: 'c', path: 'ccc', dependencies: ['d', 'd2']},
      {name: 'd', path: 'd', dependencies: ['a']},
      {name: 'd2', path: 'd2', dependencies: []},
      {name: 'a', path: 'a'},
    ]
    const repoJob = {
      justBuildArtifacts: names(artifacts),
      filesChangedSinceLastBuild: {},
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['d2', 'a', 'd', 'c', 'b'])
  })

  it('should not execute jobs that are dependent on a failed job', () => {
    const artifacts = [
      {name: 'b', path: 'b', dependencies: ['c']},
      {name: 'c', path: 'ccc', dependencies: ['d', 'd2']},
      {name: 'd', path: 'd', dependencies: ['a'], failBuild: true},
      {name: 'd2', path: 'd2', dependencies: []},
      {name: 'a', path: 'a'},
    ]
    const repoJob = {
      justBuildArtifacts: names(artifacts),
      filesChangedSinceLastBuild: {},
    }

    const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

    expect(jobNames(jobsThatRan)).to.eql(['d2', 'a', 'd'])
  })
})

function runRepoJob(artifacts, repoJob, repoBuildJobRunner) {
  let jobResult = repoBuildJobRunner.getBuildSteps({
    buildContext: {initialAllArtifacts: artifacts, ...repoJob},
  })
  const jobsList = [...((jobResult.jobs || []).map(j => j.job) || [])]
  const jobsToDo = (jobResult.jobs || []).map(j => j.job) || []

  while (jobResult.jobs && jobResult.jobs.length > 0) {
    expect(jobResult.jobs.every(j => j.awaken))
    const doneJob = jobsToDo.pop()

    jobResult = repoBuildJobRunner.getBuildSteps({
      buildContext: {
        state: jobResult.state,
        initialAllArtifacts: undefined,
        awakenedFrom: {
          job: doneJob,
          result: {success: !artifacts.find(a => a.name === doneJob.artifact.name).failBuild},
        },
      },
      job: repoJob,
    })
    jobsList.push(...(jobResult.jobs || []).map(j => j.job))
    if (jobResult.jobs)
      expect(jobsToDo.map(j => j.job.artifact.name)).to.not.have.members(
        (jobResult.jobs || []).map(j => j.job.artifact.name),
      )
    jobsToDo.push(...(jobResult.jobs || []).map(j => j.job))
  }
  expect(jobsToDo).to.have.length(0)

  return jobsList
}
