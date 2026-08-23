window.CHATBOT_CONFIG = {
    provider: 'openai',
    model: 'grok-4.5',
    modelLabel: 'Grok 4.5',
    responseLanguage: 'English only',
    apiEndpoint: 'https://api.duckcoding.ai/v1/chat/completions',
    apiKey: 'sk-gCD9LPFkUHodN26iRvV6OEwACZ419O7Hs6AhiuLU7XOCSVa6',
    embeddedMode: true,
    retrieval: {
        maxRelevantPapers: 6,
        maxLoadedPapers: 4,
        maxHistoryMessages: 12,
        maxKnowledgeChars: 7000
    }
};
