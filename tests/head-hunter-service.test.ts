import { expect } from 'chai';
import { describe, it } from 'mocha';
import { HeadHunterService } from '@/head-hunter-service';
import sinon, { SinonStub } from 'sinon';
import axios from 'axios';

describe('HeadHunterService Class', () => {
  let service: HeadHunterService;
  let axiosStub: SinonStub;
  const fakeData = { data: "fake" };
  const okResponse = { status: 200, data: fakeData, headers: {}, config: {} };
  const errorResponse = { status: 403, data: fakeData, headers: {}, config: {} };

  beforeEach(() => {
    service = new HeadHunterService({
      input: () => Promise.resolve('test'),
      confirm: () => Promise.resolve(true),
    });

    // Stub the axios request to return a response when called
    axiosStub = sinon.stub(axios, 'request');
  });

  afterEach(() => {
    // Restores axios.request to its original state
    axiosStub.restore();
  });

  describe('HeadHunterService.login()', () => {
    it('correctly authenticates a user', async () => {
      axiosStub.onFirstCall().resolves(okResponse);
      axiosStub.onSecondCall().resolves(okResponse);
      const response = await service.login({ username: 'test', password: 'test' });

      expect(response).to.equal(true);
    });

    it('throws an error when there is an issue with authentication', async () => {
      axiosStub.onFirstCall().resolves(okResponse);
      axiosStub.onSecondCall().rejects({ response: errorResponse });

      try {
        await service.login({ username: 'test', password: 'test' })
      } catch (error) {
        expect(error.response.status).to.equal(403);
      }
    });
  });

  describe('HeadHunterService.getResumes()', () => {
    it('should fetch resumes correctly', async () => {
      const resumeResponse = { status: 200, headers: {}, config: {}, data: 'HTML_STRING' };

      axiosStub.onFirstCall().resolves(resumeResponse);

      const response = await service.getResumes();

      expect(response).to.not.equal([]);
    });
  });

  describe('HeadHunterService.raiseResume()', () => {
    it('should return correct status on successful resume raise', async () => {
      axiosStub.onFirstCall().resolves(okResponse);

      const response = await service.raiseResume({ id: 'test', name: 'test' });

      expect(response).to.equal(true);
    });

    it('should throw an error when there is an issue with raising the resume', async () => {
      axiosStub.onFirstCall().rejects({ response: errorResponse });

      try {
        await service.raiseResume({ id: 'test', name: 'test' });
      } catch (error) {
        expect(error.response.status).to.equal(403);
      }
    });
  });
});
