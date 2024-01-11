import { checkbox, input, password, confirm } from '@inquirer/prompts';
import { HeadHunterService } from '@/head-hunter-service';
import { Logger } from '@/infra/logger';
import { DataStore } from '@/infra/store';

type PromoteResume = { id: string; bumpAt: number; name: string };

class MainApp {
  private service: HeadHunterService;
  private dataStore: DataStore;
  private promoteResumes: PromoteResume[] = [];
  private timeUntilNextBump;
  private nextBumpTimer;

  constructor() {
    this.dataStore = new DataStore('./config.json');
    this.service = new HeadHunterService({ input, confirm });
  }

  public async run() {
    await this.initializeCredentials();

    const auth = await this.service.login(
      this.dataStore.getByKey('credentials'),
    );
    if (!auth) {
      Logger.error('🆘 Authorization failed');
      return;
    }

    await this.handleResumePromotion();
    Logger.success(
      `❇️ ${this.promoteResumes.length} resume scheduled for auto-bump`,
    );
  }

  private async initializeCredentials() {
    let credentials = this.dataStore.getByKey('credentials');
    if (!credentials) {
      const username = await input({ message: 'Enter account email/phone' });
      const pass = await password({ message: 'Enter account password' });
      credentials = { username, password: pass };
      this.dataStore.write('credentials', credentials);
    }
  }

  private async handleResumePromotion() {
    let promoteResumes = this.dataStore.getByKey('promoteResumes');
    if (!promoteResumes) {
      promoteResumes = await this.selectResumesForPromotion();
      this.dataStore.write('promoteResumes', promoteResumes);
    }
    this.promoteResumes = promoteResumes;
    this.scheduleResumePromotion();
  }

  private async selectResumesForPromotion() {
    const resumes = await this.service.getResumes();
    return checkbox({
      message: 'Select resumes to promote',
      choices: Object.keys(resumes).map((value) => ({
        ...resumes[value],
        value,
      })),
    }).then((res) =>
      res.map((i: string) => ({
        id: i,
        bumpAt: new Date(Date.now() + resumes[i].timeLeft * 1000).getTime(),
        name: resumes[i].name,
      })),
    );
  }

  private scheduleResumePromotion() {
    this.promoteResumes.forEach(this.setupPromotionHook.bind(this));
  }

  private setupPromotionHook(data: PromoteResume, index: number) {
    const timeUntilNextBump = data.bumpAt - Date.now();
    setTimeout(async () => {
      const isResumeRaised = await this.service.raiseResume(data);
      const nextBumpDelay = isResumeRaised
        ? 4 * 3600 * 1000 + 15000
        : 30 * 1000;
      this.promoteResumes[index].bumpAt = Date.now() + nextBumpDelay;
      this.dataStore.write('promoteResumes', this.promoteResumes);
      this.setupPromotionHook(this.promoteResumes[index], index);
    }, timeUntilNextBump);
    if (!this.timeUntilNextBump || this.timeUntilNextBump > timeUntilNextBump) {
      clearTimeout(this.nextBumpTimer);
      this.timeUntilNextBump = timeUntilNextBump;
      this.nextBumpTimer = setTimeout(() => {
        Logger.info(
          `Next bump at ${new Date(
            Date.now() + this.timeUntilNextBump,
          ).toLocaleString()}`,
        );
      }, 5000);
    }
  }
}

const app = new MainApp();
app.run();
