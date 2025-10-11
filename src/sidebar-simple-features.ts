/**
 * Simple Sidebar Features Configuration
 * This file defines the features available in the simple sidebar interface
 */

export interface SidebarFeature {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'basic' | 'enhanced' | 'advanced';
    enabled: boolean;
    shortcut?: string;
}

export const SIMPLE_SIDEBAR_FEATURES: SidebarFeature[] = [
    // Basic Features
    {
        id: 'ai-chat',
        name: 'AI Chat Assistant',
        description: 'Basic AI chat functionality with multiple providers',
        icon: '💬',
        category: 'basic',
        enabled: true
    },
    {
        id: 'code-generation',
        name: 'Code Generation',
        description: 'Generate code snippets based on natural language',
        icon: '⚡',
        category: 'basic',
        enabled: true
    },
    {
        id: 'multi-provider',
        name: 'Multi-Provider Support',
        description: 'Switch between Groq, Together.ai, OpenRouter, Mistral, and Cerebras',
        icon: '🔄',
        category: 'basic',
        enabled: true
    },
    {
        id: 'web-search',
        name: 'Web Search Integration',
        description: 'Enhance responses with real-time web search',
        icon: '🌐',
        category: 'basic',
        enabled: true
    },

    // Enhanced Features
    {
        id: 'project-context',
        name: 'Project Context Awareness',
        description: 'AI understands your project structure and files',
        icon: '📁',
        category: 'enhanced',
        enabled: true
    },
    {
        id: 'smart-suggestions',
        name: 'Smart Code Suggestions',
        description: 'Context-aware code completion and recommendations',
        icon: '💡',
        category: 'enhanced',
        enabled: true
    },
    {
        id: 'file-operations',
        name: 'Smart File Operations',
        description: 'Create, modify, and manage files intelligently',
        icon: '📄',
        category: 'enhanced',
        enabled: true
    },
    {
        id: 'shell-integration',
        name: 'Terminal Integration',
        description: 'Execute commands and scripts through AI',
        icon: '💻',
        category: 'enhanced',
        enabled: true
    },

    // Advanced Features (from our new implementation)
    {
        id: 'semantic-search',
        name: 'Semantic Code Search',
        description: 'Search code using natural language queries',
        icon: '🔍',
        category: 'advanced',
        enabled: true,
        shortcut: 'Ctrl+Shift+S'
    },
    {
        id: 'knowledge-graph',
        name: 'Project Knowledge Graph',
        description: 'Deep understanding of project architecture',
        icon: '🕸️',
        category: 'advanced',
        enabled: true
    },
    {
        id: 'autonomous-workflows',
        name: 'Autonomous Workflows',
        description: 'Multi-step automated development tasks',
        icon: '⚙️',
        category: 'advanced',
        enabled: true
    },
    {
        id: 'cross-file-reasoning',
        name: 'Cross-File Analysis',
        description: 'Understand relationships across entire codebase',
        icon: '🔗',
        category: 'advanced',
        enabled: true
    },
    {
        id: 'intelligent-refactoring',
        name: 'Intelligent Refactoring',
        description: 'AI-powered code improvements with safety analysis',
        icon: '🛠️',
        category: 'advanced',
        enabled: true
    },
    {
        id: 'project-insights',
        name: 'Project Intelligence',
        description: 'Comprehensive project health and insights',
        icon: '💎',
        category: 'advanced',
        enabled: true
    }
];

/**
 * Get features by category
 */
export function getFeaturesByCategory(category: 'basic' | 'enhanced' | 'advanced'): SidebarFeature[] {
    return SIMPLE_SIDEBAR_FEATURES.filter(feature => feature.category === category);
}

/**
 * Get enabled features
 */
export function getEnabledFeatures(): SidebarFeature[] {
    return SIMPLE_SIDEBAR_FEATURES.filter(feature => feature.enabled);
}

/**
 * Feature capability descriptions for user guidance
 */
export const FEATURE_DESCRIPTIONS = {
    basic: 'Essential AI coding assistance with multi-provider support',
    enhanced: 'Context-aware features that understand your project',
    advanced: 'Cutting-edge AI capabilities for autonomous development'
};

/**
 * Quick access commands for common features
 */
export const QUICK_COMMANDS = [
    {
        command: 'Ask AI',
        description: 'Quick AI query',
        placeholder: 'Ask me anything about your code...'
    },
    {
        command: 'Generate Code',
        description: 'Create code from description',
        placeholder: 'Describe what code you need...'
    },
    {
        command: 'Search Code',
        description: 'Find code semantically',
        placeholder: 'Search for functions, classes, or concepts...'
    },
    {
        command: 'Start Workflow',
        description: 'Begin automated task',
        placeholder: 'Describe the workflow you want to automate...'
    }
];