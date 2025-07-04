const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');

class LocatorManager {
  constructor(locatorPath) {
    this.locatorPath = locatorPath;
    this.locators = new Map();
    this.ensureDirectory();
    this.loadLocators();
  }

  async ensureDirectory() {
    try {
      await fs.mkdir(this.locatorPath, { recursive: true });
    } catch (error) {
      console.error('Error creating locator directory:', error);
    }
  }

  async loadLocators() {
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

  async loadLocatorFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(content);
      
      if (result.locators && result.locators.page) {
        for (const page of result.locators.page) {
          const pageName = page.$.name;
          const pageLocators = {};
          
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

  parseStrategies(strategies) {
    if (!strategies) return [];
    
    return strategies.map(strategy => ({
      type: strategy.$.type,
      value: strategy.$.value,
      priority: parseInt(strategy.$.priority || '0')
    }));
  }

  async saveLocator(locator) {
    const { pageName, locatorName, ...locatorData } = locator;
    
    if (!this.locators.has(pageName)) {
      this.locators.set(pageName, {});
    }
    
    this.locators.get(pageName)[locatorName] = locatorData;
    
    await this.saveToFile(pageName);
    
    return { success: true, pageName, locatorName };
  }

  async saveToFile(pageName) {
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
              automationId: data.automationId,
              className: data.className,
              controlType: data.controlType,
              description: data.description
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

  async getLocator(fullName) {
    const [pageName, locatorName] = fullName.split('.');
    
    if (!this.locators.has(pageName)) {
      return null;
    }
    
    return this.locators.get(pageName)[locatorName] || null;
  }

  async getAllLocators() {
    const allLocators = [];
    
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

  async deleteLocator(fullName) {
    const [pageName, locatorName] = fullName.split('.');
    
    if (!this.locators.has(pageName)) {
      return { success: false, error: 'Page not found' };
    }
    
    const pageLocators = this.locators.get(pageName);
    delete pageLocators[locatorName];
    
    if (Object.keys(pageLocators).length === 0) {
      this.locators.delete(pageName);
      // Delete the file
      const filePath = path.join(this.locatorPath, `${pageName}.xml`);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    } else {
      await this.saveToFile(pageName);
    }
    
    return { success: true };
  }

  async exportLocators(format = 'xml') {
    if (format === 'xml') {
      const builder = new xml2js.Builder();
      const pages = [];
      
      for (const [pageName, pageLocators] of this.locators) {
        pages.push({
          $: { name: pageName },
          locator: Object.entries(pageLocators).map(([name, data]) => ({
            $: {
              name: name,
              automationId: data.automationId,
              className: data.className,
              controlType: data.controlType,
              description: data.description
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
    } else if (format === 'json') {
      const result = {};
      for (const [pageName, pageLocators] of this.locators) {
        result[pageName] = pageLocators;
      }
      return JSON.stringify(result, null, 2);
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  async importLocators(data, format = 'xml') {
    if (format === 'xml') {
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(data);
      
      if (result.locators && result.locators.page) {
        for (const page of result.locators.page) {
          const pageName = page.$.name;
          const pageLocators = {};
          
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
          await this.saveToFile(pageName);
        }
      }
    } else if (format === 'json') {
      const imported = JSON.parse(data);
      
      for (const [pageName, pageLocators] of Object.entries(imported)) {
        this.locators.set(pageName, pageLocators);
        await this.saveToFile(pageName);
      }
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }
    
    return { success: true, count: this.locators.size };
  }

  // Helper method to convert stored locator to test selector format
  getTestSelector(fullName) {
    const locator = this.getLocator(fullName);
    if (!locator) return null;
    
    const selectors = [];
    
    // Add default selectors
    if (locator.automationId) {
      selectors.push({
        type: 'automationId',
        value: locator.automationId,
        priority: 1
      });
    }
    
    if (locator.name) {
      selectors.push({
        type: 'name',
        value: locator.name,
        priority: 2
      });
    }
    
    if (locator.className) {
      selectors.push({
        type: 'className',
        value: locator.className,
        priority: 3
      });
    }
    
    // Add custom strategies
    if (locator.strategies) {
      selectors.push(...locator.strategies);
    }
    
    return {
      selectors: selectors.sort((a, b) => a.priority - b.priority)
    };
  }
}

module.exports = { LocatorManager };