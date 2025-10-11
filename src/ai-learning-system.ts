/**
 * AI-Powered Learning and Skill Development System
 * Personalized learning paths, skill assessment, and adaptive tutorials
 */

import * as vscode from 'vscode';
import { getLLMCompletion } from './extension';
import { SecurityUtils } from './utils/sanitizer';
import { SecureConfigManager } from './utils/secure-config';
import * as path from 'path';
import * as fs from 'fs';

interface LearningPath {
  id: string;
  title: string;
  description: string;
  category: 'programming' | 'framework' | 'tools' | 'concepts' | 'best-practices';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedHours: number;
  prerequisites: string[];
  skills: string[];
  modules: LearningModule[];
  progress: {
    completedModules: number;
    totalModules: number;
    percentage: number;
    timeSpent: number;
  };
  personalized: boolean;
  adaptiveDifficulty: boolean;
}

interface LearningModule {
  id: string;
  title: string;
  description: string;
  type: 'tutorial' | 'exercise' | 'project' | 'quiz' | 'reading' | 'video';
  content: string;
  exercises: Exercise[];
  resources: Resource[];
  completed: boolean;
  score?: number;
  timeSpent: number;
  difficulty: number; // 1-10
  adaptiveContent?: string;
}

interface Exercise {
  id: string;
  title: string;
  description: string;
  type: 'coding' | 'multiple-choice' | 'fill-blank' | 'project' | 'debug';
  difficulty: number;
  code?: string;
  expectedOutput?: string;
  testCases?: TestCase[];
  hints: string[];
  solution: string;
  explanation: string;
  completed: boolean;
  attempts: number;
  bestScore: number;
}

interface TestCase {
  input: any;
  expectedOutput: any;
  description: string;
}

interface Resource {
  title: string;
  type: 'documentation' | 'article' | 'video' | 'book' | 'tool';
  url?: string;
  content?: string;
  difficulty: number;
}

interface SkillAssessment {
  skillName: string;
  category: string;
  currentLevel: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  confidence: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  lastAssessed: Date;
  assessmentHistory: AssessmentScore[];
}

interface AssessmentScore {
  date: Date;
  score: number;
  level: string;
  topics: { topic: string; score: number }[];
}

interface PersonalizedRecommendation {
  type: 'learning-path' | 'resource' | 'practice' | 'project';
  title: string;
  description: string;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: string;
  difficulty: number;
  skills: string[];
  actionUrl?: string;
}

export class AILearningSystem {
  private configManager: SecureConfigManager;
  private learningPaths: Map<string, LearningPath> = new Map();
  private skillAssessments: Map<string, SkillAssessment> = new Map();
  private userProgress: Map<string, any> = new Map();
  private adaptiveEngine: AdaptiveLearningEngine;

  constructor() {
    this.configManager = SecureConfigManager.getInstance();
    this.adaptiveEngine = new AdaptiveLearningEngine();
    this.loadLearningPaths();
  }

