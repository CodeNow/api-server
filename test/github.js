var users = require('./lib/userFactory');
var helpers = require('./lib/helpers');
var extendContext = helpers.extendContext;
var extendContextSeries = helpers.extendContextSeries;
require('./lib/fixtures/harbourmaster');

describe('Files', function () {
  after(helpers.cleanup);

  describe('POST /runnables/import/github', function () {
    beforeEach(extendContextSeries({
      user: users.createRegistered
    }));
    afterEach(helpers.cleanupExcept('image'));
    it('should create an image from github', function (done) {
      this.user.specRequest({
        githubUrl: 'https://github.com/tardate/jtab',
        stack: 'web'
      })
      .expect(201)
      .end(done);
    });
  });
});