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
        
        // 智能搜索：如果用户询问特定论文，先搜索再注入结果
        let enrichedMessage = message;
        if (this.websiteData && this.websiteData.papers) {
            const searchResults = this.searchPapers(message);
            if (searchResults.length > 0) {
                const resultsInfo = searchResults.slice(0, 5).map(p => 
                    `[ID:${p.id}] "${p.title}" (${p.year}) | Hardware: ${(p.hardwareDevices||[]).slice(0,2).join(',')} | App: ${(p.applicationScenarios||[]).slice(0,2).join(',')}`
                ).join('\n');
                enrichedMessage = `${message}\n\n[System: Found ${searchResults.length} matching papers in database:\n${resultsInfo}]`;
            }
        }
        
        // Show loading
        this.showLoading();
        
        try {
            const response = await this.callGeminiAPI(enrichedMessage);
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

    searchPapers(query) {
        // 在论文数据中搜索
        if (!this.websiteData || !this.websiteData.papers) {
            return [];
        }
        
        const lowerQuery = query.toLowerCase();
        const results = this.websiteData.papers.filter(paper => {
            // 搜索标题
            if (paper.title && paper.title.toLowerCase().includes(lowerQuery)) return true;
            
            // 搜索年份
            if (paper.year && paper.year.toString().includes(lowerQuery)) return true;
            
            // 搜索作者
            if (paper.authors && paper.authors.toLowerCase().includes(lowerQuery)) return true;
            
            // 搜索硬件设备
            if (paper.hardwareDevices && paper.hardwareDevices.some(d => d.toLowerCase().includes(lowerQuery))) return true;
            
            // 搜索应用场景
            if (paper.applicationScenarios && paper.applicationScenarios.some(a => a.toLowerCase().includes(lowerQuery))) return true;
            
            // 搜索手势类型
            if (paper.gestureTypes && paper.gestureTypes.some(g => g.toLowerCase().includes(lowerQuery))) return true;
            
            return false;
        });
        
        return results.slice(0, 10); // 最多返回10个结果
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
        let context = 'You are a helpful AI assistant for a gesture interaction research paper gallery.';
        
        // 如果有当前论文，提供紧凑的数据摘要
        if (this.currentPaper && this.currentPaper.text) {
            if (this.websiteData) {
                context += '\n\n' + this.generateCompactWebsiteData();
            }
            
            const paperText = this.currentPaper.text;
            const maxChars = 25000; // 增加论文内容空间
            
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
