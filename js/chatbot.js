class GrokChatbot {
    constructor() {
        this.config = {
            provider: 'openai',
            model: 'grok-4.5',
            modelLabel: 'Grok 4.5',
            apiEndpoint: 'https://api.duckcoding.ai/v1/chat/completions',
            apiKey: '',
            maxResponseTokens: 3072,
            embeddedMode: false,
            retrieval: {
                maxRelevantPapers: 6,
                maxLoadedPapers: 4,
                maxHistoryMessages: 12,
                maxKnowledgeChars: 7000
            }
        };
        this.apiKey = '';
        this.model = this.config.model;
        this.apiEndpoint = this.config.apiEndpoint;
        this.modelLabel = this.config.modelLabel;
        this.provider = this.config.provider;
        this.hasEmbeddedKey = false;
        this.conversationHistory = [];
        this.isOpen = false;
        this.isLoading = false;
        this.currentPaper = null;  // 
        this.papersIndex = null;   // （）
        this.papersTexts = null;   // （）
        this.websiteData = null;   // （PAPERS_DATA）
        this.paperLookup = {
            byId: new Map(),
            byNormalizedTitle: new Map(),
            titlesByLength: []
        };
        
        // 
        this.conversations = [];   // 
        this.currentConversationId = null; // ID
        
        this.init();
    }

    init() {
        this.loadConfig();
        this.createChatInterface();
        this.setupEventListeners();
        this.loadApiKey();
        this.loadPapersTexts();
        this.loadWebsiteData();
        this.loadConversations();
        this.updateApiStatusUI();
        this.updatePaperContextUI();
    }

    loadConfig() {
        if (typeof window === 'undefined' || !window.CHATBOT_CONFIG) {
            return;
        }

        const incoming = window.CHATBOT_CONFIG;
        this.config = {
            ...this.config,
            ...incoming,
            retrieval: {
                ...this.config.retrieval,
                ...(incoming.retrieval || {})
            }
        };

        this.provider = this.config.provider || 'openai';
        this.model = this.config.model || this.model;
        this.modelLabel = this.config.modelLabel || 'Grok 4.5';
        this.apiEndpoint = this.config.apiEndpoint || this.apiEndpoint;

        if (this.config.apiKey && this.config.apiKey.trim() && !this.config.apiKey.includes('PASTE_')) {
            this.apiKey = this.config.apiKey.trim();
            this.hasEmbeddedKey = true;
        }
    }

    async loadPapersTexts() {
        // （）
        try {
            const response = await fetch('papers-index.json');
            if (response.ok) {
                this.papersIndex = await response.json();
                console.log(`Loaded ${Object.keys(this.papersIndex).length} paper index entries`);
            }
        } catch (error) {
            console.warn('Unable to load paper index:', error);
        }
    }

    loadWebsiteData() {
        // （PAPERS_DATA）
        if (typeof PAPERS_DATA !== 'undefined') {
            this.websiteData = PAPERS_DATA;
            this.buildPaperLookup();
            console.log(`Loaded website data: ${PAPERS_DATA.papers.length} papers`);
        } else {
            console.warn('PAPERS_DATA is not available');
        }
    }

    buildPaperLookup() {
        const papers = this.getArchivePapers();
        const byId = new Map();
        const byNormalizedTitle = new Map();

        papers.forEach((paper) => {
            if (!paper || !paper.title) {
                return;
            }

            if (paper.id !== undefined && paper.id !== null) {
                byId.set(String(paper.id), paper);
            }

            const normalizedTitle = this.normalizePaperTitle(paper.title);
            if (normalizedTitle && !byNormalizedTitle.has(normalizedTitle)) {
                byNormalizedTitle.set(normalizedTitle, paper);
            }
        });

        this.paperLookup = {
            byId,
            byNormalizedTitle,
            titlesByLength: Array.from(byNormalizedTitle.entries())
                .map(([normalizedTitle, paper]) => ({
                    normalizedTitle,
                    title: paper.title,
                    lowerTitle: paper.title.toLowerCase(),
                    paper
                }))
                .filter((item) => item.title.length >= 12)
                .sort((a, b) => b.title.length - a.title.length)
        };
    }

    getArchivePapers() {
        if (this.websiteData && Array.isArray(this.websiteData.papers)) {
            return this.websiteData.papers;
        }

        if (typeof PAPERS_DATA !== 'undefined' && Array.isArray(PAPERS_DATA.papers)) {
            return PAPERS_DATA.papers;
        }

        return [];
    }

    normalizePaperTitle(title = '') {
        return String(title)
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201c\u201d]/g, '"')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async loadFullPaperText(filename) {
        // 
        if (!this.papersTexts) {
            console.log('📥 Loading complete paper data...');
            try {
                const response = await fetch('papers-texts.json');
                if (response.ok) {
                    this.papersTexts = await response.json();
                    console.log('✅ Complete data loaded successfully');
                } else {
                    throw new Error('Failed to load paper data');
                }
            } catch (error) {
                console.error('❌ Loading failed:', error);
                throw error;
            }
        }
        return this.papersTexts[filename];
    }

    loadPaper(paperTitle, paperData) {
        // 
        this.currentPaper = {
            title: paperTitle,
            ...paperData
        };
        this.updatePaperContextUI();
        
        // 
        if (!this.isOpen) {
            this.openChat();
        }
        
        // 
        setTimeout(() => {
            this.addMessage('System', `Loaded paper: "${paperTitle}"\nYou can now ask anything about this paper.`, 'system');
        }, 500);
    }

    loadApiKey() {
        if (this.hasEmbeddedKey) {
            localStorage.removeItem('gemini_api_key');
            return;
        }
        const savedKey = localStorage.getItem('grok_api_key');
        if (savedKey) {
            this.apiKey = savedKey;
        }
    }

    saveApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('grok_api_key', key);
        this.updateApiStatusUI();
    }

    createChatInterface() {
        const apiStatusLabel = this.hasEmbeddedKey
            ? 'Embedded API Ready'
            : (this.apiKey ? 'API Configured' : 'API Needed');

        const chatHTML = `
            <div class="chatbot-container" id="chatbotContainer">
                <div class="chatbot-sidebar">
                    <div class="sidebar-header">
                        <button id="newChatBtn" class="new-chat-btn">
                            <span>+</span>
                            <span>New chat</span>
                        </button>
                        <div class="sidebar-caption">Research sessions</div>
                    </div>
                    <div id="conversationsList" class="conversations-list">
                    </div>
                </div>
                
                <div class="chatbot-main">
                    <div class="chatbot-header">
                        <div class="chatbot-header-main">
                            <div class="chatbot-header-content">
                                <div class="chatbot-avatar">AI</div>
                                <div class="chatbot-title">
                                    <h3>Research Assistant</h3>
                                    <p id="chatbotModelLabel">${this.modelLabel}</p>
                                </div>
                            </div>
                            <div class="chatbot-toolbar">
                                <span class="chatbot-status ${this.apiKey ? 'ready' : 'missing'}" id="chatbotApiStatus">${apiStatusLabel}</span>
                                <button type="button" class="chatbot-toolbar-btn" id="chatbotPaperBtn">Browse papers</button>
                                <button type="button" class="chatbot-toolbar-btn" id="chatbotSettingsBtn">${this.hasEmbeddedKey ? 'Config' : 'API'}</button>
                            </div>
                        </div>
                        <button class="chatbot-close" id="chatbotClose" title="Close Chat (Esc)" aria-label="Close chatbot">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <div class="chatbot-paper-context" id="chatbotPaperContext" hidden>
                        <div class="chatbot-paper-context-copy">
                            <span class="chatbot-paper-context-label">Current paper</span>
                            <strong id="chatbotCurrentPaperTitle">No paper selected</strong>
                        </div>
                        <button type="button" class="chatbot-paper-context-clear" id="chatbotClearPaper">Clear</button>
                    </div>
                    
                    <div class="chatbot-messages" id="chatbotMessages">
                        <div class="chatbot-welcome">
                            <span class="welcome-eyebrow">Microgesture archive · research workspace</span>
                            <div class="welcome-icon">◌</div>
                            <h4>Research with context.</h4>
                            <p>Search papers, compare methods, summarize a selected paper, or ask for trends across the archive.</p>
                            <div class="chatbot-suggestions">
                                <button type="button" class="chatbot-suggestion" data-prompt="Find papers about smart ring interaction.">Smart ring papers</button>
                                <button type="button" class="chatbot-suggestion" data-prompt="Compare EMG-based and IMU-based gesture research.">Compare EMG vs IMU</button>
                                <button type="button" class="chatbot-suggestion" data-prompt="What are the recent trends in microgesture research after 2020?">Recent trends</button>
                                <button type="button" class="chatbot-suggestion" data-prompt="Recommend papers about text input on wearables.">Recommend text input papers</button>
                            </div>
                        </div>
                    </div>

                    <div class="chatbot-input-shell">
                        <div class="chatbot-input-container">
                            <div class="chatbot-input-wrapper">
                                <textarea 
                                    class="chatbot-input" 
                                    id="chatbotInput" 
                                    placeholder="Message the research assistant..."
                                    rows="1"
                                ></textarea>
                                <div class="chatbot-input-actions">
                                    <span class="chatbot-input-hint">Enter to send, Shift+Enter for a new line</span>
                                    <button class="chatbot-send" id="chatbotSend" aria-label="Send message">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="chatbot-paper-selector" id="chatbotPaperSelector" style="display: none;">
                    <div class="paper-selector-header">
                        <h4>Select a Paper to Discuss</h4>
                        <button class="paper-selector-close" id="paperSelectorClose">×</button>
                    </div>
                    <div class="paper-search">
                        <input type="text" id="paperSearchInput" placeholder="Search paper title..." />
                    </div>
                    <div class="paper-list" id="paperList">
                        <div class="paper-loading">Loading...</div>
                    </div>
                </div>
                
                <div class="chatbot-settings" id="chatbotSettings" style="display: none;">
                    <div class="settings-content">
                        <h4>API Configuration</h4>
                        <p class="settings-description" id="chatbotSettingsDescription">${this.hasEmbeddedKey ? 'An embedded Grok API configuration is active for this build. You can still inspect or replace it here for testing.' : 'Enter your Grok API key to start chatting.'}</p>
                        <a href="https://api.duckcoding.ai" target="_blank" rel="noopener" class="api-link">Open DuckCoding API →</a>
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
            </button>
        `;
        
        document.body.insertAdjacentHTML('beforeend', chatHTML);
    }

    setupEventListeners() {
        const toggle = document.getElementById('chatbotToggle');
        const close = document.getElementById('chatbotClose');
        const send = document.getElementById('chatbotSend');
        const input = document.getElementById('chatbotInput');
        const settingsBtn = document.getElementById('chatbotSettingsBtn');
        const settingsSave = document.getElementById('settingsSave');
        const settingsCancel = document.getElementById('settingsCancel');
        const paperBtn = document.getElementById('chatbotPaperBtn');
        const paperSelectorClose = document.getElementById('paperSelectorClose');
        const paperSearchInput = document.getElementById('paperSearchInput');
        const newChatBtn = document.getElementById('newChatBtn');
        const clearPaperBtn = document.getElementById('chatbotClearPaper');
        
        if (toggle) toggle.addEventListener('click', () => this.toggleChat());
        if (close) close.addEventListener('click', () => this.closeChat());
        if (send) send.addEventListener('click', () => this.sendMessage());
        
        // 
        if (newChatBtn) newChatBtn.addEventListener('click', () => this.createNewConversation());
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.showSettings());
        if (clearPaperBtn) clearPaperBtn.addEventListener('click', () => this.clearCurrentPaperContext());
        
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            input.addEventListener('input', () => {
                this.autoResizeTextarea(input);
            });
        }

        // ESC key to close chatbot
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeChat();
            }
        });
        
        if (settingsSave) settingsSave.addEventListener('click', () => this.saveSettings());
        if (settingsCancel) settingsCancel.addEventListener('click', () => this.hideSettings());
        
        // 
        if (paperBtn) paperBtn.addEventListener('click', () => this.showPaperSelector());
        if (paperSelectorClose) paperSelectorClose.addEventListener('click', () => this.hidePaperSelector());
        
        // 
        if (paperSearchInput) {
            paperSearchInput.addEventListener('input', (e) => {
                this.filterPapers(e.target.value);
            });
        }

        document.querySelectorAll('.chatbot-suggestion').forEach((button) => {
            button.addEventListener('click', () => {
                const prompt = button.dataset.prompt || '';
                const chatInput = document.getElementById('chatbotInput');
                if (!chatInput) return;
                chatInput.value = prompt;
                this.autoResizeTextarea(chatInput);
                chatInput.focus();
            });
        });
    }

    showPaperSelector() {
        const selector = document.getElementById('chatbotPaperSelector');
        selector.style.display = 'flex';
        
        // （）
        if (this.papersIndex && Object.keys(this.papersIndex).length > 0) {
            this.renderPaperList();
        } else {
            document.getElementById('paperList').innerHTML = '<div class="paper-loading">Loading paper list...</div>';
        }
    }

    hidePaperSelector() {
        const selector = document.getElementById('chatbotPaperSelector');
        selector.style.display = 'none';
        document.getElementById('paperSearchInput').value = '';
    }

    renderPaperList(filterText = '') {
        const paperList = document.getElementById('paperList');
        const papers = Object.values(this.papersIndex || {});
        
        // 
        const filtered = filterText
            ? papers.filter(p => p.title.toLowerCase().includes(filterText.toLowerCase()))
            : papers;
        
        if (filtered.length === 0) {
            paperList.innerHTML = '<div class="paper-empty">No matching papers found</div>';
            return;
        }
        
        // 
        paperList.innerHTML = filtered.map(paper => `
            <div class="paper-item-selector" data-filename="${paper.filename}">
                <div class="paper-item-title">${paper.title}</div>
                <div class="paper-item-preview">${paper.preview}</div>
            </div>
        `).join('');
        
        // 
        paperList.querySelectorAll('.paper-item-selector').forEach(item => {
            item.addEventListener('click', async () => {
                const filename = item.dataset.filename;
                await this.selectPaperByFilename(filename);
            });
        });
    }

    filterPapers(filterText) {
        this.renderPaperList(filterText);
    }

    async selectPaperByFilename(filename) {
        try {
            // 
            this.hidePaperSelector();
            const messagesContainer = document.getElementById('chatbotMessages');
            messagesContainer.innerHTML = '';
            this.addMessage('System', 'Loading paper content, please wait...', 'system');
            
            // 
            const paper = await this.loadFullPaperText(filename);
            
            if (!paper) {
                throw new Error('Failed to load paper data');
            }
            
            // 
            this.currentPaper = paper;
            this.updatePaperContextUI();
            
            // 
            this.conversationHistory = [];
            messagesContainer.innerHTML = '';
            
            // 
            this.addMessage('System', `Paper loaded: "${paper.title}"\n\nYou can now ask anything about this paper.\n\nExample questions:\n- What are the main contributions?\n- What research methods were used?\n- What are the experimental results?\n- What are the limitations?\n- What future work is suggested?`, 'system');
            
        } catch (error) {
            this.addMessage('System', `❌ Loading failed: ${error.message}\nPlease check your network connection and try again.`, 'error');
        }
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    updateApiStatusUI() {
        const status = document.getElementById('chatbotApiStatus');
        const description = document.getElementById('chatbotSettingsDescription');
        if (status) {
            const hasKey = Boolean(this.apiKey);
            status.textContent = this.hasEmbeddedKey
                ? 'Embedded API Ready'
                : (hasKey ? 'API Configured' : 'API Needed');
            status.classList.toggle('ready', hasKey);
            status.classList.toggle('missing', !hasKey);
        }

        if (description) {
            description.textContent = this.hasEmbeddedKey
                ? 'An embedded API configuration is active for this build. You can still inspect or replace it here for testing.'
                : 'Enter your Grok API key to start chatting.';
        }
    }

    updatePaperContextUI() {
        const container = document.getElementById('chatbotPaperContext');
        const title = document.getElementById('chatbotCurrentPaperTitle');
        if (!container || !title) {
            return;
        }

        if (this.currentPaper && this.currentPaper.title) {
            container.hidden = false;
            title.textContent = this.currentPaper.title;
        } else {
            container.hidden = true;
            title.textContent = 'No paper selected';
        }
    }

    clearCurrentPaperContext() {
        this.currentPaper = null;
        this.updatePaperContextUI();
        this.addMessage('System', 'Paper context cleared. I will answer using the archive-wide knowledge base.', 'system');
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
        
        container.classList.add('active');
        toggle.classList.add('active');
        this.isOpen = true;
        this.updateApiStatusUI();
        this.updatePaperContextUI();
        
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
        this.hidePaperSelector();
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
        let message = input.value.trim();
        
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
        
        let relevantPapers = [];
        let directResponse = null;
        
        if (this.websiteData && this.websiteData.papers) {
            const analysis = this.analyzeDatabase(message);
            if (analysis) {
                directResponse = this.formatAnalysisResult(analysis, message);
            }
            
            if (!directResponse && /what is|define|explain|meaning of/i.test(message)) {
                const knowledge = this.getDomainKnowledge();
                const lowerMsg = message.toLowerCase();
                
                for (const [term, definition] of Object.entries(knowledge.terms)) {
                    if (lowerMsg.includes(term)) {
                        const relatedCount = this.websiteData.papers.filter(p => {
                            const text = JSON.stringify(p).toLowerCase();
                            return text.includes(term);
                        }).length;
                        directResponse = `📖 **${term.toUpperCase()}**: ${definition}\n\nRelated papers in the archive using this term: **${relatedCount}**`;
                        break;
                    }
                }
            }
            
            if (!directResponse) {
                relevantPapers = this.searchPapers(message);
                
                if (relevantPapers.length > 0) {
                    relevantPapers = relevantPapers.slice(0, this.config.retrieval.maxRelevantPapers);
                    await this.loadPaperTexts(relevantPapers);
                    
                    if (/recommend|suggest|similar|related|also|like this/i.test(message) && relevantPapers.length > 0) {
                        const recommendations = this.recommendPapers(relevantPapers[0], 5);
                        const seenTitles = new Set(relevantPapers.map((paper) => paper.title));
                        recommendations.forEach((paper) => {
                            if (!seenTitles.has(paper.title)) {
                                relevantPapers.push(paper);
                                seenTitles.add(paper.title);
                            }
                        });
                        relevantPapers = relevantPapers.slice(0, this.config.retrieval.maxRelevantPapers);
                    }
                }
            }
        }

        if (directResponse) {
            this.conversationHistory.push({
                role: 'user',
                text: message
            });
            this.conversationHistory.push({
                role: 'model',
                text: directResponse
            });
            this.addMessage('AI', directResponse, 'bot');
            return;
        }
        
        // Show loading
        this.showLoading();
        
        try {
            const response = await this.callChatAPI(message, relevantPapers);
            this.hideLoading();
            this.addMessage('AI', response, 'bot');
        } catch (error) {
            this.hideLoading();
            let errorMessage = 'Sorry, I encountered an error. Please check your API key and try again.';
            
            if (error.message.includes('API key')) {
                errorMessage = 'Invalid API key. Please check your settings.';
                setTimeout(() => this.showSettings(), 1000);
            } else if (error.message.includes('quota')) {
                errorMessage = 'API quota exceeded. Please check your DuckCoding account.';
            }
            
            this.addMessage('System', errorMessage, 'error');
        }
    }

    async callChatAPI(message, relevantPapers = []) {
        const messages = [];

        if (this.conversationHistory.length === 0) {
            messages.push({
                role: 'system',
                content: this.buildContext()
            });
        }

        if (relevantPapers.length > 0) {
            const knowledgeContext = this.buildKnowledgeContext(relevantPapers, message);
            if (knowledgeContext) {
                messages.push({
                    role: 'system',
                    content: knowledgeContext
                });
            }
        }

        const recentHistory = this.conversationHistory.slice(-this.config.retrieval.maxHistoryMessages);
        recentHistory.forEach(item => {
            messages.push({
                role: item.role === 'model' ? 'assistant' : item.role,
                content: item.text
            });
        });

        messages.push({
            role: 'user',
            content: message
        });

        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                temperature: 0.7,
                max_tokens: this.config.maxResponseTokens || 3072
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }
        
        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content || 'No response generated';

        this.conversationHistory.push({
            role: 'user',
            text: message
        });
        this.conversationHistory.push({
            role: 'model',
            text: aiResponse
        });
        
        return aiResponse;
    }

    /**
     * 🔬 ：
     */
    async loadPaperTexts(papers) {
        if (!this.papersTexts) {
            try {
                const response = await fetch('papers-texts.json');
                this.papersTexts = await response.json();
                console.log('Paper full texts loaded:', Object.keys(this.papersTexts).length, 'papers');
            } catch (error) {
                console.error('Error loading papers texts:', error);
                return;
            }
        }
        
        // 
        papers.forEach(paper => {
            const filename = paper.pdfFile || paper.filename;
            if (filename && this.papersTexts[filename]) {
                paper.fullText = this.papersTexts[filename].text;
                paper.fullTextLength = this.papersTexts[filename].length || paper.fullText.length;
                
                // 🔬 ：
                paper.extractedData = this.extractPaperStructure(paper.fullText, paper);
            }
        });
    }

    /**
     * 🔬  - 
     */
    extractPaperStructure(fullText, paper) {
        if (!fullText) return null;

        const extracted = {
            abstract: '',
            methods: '',
            results: '',
            evaluation: '',
            metrics: {},
            contributions: [],
            limitations: []
        };

        // 1. （1000）
        extracted.abstract = fullText.substring(0, 1000);

        // 2. 
        const methodSections = this.findSections(fullText, [
            'method', 'approach', 'technique', 'implementation', 'system design', 'algorithm'
        ]);
        extracted.methods = methodSections.slice(0, 3000).join(' ');

        // 3. /
        const resultSections = this.findSections(fullText, [
            'result', 'evaluation', 'experiment', 'user study', 'performance', 'accuracy'
        ]);
        extracted.results = resultSections.slice(0, 3000).join(' ');

        // 4. 
        extracted.metrics = this.extractMetrics(fullText);

        // 5. 
        extracted.contributions = this.extractContributions(fullText);

        // 6. 
        extracted.limitations = this.extractLimitations(fullText);

        return extracted;
    }

    /**
     * 
     */
    findSections(text, keywords) {
        const sections = [];
        const lines = text.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            
            // 
            for (const keyword of keywords) {
                if (line.includes(keyword) && line.length < 100) {
                    // ，
                    const sectionText = lines.slice(i, Math.min(i + 50, lines.length)).join(' ');
                    sections.push(sectionText);
                    break;
                }
            }
        }
        
        return sections;
    }

    /**
     * 🔬 （）
     */
    extractMetrics(text) {
        const metrics = {
            accuracy: [],
            precision: [],
            recall: [],
            f1_score: [],
            latency: [],
            fps: [],
            users: [],
            gestures: []
        };

        //  (accuracy, recognition rate)
        const accuracyRegex = /(\d+\.?\d*)\s*%?\s*(accuracy|recognition rate|correct|success rate)/gi;
        let match;
        while ((match = accuracyRegex.exec(text)) !== null) {
            const value = parseFloat(match[1]);
            if (value > 50 && value <= 100) { // 
                metrics.accuracy.push(value);
            }
        }

        //  (latency, delay, response time)
        const latencyRegex = /(\d+\.?\d*)\s*(ms|millisecond|second)/gi;
        while ((match = latencyRegex.exec(text)) !== null) {
            const value = parseFloat(match[1]);
            const unit = match[2].toLowerCase();
            // ms
            const latencyMs = unit.includes('second') && !unit.includes('milli') ? value * 1000 : value;
            if (latencyMs < 10000) { // 
                metrics.latency.push(latencyMs);
            }
        }

        // FPS (frames per second)
        const fpsRegex = /(\d+\.?\d*)\s*(fps|frame.*per.*second)/gi;
        while ((match = fpsRegex.exec(text)) !== null) {
            metrics.fps.push(parseFloat(match[1]));
        }

        //  (participants, users, subjects)
        const userRegex = /(\d+)\s*(participant|user|subject|people)/gi;
        while ((match = userRegex.exec(text)) !== null) {
            const value = parseInt(match[1]);
            if (value > 0 && value < 1000) { // 
                metrics.users.push(value);
            }
        }

        // 
        const gestureRegex = /(\d+)\s*(gesture|motion|action|class|command)/gi;
        while ((match = gestureRegex.exec(text)) !== null) {
            const value = parseInt(match[1]);
            if (value > 0 && value < 100) {
                metrics.gestures.push(value);
            }
        }

        // 
        for (const key in metrics) {
            if (metrics[key].length > 0) {
                const avg = metrics[key].reduce((a, b) => a + b, 0) / metrics[key].length;
                metrics[key + '_avg'] = Math.round(avg * 100) / 100;
                metrics[key + '_max'] = Math.max(...metrics[key]);
                metrics[key + '_count'] = metrics[key].length;
            }
        }

        return metrics;
    }

    /**
     * 
     */
    extractContributions(text) {
        const contributions = [];
        const contributionKeywords = [
            'we contribute', 'our contribution', 'we present', 'we propose',
            'we introduce', 'we demonstrate', 'our work', 'key contribution'
        ];

        const sentences = text.split(/[.!?]\s+/);
        for (const sentence of sentences) {
            const lower = sentence.toLowerCase();
            for (const keyword of contributionKeywords) {
                if (lower.includes(keyword) && sentence.length < 300) {
                    contributions.push(sentence.trim());
                    break;
                }
            }
        }

        return contributions.slice(0, 5); // 5
    }

    /**
     * 
     */
    extractLimitations(text) {
        const limitations = [];
        const limitKeywords = [
            'limitation', 'limit', 'drawback', 'weakness', 'challenge',
            'future work', 'not able to', 'unable to', 'however'
        ];

        const sentences = text.split(/[.!?]\s+/);
        for (const sentence of sentences) {
            const lower = sentence.toLowerCase();
            for (const keyword of limitKeywords) {
                if (lower.includes(keyword) && sentence.length < 300) {
                    limitations.push(sentence.trim());
                    break;
                }
            }
        }

        return limitations.slice(0, 5); // 5
    }

    /**
     * 📊 1：
     */
    analyzeDatabase(query) {
        if (!this.websiteData || !this.websiteData.papers) {
            return null;
        }

        const papers = this.websiteData.papers;
        const lowerQuery = query.toLowerCase();
        
        // 
        const isStatQuery = /how many|count|number of|statistics|trend|popular|most used|distribution|compare.*papers/i.test(query);
        const isTrendQuery = /trend|evolution|history|over time|year|timeline/i.test(query);
        const isHardwareQuery = /hardware|device|sensor|equipment/i.test(query);
        const isAppQuery = /application|scenario|use case|domain/i.test(query);
        const isYearQuery = /\b20\d{2}\b/.test(query);
        
        if (!isStatQuery && !isTrendQuery && !isHardwareQuery && !isAppQuery && !isYearQuery) {
            return null; // 
        }

        const analysis = {
            type: 'statistical_analysis',
            total: papers.length,
            yearRange: {},
            hardware: {},
            applications: {},
            gestures: {},
            categories: {},
            conferences: {}
        };

        // 
        papers.forEach(paper => {
            // 
            const year = paper.year || 'Unknown';
            analysis.yearRange[year] = (analysis.yearRange[year] || 0) + 1;

            // 
            const category = paper.category || 'Unknown';
            analysis.categories[category] = (analysis.categories[category] || 0) + 1;

            // 
            if (paper.hardwareDevices) {
                paper.hardwareDevices.forEach(hw => {
                    analysis.hardware[hw] = (analysis.hardware[hw] || 0) + 1;
                });
            }

            // 
            if (paper.applicationScenarios) {
                paper.applicationScenarios.forEach(app => {
                    analysis.applications[app] = (analysis.applications[app] || 0) + 1;
                });
            }

            // 
            if (paper.gestureTypes) {
                paper.gestureTypes.forEach(gest => {
                    analysis.gestures[gest] = (analysis.gestures[gest] || 0) + 1;
                });
            }

            // 
            if (paper.conferenceName) {
                const conf = paper.conferenceName.split(':')[0].trim(); // 
                analysis.conferences[conf] = (analysis.conferences[conf] || 0) + 1;
            }
        });

        // 
        analysis.topHardware = Object.entries(analysis.hardware)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        analysis.topApplications = Object.entries(analysis.applications)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        analysis.topGestures = Object.entries(analysis.gestures)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        analysis.topConferences = Object.entries(analysis.conferences)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        analysis.yearTrend = Object.entries(analysis.yearRange)
            .filter(([year]) => year !== 'Unknown')
            .sort((a, b) => a[0] - b[0]);

        return analysis;
    }

    /**
     * 
     */
    formatAnalysisResult(analysis, query) {
        if (!analysis) return null;

        let result = '📊 **Database Statistical Analysis**\n\n';
        result += `**Overview:** ${analysis.total} gesture interaction research papers (${analysis.yearTrend[0]?.[0] || '2002'}-${analysis.yearTrend[analysis.yearTrend.length-1]?.[0] || '2025'})\n\n`;

        // 
        if (/trend|timeline|evolution|history|over time/i.test(query)) {
            result += '## 📈 Research Trend by Year\n';
            const recentYears = analysis.yearTrend.slice(-10);
            recentYears.forEach(([year, count]) => {
                const bar = '█'.repeat(Math.ceil(count / 2));
                result += `${year}: ${bar} (${count} papers)\n`;
            });
            result += '\n';
        }

        // 
        if (/hardware|device|sensor/i.test(query) || analysis.topHardware.length > 0) {
            result += '## 🔧 Most Used Hardware/Sensors\n';
            analysis.topHardware.slice(0, 8).forEach(([hw, count], idx) => {
                result += `${idx + 1}. **${hw}**: ${count} papers\n`;
            });
            result += '\n';
        }

        // 
        if (/application|scenario|use case/i.test(query) || analysis.topApplications.length > 0) {
            result += '## 🎯 Application Scenarios\n';
            analysis.topApplications.slice(0, 8).forEach(([app, count], idx) => {
                result += `${idx + 1}. **${app}**: ${count} papers\n`;
            });
            result += '\n';
        }

        // 
        if (Object.keys(analysis.categories).length > 0) {
            result += '## 📚 Research Categories\n';
            Object.entries(analysis.categories)
                .sort((a, b) => b[1] - a[1])
                .forEach(([cat, count]) => {
                    const percentage = ((count / analysis.total) * 100).toFixed(1);
                    result += `- **${cat}**: ${count} papers (${percentage}%)\n`;
                });
            result += '\n';
        }

        // 
        if (analysis.topConferences.length > 0) {
            result += '## 🏆 Top Conferences/Journals\n';
            analysis.topConferences.slice(0, 5).forEach(([conf, count], idx) => {
                result += `${idx + 1}. ${conf}: ${count} papers\n`;
            });
            result += '\n';
        }

        result += '\n*This analysis is generated from the complete database of ' + analysis.total + ' papers.*';
        
        return result;
    }

    /**
     * 🔬  - 
     */
    buildKnowledgeContext(papers, query = '') {
        if (!papers || papers.length === 0) return '';
        
        // 
        const queryLower = query.toLowerCase();
        const isMethodQuery = /method|approach|technique|algorithm|how.*work|implement/i.test(query);
        const isResultQuery = /accuracy|precision|result|performance|evaluation|metric|achieve/i.test(query);
        const isCompareQuery = /compare|versus|vs|difference|better/i.test(query);
        const isOverviewQuery = /overview|summary|introduce|what is|tell me about/i.test(query);
        
        let context = '📚 **KNOWLEDGE BASE - Relevant Research Papers:**\n\n';
        
        papers.forEach((paper, index) => {
            context += `## Paper ${index + 1}: ${paper.title}\n`;
            context += `**Author:** ${paper.firstAuthor || paper.authors || 'Unknown'}\n`;
            context += `**Year:** ${paper.year || 'Unknown'}\n`;
            context += `**Conference:** ${paper.conferenceName || 'Unknown'}\n`;
            
            if (paper.hardwareDevices && paper.hardwareDevices.length > 0) {
                context += `**Hardware:** ${paper.hardwareDevices.join(', ')}\n`;
            }
            if (paper.applicationScenarios && paper.applicationScenarios.length > 0) {
                context += `**Applications:** ${paper.applicationScenarios.join(', ')}\n`;
            }
            
            // 🔬 
            if (paper.extractedData) {
                const data = paper.extractedData;
                
                // （）
                if (data.abstract) {
                    context += `\n**ABSTRACT:**\n${data.abstract.substring(0, 800)}...\n`;
                }
                
                // ，
                if (isMethodQuery && data.methods) {
                    context += `\n**METHODS:**\n${data.methods.substring(0, 2000)}...\n`;
                }
                
                // ，
                if (isResultQuery) {
                    if (data.results) {
                        context += `\n**RESULTS:**\n${data.results.substring(0, 2000)}...\n`;
                    }
                    
                    // 
                    if (data.metrics && Object.keys(data.metrics).length > 0) {
                        context += `\n**KEY METRICS:**\n`;
                        if (data.metrics.accuracy_avg) {
                            context += `- Accuracy: ${data.metrics.accuracy_avg}% (from ${data.metrics.accuracy_count} measurements)\n`;
                        }
                        if (data.metrics.latency_avg) {
                            context += `- Latency: ${data.metrics.latency_avg}ms (max: ${data.metrics.latency_max}ms)\n`;
                        }
                        if (data.metrics.users_avg) {
                            context += `- User Study: ${Math.round(data.metrics.users_avg)} participants\n`;
                        }
                        if (data.metrics.gestures_avg) {
                            context += `- Gestures: ${Math.round(data.metrics.gestures_avg)} gesture types\n`;
                        }
                    }
                }
                
                // ，
                if (isCompareQuery) {
                    if (data.methods) {
                        context += `\n**METHODS:**\n${data.methods.substring(0, 1500)}...\n`;
                    }
                    if (data.results) {
                        context += `\n**RESULTS:**\n${data.results.substring(0, 1500)}...\n`;
                    }
                    // 
                    if (data.metrics.accuracy_avg) {
                        context += `\n**Performance:** Accuracy: ${data.metrics.accuracy_avg}%\n`;
                    }
                }
                
                // ，
                if (isOverviewQuery || (!isMethodQuery && !isResultQuery && !isCompareQuery)) {
                    if (data.contributions && data.contributions.length > 0) {
                        context += `\n**KEY CONTRIBUTIONS:**\n`;
                        data.contributions.slice(0, 3).forEach((contrib, i) => {
                            context += `${i + 1}. ${contrib}\n`;
                        });
                    }
                    
                    if (data.limitations && data.limitations.length > 0) {
                        context += `\n**LIMITATIONS:**\n`;
                        data.limitations.slice(0, 2).forEach((limit, i) => {
                            context += `${i + 1}. ${limit}\n`;
                        });
                    }
                }
            } else if (paper.fullText) {
                // ，
                const maxLength = 8000;
                const text = paper.fullText.length > maxLength 
                    ? paper.fullText.substring(0, maxLength) + '...(truncated)'
                    : paper.fullText;
                context += `\n**CONTENT:**\n${text}\n`;
            }
            
            context += '\n' + '='.repeat(80) + '\n\n';
        });
        
        // 
        context += '\n**INSTRUCTIONS:**\n';
        context += '- Answer based on the papers above with specific citations\n';
        context += '- When citing or recommending archive papers, use the exact paper title naturally in the sentence or list item\n';
        context += '- Always mention paper title, author, and year when discussing results\n';
        context += '- Provide quantitative data (accuracy %, latency ms, etc.) when available\n';
        
        if (isMethodQuery) {
            context += '- Focus on technical methods, algorithms, and implementation details\n';
            context += '- Explain how the system works step-by-step\n';
        } else if (isResultQuery) {
            context += '- Emphasize numerical results and evaluation metrics\n';
            context += '- Compare performance across papers if multiple are provided\n';
        } else if (isCompareQuery) {
            context += '- Provide systematic comparison across all papers\n';
            context += '- Highlight similarities, differences, and tradeoffs\n';
            context += '- Use tables or structured format for clarity\n';
        }
        
        context += '- If information is not in these papers, clearly state that\n\n';
        
        return context;
    }

    normalizeQueryText(text = '') {
        return text
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    expandQueryKeywords(query) {
        const normalized = this.normalizeQueryText(query);
        const synonymMap = {
            microgesture: ['micro gesture', 'subtle gesture'],
            gesture: ['gestures', 'interaction gesture'],
            ring: ['smart ring', 'finger worn'],
            smartwatch: ['smart watch', 'watch'],
            earbuds: ['ear worn', 'ear based interaction'],
            glasses: ['smart glasses', 'ar glasses'],
            emg: ['electromyography', 'muscle signal'],
            imu: ['inertial measurement unit', 'accelerometer', 'gyroscope'],
            radar: ['rf sensing', 'millimeter wave', 'mmwave'],
            acoustic: ['audio', 'sound based'],
            haptic: ['vibrotactile', 'tactile'],
            'text input': ['typing', 'keyboard', 'text entry'],
            accessibility: ['visual impairment', 'assistive'],
            ar: ['augmented reality'],
            vr: ['virtual reality'],
            recommend: ['similar', 'related'],
            compare: ['comparison', 'difference']
        };

        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'what', 'how', 'which', 'about', 'can', 'you', 'i', 'tell', 'me', 'show', 'please', 'find', 'search'];
        const tokens = normalized.split(/\s+/).filter((word) => word.length > 1 && !stopWords.includes(word));
        const expanded = new Set(tokens);

        Object.entries(synonymMap).forEach(([term, alternatives]) => {
            if (normalized.includes(term) || tokens.includes(term)) {
                alternatives.forEach((alt) => expanded.add(alt));
            }
        });

        tokens.forEach((token) => {
            Object.entries(synonymMap).forEach(([term, alternatives]) => {
                if (alternatives.includes(token)) {
                    expanded.add(term);
                }
            });
        });

        return Array.from(expanded).slice(0, 16);
    }

    /**
     * 📊 3：RAG - 
     */
    searchPapers(query) {
        if (!this.websiteData || !this.websiteData.papers) {
            return [];
        }
        
        const lowerQuery = this.normalizeQueryText(query);
        const keywords = this.expandQueryKeywords(query);
        
        // 
        const isCompareQuery = /compare|versus|vs|difference|better|which/i.test(query);
        const isMethodQuery = /method|approach|technique|algorithm|how.*work/i.test(query);
        const isResultQuery = /accuracy|precision|result|performance|evaluation/i.test(query);
        
        // 
        const scoredPapers = this.websiteData.papers.map(paper => {
            let score = 0;
            const title = this.normalizeQueryText(paper.title || '');
            const author = this.normalizeQueryText(paper.authors || paper.firstAuthor || '');
            const conf = this.normalizeQueryText(paper.conferenceName || '');
            const category = this.normalizeQueryText(paper.category || '');
            const allTags = [
                ...(paper.hardwareDevices || []),
                ...(paper.applicationScenarios || []),
                ...(paper.gestureTypes || []),
                ...(paper.recognitionClassification || []),
                ...(paper.sensingTechnology || []),
                ...(paper.interactionModalities || []),
                ...(paper.feedbackOutput || []),
                ...(paper.userExperienceDesign || [])
            ].map(t => this.normalizeQueryText(t)).join(' ');
            const searchableText = `${title} ${author} ${conf} ${category} ${allTags}`;
            
            //  - 
            if (title.includes(lowerQuery)) score += 100;
            if (searchableText.includes(lowerQuery)) score += 30;
            
            // （）
            keywords.forEach(kw => {
                if (title.includes(kw)) score += 18;
                if (author.includes(kw)) score += 8;
                if (allTags.includes(kw)) score += 9;
                if (category.includes(kw)) score += 7;
                if (conf.includes(kw)) score += 4;
                if (searchableText.includes(kw)) score += 2;
            });
            
            // 
            if (paper.year && lowerQuery.includes(paper.year.toString())) {
                score += 10;
            }
            
            // 
            if (isMethodQuery && (title.includes('method') || title.includes('approach'))) {
                score += 10;
            }
            if (isResultQuery && (title.includes('evaluat') || title.includes('study'))) {
                score += 10;
            }
            
            // （CHI, UIST）
            const topConferences = ['CHI', 'UIST', 'MobileHCI', 'SIGGRAPH'];
            if (topConferences.some(tc => conf.includes(tc.toLowerCase()))) {
                score += 5;
            }
            
            // 
            if (paper.year && paper.year >= 2020) {
                score += 2;
            }
            
            return { paper, score };
        });
        
        // 
        const results = scoredPapers
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.paper);
        
        // ，
        const limit = isCompareQuery
            ? Math.max(this.config.retrieval.maxRelevantPapers, 8)
            : this.config.retrieval.maxRelevantPapers;
        return results.slice(0, limit);
    }

    /**
     * 4：
     */
    getDomainKnowledge() {
        return {
            // 
            terms: {
                'imu': 'Inertial Measurement Unit - sensors that measure motion via accelerometer and gyroscope',
                'emg': 'Electromyography - measures electrical activity of muscles',
                'capacitive': 'Sensing based on changes in electrical capacitance',
                'rf': 'Radio Frequency - wireless electromagnetic signals',
                'acoustic': 'Sound-based sensing using speakers and microphones',
                'depth camera': 'Cameras that capture 3D depth information (e.g., Kinect)',
                'time-of-flight': 'ToF - measures distance by timing light reflection',
                'machine learning': 'ML - algorithms that learn patterns from data',
                'deep learning': 'Neural networks with multiple layers',
                'cnn': 'Convolutional Neural Network - effective for spatial data',
                'rnn': 'Recurrent Neural Network - good for sequential data',
                'lstm': 'Long Short-Term Memory - type of RNN for long sequences',
                'svm': 'Support Vector Machine - classification algorithm',
                'random forest': 'Ensemble learning method using decision trees',
                'k-nn': 'K-Nearest Neighbors - simple classification algorithm',
                'dtw': 'Dynamic Time Warping - compares time series',
                'hmm': 'Hidden Markov Model - statistical sequential model',
                'accuracy': 'Percentage of correct predictions',
                'precision': 'Ratio of true positives to all positives',
                'recall': 'Ratio of true positives to all actual positives',
                'f1-score': 'Harmonic mean of precision and recall',
                'latency': 'Time delay between input and response',
                'throughput': 'Amount of data processed per time unit',
                'user study': 'Research involving human participants',
                'micro-gesture': 'Small, subtle hand or finger movements',
                'on-body': 'Interaction on body surface (skin)',
                'mid-air': 'Gestures performed in the air without touching a surface',
                'smartwatch': 'Wrist-worn computer with sensors',
                'smart ring': 'Finger-worn wearable device',
                'ar': 'Augmented Reality - overlay digital on physical world',
                'vr': 'Virtual Reality - fully immersive digital environment',
                'gesture elicitation': 'Study method to discover user-preferred gestures'
            },
            
            // 
            methods: {
                'vision-based': 'Uses cameras to track hand/finger movements',
                'sensor-based': 'Uses wearable sensors (IMU, EMG, etc.)',
                'acoustic': 'Uses sound waves for gesture sensing',
                'rf-based': 'Uses radio frequency signals',
                'hybrid': 'Combines multiple sensing modalities'
            },
            
            // 
            conferences: {
                'CHI': 'ACM Conference on Human Factors in Computing Systems (top HCI conference)',
                'UIST': 'ACM Symposium on User Interface Software and Technology',
                'MobileHCI': 'International Conference on Human-Computer Interaction with Mobile Devices',
                'SIGGRAPH': 'Special Interest Group on Computer Graphics',
                'UbiComp': 'ACM International Joint Conference on Pervasive and Ubiquitous Computing',
                'ISMAR': 'International Symposium on Mixed and Augmented Reality',
                'IUI': 'International Conference on Intelligent User Interfaces',
                'ISS': 'Interactive Surfaces and Spaces'
            }
        };
    }

    /**
     * 5：
     */
    comparePapers(papers, query) {
        if (!papers || papers.length < 2) {
            return null;
        }

        const comparison = {
            papers: papers.map(p => ({
                title: p.title,
                author: p.firstAuthor || p.authors,
                year: p.year,
                conference: p.conferenceName,
                hardware: p.hardwareDevices || [],
                applications: p.applicationScenarios || [],
                gestures: p.gestureTypes || []
            })),
            commonHardware: [],
            commonApplications: [],
            differences: []
        };

        // 
        if (papers.length >= 2) {
            const hw1 = new Set(papers[0].hardwareDevices || []);
            const hw2 = new Set(papers[1].hardwareDevices || []);
            comparison.commonHardware = [...hw1].filter(h => hw2.has(h));

            const app1 = new Set(papers[0].applicationScenarios || []);
            const app2 = new Set(papers[1].applicationScenarios || []);
            comparison.commonApplications = [...app1].filter(a => app2.has(a));
        }

        // 
        const yearDiff = Math.abs((papers[0].year || 2020) - (papers[1].year || 2020));
        if (yearDiff > 5) {
            comparison.differences.push(`Significant time gap: ${yearDiff} years between papers`);
        }

        return comparison;
    }

    /**
     * 
     */
    formatComparisonResult(comparison) {
        if (!comparison) return null;

        let result = '📊 **Paper Comparison Analysis**\n\n';
        
        comparison.papers.forEach((p, idx) => {
            result += `### Paper ${idx + 1}: ${p.title}\n`;
            result += `- **Author:** ${p.author || 'Unknown'}\n`;
            result += `- **Year:** ${p.year || 'Unknown'}\n`;
            result += `- **Hardware:** ${p.hardware.slice(0, 3).join(', ') || 'Not specified'}\n`;
            result += `- **Applications:** ${p.applications.slice(0, 3).join(', ') || 'Not specified'}\n\n`;
        });

        if (comparison.commonHardware.length > 0) {
            result += `**Common Hardware:** ${comparison.commonHardware.join(', ')}\n\n`;
        }

        if (comparison.commonApplications.length > 0) {
            result += `**Common Applications:** ${comparison.commonApplications.join(', ')}\n\n`;
        }

        if (comparison.differences.length > 0) {
            result += `**Key Differences:**\n`;
            comparison.differences.forEach(diff => {
                result += `- ${diff}\n`;
            });
        }

        return result;
    }

    /**
     * 6：
     */
    recommendPapers(basePaper, count = 5) {
        if (!basePaper || !this.websiteData) {
            return [];
        }

        const papers = this.websiteData.papers.filter(p => p.id !== basePaper.id);
        
        // 
        const scoredPapers = papers.map(paper => {
            let similarity = 0;
            
            // 
            const baseHW = new Set(basePaper.hardwareDevices || []);
            const paperHW = new Set(paper.hardwareDevices || []);
            const hwOverlap = [...baseHW].filter(h => paperHW.has(h)).length;
            similarity += hwOverlap * 10;
            
            // 
            const baseApp = new Set(basePaper.applicationScenarios || []);
            const paperApp = new Set(paper.applicationScenarios || []);
            const appOverlap = [...baseApp].filter(a => paperApp.has(a)).length;
            similarity += appOverlap * 8;
            
            // （±3）
            const yearDiff = Math.abs((paper.year || 2020) - (basePaper.year || 2020));
            if (yearDiff <= 3) {
                similarity += (3 - yearDiff) * 2;
            }
            
            // 
            if (paper.category === basePaper.category) {
                similarity += 5;
            }
            
            // 
            if (paper.firstAuthor === basePaper.firstAuthor) {
                similarity += 15;
            }
            
            return { paper, similarity };
        });
        
        return scoredPapers
            .filter(item => item.similarity > 0)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, count)
            .map(item => item.paper);
    }

    /**
     * 
     */
    formatRecommendations(papers, basePaper) {
        if (!papers || papers.length === 0) return null;

        let result = `💡 **Recommended Papers** (based on "${basePaper.title}")\n\n`;
        
        papers.forEach((paper, idx) => {
            result += `${idx + 1}. **${paper.title}**\n`;
            result += `   - Author: ${paper.firstAuthor || paper.authors || 'Unknown'}\n`;
            result += `   - Year: ${paper.year || 'Unknown'}\n`;
            
            // 
            const reasons = [];
            if (paper.hardwareDevices && basePaper.hardwareDevices) {
                const common = paper.hardwareDevices.filter(h => 
                    basePaper.hardwareDevices.includes(h)
                );
                if (common.length > 0) {
                    reasons.push(`Similar hardware: ${common.slice(0, 2).join(', ')}`);
                }
            }
            if (paper.applicationScenarios && basePaper.applicationScenarios) {
                const common = paper.applicationScenarios.filter(a => 
                    basePaper.applicationScenarios.includes(a)
                );
                if (common.length > 0) {
                    reasons.push(`Similar applications: ${common.slice(0, 2).join(', ')}`);
                }
            }
            if (reasons.length > 0) {
                result += `   - Why: ${reasons.join('; ')}\n`;
            }
            result += '\n';
        });

        return result;
    }

    generateWebsiteDataSummary() {
        if (!this.websiteData || !this.websiteData.papers) {
            return '';
        }
        
        const papers = this.websiteData.papers;
        const totalPapers = papers.length;
        
        // 
        const yearCounts = {};
        papers.forEach(p => {
            const year = p.year || 'Unknown';
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        });
        const yearsData = Object.entries(yearCounts)
            .sort((a, b) => b[0].localeCompare(a[0]));
        
        // 
        const deviceCounts = {};
        papers.forEach(p => {
            if (p.hardwareDevices) {
                p.hardwareDevices.forEach(d => {
                    deviceCounts[d] = (deviceCounts[d] || 0) + 1;
                });
            }
        });
        const topDevices = Object.entries(deviceCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);
        
        // 
        const appCounts = {};
        papers.forEach(p => {
            if (p.applicationScenarios) {
                p.applicationScenarios.forEach(a => {
                    appCounts[a] = (appCounts[a] || 0) + 1;
                });
            }
        });
        const topApps = Object.entries(appCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);
        
        // 
        const gestureCounts = {};
        papers.forEach(p => {
            if (p.gestureTypes) {
                p.gestureTypes.forEach(g => {
                    gestureCounts[g] = (gestureCounts[g] || 0) + 1;
                });
            }
        });
        const topGestures = Object.entries(gestureCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);
        
        // 
        const generatePaperIndex = (filterFn, limit = 30) => {
            return papers.filter(filterFn).slice(0, limit).map(p => 
                `[${p.id}] "${p.title}" (${p.year})`
            ).join('; ');
        };
        
        return `
## 📊 Website Database Overview

**Total Papers**: ${totalPapers} gesture interaction research papers (2005-2023)
**Your current website**: https://formicrogses.github.io

### Statistics Summary
**Years**: ${yearsData.map(([y,c]) => `${y}(${c})`).join(', ')}

**Top Hardware** (15): ${topDevices.map(([d,c]) => `${d}(${c})`).join(', ')}

**Top Applications** (15): ${topApps.map(([a,c]) => `${a}(${c})`).join(', ')}

**Top Gestures** (15): ${topGestures.map(([g,c]) => `${g}(${c})`).join(', ')}

### How to Search & Recommend Papers

**When user asks for papers**, use this search logic:
1. **By keyword** (e.g., "EMG", "VR", "DataGlove"): Match against title, hardware, applications, gestures
2. **By year** (e.g., "2020"): Filter papers from that year
3. **By author**: Search in authors field
4. **By combination**: Multiple criteria (e.g., "VR EMG 2020")

**Response Format**:
\`\`\`
I found several papers about [topic]:

1. **[Full Title]** (Year)
   - Hardware: [devices]
   - Applications: [scenarios]
   - 🔗 View on website: Click the paper card or search by title

2. **[Title]** (Year)
   ...

To access these papers:
- Click on any paper card on the website
- Each paper has detailed information and DOI link
- Use website filters to narrow down your search
\`\`\`

### Available Search Criteria:
- **Title keywords**: Any word from paper titles
- **Years**: ${yearsData.map(([y]) => y).join(', ')}
- **Hardware**: ${topDevices.slice(0,10).map(([d]) => d).join(', ')}, etc.
- **Applications**: ${topApps.slice(0,10).map(([a]) => a).join(', ')}, etc.
- **Gestures**: ${topGestures.slice(0,10).map(([g]) => g).join(', ')}, etc.

### Example Queries You Can Handle:
✅ "Find EMG papers" → Search papers with EMG in hardware/title
✅ "Papers from 2020" → List 2020 papers
✅ "VR gesture interaction" → Find papers with VR+gesture tags
✅ "DataGlove research" → Papers using DataGlove hardware
✅ "Recommend papers about X" → Smart recommendations based on tags

**IMPORTANT**: You have access to ALL ${totalPapers} papers. When user asks, search by their criteria (keywords, year, tags) and provide exact paper titles. Tell users they can click paper titles in the chat or paper cards on the website to see full details and DOI links.`;
    }

    generateCompactWebsiteData() {
        // （）
        if (!this.websiteData || !this.websiteData.papers) {
            return '';
        }
        
        const papers = this.websiteData.papers;
        const totalPapers = papers.length;
        
        // 
        const yearCounts = {};
        papers.forEach(p => {
            const year = p.year || 'Unknown';
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        });
        
        return `
## Archive Overview
**Total papers**: ${totalPapers} papers (2005-2023)
**Search support**: The assistant can search and recommend papers from the archive
**Browsing**: Users can search paper titles on the site and open paper cards for details
`;
    }

    buildContext() {
        const totalPapers = this.websiteData?.papers?.length || 0;
        let context = `You are a research assistant for a website about gesture and microgesture interaction papers.

Core rules:
- Respond in the same language as the user unless the user asks otherwise.
- Be accurate and structured; give enough detail for useful research reading.
- Always ground claims in the retrieved papers when paper evidence is available.
- Cite paper title, year, and author when making a specific claim.
- If retrieved evidence is insufficient, say so clearly instead of guessing.
- When relevant, recommend papers and explain why they are relevant.

Archive facts:
- The website contains ${totalPapers}+ papers.
- Users can click paper cards on the website to open full details and DOI links.
- When mentioning archive papers, use the exact title so the website can make it clickable automatically.
`;

        if (this.currentPaper && this.currentPaper.text) {
            const paperText = this.currentPaper.text;
            const maxChars = 18000;
            
            const truncatedText = paperText.length > maxChars 
                ? paperText.substring(0, maxChars) + '\n\n[Paper content truncated for context length.]'
                : paperText;
            
            context += `\nCurrent focused paper:
- Title: ${this.currentPaper.title}

Use this paper as the primary source when the user asks about "this paper".

Paper content:
${truncatedText}`;
        } else {
            context += `\nNo single paper is currently selected. Use the retrieved archive papers as evidence.`;
        }
        
        return context;
    }

    addMessage(sender, text, type = 'user', saveToConversation = true) {
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
        
        // Format text with basic markdown support
        if (type === 'bot') {
            const displayText = this.cleanVisiblePaperReferences(text);
            textDiv.innerHTML = this.formatMarkdown(displayText);
            this.linkPaperReferences(textDiv);
        } else {
            textDiv.textContent = text;
        }
        
        content.appendChild(senderSpan);
        content.appendChild(textDiv);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        messagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Save to conversation
        if (saveToConversation && (type === 'user' || type === 'bot')) {
            this.saveMessageToConversation(sender, text, type);
        }
    }

    cleanVisiblePaperReferences(text) {
        if (!text || !this.paperLookup || this.paperLookup.byId.size === 0) {
            return text;
        }

        const resolveTitle = (id, fallback = '') => {
            const paper = this.paperLookup.byId.get(String(id));
            return paper ? paper.title : fallback;
        };
        const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let cleanedText = String(text);

        this.getArchivePapers().forEach((paper) => {
            if (!paper || !paper.id || !paper.title) {
                return;
            }

            const idPattern = String(paper.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const titlePattern = escapeRegExp(paper.title);
            cleanedText = cleanedText
                .replace(new RegExp(`\\*\\*Paper\\s*#\\s*${idPattern}\\*\\*\\s*:\\s*["“]?${titlePattern}["”]?`, 'gi'), `**${paper.title}**`)
                .replace(new RegExp(`\\bPaper\\s*#\\s*${idPattern}\\s*:\\s*["“]?${titlePattern}["”]?`, 'gi'), paper.title);
        });

        return cleanedText
            .replace(/\*\*Paper\s*#\s*(\d{1,4})\*\*\s*:\s*["“]([^"”\n]+)["”]/gi, (match, id, fallbackTitle) => {
                const title = resolveTitle(id, fallbackTitle);
                return title ? `**${title}**` : match;
            })
            .replace(/\bPaper\s*#\s*(\d{1,4})\s*:\s*["“]([^"”\n]+)["”]/gi, (match, id, fallbackTitle) => {
                const title = resolveTitle(id, fallbackTitle);
                return title || match;
            })
            .replace(/\*\*Paper\s*#\s*(\d{1,4})\*\*/gi, (match, id) => {
                const title = resolveTitle(id);
                return title ? `**${title}**` : match;
            })
            .replace(/\bPaper\s*#\s*(\d{1,4})\b/gi, (match, id) => {
                const title = resolveTitle(id);
                return title || match;
            });
    }

    linkPaperReferences(container) {
        if (!container || !this.paperLookup || this.paperLookup.byId.size === 0) {
            return;
        }

        this.linkPaperIds(container);
        this.linkPaperTitles(container);
    }

    linkPaperIds(container) {
        const idPattern = /\bPaper\s*#\s*(\d{1,4})\b/gi;

        this.replaceTextMatches(container, idPattern, (match) => {
            const id = match[1];
            const paper = this.paperLookup.byId.get(String(id));
            if (!paper) {
                return null;
            }

            return this.createPaperReferenceButton(paper, paper.title);
        });
    }

    linkPaperTitles(container) {
        const titles = this.paperLookup.titlesByLength || [];
        if (titles.length === 0) {
            return;
        }

        this.replaceTextNodes(container, (text) => {
            const matches = this.findPaperTitleMatches(text, titles);
            if (matches.length === 0) {
                return null;
            }

            const fragment = document.createDocumentFragment();
            let cursor = 0;

            matches.forEach((match) => {
                if (match.start > cursor) {
                    fragment.appendChild(document.createTextNode(text.slice(cursor, match.start)));
                }

                fragment.appendChild(this.createPaperReferenceButton(
                    match.paper,
                    text.slice(match.start, match.end),
                    'title'
                ));
                cursor = match.end;
            });

            if (cursor < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(cursor)));
            }

            return fragment;
        });
    }

    findPaperTitleMatches(text, titles) {
        const lowerText = text.toLowerCase();
        const rawMatches = [];

        titles.forEach(({ lowerTitle, paper }) => {
            let start = lowerText.indexOf(lowerTitle);

            while (start !== -1) {
                const end = start + lowerTitle.length;

                if (this.isPaperTitleBoundary(text, start, end)) {
                    rawMatches.push({
                        start,
                        end,
                        paper,
                        length: lowerTitle.length
                    });
                }

                start = lowerText.indexOf(lowerTitle, start + 1);
            }
        });

        rawMatches.sort((a, b) => {
            if (a.start !== b.start) return a.start - b.start;
            return b.length - a.length;
        });

        const selected = [];
        let occupiedUntil = -1;

        rawMatches.forEach((match) => {
            if (match.start >= occupiedUntil) {
                selected.push(match);
                occupiedUntil = match.end;
            }
        });

        return selected;
    }

    isPaperTitleBoundary(text, start, end) {
        const before = text[start - 1] || '';
        const after = text[end] || '';
        const isWord = (character) => /[A-Za-z0-9]/.test(character);

        return !isWord(before) && !isWord(after);
    }

    replaceTextMatches(container, pattern, createReplacement) {
        this.replaceTextNodes(container, (text) => {
            pattern.lastIndex = 0;
            let match;
            let cursor = 0;
            let hasReplacement = false;
            const fragment = document.createDocumentFragment();

            while ((match = pattern.exec(text)) !== null) {
                const replacement = createReplacement(match);
                if (!replacement) {
                    continue;
                }

                hasReplacement = true;
                if (match.index > cursor) {
                    fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
                }
                fragment.appendChild(replacement);
                cursor = match.index + match[0].length;
            }

            if (!hasReplacement) {
                return null;
            }

            if (cursor < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(cursor)));
            }

            return fragment;
        });
    }

    replaceTextNodes(container, createFragment) {
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (!node.nodeValue || !node.nodeValue.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    const parent = node.parentElement;
                    if (!parent || parent.closest('a, button, code, pre, script, style')) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodes = [];
        let node;
        while ((node = walker.nextNode())) {
            nodes.push(node);
        }

        nodes.forEach((textNode) => {
            const fragment = createFragment(textNode.nodeValue);
            if (fragment) {
                textNode.replaceWith(fragment);
            }
        });
    }

    createPaperReferenceButton(paper, label, variant = 'id') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `chatbot-paper-link chatbot-paper-link-${variant}`;
        button.textContent = label;
        button.dataset.paperId = paper.id || '';
        button.setAttribute('aria-label', `Open paper details for ${paper.title}`);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.openPaperFromChat(paper);
        });

        return button;
    }

    openPaperFromChat(paper) {
        if (!paper) {
            return;
        }

        if (typeof PaperModal === 'undefined') {
            console.warn('PaperModal is not available');
            return;
        }

        const modal = new PaperModal(paper);
        modal.show();
    }

    formatMarkdown(text) {
        // Escape HTML first
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Code blocks (triple backticks)
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // Inline code (single backticks)
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Bold (**text** or __text__)
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        
        // Italic (*text* or _text_)
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        
        // Headers
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        
        // Lists
        html = html.replace(/^\s*\* (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^\s*- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>');
        
        // Wrap list items in ul/ol tags
        html = html.replace(/(<li>.*<\/li>\n?)+/g, match => {
            return '<ul>' + match + '</ul>';
        });
        
        // Links [text](url)
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        
        // Blockquotes
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
        
        // Line breaks (double newline = paragraph)
        html = html.split('\n\n').map(para => {
            if (para.trim() && 
                !para.startsWith('<h') && 
                !para.startsWith('<ul') && 
                !para.startsWith('<ol') && 
                !para.startsWith('<pre') &&
                !para.startsWith('<blockquote')) {
                return '<p>' + para.trim() + '</p>';
            }
            return para;
        }).join('\n');

        html = html.replace(/<p>\s*<\/p>/g, '');
        
        return html;
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

    // =====  =====
    
    loadConversations() {
        const saved = localStorage.getItem('chatbot_conversations');
        if (saved) {
            this.conversations = JSON.parse(saved);
        }
        this.renderConversationsList();
        
        // ，
        if (this.conversations.length > 0) {
            this.loadConversation(this.conversations[0].id);
        }
    }

    saveConversations() {
        localStorage.setItem('chatbot_conversations', JSON.stringify(this.conversations));
    }

    createNewConversation() {
        const newConv = {
            id: Date.now().toString(),
            title: 'New Conversation',
            messages: [],
            paper: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.conversations.unshift(newConv);
        this.saveConversations();
        this.loadConversation(newConv.id);
        this.renderConversationsList();
    }

    loadConversation(convId) {
        const conv = this.conversations.find(c => c.id === convId);
        if (!conv) return;
        
        this.currentConversationId = convId;
        this.conversationHistory = [];
        this.currentPaper = conv.paper;
        
        // 
        const messagesContainer = document.getElementById('chatbotMessages');
        messagesContainer.innerHTML = '';
        
        // 
        conv.messages.forEach(msg => {
            this.addMessage(msg.sender, msg.text, msg.type, false); // false = 
        });
        
        // conversationHistory（API）
        conv.messages.forEach(msg => {
            if (msg.type === 'user') {
                this.conversationHistory.push({ role: 'user', text: msg.text });
            } else if (msg.type === 'bot') {
                this.conversationHistory.push({ role: 'model', text: msg.text });
            }
        });
        
        this.renderConversationsList();
    }

    deleteConversation(convId, event) {
        event.stopPropagation();
        
        if (!confirm('Are you sure you want to delete this conversation?')) return;
        
        this.conversations = this.conversations.filter(c => c.id !== convId);
        this.saveConversations();
        
        // ，
        if (this.currentConversationId === convId) {
            if (this.conversations.length > 0) {
                this.loadConversation(this.conversations[0].id);
            } else {
                this.createNewConversation();
            }
        }
        
        this.renderConversationsList();
    }

    updateConversationTitle(convId) {
        const conv = this.conversations.find(c => c.id === convId);
        if (!conv || conv.messages.length === 0) return;
        
        // 
        const firstUserMsg = conv.messages.find(m => m.type === 'user');
        if (firstUserMsg) {
            conv.title = firstUserMsg.text.slice(0, 20) + (firstUserMsg.text.length > 20 ? '...' : '');
        } else if (conv.paper) {
            conv.title = conv.paper.title.slice(0, 20) + '...';
        }
        
        conv.updatedAt = new Date().toISOString();
        this.saveConversations();
        this.renderConversationsList();
    }

    saveMessageToConversation(sender, text, type) {
        if (!this.currentConversationId) {
            this.createNewConversation();
        }
        
        const conv = this.conversations.find(c => c.id === this.currentConversationId);
        if (!conv) return;
        
        conv.messages.push({ sender, text, type, timestamp: new Date().toISOString() });
        conv.paper = this.currentPaper;
        conv.updatedAt = new Date().toISOString();
        
        // 
        if (conv.messages.length === 1) {
            this.updateConversationTitle(conv.id);
        }
        
        this.saveConversations();
    }

    renderConversationsList() {
        const list = document.getElementById('conversationsList');
        if (!list) return;
        
        if (this.conversations.length === 0) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">No conversations yet</div>';
            return;
        }
        
        list.innerHTML = this.conversations.map(conv => {
            const isActive = conv.id === this.currentConversationId;
            const time = this.formatTime(conv.updatedAt);
            const preview = conv.messages.length > 0 
                ? conv.messages[conv.messages.length - 1].text.slice(0, 30) 
                : 'No messages';
            
            return `
                <div class="conversation-item ${isActive ? 'active' : ''}" data-id="${conv.id}" style="position: relative;">
                    <div class="conversation-title">${conv.title}</div>
                    <div class="conversation-preview">${preview}</div>
                    <div class="conversation-time">${time}</div>
                    <button class="conversation-delete" data-id="${conv.id}" title="Delete">×</button>
                </div>
            `;
        }).join('');
        
        // 
        list.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                this.loadConversation(id);
            });
        });
        
        list.querySelectorAll('.conversation-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                this.deleteConversation(id, e);
            });
        });
    }

    formatTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new GrokChatbot();
});
