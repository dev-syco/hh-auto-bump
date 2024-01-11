import { readFileSync, writeFileSync, existsSync } from 'fs';
import { Logger } from '@/infra/logger';

type JsonData = Record<string, any>;

export class DataStore {
  private readonly filePath: string;
  private data: JsonData;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = {};
    this.init();
  }

  private init() {
    try {
      const fileExists = existsSync(this.filePath);
      if (!fileExists) {
        writeFileSync(this.filePath, '{}');
      }
      this.readFromFile();
    } catch (error) {
      Logger.error(`Error initializing JsonFileHandler: ${error}`);
    }
  }

  private readFromFile() {
    try {
      const fileData = readFileSync(this.filePath, { encoding: 'utf8' });
      this.data = JSON.parse(fileData);
    } catch (error) {
      Logger.error(`Error reading from file: ${error}`);
    }
  }

  public getByKey(key: string): any {
    return this.data[key];
  }

  public write(key: string, value: any): void {
    try {
      this.data[key] = value;
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      Logger.error(`Error writing to file: ${error}`);
    }
  }
}
