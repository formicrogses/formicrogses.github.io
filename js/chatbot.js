// Chatbot using Google Gemini API
class GeminiChatbot {
    constructor() {
        this.apiKey = '';
        this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
        this.conversationHistory = [];
        this.isOpen = false;
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.createChatInterface();
        this.setupEventListeners();
        this.loadApiKey();
    }

    loadApiKey() {
        // Load API key from localStorage
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
            this.apiKey = savedKey;
        }
    }

    saveApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('gemini_api_key', key);
    }

    createChatInterface() {
        const chatHTML = `
            <div class="chatbot-container" id="chatbotContainer">
                <div class="chatbot-header">
                    <div class="chatbot-header-content">
                        <div class="chatbot-avatar">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <div class="chatbot-title">
                            <h3>AI Assistant</h3>
                            <p>Powered by Gemini</p>
                        </div>
                    </div>
                    <button class="chatbot-close" id="chatbotClose">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <div class="chatbot-messages" id="chatbotMessages">
                    <div class="chatbot-welcome">
                        <div class="welcome-icon">👋</div>
                        <h4>Welcome to AI Assistant!</h4>
                        <p>I can help you explore gesture interaction research papers. Ask me anything!</p>
                    </div>
                </div>
                
                <div class="chatbot-input-container">
                    <textarea 
                        class="chatbot-input" 
                        id="chatbotInput" 
                        placeholder="Ask me anything about the papers..."
                        rows="1"
                    ></textarea>
                    <button class="chatbot-send" id="chatbotSend">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
                
                <div class="chatbot-settings" id="chatbotSettings" style="display: none;">
                    <div class="settings-content">
                        <h4>API Settings</h4>
                        <p class="settings-description">Enter your Google Gemini API key to start chatting.</p>
                        <a href="https://makersuite.google.com/app/apikey" target="_blank" class="api-link">Get API Key →</a>
                        <input 
                            type="password" 
                            class="api-key-input" 
                            id="apiKeyInput" 
                            placeholder="Enter your API key..."
                        >
                        <div class="settings-buttons">
                            <button class="btn-cancel" id="settingsCancel">Cancel</button>
                            <button class="btn-save" id="settingsSave">Save</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <button class="chatbot-toggle" id="chatbotToggle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="chatbot-badge" id="chatbotBadge" style="display: none;">1</span>
            </button>
        `;
        
        document.body.insertAdjacentHTML('beforeend', chatHTML);
    }

    setupEventListeners() {
        const toggle = document.getElementById('chatbotToggle');
        const close = document.getElementById('chatbotClose');
        const send = document.getElementById('chatbotSend');
        const input = document.getElementById('chatbotInput');
        const settingsSave = document.getElementById('settingsSave');
        const settingsCancel = document.getElementById('settingsCancel');
        
        toggle.addEventListener('click', () => this.toggleChat());
        close.addEventListener('click', () => this.closeChat());
        send.addEventListener('click', () => this.sendMessage());
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        input.addEventListener('input', () => {
            this.autoResizeTextarea(input);
        });
        
        settingsSave.addEventListener('click', () => this.saveSettings());
        settingsCancel.addEventListener('click', () => this.hideSettings());
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        const container = document.getElementById('chatbotContainer');
        const toggle = document.getElementById('chatbotToggle');
        const badge = document.getElementById('chatbotBadge');
        
        container.classList.add('active');
        toggle.classList.add('active');
        badge.style.display = 'none';
        this.isOpen = true;
        
        // Focus input
        setTimeout(() => {
            const input = document.getElementById('chatbotInput');
            if (input) input.focus();
        }, 300);
        
        // Check if API key is set
        if (!this.apiKey) {
            setTimeout(() => this.showSettings(), 500);
        }
    }

    closeChat() {
        const container = document.getElementById('chatbotContainer');
        const toggle = document.getElementById('chatbotToggle');
        
        container.classList.remove('active');
        toggle.classList.remove('active');
        this.isOpen = false;
        this.hideSettings();
    }

    showSettings() {
        const settings = document.getElementById('chatbotSettings');
        const input = document.getElementById('apiKeyInput');
        settings.style.display = 'flex';
        if (this.apiKey) {
            input.value = this.apiKey;
        }
        setTimeout(() => input.focus(), 100);
    }

    hideSettings() {
        const settings = document.getElementById('chatbotSettings');
        settings.style.display = 'none';
    }

    saveSettings() {
        const input = document.getElementById('apiKeyInput');
        const key = input.value.trim();
        
        if (key) {
            this.saveApiKey(key);
            this.hideSettings();
            this.addMessage('System', '✅ API key saved successfully!', 'system');
        } else {
            alert('Please enter a valid API key');
        }
    }

    async sendMessage() {
        const input = document.getElementById('chatbotInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        if (!this.apiKey) {
            this.showSettings();
            return;
        }
        
        // Clear input
        input.value = '';
        this.autoResizeTextarea(input);
        
        // Add user message
        this.addMessage('You', message, 'user');
        
        // Show loading
        this.showLoading();
        
        try {
            const response = await this.callGeminiAPI(message);
            this.hideLoading();
            this.addMessage('AI', response, 'bot');
        } catch (error) {
            this.hideLoading();
            let errorMessage = 'Sorry, I encountered an error. Please check your API key and try again.';
            
            if (error.message.includes('API key')) {
                errorMessage = 'Invalid API key. Please check your settings.';
                setTimeout(() => this.showSettings(), 1000);
            } else if (error.message.includes('quota')) {
                errorMessage = 'API quota exceeded. Please check your Google Cloud Console.';
            }
            
            this.addMessage('System', errorMessage, 'error');
        }
    }

    async callGeminiAPI(message) {
        // Add context about the papers
        const context = this.buildContext();
        const fullMessage = `${context}\n\nUser question: ${message}`;
        
        const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: fullMessage
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                }
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }
        
        const data = await response.json();
        return data.candidates[0]?.content?.parts[0]?.text || 'No response generated';
    }

    buildContext() {
        // Get information about current papers (if app is available)
        if (typeof app !== 'undefined' && app.allPapers) {
            const totalPapers = app.allPapers.length;
            const categories = [...new Set(app.allPapers.map(p => p.category))];
            const years = [...new Set(app.allPapers.map(p => p.year))].sort().reverse();
            
            return `You are a helpful AI assistant for a gesture interaction research paper gallery. 
The gallery contains ${totalPapers} research papers about gesture interaction.
Categories available: ${categories.join(', ')}.
Papers span from ${years[years.length - 1]} to ${years[0]}.
Help users discover papers, understand concepts, and answer questions about gesture interaction research.`;
        }
        
        return 'You are a helpful AI assistant for a gesture interaction research paper gallery. Help users discover papers and answer questions about gesture interaction research.';
    }

    addMessage(sender, text, type = 'user') {
        const messagesContainer = document.getElementById('chatbotMessages');
        const welcome = messagesContainer.querySelector('.chatbot-welcome');
        
        // Remove welcome message on first message
        if (welcome && type !== 'system') {
            welcome.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chatbot-message ${type}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = type === 'user' ? '👤' : (type === 'bot' ? '🤖' : '⚙️');
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const senderSpan = document.createElement('div');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = sender;
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = text;
        
        content.appendChild(senderSpan);
        content.appendChild(textDiv);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showLoading() {
        this.isLoading = true;
        const messagesContainer = document.getElementById('chatbotMessages');
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chatbot-message bot loading-message';
        loadingDiv.id = 'chatbotLoading';
        loadingDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="message-sender">AI</div>
                <div class="message-text">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideLoading() {
        this.isLoading = false;
        const loading = document.getElementById('chatbotLoading');
        if (loading) {
            loading.remove();
        }
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new GeminiChatbot();
});