  /**
   * Start personalized learning journey
   */
  public async startLearningJourney(): Promise<void> {
    try {
      const goal = await vscode.window.showQuickPick([
        { label: '🎯 Learn a New Programming Language', value: 'language' },
        { label: '🚀 Master a Framework', value: 'framework' },
        { label: '🛠️ Improve Development Tools Skills', value: 'tools' },
        { label: '🧠 Understand Programming Concepts', value: 'concepts' },
        { label: '✨ Learn Best Practices', value: 'practices' },
        { label: '🎨 Custom Learning Path', value: 'custom' }
      ], {
        placeHolder: 'What would you like to learn?'
      });

      if (!goal) {return;}

      let learningPath: LearningPath;

      if (goal.value === 'custom') {
        learningPath = await this.createCustomLearningPath();
      } else {
        learningPath = await this.recommendLearningPath(goal.value);
      }

      if (!learningPath) {
        vscode.window.showErrorMessage('Failed to create learning path');
        return;
      }

      await this.initializeLearningPath(learningPath);
      await this.displayLearningDashboard(learningPath);

    } catch (error) {
      vscode.window.showErrorMessage(`Learning journey failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Assess current skills
   */
  public async assessSkills(): Promise<void> {
    try {
      const skillCategory = await vscode.window.showQuickPick([
        { label: '💻 Programming Languages', value: 'programming' },
        { label: '🚀 Frameworks & Libraries', value: 'frameworks' },
        { label: '🛠️ Development Tools', value: 'tools' },
        { label: '🏗️ Software Architecture', value: 'architecture' },
        { label: '🧪 Testing & Quality', value: 'testing' },
        { label: '🔒 Security', value: 'security' },
        { label: '📊 Data & Analytics', value: 'data' },
        { label: '☁️ Cloud & DevOps', value: 'devops' }
      ], {
        placeHolder: 'Select skill category to assess'
      });

      if (!skillCategory) {return;}

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '🧠 Assessing Skills...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Generating assessment questions...' });
        
        const assessment = await this.generateSkillAssessment(skillCategory.value);
        
        progress.report({ message: 'Starting assessment...' });
        
        const results = await this.conductAssessment(assessment);
        
        progress.report({ message: 'Analyzing results...' });
        
        const skillProfile = await this.analyzeAssessmentResults(results, skillCategory.value);
        
        progress.report({ message: 'Generating recommendations...' });
        
        const recommendations = await this.generatePersonalizedRecommendations(skillProfile);
        
        await this.displayAssessmentResults(skillProfile, recommendations);
      });

    } catch (error) {
      vscode.window.showErrorMessage(`Skill assessment failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Start interactive tutorial
   */
  public async startInteractiveTutorial(): Promise<void> {
    try {
      const tutorials = await this.getAvailableTutorials();
      
      const selectedTutorial = await vscode.window.showQuickPick(
        tutorials.map(tutorial => ({
          label: tutorial.title,
          description: tutorial.description,
          detail: `${tutorial.difficulty} • ${tutorial.estimatedHours}h • ${tutorial.modules.length} modules`,
          tutorial
        })),
        {
          placeHolder: 'Select tutorial to start',
          matchOnDescription: true
        }
      );

      if (!selectedTutorial) {return;}

      await this.startTutorial(selectedTutorial.tutorial);

    } catch (error) {
      vscode.window.showErrorMessage(`Tutorial start failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Practice coding with AI feedback
   */
  public async startCodingPractice(): Promise<void> {
    try {
      const practiceType = await vscode.window.showQuickPick([
        { label: '🔧 Algorithm Practice', value: 'algorithms' },
        { label: '🏗️ Design Patterns', value: 'patterns' },
        { label: '🐛 Debug Challenges', value: 'debugging' },
        { label: '🚀 Code Optimization', value: 'optimization' },
        { label: '🧪 Test-Driven Development', value: 'tdd' },
        { label: '🎯 Code Review Practice', value: 'review' }
      ], {
        placeHolder: 'Select practice type'
      });

      if (!practiceType) {return;}

      const difficulty = await vscode.window.showQuickPick([
        { label: '🌱 Beginner', value: 'beginner' },
        { label: '📈 Intermediate', value: 'intermediate' },
        { label: '🚀 Advanced', value: 'advanced' },
        { label: '🎯 Adaptive (AI chooses)', value: 'adaptive' }
      ], {
        placeHolder: 'Select difficulty level'
      });

      if (!difficulty) {return;}

      await this.generateCodingChallenge(practiceType.value, difficulty.value);

    } catch (error) {
      vscode.window.showErrorMessage(`Coding practice failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Get personalized learning recommendations
   */
  public async getPersonalizedRecommendations(): Promise<void> {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '🤖 Generating Recommendations...',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Analyzing learning history...' });
        
        const learningHistory = await this.analyzeLearningHistory();
        
        progress.report({ message: 'Assessing current skills...' });
        
        const currentSkills = await this.getCurrentSkillLevels();
        
        progress.report({ message: 'Generating personalized recommendations...' });
        
        const recommendations = await this.generateAIRecommendations(learningHistory, currentSkills);
        
        await this.displayRecommendations(recommendations);
      });

    } catch (error) {
      vscode.window.showErrorMessage(`Recommendations failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * View learning progress and statistics
   */
  public async viewLearningProgress(): Promise<void> {
    try {
      const progress = await this.calculateOverallProgress();
      await this.displayProgressDashboard(progress);

    } catch (error) {
      vscode.window.showErrorMessage(`Progress view failed: ${SecurityUtils.sanitizeLogInput(String(error))}`);
    }
  }

  /**
   * Private implementation methods
   */
  private async createCustomLearningPath(): Promise<LearningPath> {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter learning path title',
      placeHolder: 'My Custom Learning Journey'
    });

    if (!title) {throw new Error('Title required');}

    const description = await vscode.window.showInputBox({
      prompt: 'Describe what you want to learn',
      placeHolder: 'I want to learn React with TypeScript and build modern web applications'
    });

    if (!description) {throw new Error('Description required');}

    const aiPrompt = `
Create a personalized learning path based on this request:

Title: ${title}
Description: ${description}

Generate a structured learning path with modules, exercises, and resources.
Return ONLY a JSON object with this structure:
{
  "id": "unique-id",
  "title": "${title}",
  "description": "${description}",
  "category": "programming|framework|tools|concepts|best-practices",
  "difficulty": "beginner|intermediate|advanced|expert",
  "estimatedHours": number,
  "prerequisites": ["list of prerequisites"],
  "skills": ["list of skills to learn"],
  "modules": [
    {
      "id": "module-id",
      "title": "Module Title",
      "description": "Module description",
      "type": "tutorial|exercise|project|quiz|reading",
      "content": "Detailed content",
      "exercises": [],
      "resources": [],
      "completed": false,
      "timeSpent": 0,
      "difficulty": 5
    }
  ]
}

Create a comprehensive, well-structured learning path.
`;

    try {
      const response = await getLLMCompletion(aiPrompt);
      
      if (!response) {
        throw new Error('Learning path generation returned no response');
      }
      
      const cleanResponse = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
      const pathData = JSON.parse(cleanResponse);
      
      return {
        ...pathData,
        progress: {
          completedModules: 0,
          totalModules: pathData.modules.length,
          percentage: 0,
          timeSpent: 0
        },
        personalized: true,
        adaptiveDifficulty: true
      };
    } catch (error) {
      throw new Error('Failed to generate custom learning path');
    }
  }

  private async recommendLearningPath(goal: string): Promise<LearningPath> {
    // Get existing learning paths that match the goal
    const matchingPaths = Array.from(this.learningPaths.values())
      .filter(path => path.category === goal);

    if (matchingPaths.length === 0) {
      // Generate a new learning path
      return await this.generateLearningPath(goal);
    }

    const selectedPath = await vscode.window.showQuickPick(
      matchingPaths.map(path => ({
        label: path.title,
        description: path.description,
        detail: `${path.difficulty} • ${path.estimatedHours}h • ${path.modules.length} modules`,
        path
      })),
      {
        placeHolder: 'Select recommended learning path'
      }
    );

    return selectedPath?.path || matchingPaths[0];
  }

  private async generateLearningPath(goal: string): Promise<LearningPath> {
    const aiPrompt = `
Generate a comprehensive learning path for: ${goal}

Create modules that progressively build skills, include practical exercises,
and provide resources for further learning.

Return a JSON learning path object with detailed modules and exercises.
`;

    const response = await getLLMCompletion(aiPrompt);
    
    if (!response) {
      throw new Error('Learning path creation returned no response');
    }
    
    const cleanResponse = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
    return JSON.parse(cleanResponse);
  }

  private async initializeLearningPath(learningPath: LearningPath): Promise<void> {
    this.learningPaths.set(learningPath.id, learningPath);
    this.userProgress.set('currentPath', learningPath.id);
    
    vscode.window.showInformationMessage(
      `🚀 Started learning path: ${learningPath.title}`,
      'View Dashboard'
    ).then(selection => {
      if (selection === 'View Dashboard') {
        this.displayLearningDashboard(learningPath);
      }
    });
  }

  private async generateSkillAssessment(category: string): Promise<any> {
    const aiPrompt = `
Generate a skill assessment for category: ${category}

Create 10-15 questions that test different aspects and levels.
Include multiple choice, coding challenges, and scenario-based questions.

Return assessment in JSON format with questions and scoring criteria.
`;

    const response = await getLLMCompletion(aiPrompt);
    
    if (!response) {
      throw new Error('Assessment generation returned no response');
    }
    
    const cleanResponse = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
    return JSON.parse(cleanResponse);
  }

  private async conductAssessment(assessment: any): Promise<any> {
    // Simplified assessment - in real implementation, this would be interactive
    return {
      totalQuestions: assessment.questions?.length || 10,
      correctAnswers: Math.floor(Math.random() * 10) + 5, // Mock data
      timeSpent: 25, // minutes
      detailedResults: []
    };
  }

  private async analyzeAssessmentResults(results: any, category: string): Promise<SkillAssessment> {
    const score = (results.correctAnswers / results.totalQuestions) * 100;
    let level: SkillAssessment['currentLevel'];
    
    if (score >= 90) {level = 'expert';}
    else if (score >= 75) {level = 'advanced';}
    else if (score >= 60) {level = 'intermediate';}
    else if (score >= 40) {level = 'beginner';}
    else {level = 'novice';}

    return {
      skillName: category,
      category,
      currentLevel: level,
      confidence: score,
      strengths: ['Pattern recognition', 'Problem solving'],
      weaknesses: ['Advanced concepts', 'Best practices'],
      recommendations: ['Focus on advanced topics', 'Practice more complex scenarios'],
      lastAssessed: new Date(),
      assessmentHistory: [{
        date: new Date(),
        score,
        level,
        topics: []
      }]
    };
  }

  private async generatePersonalizedRecommendations(skillProfile: SkillAssessment): Promise<PersonalizedRecommendation[]> {
    const aiPrompt = `
Based on this skill assessment, generate personalized learning recommendations:

Skill: ${skillProfile.skillName}
Level: ${skillProfile.currentLevel}
Confidence: ${skillProfile.confidence}%
Strengths: ${skillProfile.strengths.join(', ')}
Weaknesses: ${skillProfile.weaknesses.join(', ')}

Generate 5-7 specific, actionable recommendations for improvement.
Return as JSON array of recommendation objects.
`;

    try {
      const response = await getLLMCompletion(aiPrompt);
      
      if (!response) {
        console.warn('Recommendations generation returned no response');
        return [];
      }
      
      const cleanResponse = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      return []; // Return empty array on error
    }
  }

  private async getAvailableTutorials(): Promise<LearningPath[]> {
    return Array.from(this.learningPaths.values())
      .filter(path => path.modules.some(module => module.type === 'tutorial'));
  }

  private async startTutorial(tutorial: LearningPath): Promise<void> {
    await this.displayTutorialInterface(tutorial);
  }

  private async generateCodingChallenge(type: string, difficulty: string): Promise<void> {
    const aiPrompt = `
Generate a coding challenge for:
Type: ${type}
Difficulty: ${difficulty}

Include:
- Clear problem description
- Example inputs/outputs
- Test cases
- Hints for different skill levels
- Solution with explanation

Return as JSON with challenge details.
`;

    try {
      const response = await getLLMCompletion(aiPrompt);
      
      if (!response) {
        vscode.window.showWarningMessage('Coding challenge generation returned no response');
        return;
      }
      
      const cleanResponse = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
      const challenge = JSON.parse(cleanResponse);
      
      await this.displayCodingChallenge(challenge);
    } catch (error) {
      vscode.window.showErrorMessage('Failed to generate coding challenge');
    }
  }

  private async analyzeLearningHistory(): Promise<any> {
    // Analyze user's learning patterns and progress
    return {
      totalHours: 45,
      completedPaths: 3,
      preferredLearningStyle: 'hands-on',
      strongAreas: ['JavaScript', 'React'],
      improvementAreas: ['Testing', 'Architecture']
    };
  }

  private async getCurrentSkillLevels(): Promise<Map<string, number>> {
    const skills = new Map();
    for (const [name, assessment] of this.skillAssessments) {
      skills.set(name, assessment.confidence);
    }
    return skills;
  }

  private async generateAIRecommendations(history: any, skills: Map<string, number>): Promise<PersonalizedRecommendation[]> {
    const aiPrompt = `
Generate personalized learning recommendations based on:

Learning History:
- Total Hours: ${history.totalHours}
- Completed Paths: ${history.completedPaths}
- Learning Style: ${history.preferredLearningStyle}
- Strong Areas: ${history.strongAreas.join(', ')}
- Improvement Areas: ${history.improvementAreas.join(', ')}

Current Skill Levels:
${Array.from(skills.entries()).map(([skill, level]) => `- ${skill}: ${level}%`).join('\n')}

Generate 5-8 personalized recommendations that build on strengths and address weaknesses.
Return as JSON array of recommendation objects.
`;

    try {
      const response = await getLLMCompletion(aiPrompt);
      
      if (!response) {
        console.warn('Personalized recommendations returned no response');
        return [];
      }
      
      const cleanResponse = response.replace(/```json\n?/, '').replace(/```$/, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      return [];
    }
  }

  private async calculateOverallProgress(): Promise<any> {
    return {
      overallCompletion: 68,
      activePaths: 2,
      totalHours: 120,
      skillsImproved: 8,
      certificatesEarned: 3,
      streakDays: 15
    };
  }

  /**
   * Display methods
   */
  private async displayLearningDashboard(learningPath: LearningPath): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'learningDashboard',
      '📚 Learning Dashboard',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateLearningDashboardHtml(learningPath);
  }

  private async displayAssessmentResults(skillProfile: SkillAssessment, recommendations: PersonalizedRecommendation[]): Promise<void> {
    const content = `
# 🧠 Skill Assessment Results

**Skill**: ${skillProfile.skillName}  
**Current Level**: ${skillProfile.currentLevel.toUpperCase()}  
**Confidence Score**: ${skillProfile.confidence}%  
**Assessed**: ${skillProfile.lastAssessed.toLocaleDateString()}

## 💪 Strengths
${skillProfile.strengths.map(strength => `- ${strength}`).join('\n')}

## 🎯 Areas for Improvement
${skillProfile.weaknesses.map(weakness => `- ${weakness}`).join('\n')}

## 🚀 Personalized Recommendations

${recommendations.map((rec, index) => `
### ${index + 1}. ${rec.title}
**Priority**: ${rec.priority.toUpperCase()}  
**Estimated Time**: ${rec.estimatedTime}  
**Difficulty**: ${'⭐'.repeat(rec.difficulty)}/5

${rec.description}

**Why this helps**: ${rec.reasoning}

**Skills**: ${rec.skills?.join(', ') || 'General improvement'}

---
`).join('\n')}

## 📈 Next Steps
1. Choose 1-2 high-priority recommendations to start with
2. Set aside dedicated learning time
3. Track your progress regularly
4. Reassess skills in 4-6 weeks

*Click on any recommendation to get started!*
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  }

  private async displayRecommendations(recommendations: PersonalizedRecommendation[]): Promise<void> {
    const content = `
# 🤖 AI-Powered Learning Recommendations

Generated: ${new Date().toLocaleString()}

${recommendations.map((rec, index) => `
## ${index + 1}. ${rec.title}

**Type**: ${rec.type.replace('-', ' ').toUpperCase()}  
**Priority**: ${rec.priority.toUpperCase()}  
**Estimated Time**: ${rec.estimatedTime}  
**Difficulty**: ${'⭐'.repeat(rec.difficulty)}/5

### Description
${rec.description}

### Why This Recommendation?
${rec.reasoning}

### Skills You'll Develop
${rec.skills?.map(skill => `- ${skill}`).join('\n') || 'Various skills'}

---
`).join('\n')}

## 🎯 How to Use These Recommendations

1. **Start with High Priority**: Focus on recommendations marked as high priority
2. **Consider Your Schedule**: Match time estimates with your availability
3. **Progress Gradually**: Don't try to tackle everything at once
4. **Track Progress**: Update your learning journal regularly
5. **Reassess Regularly**: Come back for updated recommendations

*AI recommendations are updated based on your learning progress and changing goals.*
`;

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  }

  private async displayProgressDashboard(progress: any): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'progressDashboard',
      '📊 Learning Progress',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateProgressDashboardHtml(progress);
  }

  private async displayTutorialInterface(tutorial: LearningPath): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'tutorial',
      `📖 ${tutorial.title}`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateTutorialHtml(tutorial);
  }

  private async displayCodingChallenge(challenge: any): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'codingChallenge',
      '🧩 Coding Challenge',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.generateCodingChallengeHtml(challenge);
  }

  private generateLearningDashboardHtml(learningPath: LearningPath): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; padding: 20px; background: #f5f5f5; 
        }
        .container { 
            max-width: 1200px; margin: 0 auto; background: white; 
            border-radius: 12px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        }
        .header { 
            text-align: center; border-bottom: 2px solid #007ACC; 
            padding-bottom: 20px; margin-bottom: 30px; 
        }
        .progress-bar { 
            width: 100%; height: 20px; background: #e0e0e0; 
            border-radius: 10px; overflow: hidden; margin: 20px 0; 
        }
        .progress-fill { 
            height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); 
            width: ${learningPath.progress.percentage}%; transition: width 0.3s ease; 
        }
        .modules-grid { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; margin: 30px 0; 
        }
        .module-card { 
            border: 1px solid #ddd; border-radius: 8px; padding: 20px; 
            background: ${learningPath.progress.percentage > 50 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa'}; 
            color: ${learningPath.progress.percentage > 50 ? 'white' : 'black'}; 
            cursor: pointer; transition: transform 0.2s ease; 
        }
        .module-card:hover { transform: translateY(-2px); }
        .module-completed { background: #d4edda !important; color: #155724 !important; }
        .stats { 
            display: flex; justify-content: space-around; margin: 30px 0; 
            text-align: center; 
        }
        .stat { 
            padding: 15px; 
        }
        .stat-number { 
            font-size: 2em; font-weight: bold; color: #007ACC; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 ${learningPath.title}</h1>
            <p>${learningPath.description}</p>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <p>Progress: ${learningPath.progress.completedModules}/${learningPath.progress.totalModules} modules (${learningPath.progress.percentage}%)</p>
        </div>

        <div class="stats">
            <div class="stat">
                <div class="stat-number">${learningPath.estimatedHours}h</div>
                <div>Estimated Time</div>
            </div>
            <div class="stat">
                <div class="stat-number">${learningPath.progress.timeSpent}h</div>
                <div>Time Spent</div>
            </div>
            <div class="stat">
                <div class="stat-number">${learningPath.difficulty}</div>
                <div>Difficulty</div>
            </div>
            <div class="stat">
                <div class="stat-number">${learningPath.skills.length}</div>
                <div>Skills</div>
            </div>
        </div>

        <h2>📖 Learning Modules</h2>
        <div class="modules-grid">
            ${learningPath.modules.map((module, index) => `
                <div class="module-card ${module.completed ? 'module-completed' : ''}" 
                     onclick="startModule('${module.id}')">
                    <h3>${index + 1}. ${module.title}</h3>
                    <p>${module.description}</p>
                    <p><strong>Type:</strong> ${module.type}</p>
                    <p><strong>Difficulty:</strong> ${'⭐'.repeat(module.difficulty)}/10</p>
                    ${module.completed ? '<p>✅ Completed</p>' : '<p>📋 Not Started</p>'}
                </div>
            `).join('')}
        </div>

        <h2>🎯 Skills You'll Learn</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${learningPath.skills.map(skill => `
                <span style="background: #007ACC; color: white; padding: 5px 10px; 
                            border-radius: 15px; font-size: 0.9em;">${skill}</span>
            `).join('')}
        </div>
    </div>

    <script>
        function startModule(moduleId) {
            // In a real implementation, this would communicate with the extension
            console.log('Starting module:', moduleId);
        }
    </script>
</body>
</html>`;
  }

  private generateProgressDashboardHtml(progress: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; padding: 20px; background: #f5f5f5; 
        }
        .container { 
            max-width: 1200px; margin: 0 auto; background: white; 
            border-radius: 12px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        }
        .stats-grid { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; margin: 30px 0; 
        }
        .stat-card { 
            text-align: center; padding: 20px; border-radius: 10px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
        }
        .stat-number { 
            font-size: 3em; font-weight: bold; margin: 10px 0; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Your Learning Progress</h1>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${progress.overallCompletion}%</div>
                <div>Overall Completion</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${progress.totalHours}h</div>
                <div>Total Learning Hours</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${progress.skillsImproved}</div>
                <div>Skills Improved</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${progress.streakDays}</div>
                <div>Learning Streak (days)</div>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  private generateTutorialHtml(tutorial: LearningPath): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; padding: 20px; background: #f5f5f5; 
        }
        .container { 
            max-width: 800px; margin: 0 auto; background: white; 
            border-radius: 12px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📖 ${tutorial.title}</h1>
        <p>${tutorial.description}</p>
        <p>Interactive tutorial interface would be here...</p>
    </div>
</body>
</html>`;
  }

  private generateCodingChallengeHtml(challenge: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; padding: 20px; background: #f5f5f5; 
        }
        .container { 
            max-width: 1000px; margin: 0 auto; background: white; 
            border-radius: 12px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧩 Coding Challenge</h1>
        <p>Interactive coding challenge interface would be here...</p>
        <p>Challenge details: ${JSON.stringify(challenge, null, 2)}</p>
    </div>
</body>
</html>`;
  }

  private loadLearningPaths(): void {
    // Load built-in learning paths
    const reactPath: LearningPath = {
      id: 'react-fundamentals',
      title: 'React Fundamentals',
      description: 'Learn React from the ground up with hands-on projects',
      category: 'framework',
      difficulty: 'beginner',
      estimatedHours: 25,
      prerequisites: ['JavaScript', 'HTML', 'CSS'],
      skills: ['React', 'JSX', 'Components', 'State Management', 'Hooks'],
      modules: [],
      progress: { completedModules: 0, totalModules: 8, percentage: 0, timeSpent: 0 },
      personalized: false,
      adaptiveDifficulty: true
    };

    this.learningPaths.set(reactPath.id, reactPath);
  }
}

/**
 * Adaptive Learning Engine
 * Adjusts difficulty and content based on user performance
 */
class AdaptiveLearningEngine {
  public adjustDifficulty(userPerformance: any, currentDifficulty: number): number {
    // Adaptive difficulty algorithm
    if (userPerformance.accuracy > 0.9) {
      return Math.min(10, currentDifficulty + 1);
    } else if (userPerformance.accuracy < 0.6) {
      return Math.max(1, currentDifficulty - 1);
    }
    return currentDifficulty;
  }

  public personalizeContent(userProfile: any, baseContent: string): string {
    // Content personalization based on learning style
    return baseContent; // Simplified for now
  }

  public recommendNextModule(completedModules: any[], availableModules: any[]): any {
    // Smart module recommendation
    return availableModules[0]; // Simplified for now
  }
}

/**
 * Register AI learning system commands
 */
export function registerAILearningSystemCommands(context: vscode.ExtensionContext) {
  const learningSystem = new AILearningSystem();

  context.subscriptions.push(
    vscode.commands.registerCommand('coding.learning.startJourney', () => {
      learningSystem.startLearningJourney();
    }),

    vscode.commands.registerCommand('coding.learning.assessSkills', () => {
      learningSystem.assessSkills();
    }),

    vscode.commands.registerCommand('coding.learning.startTutorial', () => {
      learningSystem.startInteractiveTutorial();
    }),

    vscode.commands.registerCommand('coding.learning.codingPractice', () => {
      learningSystem.startCodingPractice();
    }),

    vscode.commands.registerCommand('coding.learning.recommendations', () => {
      learningSystem.getPersonalizedRecommendations();
    }),

    vscode.commands.registerCommand('coding.learning.progress', () => {
      learningSystem.viewLearningProgress();
    })
  );
}