import axios, { AxiosRequestConfig, Method } from 'axios';
import { faker } from '@faker-js/faker';
import cheerio from 'cheerio';
import { Logger } from '@/infra/logger';

type InputControl = (data: { message: string }) => Promise<string>;
type ConformControl = (data: { message: string }) => Promise<boolean>;

/**
 * Represents a HeadHunter service for managing job applications and resumes.
 */
export class HeadHunterService {
  private xsrf: string | null = null;
  private hhToken: string | null = null;
  private static BASE_URL = 'https://hh.ru';
  private readonly userAgent: string;
  private readonly controls: { input: InputControl; confirm: ConformControl };

  constructor(controls: { input: InputControl; confirm: ConformControl }) {
    this.userAgent = faker.internet.userAgent();
    this.controls = controls;
  }

  private async request(
    method: Method,
    url: string,
    headers: Record<string, string>,
    data?: any,
  ) {
    const req: AxiosRequestConfig = {
      method,
      url,
      headers,
      data,
    };
    try {
      return await axios.request(req);
    } catch (error) {
      if (error.response.status === 302) {
        const { url } = error.response.data;
        Logger.info(`${HeadHunterService.BASE_URL}${url}`);
        await this.controls.confirm({ message: `🤖 Captcha solved?` });
        return error.response;
      } else if (error.response.status === 409) {
        return error.response;
      } else {
        Logger.error(
          `Request failed: ${method} ${url} with code ${error.response.status}`,
        );
        throw error;
      }
    }
  }

  private async getCookieAnonymous(): Promise<void> {
    const url = HeadHunterService.BASE_URL;
    const response = await this.request('head', url, {
      'User-Agent': this.userAgent,
    });

    this.updateCookiesFromResponse(response);
  }

  private extractCookie(cookies: string[], name: string): string | null {
    return (
      cookies
        ?.find((cookie) => cookie.startsWith(`${name}=`))
        ?.split(';')[0]
        .split('=')[1] ?? null
    );
  }

  private async getRequestData(data?: any) {
    const formData: any = this.appendFormData(data);
    const headers = {
      cookie: `_xsrf=${this.xsrf}; hhtoken=${this.hhToken};`,
      'user-agent': this.userAgent,
      'x-xsrftoken': `${this.xsrf}`,
    };

    return { headers, data: formData };
  }

  private appendFormData(data: any) {
    const form = new FormData();
    Object.keys(data).forEach((key) => form.append(key, data[key]));
    return form;
  }

  /**
   * Log in to the application with the given credentials
   *
   * @param {Object} credentials - The login credentials.
   * @param {string} credentials.username - The username.
   * @param {string} credentials.password - The password.
   * @param {Object} [captcha] - The captcha details.
   * @param {Object} [captcha.data] - Additional data for captcha.
   * @returns {Promise<boolean>} - A promise that resolves to true if login is successful, or false otherwise.
   */
  async login(
    credentials: { username: string; password: string },
    captcha?: {
      data?: Record<string, any>;
    },
  ): Promise<boolean> {
    if (!this.hhToken) {
      await this.getCookieAnonymous();
    }

    const url = `${HeadHunterService.BASE_URL}/account/login?backurl=%2F`;
    const { headers, data } = await this.getRequestData({
      _xsrf: this.xsrf ?? '',
      backUrl: HeadHunterService.BASE_URL,
      failUrl: '/account/login',
      remember: 'yes',
      accountType: 'APPLICANT',
      username: credentials.username,
      password: credentials.password,
      isBot: 'false',
      ...captcha?.data,
    });

    const response = await this.request('post', url, headers, data);
    const { hhcaptcha } = response.data;
    if (hhcaptcha && (hhcaptcha.isBot || hhcaptcha.captchaError)) {
      const response = await this.request(
        'post',
        `${HeadHunterService.BASE_URL}/captcha?lang=EN`,
        headers,
        data,
      );
      const { key: captchaKey } = response.data;
      const { captchaState } = hhcaptcha;
      const captchaLink = `${HeadHunterService.BASE_URL}/captcha/picture?key=${captchaKey}`;
      const captchaText = await this.controls.input({
        message: `🤖 Captcha required: ${captchaLink}`,
      });
      return this.login(credentials, {
        data: { captchaKey, captchaText, captchaState },
      });
    }

    Logger.success('✅ Authorized successfully');
    this.updateCookiesFromResponse(response);
    return response.status === 200;
  }

  private updateCookiesFromResponse(response: any) {
    const cookies = response.headers['set-cookie'];
    this.xsrf = this.extractCookie(cookies, '_xsrf');
    this.hhToken = this.extractCookie(cookies, 'hhtoken');
  }

  async getResumes() {
    const url = `${HeadHunterService.BASE_URL}/applicant/resumes`;
    const response = await this.request('get', url, {
      cookie: `_xsrf=${this.xsrf}; hhtoken=${this.hhToken};`,
      accept: 'text/html,application/xhtml+xml,application/xml',
    });
    const $ = cheerio.load(response.data);

    const resumeSrc = {};
    try {
      const data = JSON.parse($('template#HH-Lux-InitialState').text());
      const { applicantResumes: resumes } = data;
      resumes.forEach((i) => {
        resumeSrc[i._attributes.hash] = {
          name: i.title[0]?.string,
          timeLeft: i.toUpdate.value,
        };
      });
      return resumeSrc;
    } catch (e) {
      Logger.error('Error while parsing resumes page');
      return [];
    }
  }

  async raiseResume(resume: { id: string; name: string }): Promise<boolean> {
    const url = `${HeadHunterService.BASE_URL}/applicant/resumes/touch`;
    const { headers, data } = await this.getRequestData({
      resume: resume.id,
      undirectable: 'true',
    });
    const response = await this.request('post', url, headers, data);
    if (response.status === 200) {
      Logger.success(`🚀 ${resume.name} successfully bumped`);
    }
    return response.status === 200;
  }
}
