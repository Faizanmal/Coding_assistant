import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface UserStory {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'high' | 'medium' | 'low';
}

interface E2ETestConfig {
  framework: 'cypress' | 'playwright' | 'selenium';
  baseUrl: string;
  viewport: { width: number; height: number };
  browser: string[];
}

export class E2ETestGenerator {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('E2E Test Generator');
  }

  async generateFromUserStory(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('🚀 Starting E2E Test Generation from User Story...');

    // Get user story input
    const userStory = await this.collectUserStoryInput();
    if (!userStory) {return;}

    // Get test configuration
    const config = await this.getTestConfiguration();
    if (!config) {return;}

    // Generate test files
    const testCode = await this.generateTestCode(userStory, config);
    await this.createTestFiles(testCode, config, userStory.title);

    vscode.window.showInformationMessage('E2E tests generated successfully!');
  }

  async generateFromNaturalLanguage(): Promise<void> {
    this.outputChannel.show();
    this.outputChannel.appendLine('💬 Starting E2E Test Generation from Natural Language...');

    const prompt = await vscode.window.showInputBox({
      prompt: 'Describe the user flow you want to test',
      placeHolder: 'e.g., "User logs in, navigates to dashboard, creates a new project, and verifies it appears in the project list"',
      value: ''
    });

    if (!prompt) {return;}

    const config = await this.getTestConfiguration();
    if (!config) {return;}

    const parsedStory = await this.parseNaturalLanguagePrompt(prompt);
    const testCode = await this.generateTestCode(parsedStory, config);
    await this.createTestFiles(testCode, config, parsedStory.title);

    vscode.window.showInformationMessage('E2E tests generated from natural language!');
  }

  private async collectUserStoryInput(): Promise<UserStory | undefined> {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter user story title',
      placeHolder: 'e.g., "User Login Flow"'
    });

    if (!title) {return undefined;}

    const description = await vscode.window.showInputBox({
      prompt: 'Enter user story description',
      placeHolder: 'As a user, I want to...'
    });

    if (!description) {return undefined;}

    const criteriaInput = await vscode.window.showInputBox({
      prompt: 'Enter acceptance criteria (comma-separated)',
      placeHolder: 'User can login, Dashboard loads, Navigation works'
    });

    const acceptanceCriteria = criteriaInput?.split(',').map(c => c.trim()) || [];

    const priority = await vscode.window.showQuickPick(
      [
        { label: 'High Priority', value: 'high' as const },
        { label: 'Medium Priority', value: 'medium' as const },
        { label: 'Low Priority', value: 'low' as const }
      ],
      { placeHolder: 'Select priority level' }
    );

    return {
      title,
      description,
      acceptanceCriteria,
      priority: priority?.value || 'medium'
    };
  }

  private async getTestConfiguration(): Promise<E2ETestConfig | undefined> {
    const framework = await vscode.window.showQuickPick([
      { label: 'Cypress', value: 'cypress' as const },
      { label: 'Playwright', value: 'playwright' as const },
      { label: 'Selenium WebDriver', value: 'selenium' as const }
    ], { placeHolder: 'Select testing framework' });

    if (!framework) {return undefined;}

    const baseUrl = await vscode.window.showInputBox({
      prompt: 'Enter base URL for testing',
      placeHolder: 'https://localhost:3000',
      value: 'https://localhost:3000'
    });

    if (!baseUrl) {return undefined;}

    const browsers = await vscode.window.showQuickPick([
      { label: 'Chrome', value: 'chrome' },
      { label: 'Firefox', value: 'firefox' },
      { label: 'Safari', value: 'safari' },
      { label: 'Edge', value: 'edge' }
    ], { 
      placeHolder: 'Select browsers to test',
      canPickMany: true 
    });

    return {
      framework: framework.value,
      baseUrl,
      viewport: { width: 1280, height: 720 },
      browser: browsers?.map(b => b.value) || ['chrome']
    };
  }

  private async parseNaturalLanguagePrompt(prompt: string): Promise<UserStory> {
    // Simple NLP parsing - could be enhanced with actual NLP libraries
    const steps = this.extractStepsFromPrompt(prompt);
    const title = this.generateTitleFromPrompt(prompt);
    
    return {
      title,
      description: prompt,
      acceptanceCriteria: steps,
      priority: 'medium'
    };
  }

  private extractStepsFromPrompt(prompt: string): string[] {
    // Extract action words and create test steps
    const actionWords = ['login', 'navigate', 'click', 'enter', 'select', 'verify', 'check', 'submit', 'create', 'delete', 'edit', 'search'];
    const steps: string[] = [];
    
    const sentences = prompt.split(/[,.]/).map(s => s.trim()).filter(s => s.length > 0);
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const hasAction = actionWords.some(action => lowerSentence.includes(action));
      
      if (hasAction) {
        steps.push(sentence);
      }
    });

    return steps.length > 0 ? steps : [prompt];
  }

  private generateTitleFromPrompt(prompt: string): string {
    const words = prompt.split(' ').slice(0, 5);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Test';
  }

  private async generateTestCode(userStory: UserStory, config: E2ETestConfig): Promise<string> {
    switch (config.framework) {
      case 'cypress':
        return this.generateCypressTest(userStory, config);
      case 'playwright':
        return this.generatePlaywrightTest(userStory, config);
      case 'selenium':
        return this.generateSeleniumTest(userStory, config);
      default:
        throw new Error(`Unsupported framework: ${config.framework}`);
    }
  }

  private generateCypressTest(userStory: UserStory, config: E2ETestConfig): string {
    const testName = userStory.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    return `describe('${userStory.title}', () => {
  beforeEach(() => {
    cy.visit('${config.baseUrl}');
    cy.viewport(${config.viewport.width}, ${config.viewport.height});
  });

  it('should complete ${userStory.description}', () => {
    // Generated test steps based on acceptance criteria
    ${userStory.acceptanceCriteria.map((criteria, index) => 
      this.generateCypressStep(criteria, index)
    ).join('\n    ')}
    
    // Verify final state
    cy.url().should('include', '/');
    cy.get('body').should('be.visible');
  });

  ${userStory.acceptanceCriteria.map((criteria, index) => `
  it('should satisfy: ${criteria}', () => {
    ${this.generateCypressStep(criteria, index)}
    
    // Add specific assertions for this criteria
    cy.get('[data-testid="success-indicator"]').should('be.visible');
  });`).join('')}
});

// Custom commands for this test suite
Cypress.Commands.add('loginUser', (email = 'test@example.com', password = 'password') => {
  cy.get('[data-testid="email-input"]').type(email);
  cy.get('[data-testid="password-input"]').type(password);
  cy.get('[data-testid="login-button"]').click();
});

Cypress.Commands.add('navigateToSection', (section) => {
  cy.get(\`[data-testid="\${section}-nav"]\`).click();
  cy.url().should('include', \`/\${section}\`);
});

// Page Object Model
class ${this.toPascalCase(testName)}Page {
  visit() {
    cy.visit('${config.baseUrl}');
  }

  getTitle() {
    return cy.get('h1');
  }

  clickMainAction() {
    return cy.get('[data-testid="main-action-button"]').click();
  }

  verifySuccess() {
    return cy.get('[data-testid="success-message"]').should('be.visible');
  }
}

export const ${testName}Page = new ${this.toPascalCase(testName)}Page();`;
  }

  private generatePlaywrightTest(userStory: UserStory, config: E2ETestConfig): string {
    const testName = userStory.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    return `import { test, expect, Page } from '@playwright/test';

test.describe('${userStory.title}', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('${config.baseUrl}');
    await page.setViewportSize({ width: ${config.viewport.width}, height: ${config.viewport.height} });
  });

  test('should complete ${userStory.description}', async ({ page }) => {
    // Generated test steps based on acceptance criteria
    ${userStory.acceptanceCriteria.map((criteria, index) => 
      this.generatePlaywrightStep(criteria, index)
    ).join('\n    ')}
    
    // Verify final state
    await expect(page).toHaveURL(/.*\\//);
    await expect(page.locator('body')).toBeVisible();
  });

  ${userStory.acceptanceCriteria.map((criteria, index) => `
  test('should satisfy: ${criteria}', async ({ page }) => {
    ${this.generatePlaywrightStep(criteria, index)}
    
    // Add specific assertions for this criteria
    await expect(page.locator('[data-testid="success-indicator"]')).toBeVisible();
  });`).join('')}
});

// Page Object Model
export class ${this.toPascalCase(testName)}Page {
  constructor(private page: Page) {}

  async visit() {
    await this.page.goto('${config.baseUrl}');
  }

  async getTitle() {
    return this.page.locator('h1');
  }

  async clickMainAction() {
    await this.page.click('[data-testid="main-action-button"]');
  }

  async verifySuccess() {
    await expect(this.page.locator('[data-testid="success-message"]')).toBeVisible();
  }

  async loginUser(email = 'test@example.com', password = 'password') {
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="login-button"]');
  }

  async navigateToSection(section: string) {
    await this.page.click(\`[data-testid="\${section}-nav"]\`);
    await expect(this.page).toHaveURL(new RegExp(\`.*\${section}.*\`));
  }
}

// Fixtures and test data
export const testData = {
  validUser: {
    email: 'test@example.com',
    password: 'password123'
  },
  invalidUser: {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  }
};`;
  }

  private generateSeleniumTest(userStory: UserStory, config: E2ETestConfig): string {
    const testName = userStory.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const className = this.toPascalCase(testName) + 'Test';
    
    return `import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.PageFactory;
import org.openqa.selenium.support.FindBy;
import java.time.Duration;

public class ${className} {
    private WebDriver driver;
    private WebDriverWait wait;
    private ${this.toPascalCase(testName)}Page page;

    @BeforeEach
    public void setUp() {
        driver = new ChromeDriver();
        driver.manage().window().setSize(new Dimension(${config.viewport.width}, ${config.viewport.height}));
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        page = new ${this.toPascalCase(testName)}Page(driver);
        driver.get("${config.baseUrl}");
    }

    @Test
    @DisplayName("${userStory.description}")
    public void testComplete${this.toPascalCase(testName)}() {
        // Generated test steps based on acceptance criteria
        ${userStory.acceptanceCriteria.map((criteria, index) => 
          this.generateSeleniumStep(criteria, index)
        ).join('\n        ')}
        
        // Verify final state
        Assertions.assertTrue(driver.getCurrentUrl().contains("/"));
        Assertions.assertTrue(driver.findElement(By.tagName("body")).isDisplayed());
    }

    ${userStory.acceptanceCriteria.map((criteria, index) => `
    @Test
    @DisplayName("Should satisfy: ${criteria}")
    public void testCriteria${index + 1}() {
        ${this.generateSeleniumStep(criteria, index)}
        
        // Add specific assertions for this criteria
        WebElement successIndicator = wait.until(
            ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='success-indicator']"))
        );
        Assertions.assertTrue(successIndicator.isDisplayed());
    }`).join('')}

    @AfterEach
    public void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }
}

// Page Object Model
class ${this.toPascalCase(testName)}Page {
    private WebDriver driver;
    private WebDriverWait wait;

    @FindBy(css = "[data-testid='main-action-button']")
    private WebElement mainActionButton;

    @FindBy(css = "[data-testid='success-message']")
    private WebElement successMessage;

    @FindBy(css = "[data-testid='email-input']")
    private WebElement emailInput;

    @FindBy(css = "[data-testid='password-input']")
    private WebElement passwordInput;

    @FindBy(css = "[data-testid='login-button']")
    private WebElement loginButton;

    public ${this.toPascalCase(testName)}Page(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        PageFactory.initElements(driver, this);
    }

    public void clickMainAction() {
        wait.until(ExpectedConditions.elementToBeClickable(mainActionButton)).click();
    }

    public boolean isSuccessMessageVisible() {
        try {
            return wait.until(ExpectedConditions.visibilityOf(successMessage)).isDisplayed();
        } catch (TimeoutException e) {
            return false;
        }
    }

    public void loginUser(String email, String password) {
        emailInput.sendKeys(email);
        passwordInput.sendKeys(password);
        loginButton.click();
    }

    public void navigateToSection(String section) {
        WebElement navElement = driver.findElement(By.cssSelector("[data-testid='" + section + "-nav']"));
        navElement.click();
        wait.until(ExpectedConditions.urlContains("/" + section));
    }
}`;
  }

  private generateCypressStep(criteria: string, index: number): string {
    const lowerCriteria = criteria.toLowerCase();
    
    if (lowerCriteria.includes('login') || lowerCriteria.includes('sign in')) {
      return `// Step ${index + 1}: ${criteria}
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('include', '/dashboard');`;
    }
    
    if (lowerCriteria.includes('navigate') || lowerCriteria.includes('go to')) {
      return `// Step ${index + 1}: ${criteria}
    cy.get('[data-testid="navigation-menu"]').click();
    cy.get('[data-testid="target-page-link"]').click();`;
    }
    
    if (lowerCriteria.includes('create') || lowerCriteria.includes('add')) {
      return `// Step ${index + 1}: ${criteria}
    cy.get('[data-testid="create-button"]').click();
    cy.get('[data-testid="title-input"]').type('New Item');
    cy.get('[data-testid="save-button"]').click();`;
    }
    
    if (lowerCriteria.includes('verify') || lowerCriteria.includes('check')) {
      return `// Step ${index + 1}: ${criteria}
    cy.get('[data-testid="result-item"]').should('be.visible');
    cy.get('[data-testid="result-item"]').should('contain.text', 'Expected Text');`;
    }
    
    return `// Step ${index + 1}: ${criteria}
    cy.get('[data-testid="action-button"]').click();
    cy.get('[data-testid="confirmation"]').should('be.visible');`;
  }

  private generatePlaywrightStep(criteria: string, index: number): string {
    const lowerCriteria = criteria.toLowerCase();
    
    if (lowerCriteria.includes('login') || lowerCriteria.includes('sign in')) {
      return `// Step ${index + 1}: ${criteria}
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL(/.*dashboard.*/);`;
    }
    
    if (lowerCriteria.includes('navigate') || lowerCriteria.includes('go to')) {
      return `// Step ${index + 1}: ${criteria}
    await page.click('[data-testid="navigation-menu"]');
    await page.click('[data-testid="target-page-link"]');`;
    }
    
    if (lowerCriteria.includes('create') || lowerCriteria.includes('add')) {
      return `// Step ${index + 1}: ${criteria}
    await page.click('[data-testid="create-button"]');
    await page.fill('[data-testid="title-input"]', 'New Item');
    await page.click('[data-testid="save-button"]');`;
    }
    
    if (lowerCriteria.includes('verify') || lowerCriteria.includes('check')) {
      return `// Step ${index + 1}: ${criteria}
    await expect(page.locator('[data-testid="result-item"]')).toBeVisible();
    await expect(page.locator('[data-testid="result-item"]')).toContainText('Expected Text');`;
    }
    
    return `// Step ${index + 1}: ${criteria}
    await page.click('[data-testid="action-button"]');
    await expect(page.locator('[data-testid="confirmation"]')).toBeVisible();`;
  }

  private generateSeleniumStep(criteria: string, index: number): string {
    const lowerCriteria = criteria.toLowerCase();
    
    if (lowerCriteria.includes('login') || lowerCriteria.includes('sign in')) {
      return `// Step ${index + 1}: ${criteria}
        driver.findElement(By.cssSelector("[data-testid='email-input']")).sendKeys("test@example.com");
        driver.findElement(By.cssSelector("[data-testid='password-input']")).sendKeys("password123");
        driver.findElement(By.cssSelector("[data-testid='login-button']")).click();
        wait.until(ExpectedConditions.urlContains("dashboard"));`;
    }
    
    if (lowerCriteria.includes('navigate') || lowerCriteria.includes('go to')) {
      return `// Step ${index + 1}: ${criteria}
        driver.findElement(By.cssSelector("[data-testid='navigation-menu']")).click();
        driver.findElement(By.cssSelector("[data-testid='target-page-link']")).click();`;
    }
    
    if (lowerCriteria.includes('create') || lowerCriteria.includes('add')) {
      return `// Step ${index + 1}: ${criteria}
        driver.findElement(By.cssSelector("[data-testid='create-button']")).click();
        driver.findElement(By.cssSelector("[data-testid='title-input']")).sendKeys("New Item");
        driver.findElement(By.cssSelector("[data-testid='save-button']")).click();`;
    }
    
    if (lowerCriteria.includes('verify') || lowerCriteria.includes('check')) {
      return `// Step ${index + 1}: ${criteria}
        WebElement resultItem = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='result-item']")));
        Assertions.assertTrue(resultItem.getText().contains("Expected Text"));`;
    }
    
    return `// Step ${index + 1}: ${criteria}
        driver.findElement(By.cssSelector("[data-testid='action-button']")).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("[data-testid='confirmation']")));`;
  }

  private async createTestFiles(testCode: string, config: E2ETestConfig, title: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    const testFileName = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    let testDir = '';
    let fileName = '';
    let extension = '';

    switch (config.framework) {
      case 'cypress':
        testDir = 'cypress/e2e';
        fileName = `${testFileName}.cy`;
        extension = '.js';
        break;
      case 'playwright':
        testDir = 'tests';
        fileName = `${testFileName}.spec`;
        extension = '.ts';
        break;
      case 'selenium':
        testDir = 'src/test/java';
        fileName = this.toPascalCase(testFileName) + 'Test';
        extension = '.java';
        break;
    }

    const fullTestDir = path.join(workspaceFolder.uri.fsPath, testDir);
    const fullFilePath = path.join(fullTestDir, fileName + extension);

    // Create directory if it doesn't exist
    await fs.promises.mkdir(fullTestDir, { recursive: true });

    // Write test file
    await fs.promises.writeFile(fullFilePath, testCode);

    // Create configuration files if they don't exist
    await this.createConfigFiles(config, workspaceFolder.uri.fsPath);

    // Open the generated test file
    const document = await vscode.workspace.openTextDocument(fullFilePath);
    await vscode.window.showTextDocument(document);

    this.outputChannel.appendLine(`✅ Test file created: ${fullFilePath}`);
  }

  private async createConfigFiles(config: E2ETestConfig, workspacePath: string): Promise<void> {
    switch (config.framework) {
      case 'cypress':
        await this.createCypressConfig(config, workspacePath);
        break;
      case 'playwright':
        await this.createPlaywrightConfig(config, workspacePath);
        break;
      case 'selenium':
        await this.createSeleniumConfig(config, workspacePath);
        break;
    }
  }

  private async createCypressConfig(config: E2ETestConfig, workspacePath: string): Promise<void> {
    const configPath = path.join(workspacePath, 'cypress.config.js');
    const configExists = await fs.promises.access(configPath).then(() => true).catch(() => false);

    if (!configExists) {
      const configContent = `const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: '${config.baseUrl}',
    viewportWidth: ${config.viewport.width},
    viewportHeight: ${config.viewport.height},
    video: true,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});`;
      await fs.promises.writeFile(configPath, configContent);
    }
  }

  private async createPlaywrightConfig(config: E2ETestConfig, workspacePath: string): Promise<void> {
    const configPath = path.join(workspacePath, 'playwright.config.ts');
    const configExists = await fs.promises.access(configPath).then(() => true).catch(() => false);

    if (!configExists) {
      const configContent = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: '${config.baseUrl}',
    trace: 'on-first-retry',
  },

  projects: [
    ${config.browser.map(browser => `
    {
      name: '${browser}',
      use: { ...devices['Desktop ${this.capitalizeFirst(browser)}'] },
    },`).join('')}
  ],

  webServer: {
    command: 'npm run start',
    url: '${config.baseUrl}',
    reuseExistingServer: !process.env.CI,
  },
});`;
      await fs.promises.writeFile(configPath, configContent);
    }
  }

  private async createSeleniumConfig(config: E2ETestConfig, workspacePath: string): Promise<void> {
    // Create Maven pom.xml if it doesn't exist
    const pomPath = path.join(workspacePath, 'pom.xml');
    const pomExists = await fs.promises.access(pomPath).then(() => true).catch(() => false);

    if (!pomExists) {
      const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.example</groupId>
    <artifactId>e2e-tests</artifactId>
    <version>1.0-SNAPSHOT</version>
    
    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <junit.version>5.8.2</junit.version>
        <selenium.version>4.11.0</selenium.version>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>org.seleniumhq.selenium</groupId>
            <artifactId>selenium-java</artifactId>
            <version>\${selenium.version}</version>
        </dependency>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>\${junit.version}</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.0.0-M7</version>
            </plugin>
        </plugins>
    </build>
</project>`;
      await fs.promises.writeFile(pomPath, pomContent);
    }
  }

  private toPascalCase(str: string): string {
    return str.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase());
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  dispose() {
    this.outputChannel.dispose();
  }
}

export function registerE2ETestGeneratorCommands(context: vscode.ExtensionContext) {
  const generator = new E2ETestGenerator();

  const generateFromStoryCommand = vscode.commands.registerCommand('coding.generateE2EFromStory', async () => {
    await generator.generateFromUserStory();
  });

  const generateFromNLCommand = vscode.commands.registerCommand('coding.generateE2EFromNL', async () => {
    await generator.generateFromNaturalLanguage();
  });

  context.subscriptions.push(generateFromStoryCommand, generateFromNLCommand);
  context.subscriptions.push(generator);
}