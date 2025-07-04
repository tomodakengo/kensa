import * as fs from 'fs-extra';
import * as path from 'path';
import * as xml2js from 'xml2js';

interface LocatorStrategy {
  type: string;
  value: string;
  priority: number;
}

interface LocatorData {
  automationId?: string;
  name?: string;
  className?: string;
  controlType?: string;
  description?: string;
  strategies?: LocatorStrategy[];
}

interface Locator {
  pageName: string;
  locatorName: string;
  automationId?: string;
  name?: string;
  className?: string;
  controlType?: string;
  description?: string;
  strategies?: LocatorStrategy[];
}

interface FullLocator extends LocatorData {
  fullName: string;
  pageName: string;
  locatorName: string;
}

export class LocatorManager {
  private locatorPath: string;
  private locators: Map<string, Record<string, LocatorData>> = new Map();

  constructor(locatorPath: string) {
    this.locatorPath = locatorPath;
    this.ensureDirectory();
    this.loadLocators();
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.ensureDir(this.locatorPath);
    } catch (error) {
      console.error('Error creating locator directory:', error);
    }
  }

  private async loadLocators(): Promise<void> {
    try {
      const files = await fs.readdir(this.locatorPath);
      const xmlFiles = files.filter(file => file.endsWith('.xml'));

      for (const file of xmlFiles) {
        await this.loadLocatorFile(path.join(this.locatorPath, file));
      }
    } catch (error) {
      console.error('Error loading locators:', error);
    }
  }

  private async loadLocatorFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(content);

      if (result.locators && result.locators.page) {
        for (const page of result.locators.page) {
          const pageName = page.$.name;
          const pageLocators: Record<string, LocatorData> = {};

          if (page.locator) {
            for (const locator of page.locator) {
              const locatorName = locator.$.name;
              pageLocators[locatorName] = {
                automationId: locator.$.automationId,
                name: locator.$.name,
                className: locator.$.className,
                controlType: locator.$.controlType,
                description: locator.$.description,
                strategies: this.parseStrategies(locator.strategy)
              };
            }
          }

          this.locators.set(pageName, pageLocators);
        }
      }
    } catch (error) {
      console.error('Error loading locator file:', error);
    }
  }

  private parseStrategies(strategies: any[]): LocatorStrategy[] {
    if (!strategies) return [];

    return strategies.map(strategy => ({
      type: strategy.$.type,
      value: strategy.$.value,
      priority: parseInt(strategy.$.priority || '0')
    }));
  }

  async saveLocator(locator: Locator): Promise<{ success: boolean; pageName: string; locatorName: string }> {
    const { pageName, locatorName, ...locatorData } = locator;

    if (!this.locators.has(pageName)) {
      this.locators.set(pageName, {});
    }

    const pageLocators = this.locators.get(pageName)!;
    pageLocators[locatorName] = locatorData;

    await this.saveToFile(pageName);

    return { success: true, pageName, locatorName };
  }

  private async saveToFile(pageName: string): Promise<void> {
    const pageLocators = this.locators.get(pageName);
    if (!pageLocators) return;

    const builder = new xml2js.Builder();
    const xml = builder.buildObject({
      locators: {
        page: [{
          $: { name: pageName },
          locator: Object.entries(pageLocators).map(([name, data]) => ({
            $: {
              name: name,
              automationId: data.automationId || '',
              className: data.className || '',
              controlType: data.controlType || '',
              description: data.description || ''
            },
            strategy: data.strategies?.map(s => ({
              $: {
                type: s.type,
                value: s.value,
                priority: s.priority.toString()
              }
            }))
          }))
        }]
      }
    });

    const filePath = path.join(this.locatorPath, `${pageName}.xml`);
    await fs.writeFile(filePath, xml, 'utf-8');
  }

  async getLocator(fullName: string): Promise<LocatorData | null> {
    const parts = fullName.split('.');
    if (parts.length < 2) return null;
    
    const [pageName, locatorName] = parts;
    if (!pageName || !locatorName) return null;

    if (!this.locators.has(pageName)) {
      return null;
    }

    const pageLocators = this.locators.get(pageName)!;
    return pageLocators[locatorName] || null;
  }

  async getAllLocators(): Promise<FullLocator[]> {
    const allLocators: FullLocator[] = [];

    for (const [pageName, pageLocators] of this.locators) {
      for (const [locatorName, locatorData] of Object.entries(pageLocators)) {
        allLocators.push({
          fullName: `${pageName}.${locatorName}`,
          pageName,
          locatorName,
          ...locatorData
        });
      }
    }

    return allLocators;
  }

  async deleteLocator(fullName: string): Promise<{ success: boolean; error?: string }> {
    const parts = fullName.split('.');
    if (parts.length < 2) {
      return { success: false, error: 'Invalid locator name format' };
    }
    
    const [pageName, locatorName] = parts;
    if (!pageName || !locatorName) {
      return { success: false, error: 'Invalid page or locator name' };
    }

    if (!this.locators.has(pageName)) {
      return { success: false, error: 'Page not found' };
    }

    const pageLocators = this.locators.get(pageName)!;
    delete pageLocators[locatorName];

    if (Object.keys(pageLocators).length === 0) {
      this.locators.delete(pageName);
      // Delete the file
      const filePath = path.join(this.locatorPath, `${pageName}.xml`);
      try {
        await fs.remove(filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    } else {
      await this.saveToFile(pageName);
    }

    return { success: true };
  }

  async exportLocators(format: 'xml' | 'json' = 'xml'): Promise<string> {
    if (format === 'xml') {
      const builder = new xml2js.Builder();
      const pages = [];

      for (const [pageName, pageLocators] of this.locators) {
        pages.push({
          $: { name: pageName },
          locator: Object.entries(pageLocators).map(([name, data]) => ({
            $: {
              name: name,
              automationId: data.automationId || '',
              className: data.className || '',
              controlType: data.controlType || '',
              description: data.description || ''
            },
            strategy: data.strategies?.map(s => ({
              $: {
                type: s.type,
                value: s.value,
                priority: s.priority.toString()
              }
            }))
          }))
        });
      }

      return builder.buildObject({ locators: { page: pages } });
    } else {
      const allLocators = await this.getAllLocators();
      return JSON.stringify(allLocators, null, 2);
    }
  }

  async importLocators(data: string, format: 'xml' | 'json' = 'xml'): Promise<{ success: boolean; imported: number }> {
    try {
      if (format === 'xml') {
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(data);

        let imported = 0;

        if (result.locators && result.locators.page) {
          for (const page of result.locators.page) {
            const pageName = page.$.name;

            if (page.locator) {
              for (const locator of page.locator) {
                const locatorName = locator.$.name;
                const locatorData: LocatorData = {
                  automationId: locator.$.automationId,
                  name: locator.$.name,
                  className: locator.$.className,
                  controlType: locator.$.controlType,
                  description: locator.$.description,
                  strategies: this.parseStrategies(locator.strategy)
                };

                await this.saveLocator({
                  pageName,
                  locatorName,
                  ...locatorData
                });

                imported++;
              }
            }
          }
        }

        return { success: true, imported };
      } else {
        const locators: Locator[] = JSON.parse(data);
        let imported = 0;

        for (const locator of locators) {
          await this.saveLocator(locator);
          imported++;
        }

        return { success: true, imported };
      }
    } catch (error) {
      console.error('Error importing locators:', error);
      return { success: false, imported: 0 };
    }
  }

  getTestSelector(fullName: string): string {
    const parts = fullName.split('.');
    if (parts.length < 2) return fullName;
    
    const [pageName, locatorName] = parts;
    if (!pageName || !locatorName) return fullName;

    if (!this.locators.has(pageName)) {
      return fullName; // Return original if not found
    }

    const pageLocators = this.locators.get(pageName)!;
    const locator = pageLocators[locatorName];

    if (!locator) {
      return fullName; // Return original if not found
    }

    // Generate selector based on strategies
    if (locator.strategies && locator.strategies.length > 0) {
      // Sort by priority and return the best strategy
      const sortedStrategies = locator.strategies.sort((a: any, b: any) => a.priority - b.priority);
      const bestStrategy = sortedStrategies[0];

      switch (bestStrategy.type) {
        case 'automationId':
          return `automationId="${bestStrategy.value}"`;
        case 'name':
          return `name="${bestStrategy.value}"`;
        case 'className':
          return `className="${bestStrategy.value}"`;
        case 'controlType':
          return `controlType="${bestStrategy.value}"`;
        case 'xpath':
          return bestStrategy.value;
        default:
          return fullName;
      }
    }

    // Fallback to basic properties
    if (locator.automationId) {
      return `automationId="${locator.automationId}"`;
    }

    if (locator.name) {
      return `name="${locator.name}"`;
    }

    if (locator.className) {
      return `className="${locator.className}"`;
    }

    return fullName;
  }

  async searchLocators(query: string): Promise<FullLocator[]> {
    const allLocators = await this.getAllLocators();
    const searchQuery = query.toLowerCase();

    return allLocators.filter(locator =>
      locator.fullName.toLowerCase().includes(searchQuery) ||
      locator.description?.toLowerCase().includes(searchQuery) ||
      locator.automationId?.toLowerCase().includes(searchQuery) ||
      locator.name?.toLowerCase().includes(searchQuery) ||
      locator.className?.toLowerCase().includes(searchQuery)
    );
  }

  async getPageLocators(pageName: string): Promise<Record<string, LocatorData>> {
    return this.locators.get(pageName) || {};
  }

  async getPages(): Promise<string[]> {
    return Array.from(this.locators.keys());
  }

  async validateLocator(locator: Locator): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!locator.pageName) {
      errors.push('Page name is required');
    }

    if (!locator.locatorName) {
      errors.push('Locator name is required');
    }

    if (!locator.automationId && !locator.name && !locator.className && !locator.controlType) {
      errors.push('At least one identifier (automationId, name, className, or controlType) is required');
    }

    if (locator.strategies) {
      for (const strategy of locator.strategies) {
        if (!strategy.type) {
          errors.push('Strategy type is required');
        }
        if (!strategy.value) {
          errors.push('Strategy value is required');
        }
        if (strategy.priority < 0) {
          errors.push('Strategy priority must be non-negative');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 