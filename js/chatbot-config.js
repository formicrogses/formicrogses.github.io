window.CHATBOT_CONFIG = {
    provider: 'openai',
    model: '[L]gemini-3-flash-preview',
    modelLabel: 'Gemini 3 Flash Preview',
    apiEndpoint: 'https://new.lemonapi.site/v1/chat/completions',
    apiKey: 'sk-gYlp8Rj6la8mVuEDNKWoKFxlMOsrCkmuuMHq5hNCOonE49d4',
    embeddedMode: true,
    retrieval: {
        maxRelevantPapers: 6,
        maxLoadedPapers: 4,
        maxHistoryMessages: 12,
        maxKnowledgeChars: 7000
    }
};
