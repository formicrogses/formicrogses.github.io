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
        this.websiteData = null;   // 网站数据（从PAPERS_DATA加载）
        
        // 对话管理
        this.conversations = [];   // 所有对话列表
        this.currentConversationId = null; // 当前对话ID
        
        this.init();
    }

    init() {
        this.createChatInterface();
        this.setupEventListeners();
        this.loadApiKey();
        this.loadConversations();
        this.loadPapersTexts();
        this.loadWebsiteData();
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

    loadWebsiteData() {
        // 加载网站论文数据（从全局变量PAPERS_DATA）
        if (typeof PAPERS_DATA !== 'undefined') {
            this.websiteData = PAPERS_DATA;
            console.log(`✅ 已加载网站数据：${PAPERS_DATA.papers.length} 篇论文`);
        } else {
            console.warn('⚠️ PAPERS_DATA未加载');
        }
    }

    async loadFullPaperText(filename) {
        // 按需加载完整论文文本
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
                <!-- Conversation Sidebar -->
                <div class="chatbot-sidebar">
                    <div class="sidebar-header">
                        <button id="newChatBtn" class="new-chat-btn">
                            <span style="font-size: 18px;">+</span>
                            <span>New Chat</span>
                        </button>
                    </div>
                    <div id="conversationsList" class="conversations-list">
                        <!-- Conversation items will be added here -->
                    </div>
                </div>
                
                <!-- Main Chat Area -->
                <div class="chatbot-main">
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
                        <button class="chatbot-close" id="chatbotClose" title="Close Chat (Esc)">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="chatbot-messages" id="chatbotMessages">
                    <div class="chatbot-welcome">
                        <div class="welcome-icon">📚</div>
                        <h4>AI Research Assistant</h4>
                        <p>I have access to 165+ gesture interaction research papers. Ask me about any topic, and I'll search the knowledge base to provide detailed answers!</p>
                        <p style="font-size: 13px; opacity: 0.8; margin-top: 8px;">Try: "What papers discuss smartwatch gestures?" or "Tell me about finger-counting methods"</p>
                    </div>
                </div>
                
                <div class="chatbot-input-container">
                    <div class="chatbot-input-wrapper">
                        <textarea 
                            class="chatbot-input" 
                            id="chatbotInput" 
                            placeholder="Message AI Research Assistant..."
                            rows="1"
                        ></textarea>
                        <button class="chatbot-send" id="chatbotSend">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                            </svg>
                        </button>
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
        const newChatBtn = document.getElementById('newChatBtn');
        
        toggle.addEventListener('click', () => this.toggleChat());
        close.addEventListener('click', () => this.closeChat());
        send.addEventListener('click', () => this.sendMessage());
        
        // 新建对话按钮
        newChatBtn.addEventListener('click', () => this.createNewConversation());
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // ESC key to close chatbot
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeChat();
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
        
        // 过滤论文
        const filtered = filterText
            ? papers.filter(p => p.title.toLowerCase().includes(filterText.toLowerCase()))
            : papers;
        
        if (filtered.length === 0) {
            paperList.innerHTML = '<div class="paper-empty">No matching papers found</div>';
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
            this.addMessage('System', '📥 Loading paper content, please wait...', 'system');
            
            // 加载完整论文文本
            const paper = await this.loadFullPaperText(filename);
            
            if (!paper) {
                throw new Error('Failed to load paper data');
            }
            
            // 设置当前论文
            this.currentPaper = paper;
            
            // 清空对话历史
            this.conversationHistory = [];
            messagesContainer.innerHTML = '';
            
            // 显示成功消息
            this.addMessage('System', `📚 Paper loaded: "${paper.title}"\n\nYou can now ask me anything about this paper!\n\n💡 Example questions:\n- What are the main contributions?\n- What research methods were used?\n- What are the experimental results?\n- What are the limitations?\n- What future work is suggested?`, 'system');
            
        } catch (error) {
            this.addMessage('System', `❌ Loading failed: ${error.message}\nPlease check your network connection and try again.`, 'error');
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
        
        // 🎯 智能分析系统 - 检测查询类型并处理
        let relevantPapers = [];
        let specialAnalysis = null;
        
        if (this.websiteData && this.websiteData.papers) {
            // 1️⃣ 检测统计分析查询
            const analysis = this.analyzeDatabase(message);
            if (analysis) {
                const analysisText = this.formatAnalysisResult(analysis, message);
                this.addMessage('System', analysisText, 'system');
                // 统计查询不需要加载论文全文
                specialAnalysis = 'statistics';
            }
            
            // 2️⃣ 检测术语解释查询
            if (/what is|define|explain|meaning of/i.test(message)) {
                const knowledge = this.getDomainKnowledge();
                const lowerMsg = message.toLowerCase();
                
                // 查找匹配的术语
                for (const [term, definition] of Object.entries(knowledge.terms)) {
                    if (lowerMsg.includes(term)) {
                        const termInfo = `📖 **${term.toUpperCase()}**: ${definition}\n\nRelated papers in database using this technology: ${this.websiteData.papers.filter(p => {
                            const text = JSON.stringify(p).toLowerCase();
                            return text.includes(term);
                        }).length} papers`;
                        this.addMessage('System', termInfo, 'system');
                        break;
                    }
                }
            }
            
            // 3️⃣ 常规知识库检索
            if (!specialAnalysis) {
                relevantPapers = this.searchPapers(message);
                
                if (relevantPapers.length > 0) {
                    // 检测对比查询
                    const isCompare = /compare|versus|vs|difference/i.test(message);
                    
                    if (isCompare && relevantPapers.length >= 2) {
                        // 对比分析
                        const comparison = this.comparePapers(relevantPapers.slice(0, 3), message);
                        if (comparison) {
                            const compText = this.formatComparisonResult(comparison);
                            this.addMessage('System', compText, 'system');
                        }
                    }
                    
                    // 显示检索信息
                    const paperTitles = relevantPapers.slice(0, 3).map(p => `"${p.title}"`).join(', ');
                    const moreText = relevantPapers.length > 3 ? ` and ${relevantPapers.length - 3} more` : '';
                    this.addMessage('System', `🔍 Knowledge base search: Found ${relevantPapers.length} relevant papers: ${paperTitles}${moreText}`, 'system');
                    
                    // 加载前5篇论文全文
                    relevantPapers = relevantPapers.slice(0, 5);
                    await this.loadPaperTexts(relevantPapers);
                    
                    // 4️⃣ 检测推荐请求
                    if (/recommend|suggest|similar|related|also|like this/i.test(message) && relevantPapers.length > 0) {
                        const recommendations = this.recommendPapers(relevantPapers[0], 5);
                        if (recommendations.length > 0) {
                            const recText = this.formatRecommendations(recommendations, relevantPapers[0]);
                            this.addMessage('System', recText, 'system');
                        }
                    }
                }
            }
        }
        
        // Show loading
        this.showLoading();
        
        try {
            const response = await this.callGeminiAPI(message, relevantPapers);
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

    async callGeminiAPI(message, relevantPapers = []) {
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
                parts: [{ text: 'I understand. I\'m ready to help you explore the gesture interaction research papers database. What would you like to know?' }]
            });
        }
        
        // 📚 动态知识库注入：如果有相关论文，注入完整内容
        if (relevantPapers.length > 0) {
            const knowledgeContext = this.buildKnowledgeContext(relevantPapers);
            if (knowledgeContext) {
                contents.push({
                    role: 'user',
                    parts: [{ text: knowledgeContext }]
                });
                contents.push({
                    role: 'model',
                    parts: [{ text: 'I have reviewed the relevant papers. Please ask your question.' }]
                });
            }
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

    /**
     * 加载论文全文内容
     */
    async loadPaperTexts(papers) {
        if (!this.papersTexts) {
            try {
                const response = await fetch('papers-texts.json');
                this.papersTexts = await response.json();
                console.log('📚 Papers full texts loaded:', Object.keys(this.papersTexts).length, 'papers');
            } catch (error) {
                console.error('Error loading papers texts:', error);
                return;
            }
        }
        
        // 为每篇论文附加全文
        papers.forEach(paper => {
            const filename = paper.pdfFile || paper.filename;
            if (filename && this.papersTexts[filename]) {
                paper.fullText = this.papersTexts[filename].text;
                paper.fullTextLength = this.papersTexts[filename].length || paper.fullText.length;
            }
        });
    }

    /**
     * 📊 方案1：智能统计分析系统
     */
    analyzeDatabase(query) {
        if (!this.websiteData || !this.websiteData.papers) {
            return null;
        }

        const papers = this.websiteData.papers;
        const lowerQuery = query.toLowerCase();
        
        // 检测查询意图
        const isStatQuery = /how many|count|number of|statistics|trend|popular|most used|distribution|compare.*papers/i.test(query);
        const isTrendQuery = /trend|evolution|history|over time|year|timeline/i.test(query);
        const isHardwareQuery = /hardware|device|sensor|equipment/i.test(query);
        const isAppQuery = /application|scenario|use case|domain/i.test(query);
        const isYearQuery = /\b20\d{2}\b/.test(query);
        
        if (!isStatQuery && !isTrendQuery && !isHardwareQuery && !isAppQuery && !isYearQuery) {
            return null; // 不是统计类查询
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

        // 统计各维度数据
        papers.forEach(paper => {
            // 年份统计
            const year = paper.year || 'Unknown';
            analysis.yearRange[year] = (analysis.yearRange[year] || 0) + 1;

            // 类别统计
            const category = paper.category || 'Unknown';
            analysis.categories[category] = (analysis.categories[category] || 0) + 1;

            // 硬件统计
            if (paper.hardwareDevices) {
                paper.hardwareDevices.forEach(hw => {
                    analysis.hardware[hw] = (analysis.hardware[hw] || 0) + 1;
                });
            }

            // 应用场景统计
            if (paper.applicationScenarios) {
                paper.applicationScenarios.forEach(app => {
                    analysis.applications[app] = (analysis.applications[app] || 0) + 1;
                });
            }

            // 手势类型统计
            if (paper.gestureTypes) {
                paper.gestureTypes.forEach(gest => {
                    analysis.gestures[gest] = (analysis.gestures[gest] || 0) + 1;
                });
            }

            // 会议统计
            if (paper.conferenceName) {
                const conf = paper.conferenceName.split(':')[0].trim(); // 提取会议简称
                analysis.conferences[conf] = (analysis.conferences[conf] || 0) + 1;
            }
        });

        // 排序
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
     * 格式化统计分析结果为可读文本
     */
    formatAnalysisResult(analysis, query) {
        if (!analysis) return null;

        let result = '📊 **Database Statistical Analysis**\n\n';
        result += `**Overview:** ${analysis.total} gesture interaction research papers (${analysis.yearTrend[0]?.[0] || '2002'}-${analysis.yearTrend[analysis.yearTrend.length-1]?.[0] || '2025'})\n\n`;

        // 年份趋势
        if (/trend|timeline|evolution|history|over time/i.test(query)) {
            result += '## 📈 Research Trend by Year\n';
            const recentYears = analysis.yearTrend.slice(-10);
            recentYears.forEach(([year, count]) => {
                const bar = '█'.repeat(Math.ceil(count / 2));
                result += `${year}: ${bar} (${count} papers)\n`;
            });
            result += '\n';
        }

        // 硬件统计
        if (/hardware|device|sensor/i.test(query) || analysis.topHardware.length > 0) {
            result += '## 🔧 Most Used Hardware/Sensors\n';
            analysis.topHardware.slice(0, 8).forEach(([hw, count], idx) => {
                result += `${idx + 1}. **${hw}**: ${count} papers\n`;
            });
            result += '\n';
        }

        // 应用场景统计
        if (/application|scenario|use case/i.test(query) || analysis.topApplications.length > 0) {
            result += '## 🎯 Application Scenarios\n';
            analysis.topApplications.slice(0, 8).forEach(([app, count], idx) => {
                result += `${idx + 1}. **${app}**: ${count} papers\n`;
            });
            result += '\n';
        }

        // 研究类别
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

        // 顶会分布
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
     * 构建知识库上下文 - 将相关论文注入AI上下文
     */
    buildKnowledgeContext(papers) {
        if (!papers || papers.length === 0) return '';
        
        let context = '📚 **KNOWLEDGE BASE - Relevant Research Papers:**\n\n';
        
        papers.forEach((paper, index) => {
            context += `## Paper ${index + 1}: ${paper.title}\n`;
            context += `**Author:** ${paper.firstAuthor || paper.authors || 'Unknown'}\n`;
            context += `**Year:** ${paper.year || 'Unknown'}\n`;
            context += `**Conference:** ${paper.conferenceName || 'Unknown'}\n`;
            
            if (paper.hardwareDevices && paper.hardwareDevices.length > 0) {
                context += `**Hardware:** ${paper.hardwareDevices.slice(0, 3).join(', ')}\n`;
            }
            if (paper.applicationScenarios && paper.applicationScenarios.length > 0) {
                context += `**Applications:** ${paper.applicationScenarios.slice(0, 3).join(', ')}\n`;
            }
            
            // 注入论文全文（限制长度）
            if (paper.fullText) {
                const maxLength = 8000; // 每篇论文最多8000字符
                const text = paper.fullText.length > maxLength 
                    ? paper.fullText.substring(0, maxLength) + '...(truncated)'
                    : paper.fullText;
                context += `\n**FULL TEXT:**\n${text}\n`;
            }
            
            context += '\n' + '='.repeat(80) + '\n\n';
        });
        
        context += '\n**INSTRUCTIONS:**\n';
        context += '- Answer the user\'s question based on the papers above\n';
        context += '- Cite specific papers by title when relevant\n';
        context += '- Provide paper details (author, year) in your response\n';
        context += '- If information is not in these papers, say so clearly\n\n';
        
        return context;
    }

    /**
     * 📊 方案3：增强RAG检索系统 - 智能论文检索
     */
    searchPapers(query) {
        if (!this.websiteData || !this.websiteData.papers) {
            return [];
        }
        
        const lowerQuery = query.toLowerCase();
        
        // 提取关键词（移除停用词）
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'what', 'how', 'which', 'about', 'can', 'you', 'i', 'tell', 'me', 'show', 'please', 'find', 'search'];
        const keywords = lowerQuery
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.includes(word))
            .slice(0, 10);
        
        // 检测查询意图
        const isCompareQuery = /compare|versus|vs|difference|better|which/i.test(query);
        const isMethodQuery = /method|approach|technique|algorithm|how.*work/i.test(query);
        const isResultQuery = /accuracy|precision|result|performance|evaluation/i.test(query);
        
        // 计算每篇论文的相关性分数
        const scoredPapers = this.websiteData.papers.map(paper => {
            let score = 0;
            const title = (paper.title || '').toLowerCase();
            const author = (paper.authors || paper.firstAuthor || '').toLowerCase();
            const conf = (paper.conferenceName || '').toLowerCase();
            const allTags = [
                ...(paper.hardwareDevices || []),
                ...(paper.applicationScenarios || []),
                ...(paper.gestureTypes || []),
                ...(paper.recognitionClassification || [])
            ].map(t => t.toLowerCase()).join(' ');
            
            // 完全匹配 - 最高分
            if (title.includes(lowerQuery)) score += 100;
            
            // 标题关键词匹配（加权）
            keywords.forEach(kw => {
                if (title.includes(kw)) score += 15;
                if (author.includes(kw)) score += 8;
                if (allTags.includes(kw)) score += 5;
                if (conf.includes(kw)) score += 3;
            });
            
            // 年份匹配
            if (paper.year && lowerQuery.includes(paper.year.toString())) {
                score += 10;
            }
            
            // 根据查询意图调整分数
            if (isMethodQuery && (title.includes('method') || title.includes('approach'))) {
                score += 10;
            }
            if (isResultQuery && (title.includes('evaluat') || title.includes('study'))) {
                score += 10;
            }
            
            // 顶会论文加分（CHI, UIST等）
            const topConferences = ['CHI', 'UIST', 'MobileHCI', 'SIGGRAPH'];
            if (topConferences.some(tc => conf.includes(tc.toLowerCase()))) {
                score += 5;
            }
            
            // 近期论文轻微加分
            if (paper.year && paper.year >= 2020) {
                score += 2;
            }
            
            return { paper, score };
        });
        
        // 过滤并排序
        const results = scoredPapers
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.paper);
        
        // 如果是对比查询，返回更多结果以便对比
        const limit = isCompareQuery ? 10 : 5;
        return results.slice(0, limit);
    }

    /**
     * 方案4：专业领域知识库
     */
    getDomainKnowledge() {
        return {
            // 常见术语解释
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
                'mid-air': 'Gestures performed in空中 without touching surface',
                'smartwatch': 'Wrist-worn computer with sensors',
                'smart ring': 'Finger-worn wearable device',
                'ar': 'Augmented Reality - overlay digital on physical world',
                'vr': 'Virtual Reality - fully immersive digital environment',
                'gesture elicitation': 'Study method to discover user-preferred gestures'
            },
            
            // 研究方法
            methods: {
                'vision-based': 'Uses cameras to track hand/finger movements',
                'sensor-based': 'Uses wearable sensors (IMU, EMG, etc.)',
                'acoustic': 'Uses sound waves for gesture sensing',
                'rf-based': 'Uses radio frequency signals',
                'hybrid': 'Combines multiple sensing modalities'
            },
            
            // 顶级会议
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
     * 方案5：智能对比分析引擎
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

        // 找出共同点
        if (papers.length >= 2) {
            const hw1 = new Set(papers[0].hardwareDevices || []);
            const hw2 = new Set(papers[1].hardwareDevices || []);
            comparison.commonHardware = [...hw1].filter(h => hw2.has(h));

            const app1 = new Set(papers[0].applicationScenarios || []);
            const app2 = new Set(papers[1].applicationScenarios || []);
            comparison.commonApplications = [...app1].filter(a => app2.has(a));
        }

        // 分析差异
        const yearDiff = Math.abs((papers[0].year || 2020) - (papers[1].year || 2020));
        if (yearDiff > 5) {
            comparison.differences.push(`Significant time gap: ${yearDiff} years between papers`);
        }

        return comparison;
    }

    /**
     * 格式化对比结果
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
     * 方案6：智能推荐系统
     */
    recommendPapers(basePaper, count = 5) {
        if (!basePaper || !this.websiteData) {
            return [];
        }

        const papers = this.websiteData.papers.filter(p => p.id !== basePaper.id);
        
        // 计算相似度
        const scoredPapers = papers.map(paper => {
            let similarity = 0;
            
            // 硬件相似度
            const baseHW = new Set(basePaper.hardwareDevices || []);
            const paperHW = new Set(paper.hardwareDevices || []);
            const hwOverlap = [...baseHW].filter(h => paperHW.has(h)).length;
            similarity += hwOverlap * 10;
            
            // 应用场景相似度
            const baseApp = new Set(basePaper.applicationScenarios || []);
            const paperApp = new Set(paper.applicationScenarios || []);
            const appOverlap = [...baseApp].filter(a => paperApp.has(a)).length;
            similarity += appOverlap * 8;
            
            // 年份接近度（±3年内）
            const yearDiff = Math.abs((paper.year || 2020) - (basePaper.year || 2020));
            if (yearDiff <= 3) {
                similarity += (3 - yearDiff) * 2;
            }
            
            // 同一类别
            if (paper.category === basePaper.category) {
                similarity += 5;
            }
            
            // 同一作者
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
     * 格式化推荐结果
     */
    formatRecommendations(papers, basePaper) {
        if (!papers || papers.length === 0) return null;

        let result = `💡 **Recommended Papers** (based on "${basePaper.title}")\n\n`;
        
        papers.forEach((paper, idx) => {
            result += `${idx + 1}. **${paper.title}**\n`;
            result += `   - Author: ${paper.firstAuthor || paper.authors || 'Unknown'}\n`;
            result += `   - Year: ${paper.year || 'Unknown'}\n`;
            
            // 说明推荐原因
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
        
        // 统计年份
        const yearCounts = {};
        papers.forEach(p => {
            const year = p.year || 'Unknown';
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        });
        const yearsData = Object.entries(yearCounts)
            .sort((a, b) => b[0].localeCompare(a[0]));
        
        // 统计硬件设备
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
        
        // 统计应用场景
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
        
        // 统计手势类型
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
        
        // 为每个标签类别生成精简的论文索引
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

1. **Paper #ID**: "[Full Title]" (Year)
   - Hardware: [devices]
   - Applications: [scenarios]
   - 🔗 View on website: Click the paper card or search by title

2. **Paper #ID**: "[Title]" (Year)
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

**IMPORTANT**: You have access to ALL ${totalPapers} papers. When user asks, search by their criteria (keywords, year, tags) and provide specific paper IDs and titles. Tell users they can click papers on the website to see full details and DOI links.`;
    }

    generateCompactWebsiteData() {
        // 生成紧凑版的网站数据（用于有论文时）
        if (!this.websiteData || !this.websiteData.papers) {
            return '';
        }
        
        const papers = this.websiteData.papers;
        const totalPapers = papers.length;
        
        // 只提供统计摘要
        const yearCounts = {};
        papers.forEach(p => {
            const year = p.year || 'Unknown';
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        });
        
        return `
## 📊 网站数据库概览
**总计**: ${totalPapers}篇论文 (2005-2023)
**搜索功能**: 可以帮助用户搜索和推荐相关论文
**查看方式**: 告诉用户论文标题，建议在网站上搜索查看详情和链接
`;
    }

    buildContext() {
        let context = `You are an AI Research Assistant with access to a comprehensive knowledge base of gesture interaction research papers.

**YOUR CAPABILITIES:**
- You have access to 165+ research papers on gesture interaction (2005-2023)
- When users ask questions, relevant papers will be automatically loaded and provided to you
- You can discuss paper content, methodologies, findings, and comparisons
- You can recommend papers based on user interests

**HOW TO RESPOND:**
- Always cite papers by title and author when discussing specific research
- Provide detailed answers based on the actual paper content
- If asked about papers not in your current context, indicate that and offer to search
- Format responses clearly with proper citations

**DATABASE OVERVIEW:**`;
        
        if (this.websiteData) {
            context += '\n' + this.generateCompactWebsiteData();
        }
        
        // 如果有当前选中的论文，提供其详细内容
        if (this.currentPaper && this.currentPaper.text) {
            const paperText = this.currentPaper.text;
            const maxChars = 25000;
            
            const truncatedText = paperText.length > maxChars 
                ? paperText.substring(0, maxChars) + '\n\n[论文内容过长，已截断...]'
                : paperText;
            
            context += `\n\n## 📄 当前讨论的论文

**标题**: ${this.currentPaper.title}

**论文内容**:
${truncatedText}

**回答要求**:
- 优先基于论文内容回答
- 引用具体段落
- 如果论文中没有相关信息，明确告知
- 可以结合网站数据对比分析（如：这篇论文与其他研究的关系）
- 使用清晰的结构（标题、列表）
- 保持简洁但信息丰富`;
        } else {
            // 没有选择论文时，提供完整的论文列表
            if (this.websiteData) {
                context += '\n\n' + this.generateWebsiteDataSummary();
            }
            
            context += `\n\n**当前状态**: 没有选择具体论文。

**你的任务**:
1. 回答关于网站的统计问题
2. 根据用户需求从上面的论文列表中搜索和推荐论文
3. 提供论文的ID、标题、年份、相关标签
4. 告诉用户可以在网站上点击查看详情和访问链接
5. 如果用户要讨论具体论文，建议使用📄按钮选择

**回答示例**:
- 用户问: "给我一篇EMG的论文"
- 回答: "我找到了几篇EMG相关的论文：
  - 论文ID 2: 'Demonstrating the feasibility of using forearm electromyography for muscle-computer interfaces' (2008)
  - 论文ID X: '...'
  您可以在网站上搜索这些标题，或点击论文卡片查看详情和访问链接。"`;
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
        
        // Save to conversation
        if (saveToConversation && (type === 'user' || type === 'bot')) {
            this.saveMessageToConversation(sender, text, type);
        }
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

    // ===== 对话管理方法 =====
    
    loadConversations() {
        const saved = localStorage.getItem('chatbot_conversations');
        if (saved) {
            this.conversations = JSON.parse(saved);
        }
        this.renderConversationsList();
        
        // 如果有对话，加载最后一个
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
        
        // 清空消息区域
        const messagesContainer = document.getElementById('chatbotMessages');
        messagesContainer.innerHTML = '';
        
        // 加载历史消息
        conv.messages.forEach(msg => {
            this.addMessage(msg.sender, msg.text, msg.type, false); // false = 不保存
        });
        
        // 重建conversationHistory（用于API调用）
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
        
        // 如果删除的是当前对话，创建新对话
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
        
        // 使用第一条用户消息作为标题
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
        
        // 更新标题
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
        
        // 绑定点击事件
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
        
        return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new GeminiChatbot();
});
