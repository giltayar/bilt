//@flow
'use strict';
const Promise = require('bluebird');
const {describe, it} = require('mocha');
const {expect} = require('chai');
const child_process = require('child_process');
const fs = require('fs');
Promise.promisifyAll(fs);
const path = require('path');
const yaml = require('js-yaml');
const thisModule = require('..');

describe('e2e test on a real folder', function() {
  const expectedArtifactRcYml = [
      {artifact: 'docker-artifactrc-alt', path: 'docker-artifactrc-artifact', type: 'docker-npm', 
        dependencies: ['docker-artifact'], owners: []},
      {artifact: 'docker-npm-artifact-name', path: 'docker-npm-artifact', type: 'docker-npm', 
        dependencies: ['npm-artifact-name'], owners: []},
      {artifact: 'docker-artifact', path: 'main/docker-artifact', type: 'docker-npm', 
        dependencies: [], owners: []},
      {artifact: 'npm-artifact-name', path: 'main/npm-artifact', type: 'npm', 
        dependencies: ['docker-artifact'], owners: []}
  ];

  it('should generate a file with the correct artifacts', Promise.coroutine(function*() {
    yield deleteIfExists('/tmp/foo.yml');
    yield thisModule(path.resolve(__dirname, 'e2e-test-dir', 'artifactsrc.yml'), '/tmp/foo.yml')

    //$FlowFixMe
    const newYml = yield fs.readFileAsync('/tmp/foo.yml');

    expect(yaml.safeLoad(newYml)).to.deep.equal(expectedArtifactRcYml);
  }));

  it('cli should generate a file with the correct artifacts', Promise.coroutine(function*() {
    yield deleteIfExists('/tmp/foo.yml');
    child_process.execSync(`node . ${path.resolve(__dirname, 'e2e-test-dir', 'artifactsrc.yml')} /tmp/foo.yml`);

    //$FlowFixMe
    const newYml = yield fs.readFileAsync('/tmp/foo.yml');

    expect(yaml.safeLoad(newYml)).to.deep.equal(expectedArtifactRcYml);
  }));
})

const deleteIfExists = Promise.coroutine(function*(filename) {
    try {
      //$FlowFixMe
      yield fs.unlinkAsync('/tmp/foo.yml')
    } catch (e) {
      if (e.code == 'ENOENT')
        return;
      throw e;
    }
});
