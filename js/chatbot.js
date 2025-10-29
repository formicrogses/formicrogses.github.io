// Chatbot using Google Gemini API
class GeminiChatbot {
    constructor() {
        this.apiKey = '';
        this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
        this.conversationHistory = [];
        this.isOpen = false;
        this.isLoading = false;
        this.currentPaper = null;  // 当前讨论的论文
        this.papersIndex = null;   // 论文索引（轻量级）
        this.papersTexts = null;   // 完整论文文本数据（按需加载）
        
        this.init();
    }

    init() {
        this.createChatInterface();
        this.setupEventListeners();
        this.loadApiKey();
        this.loadPapersTexts();
    }

    async loadPapersTexts() {
        // 先加载轻量级索引（快速显示列表）
        try {
            const response = await fetch('papers-index.json');
            if (response.ok) {
                this.papersIndex = await response.json();
                console.log(`✅ 已加载 ${Object.keys(this.papersIndex).length} 篇论文索引`);
            }
        } catch (error) {
            console.warn('⚠️ 无法加载论文索引:', error);
        }
    }

    async loadFullPaperText(filename) {
        // 按需加载完整论文文本
        if (!this.papersTexts) {
            console.log('📥 正在加载完整论文数据...');
            try {
                const response = await fetch('papers-texts.json');
                if (response.ok) {
                    this.papersTexts = await response.json();
                    console.log('✅ 完整数据加载成功');
                } else {
                    throw new Error('无法加载论文数据');
                }
            } catch (error) {
                console.error('❌ 加载失败:', error);
                throw error;
            }
        }
        return this.papersTexts[filename];
    }

    loadPaper(paperTitle, paperData) {
        // 加载论文到当前上下文
        this.currentPaper = {
            title: paperTitle,
            ...paperData
        };
        
        // 打开聊天窗口
        if (!this.isOpen) {
            this.openChat();
        }
        
        // 显示欢迎消息
        setTimeout(() => {
            this.addMessage('System', `📚 已加载论文：《${paperTitle}》\n现在您可以向我提问关于这篇论文的任何内容！`, 'system');
        }, 500);
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
                    <button class="chatbot-paper-btn" id="chatbotPaperBtn" title="选择论文讨论">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                    </button>
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
                
                <div class="chatbot-paper-selector" id="chatbotPaperSelector" style="display: none;">
                    <div class="paper-selector-header">
                        <h4>选择论文讨论</h4>
                        <button class="paper-selector-close" id="paperSelectorClose">×</button>
                    </div>
                    <div class="paper-search">
                        <input type="text" id="paperSearchInput" placeholder="搜索论文标题..." />
                    </div>
                    <div class="paper-list" id="paperList">
                        <div class="paper-loading">加载中...</div>
                    </div>
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
        const paperBtn = document.getElementById('chatbotPaperBtn');
        const paperSelectorClose = document.getElementById('paperSelectorClose');
        const paperSearchInput = document.getElementById('paperSearchInput');
        
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
        
        // 论文选择按钮
        paperBtn.addEventListener('click', () => this.showPaperSelector());
        paperSelectorClose.addEventListener('click', () => this.hidePaperSelector());
        
        // 论文搜索
        paperSearchInput.addEventListener('input', (e) => {
            this.filterPapers(e.target.value);
        });
    }

    showPaperSelector() {
        const selector = document.getElementById('chatbotPaperSelector');
        selector.style.display = 'flex';
        
        // 加载论文列表（使用索引）
        if (this.papersIndex && Object.keys(this.papersIndex).length > 0) {
            this.renderPaperList();
        } else {
            document.getElementById('paperList').innerHTML = '<div class="paper-loading">论文列表加载中...</div>';
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
        
        // 过滤论文
        const filtered = filterText
            ? papers.filter(p => p.title.toLowerCase().includes(filterText.toLowerCase()))
            : papers;
        
        if (filtered.length === 0) {
            paperList.innerHTML = '<div class="paper-empty">未找到匹配的论文</div>';
            return;
        }
        
        // 渲染论文列表
        paperList.innerHTML = filtered.map(paper => `
            <div class="paper-item-selector" data-filename="${paper.filename}">
                <div class="paper-item-title">${paper.title}</div>
                <div class="paper-item-preview">${paper.preview}</div>
            </div>
        `).join('');
        
        // 添加点击事件
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
            // 显示加载中
            this.hidePaperSelector();
            const messagesContainer = document.getElementById('chatbotMessages');
            messagesContainer.innerHTML = '';
            this.addMessage('System', '📥 正在加载论文内容，请稍候...', 'system');
            
            // 加载完整论文文本
            const paper = await this.loadFullPaperText(filename);
            
            if (!paper) {
                throw new Error('论文数据加载失败');
            }
            
            // 设置当前论文
            this.currentPaper = paper;
            
            // 清空对话历史
            this.conversationHistory = [];
            messagesContainer.innerHTML = '';
            
            // 显示成功消息
            this.addMessage('System', `📚 已加载论文：《${paper.title}》\n\n现在您可以向我提问关于这篇论文的任何内容！\n\n💡 示例问题：\n- 这篇论文的主要贡献是什么？\n- 使用了什么研究方法？\n- 实验结果如何？\n- 有哪些局限性？\n- 对未来工作有什么建议？`, 'system');
            
        } catch (error) {
            this.addMessage('System', `❌ 加载失败：${error.message}\n请检查网络连接后重试。`, 'error');
        }
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
        // 构建对话内容
        const contents = [];
        
        // 第一次对话：添加系统上下文
        if (this.conversationHistory.length === 0) {
            const context = this.buildContext();
            contents.push({
                role: 'user',
                parts: [{ text: context }]
            });
            contents.push({
                role: 'model',
                parts: [{ text: '好的，我已了解当前的论文内容。请问您想了解什么？' }]
            });
        }
        
        // 添加历史对话（最多保留最近5轮对话）
        const recentHistory = this.conversationHistory.slice(-10); // 最近10条消息 = 5轮对话
        recentHistory.forEach(item => {
            contents.push({
                role: item.role,
                parts: [{ text: item.text }]
            });
        });
        
        // 添加当前用户消息
        contents.push({
            role: 'user',
            parts: [{ text: message }]
        });
        
        const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }
        
        const data = await response.json();
        const aiResponse = data.candidates[0]?.content?.parts[0]?.text || 'No response generated';
        
        // 保存到历史记录
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

    buildContext() {
        let context = '';
        
        // 如果有当前论文，优先使用论文内容
        if (this.currentPaper && this.currentPaper.text) {
            const paperText = this.currentPaper.text;
            const maxChars = 30000; // Gemini限制，避免过长
            
            const truncatedText = paperText.length > maxChars 
                ? paperText.substring(0, maxChars) + '\n\n[论文内容过长，已截断...]'
                : paperText;
            
            context = `You are a helpful AI assistant discussing a research paper about gesture interaction.

**Current Paper:**
Title: ${this.currentPaper.title}

**Paper Content:**
${truncatedText}

Instructions:
- Answer questions based on the paper content above
- Cite specific sections when possible
- If the user asks something not in the paper, say so clearly
- Use clear, structured responses with headings and lists
- Keep responses concise but informative`;
            
            return context;
        }
        
        // 否则使用通用上下文
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
        
        // Format text with basic markdown support
        if (type === 'bot') {
            textDiv.innerHTML = this.formatMarkdown(text);
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
        
        // Lists (unordered)
        html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        
        // Lists (ordered)
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        
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
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new GeminiChatbot();
});
