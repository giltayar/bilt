/* globals cy, before, after, describe, it */
/// <reference types="cypress" />

describe('visual test', function() {
  before(() =>
    cy.eyesOpen({
      batchName: 'Bilt',
      appName: 'Bilt',
      testName: 'Bilt',
      browser: [
        { width: 1200, height: 768, name: 'chrome' },
        { width: 1200, height: 768, name: 'firefox' },
        { deviceName: 'iPhone X' },
      ],
    })
  );

  after(() => cy.eyesClose());

  ['/', '/introduction', '/codeblock'].forEach(page =>
    it(`should test ${page} page`, () => {
      cy.visit(`http://localhost:9000${page}`);

      cy.eyesCheckWindow({
        ignore: [{ selector: '.githubBtn' }],
      });
    })
  );
});
