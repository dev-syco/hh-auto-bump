import chalk from 'chalk';

const isTestEnv = process.env.ENV === 'test';

export class Logger {
  static info(message: string) {
    Logger.log(chalk.blueBright(message));
  }

  static success(message: string) {
    Logger.log(chalk.greenBright(message));
  }

  static error(message: string) {
    Logger.log(chalk.redBright(message));
  }

  static warn(message: string) {
    Logger.log(chalk.yellowBright(message));
  }

  static log(message: string) {
    !isTestEnv &&
      console.log(chalk.grey(`[${new Date().toLocaleString()}]`), message);
  }
}
