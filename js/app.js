// Main application logic
class GestureResearchGallery {
    constructor() {
        this.serviceWorkerVersion = '202605100007';
        this.isServiceWorkerRefreshing = false;
        this.allPapers = [];
        this.filteredPapers = [];
        this.currentIndex = 0;
        this.itemsPerBatch = 40;
        this.isLoading = false;
        this.searchQuery = '';
        this.sortBy = 'year';
        this.sortOrder = 'desc';
        this.defaultYearRange = {
            start: 1990,
            end: new Date().getFullYear()
        };
        
        // Filter state
        this.filterState = this.createDefaultFilterState();

        this.ready = this.init();
    }

    createDefaultFilterState() {
        return {
            mainCategory: [],
            hardwareDevices: [],
            sensingTechnology: [],
            recognitionClassification: [],
            interactionModalities: [],
            gestureTypes: [],
            applicationScenarios: [],
            feedbackOutput: [],
            userExperienceDesign: [],
            tags: [],
            yearStart: this.defaultYearRange.start,
            yearEnd: this.defaultYearRange.end
        };
    }

    async init() {
        this.showLoadingState();
        await this.loadPapersData();
        this.initializeFilters();
        this.setupEventListeners();
        this.loadStateFromURL();
        this.hideLoadingState();
        
        // Check for PWA support
        if ('serviceWorker' in navigator) {
            this.registerServiceWorker();
        }
    }

    async registerServiceWorker() {
        try {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (this.isServiceWorkerRefreshing) {
                    return;
                }

                this.isServiceWorkerRefreshing = true;
                window.location.reload();
            });

            const registration = await navigator.serviceWorker.register(`sw.js?v=${this.serviceWorkerVersion}`);
            await registration.update();
            console.log('Service Worker registered successfully');
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }

    showLoadingState() {
        const gallery = document.getElementById('gallery');
        gallery.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>Loading papers...</p>
            </div>
        `;
    }

    hideLoadingState() {
        const loadingContainer = document.querySelector('.loading-container');
        if (loadingContainer) {
            loadingContainer.remove();
        }
    }

    showEmptyState() {
        const gallery = document.getElementById('gallery');
        gallery.innerHTML = `
            <div class="empty-state">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <h3>No papers found</h3>
                <p>Try adjusting your filters or search query</p>
                <button onclick="app.clearAllFilters()" class="btn-secondary">Clear All Filters</button>
            </div>
        `;
    }

    async loadPapersData() {
        return new Promise((resolve) => {
            const checkData = setInterval(async () => {
                if (typeof PAPERS_DATA !== 'undefined') {
                    clearInterval(checkData);

                    const basePapers = Array.isArray(PAPERS_DATA.papers)
                        ? PAPERS_DATA.papers
                        : [];
                    const userPapers = await this.loadUserSubmissions();

                    this.allPapers = this.mergePaperCollections(basePapers, userPapers)
                        .filter(p => p.image)
                        .sort((a, b) => parseInt(b.year) - parseInt(a.year));

                    console.log(`Loaded ${this.allPapers.length} papers`);
                    resolve();
                }
            }, 100);
        });
    }

    async loadUserSubmissions() {
        try {
            const response = await fetch('data/user-submissions.json');
            if (!response.ok) {
                return [];
            }

            const payload = await response.json();
            return Array.isArray(payload.papers) ? payload.papers.map(paper => this.normalizePaperRecord(paper)) : [];
        } catch (error) {
            return [];
        }
    }

    mergePaperCollections(...collections) {
        const merged = [];
        const seen = new Set();

        collections.flat().forEach(paper => {
            const normalized = this.normalizePaperRecord(paper);
            const key = this.getPaperIdentity(normalized);

            if (seen.has(key)) {
                return;
            }

            seen.add(key);
            merged.push(normalized);
        });

        return merged;
    }

    normalizePaperRecord(paper) {
        const normalized = {
            id: paper?.id ?? `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: paper?.title || 'Untitled',
            year: String(paper?.year || this.defaultYearRange.end),
            category: paper?.category || 'software',
            hardwareDevices: Array.isArray(paper?.hardwareDevices) ? paper.hardwareDevices : [],
            sensingTechnology: Array.isArray(paper?.sensingTechnology) ? paper.sensingTechnology : [],
            recognitionClassification: Array.isArray(paper?.recognitionClassification) ? paper.recognitionClassification : [],
            interactionModalities: Array.isArray(paper?.interactionModalities) ? paper.interactionModalities : [],
            gestureTypes: Array.isArray(paper?.gestureTypes) ? paper.gestureTypes : [],
            applicationScenarios: Array.isArray(paper?.applicationScenarios) ? paper.applicationScenarios : [],
            feedbackOutput: Array.isArray(paper?.feedbackOutput) ? paper.feedbackOutput : [],
            userExperienceDesign: Array.isArray(paper?.userExperienceDesign) ? paper.userExperienceDesign : [],
            tags: Array.isArray(paper?.tags) ? paper.tags : [],
            image: paper?.image || '',
            url: paper?.url || '',
            doi: paper?.doi || '',
            authors: paper?.authors || '',
            journal: paper?.journal || '',
            uploadedAt: paper?.uploadedAt || '',
            source: paper?.source || ''
        };

        return normalized;
    }

    getPaperIdentity(paper) {
        return [
            paper?.url || paper?.doi || '',
            paper?.title || '',
            paper?.year || '',
            paper?.image || ''
        ].join('::');
    }

    addUploadedPaper(paper) {
        const normalized = this.normalizePaperRecord(paper);
        const key = this.getPaperIdentity(normalized);

        if (this.allPapers.some(entry => this.getPaperIdentity(entry) === key)) {
            return;
        }

        this.allPapers = [normalized, ...this.allPapers]
            .sort((a, b) => parseInt(b.year) - parseInt(a.year));

        this.initializeFilters();
        this.applyFilters();
        this.updateFilterCounts();
        this.updateStatistics();
    }

    removeUploadedPaper(paper) {
        if (!paper) {
            return;
        }

        const targetId = paper?.id ? String(paper.id) : '';
        const targetKey = this.getPaperIdentity(paper);
        const matchesTarget = (entry) => {
            if (targetId && String(entry.id || '') === targetId) {
                return true;
            }

            return this.getPaperIdentity(entry) === targetKey;
        };

        this.allPapers = this.allPapers.filter(entry => !matchesTarget(entry));
        this.filteredPapers = this.filteredPapers.filter(entry => !matchesTarget(entry));

        this.initializeFilters();
        this.applyFilters();
        this.updateFilterCounts();
        this.updateStatistics();
    }

    initializeFilters() {
        if (this.allPapers.length === 0) return;

        const tagCollections = {
            mainCategory: new Set(),
            hardwareDevices: new Set(),
            sensingTechnology: new Set(),
            recognitionClassification: new Set(),
            interactionModalities: new Set(),
            gestureTypes: new Set(),
            applicationScenarios: new Set(),
            feedbackOutput: new Set(),
            userExperienceDesign: new Set(),
            tags: new Set()
        };

        const tagCounts = {};

        this.allPapers.forEach(paper => {
            if (paper.category) {
                tagCollections.mainCategory.add(paper.category);
                tagCounts[`category_${paper.category}`] = (tagCounts[`category_${paper.category}`] || 0) + 1;
            }

            Object.keys(tagCollections).forEach(key => {
                if (key !== 'mainCategory' && paper[key]) {
                    paper[key].forEach(tag => {
                        tagCollections[key].add(tag);
                        tagCounts[`${key}_${tag}`] = (tagCounts[`${key}_${tag}`] || 0) + 1;
                    });
                }
            });
        });

        // Generate filter options
        this.generateFilterOptions('mainCategoryOptions', Array.from(tagCollections.mainCategory), 'category', tagCounts);
        this.generateFilterOptions('hardwareOptions', Array.from(tagCollections.hardwareDevices), 'hardwareDevices', tagCounts);
        this.generateFilterOptions('sensingOptions', Array.from(tagCollections.sensingTechnology), 'sensingTechnology', tagCounts);
        this.generateFilterOptions('recognitionOptions', Array.from(tagCollections.recognitionClassification), 'recognitionClassification', tagCounts);
        this.generateFilterOptions('interactionOptions', Array.from(tagCollections.interactionModalities), 'interactionModalities', tagCounts);
        this.generateFilterOptions('gestureOptions', Array.from(tagCollections.gestureTypes), 'gestureTypes', tagCounts);
        this.generateFilterOptions('applicationOptions', Array.from(tagCollections.applicationScenarios), 'applicationScenarios', tagCounts);
        this.generateFilterOptions('feedbackOptions', Array.from(tagCollections.feedbackOutput), 'feedbackOutput', tagCounts);
        this.generateFilterOptions('uxOptions', Array.from(tagCollections.userExperienceDesign), 'userExperienceDesign', tagCounts);
        this.generateFilterOptions('tagsOptions', Array.from(tagCollections.tags), 'tags', tagCounts);
    }

    generateFilterOptions(containerId, tags, categoryKey, tagCounts) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        
        // Sort tags with "Other*" at the end
        const sortedTags = tags.sort((a, b) => {
            const aIsOther = a.startsWith('Other');
            const bIsOther = b.startsWith('Other');
            
            if (aIsOther && !bIsOther) return 1;
            if (!aIsOther && bIsOther) return -1;
            return a.localeCompare(b);
        });
        
        sortedTags.forEach(tag => {
            const countKey = categoryKey === 'category' ? `category_${tag}` : `${categoryKey}_${tag}`;
            const count = tagCounts[countKey] || 0;
            
            const optionDiv = document.createElement('div');
            optionDiv.className = 'filter-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = this.createFilterOptionId(categoryKey, tag);
            checkbox.value = tag;
            checkbox.addEventListener('change', () => this.handleFilterChange(categoryKey, tag, checkbox.checked));
            
            const label = document.createElement('label');
            label.setAttribute('for', checkbox.id);
            label.innerHTML = `<span>${this.formatTag(tag)}</span><span class="filter-count">${count}</span>`;
            
            optionDiv.appendChild(checkbox);
            optionDiv.appendChild(label);
            container.appendChild(optionDiv);
        });
    }

    createFilterOptionId(categoryKey, tag) {
        const rawId = `${categoryKey}_${tag}`;
        return rawId.replace(/[^a-zA-Z0-9_-]/g, (character) => `_${character.charCodeAt(0).toString(16)}`);
    }

    handleFilterChange(categoryKey, tag, isChecked) {
        const filterKey = categoryKey === 'category' ? 'mainCategory' : categoryKey;
        
        if (isChecked) {
            if (!this.filterState[filterKey].includes(tag)) {
                this.filterState[filterKey].push(tag);
            }
        } else {
            this.filterState[filterKey] = this.filterState[filterKey].filter(t => t !== tag);
        }
        
        this.applyFilters();
        this.updateFilterCounts();
        this.updateURL();
    }

    applyFilters() {
        let papers = [...this.allPapers];
        
        // Apply year filter
        papers = papers.filter(paper => {
            const year = parseInt(paper.year);
            return year >= this.filterState.yearStart && year <= this.filterState.yearEnd;
        });
        
        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            papers = papers.filter(paper => {
                return paper.title.toLowerCase().includes(query) ||
                       paper.year.includes(query) ||
                       (paper.category && paper.category.toLowerCase().includes(query)) ||
                       this.searchInTags(paper, query);
            });
        }
        
        // Apply category filters
        const hasActiveFilters = Object.entries(this.filterState).some(([key, val]) => {
            return Array.isArray(val) && val.length > 0;
        });
        
        if (hasActiveFilters) {
            papers = papers.filter(paper => {
                // Check main category
                if (this.filterState.mainCategory.length > 0) {
                    if (!this.filterState.mainCategory.includes(paper.category)) {
                        return false;
                    }
                }
                
                // Check other tags (OR logic within each category)
                for (const [key, selectedTags] of Object.entries(this.filterState)) {
                    if (key === 'mainCategory' || key === 'yearStart' || key === 'yearEnd') continue;
                    if (!Array.isArray(selectedTags) || selectedTags.length === 0) continue;
                    
                    const paperTags = paper[key] || [];
                    const hasMatch = selectedTags.some(tag => paperTags.includes(tag));
                    
                    if (!hasMatch) return false;
                }
                
                return true;
            });
        }
        
        // Apply sorting
        papers = this.sortPapers(papers);
        
        this.filteredPapers = papers;
        
        // Reset display
        this.currentIndex = 0;
        document.getElementById('gallery').innerHTML = '';
        
        if (this.filteredPapers.length === 0) {
            this.showEmptyState();
        } else {
            this.loadMore();
        }
        
        // Update counts
        this.updateStatistics();
    }

    searchInTags(paper, query) {
        const allTags = [
            ...(paper.hardwareDevices || []),
            ...(paper.sensingTechnology || []),
            ...(paper.recognitionClassification || []),
            ...(paper.interactionModalities || []),
            ...(paper.gestureTypes || []),
            ...(paper.applicationScenarios || []),
            ...(paper.feedbackOutput || []),
            ...(paper.userExperienceDesign || []),
            ...(paper.tags || [])
        ];
        
        return allTags.some(tag => tag.toLowerCase().includes(query));
    }

    sortPapers(papers) {
        const sorted = [...papers];
        
        switch(this.sortBy) {
            case 'year':
                sorted.sort((a, b) => {
                    const yearA = parseInt(a.year);
                    const yearB = parseInt(b.year);
                    return this.sortOrder === 'desc' ? yearB - yearA : yearA - yearB;
                });
                break;
            case 'title':
                sorted.sort((a, b) => {
                    const result = a.title.localeCompare(b.title);
                    return this.sortOrder === 'desc' ? -result : result;
                });
                break;
            case 'relevance':
                // Relevance based on search query match quality
                if (this.searchQuery) {
                    sorted.sort((a, b) => {
                        const scoreA = this.getRelevanceScore(a, this.searchQuery);
                        const scoreB = this.getRelevanceScore(b, this.searchQuery);
                        return this.sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
                    });
                }
                break;
        }
        
        return sorted;
    }

    getRelevanceScore(paper, query) {
        let score = 0;
        const q = query.toLowerCase();
        
        // Title match (highest weight)
        if (paper.title.toLowerCase().includes(q)) {
            score += 10;
            if (paper.title.toLowerCase().startsWith(q)) {
                score += 5;
            }
        }
        
        // Year match
        if (paper.year.includes(q)) {
            score += 3;
        }
        
        // Category match
        if (paper.category && paper.category.toLowerCase().includes(q)) {
            score += 5;
        }
        
        // Tag matches
        const tagMatches = this.countTagMatches(paper, q);
        score += tagMatches * 2;
        
        return score;
    }

    countTagMatches(paper, query) {
        let count = 0;
        const allTags = [
            ...(paper.hardwareDevices || []),
            ...(paper.sensingTechnology || []),
            ...(paper.recognitionClassification || []),
            ...(paper.interactionModalities || []),
            ...(paper.gestureTypes || []),
            ...(paper.applicationScenarios || []),
            ...(paper.feedbackOutput || []),
            ...(paper.userExperienceDesign || []),
            ...(paper.tags || [])
        ];
        
        allTags.forEach(tag => {
            if (tag.toLowerCase().includes(query)) {
                count++;
            }
        });
        
        return count;
    }

    loadMore() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const gallery = document.getElementById('gallery');
        const endIndex = Math.min(this.currentIndex + this.itemsPerBatch, this.filteredPapers.length);
        
        for (let i = this.currentIndex; i < endIndex; i++) {
            const paper = this.filteredPapers[i];
            const item = this.createPaperItem(paper, i);
            gallery.appendChild(item);
        }
        
        this.currentIndex = endIndex;
        this.isLoading = false;
        
        // Update button state
        this.updateLoadMoreButton();
    }

    updateLoadMoreButton() {
        const btn = document.getElementById('loadBtn');
        if (!btn) return;
        
        if (this.currentIndex >= this.filteredPapers.length) {
            btn.textContent = 'All Loaded';
            btn.disabled = true;
        } else {
            btn.textContent = `Load More (${this.filteredPapers.length - this.currentIndex} remaining)`;
            btn.disabled = false;
        }
    }

    createPaperItem(paper, index) {
        const item = document.createElement('div');
        item.className = 'paper-item';
        item.style.setProperty('--item-index', index % this.itemsPerBatch);
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `Open details for ${paper.title}`);
        
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container loading';
        
        const img = document.createElement('img');
        img.className = 'paper-image';
        img.src = paper.image;
        img.alt = paper.title;
        img.loading = 'lazy';
        img.onload = function() {
            imageContainer.classList.remove('loading');
        };
        img.onerror = function() {
            this.src = 'images/placeholder.png';
            imageContainer.classList.remove('loading');
        };
        
        imageContainer.appendChild(img);
        
        const title = document.createElement('div');
        title.className = 'paper-title';
        title.textContent = paper.title;

        const cardBody = document.createElement('div');
        cardBody.className = 'paper-card-body';

        const category = document.createElement('div');
        category.className = 'paper-category';
        category.textContent = this.formatCategory(paper.category);
        
        const year = document.createElement('div');
        year.className = 'paper-year';
        year.textContent = paper.year;
        
        item.appendChild(imageContainer);
        cardBody.appendChild(category);
        cardBody.appendChild(title);
        item.appendChild(cardBody);
        item.appendChild(year);

        const openPaper = () => {
            item.classList.add('clicked');
            setTimeout(() => {
                item.classList.remove('clicked');
            }, 600);
            
            this.showModal(paper);
        };

        item.addEventListener('click', openPaper);
        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openPaper();
            }
        });
        
        return item;
    }

    showModal(paper) {
        // Implementation remains the same as original
        const modal = new PaperModal(paper);
        modal.show();
    }

    updateStatistics() {
        const totalSelected = Number(this.getSelectedFilterCount()) || 0;
        const selectedCount = document.getElementById('selectedCount');
        const filteredCount = document.getElementById('filteredCount');
        const currentCount = document.getElementById('currentCount');
        const totalCount = document.getElementById('totalCount');

        if (selectedCount) selectedCount.textContent = totalSelected;
        if (filteredCount) filteredCount.textContent = this.filteredPapers.length;
        if (currentCount) currentCount.textContent = Math.min(this.currentIndex, this.filteredPapers.length);
        if (totalCount) totalCount.textContent = this.filteredPapers.length;
        this.renderActiveFilters();
    }

    updateFilterCounts() {
        // Calculate counts for each tag based on currently filtered papers
        const tagCounts = {};
        
        // For each paper in the current filtered set
        this.filteredPapers.forEach(paper => {
            // Count main category
            if (paper.category) {
                tagCounts[`category_${paper.category}`] = (tagCounts[`category_${paper.category}`] || 0) + 1;
            }
            
            // Count other tags
            const tagCategories = {
                hardwareDevices: 'hardwareDevices',
                sensingTechnology: 'sensingTechnology',
                recognitionClassification: 'recognitionClassification',
                interactionModalities: 'interactionModalities',
                gestureTypes: 'gestureTypes',
                applicationScenarios: 'applicationScenarios',
                feedbackOutput: 'feedbackOutput',
                userExperienceDesign: 'userExperienceDesign',
                tags: 'tags'
            };
            
            Object.entries(tagCategories).forEach(([key, categoryKey]) => {
                if (paper[key]) {
                    paper[key].forEach(tag => {
                        tagCounts[`${categoryKey}_${tag}`] = (tagCounts[`${categoryKey}_${tag}`] || 0) + 1;
                    });
                }
            });
        });
        
        // Update all filter count displays
        document.querySelectorAll('.filter-option').forEach(option => {
            const checkbox = option.querySelector('input[type="checkbox"]');
            const countSpan = option.querySelector('.filter-count');
            
            if (checkbox && countSpan) {
                const countKey = checkbox.id;
                const count = tagCounts[countKey] || 0;
                countSpan.textContent = count;
            }
        });
    }

    formatTag(tag) {
        // Direct mappings for specific tags
        const tagMap = {
            'GestureDesign': 'Gesture Design',
            'SmartPhone': 'Smart Phone',
            'ARGlasses': 'AR Glasses',
            'VRHeadset': 'VR Headset',
            'E-Textile': 'E-Textile',
            'Etextile': 'E-Textile',
            'Bio-Sensor': 'Bio-Sensor',
            'EMG': 'EMG',
            'IMU': 'IMU',
            'RFSensing': 'RF Sensing',
            '3DPoseEstimation': '3D Pose Estimation',
            'BackofDevices': 'Back of Devices',
            'Thumb-Index': 'Thumb-Index',
            'AR': 'AR',
            'VR': 'VR',
            'MR': 'MR',
            'IoT': 'IoT',
            'IOT': 'IoT',
            '\u952e\u76d8': 'Keyboard',
            '\u6309\u4f4f': 'Hold',
            '\u634f\u5408': 'Pinch',
            '\u6ed1\u52a8': 'Swipe',
            '\u5bfc\u822a': 'Navigation',
            '\u8bad\u7ec3\u4e2d': 'Training',
            'QWERTYLayout': 'QWERTY Layout',
            'OtherDevices': 'Other Devices',
            'OtherTechnology': 'Other Technology',
            'OtherScenarios': 'Other Scenarios'
        };
        
        // Return direct mapping if exists
        if (tagMap[tag]) {
            return tagMap[tag];
        }
        
        // Default formatting
        tag = tag.replace(/^#/, '');
        tag = tag.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
        tag = tag.replace(/[_/]+/g, ' ');
        return tag.replace(/\s+/g, ' ').trim().replace(/\b\w/g, l => l.toUpperCase());
    }

    formatCategory(category) {
        const categoryMap = {
            hardware: 'Hardware',
            software: 'Software',
            GestureDesign: 'Gesture Design',
            'gesture-design': 'Gesture Design'
        };

        return categoryMap[category] || this.formatTag(category || '');
    }

    isYearFilterActive() {
        return this.filterState.yearStart !== this.defaultYearRange.start ||
            this.filterState.yearEnd !== this.defaultYearRange.end;
    }

    getSelectedFilterCount() {
        const safeFilterState = this.filterState && typeof this.filterState === 'object'
            ? this.filterState
            : this.createDefaultFilterState();

        const selectedTagCount = Object.values(safeFilterState).reduce((sum, value) => {
            const nextValue = Array.isArray(value) ? value.length : 0;
            return sum + (Number.isFinite(nextValue) ? nextValue : 0);
        }, 0);

        const totalSelected = selectedTagCount + (this.isYearFilterActive() ? 1 : 0);
        return Number.isFinite(totalSelected) ? totalSelected : 0;
    }

    syncYearControls() {
        const yearSliderStart = document.getElementById('yearSliderStart');
        const yearSliderEnd = document.getElementById('yearSliderEnd');
        const yearRangeStart = document.getElementById('yearRangeStart');
        const yearRangeEnd = document.getElementById('yearRangeEnd');

        if (yearSliderStart) {
            yearSliderStart.max = this.defaultYearRange.end;
            yearSliderStart.value = this.filterState.yearStart;
        }

        if (yearSliderEnd) {
            yearSliderEnd.max = this.defaultYearRange.end;
            yearSliderEnd.value = this.filterState.yearEnd;
        }

        if (yearRangeStart) {
            yearRangeStart.textContent = this.filterState.yearStart;
        }

        if (yearRangeEnd) {
            yearRangeEnd.textContent = this.filterState.yearEnd;
        }
    }

    setFilterPanelOpen(isOpen) {
        const filterToggleBtn = document.getElementById('filterToggle');
        const filterPanel = document.getElementById('filterPanel');
        const gallery = document.getElementById('gallery');
        const mainContainer = document.querySelector('.main-container');

        if (!filterToggleBtn || !filterPanel || !gallery || !mainContainer) {
            return;
        }

        filterToggleBtn.classList.toggle('active', isOpen);
        filterPanel.classList.toggle('active', isOpen);
        gallery.classList.toggle('filter-active', isOpen);
        mainContainer.classList.toggle('filter-active', isOpen);
        document.body.classList.toggle('filter-panel-open', isOpen);
        filterToggleBtn.setAttribute('aria-expanded', String(isOpen));
    }

    getActiveConstraints() {
        const constraints = [];

        if (this.searchQuery.trim()) {
            constraints.push({
                type: 'search',
                label: `Search: "${this.searchQuery.trim()}"`
            });
        }

        if (this.isYearFilterActive()) {
            constraints.push({
                type: 'year',
                label: `Years: ${this.filterState.yearStart}-${this.filterState.yearEnd}`
            });
        }

        Object.entries(this.filterState).forEach(([key, values]) => {
            if (!Array.isArray(values) || values.length === 0) {
                return;
            }

            values.forEach((value) => {
                constraints.push({
                    type: 'filter',
                    key,
                    value,
                    label: this.getActiveFilterLabel(key, value)
                });
            });
        });

        return constraints;
    }

    renderActiveFilters() {
        const summary = document.getElementById('activeFilterSummary');
        const chipContainer = document.getElementById('activeFilterChips');

        if (!summary || !chipContainer) {
            return;
        }

        const chips = this.getActiveConstraints();

        chipContainer.innerHTML = '';

        if (chips.length === 0) {
            summary.hidden = true;
            return;
        }

        chips.forEach((chip) => {
            const chipButton = document.createElement('button');
            chipButton.type = 'button';
            chipButton.className = 'active-filter-chip';
            chipButton.setAttribute('aria-label', `Remove ${chip.label}`);

            const labelSpan = document.createElement('span');
            labelSpan.textContent = chip.label;

            const removeSpan = document.createElement('span');
            removeSpan.className = 'chip-remove';
            removeSpan.setAttribute('aria-hidden', 'true');
            removeSpan.textContent = '×';

            chipButton.appendChild(labelSpan);
            chipButton.appendChild(removeSpan);
            chipButton.addEventListener('click', () => this.removeActiveFilter(chip));
            chipContainer.appendChild(chipButton);
        });

        summary.hidden = false;
    }

    getActiveFilterLabel(key, value) {
        const prefixes = {
            mainCategory: 'Category',
            hardwareDevices: 'Device',
            sensingTechnology: 'Sensing',
            recognitionClassification: 'Recognition',
            interactionModalities: 'Interaction',
            gestureTypes: 'Gesture',
            applicationScenarios: 'Scenario',
            feedbackOutput: 'Feedback',
            userExperienceDesign: 'UX',
            tags: 'Tag'
        };

        const formattedValue = key === 'mainCategory'
            ? this.formatCategory(value)
            : this.formatTag(value);

        return `${prefixes[key] || 'Filter'}: ${formattedValue}`;
    }

    removeActiveFilter(chip) {
        if (chip.type === 'search') {
            this.searchQuery = '';
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
            }
        } else if (chip.type === 'year') {
            this.filterState.yearStart = this.defaultYearRange.start;
            this.filterState.yearEnd = this.defaultYearRange.end;
            this.syncYearControls();
        } else if (chip.type === 'filter' && chip.key) {
            this.filterState[chip.key] = (this.filterState[chip.key] || []).filter((value) => value !== chip.value);
            const checkboxId = this.createFilterOptionId(chip.key === 'mainCategory' ? 'category' : chip.key, chip.value);
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.checked = false;
            }
        }

        this.applyFilters();
        this.updateFilterCounts();
        this.updateURL();
    }

    // URL State Management
    updateURL() {
        const params = new URLSearchParams();
        
        if (this.searchQuery) {
            params.set('q', this.searchQuery);
        }
        
        if (this.sortBy !== 'year') {
            params.set('sort', this.sortBy);
        }
        
        if (this.sortOrder !== 'desc') {
            params.set('order', this.sortOrder);
        }
        
        // Add filter states
        Object.entries(this.filterState).forEach(([key, values]) => {
            if (Array.isArray(values) && values.length > 0) {
                params.set(key, values.join(','));
            }
        });

        if (this.isYearFilterActive()) {
            params.set('yearStart', String(this.filterState.yearStart));
            params.set('yearEnd', String(this.filterState.yearEnd));
        }
        
        const url = params.toString() ? `?${params.toString()}` : window.location.pathname;
        window.history.replaceState({}, '', url);
    }

    loadStateFromURL() {
        const params = new URLSearchParams(window.location.search);
        const sortOrderBtn = document.getElementById('sortOrder');
        const searchInput = document.getElementById('searchInput');

        this.filterState = this.createDefaultFilterState();
        document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Load search query
        const query = params.get('q');
        this.searchQuery = query || '';
        if (searchInput) {
            searchInput.value = this.searchQuery;
        }
        
        // Load sort settings
        const sort = params.get('sort');
        this.sortBy = sort || 'year';
        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) {
            sortSelect.value = this.sortBy;
        }
        
        const order = params.get('order');
        this.sortOrder = order || 'desc';
        if (sortOrderBtn) {
            sortOrderBtn.innerHTML = this.sortOrder === 'desc' ? '↓' : '↑';
        }
        
        // Load filter states
        Object.keys(this.filterState).forEach(key => {
            if (key === 'yearStart' || key === 'yearEnd') {
                return;
            }

            const values = params.get(key);
            if (values) {
                this.filterState[key] = values.split(',');
                // Update checkboxes
                values.split(',').forEach(value => {
                    const checkbox = document.getElementById(
                        this.createFilterOptionId(key === 'mainCategory' ? 'category' : key, value)
                    );
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        });

        const yearStart = parseInt(params.get('yearStart') || this.defaultYearRange.start, 10);
        const yearEnd = parseInt(params.get('yearEnd') || this.defaultYearRange.end, 10);
        this.filterState.yearStart = Number.isNaN(yearStart) ? this.defaultYearRange.start : yearStart;
        this.filterState.yearEnd = Number.isNaN(yearEnd) ? this.defaultYearRange.end : yearEnd;
        this.syncYearControls();
        
        this.applyFilters();
        this.updateFilterCounts();
    }

    clearAllFilters() {
        // Clear filter state
        this.filterState = this.createDefaultFilterState();
        
        // Clear checkboxes
        document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Clear search
        this.searchQuery = '';
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Reset sort
        this.sortBy = 'year';
        this.sortOrder = 'desc';
        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) {
            sortSelect.value = 'year';
        }

        const sortOrderBtn = document.getElementById('sortOrder');
        if (sortOrderBtn) {
            sortOrderBtn.innerHTML = '↓';
        }

        this.syncYearControls();
        
        this.applyFilters();
        this.updateFilterCounts();
        this.updateURL();
    }



    setupEventListeners() {
        // Year slider functionality
        const yearSliderStart = document.getElementById('yearSliderStart');
        const yearSliderEnd = document.getElementById('yearSliderEnd');
        const yearRangeStart = document.getElementById('yearRangeStart');
        const yearRangeEnd = document.getElementById('yearRangeEnd');
        
        if (yearSliderStart && yearSliderEnd) {
            yearSliderStart.addEventListener('input', () => {
                let startYear = parseInt(yearSliderStart.value);
                let endYear = parseInt(yearSliderEnd.value);
                
                if (startYear > endYear) {
                    startYear = endYear;
                    yearSliderStart.value = startYear;
                }
                
                this.filterState.yearStart = startYear;
                yearRangeStart.textContent = startYear;
                this.applyFilters();
                this.updateFilterCounts();
                this.updateURL();
            });
            
            yearSliderEnd.addEventListener('input', () => {
                let startYear = parseInt(yearSliderStart.value);
                let endYear = parseInt(yearSliderEnd.value);
                
                if (endYear < startYear) {
                    endYear = startYear;
                    yearSliderEnd.value = endYear;
                }
                
                this.filterState.yearEnd = endYear;
                yearRangeEnd.textContent = endYear;
                this.applyFilters();
                this.updateFilterCounts();
                this.updateURL();
            });
        }
        
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.searchQuery = searchInput.value;
                this.applyFilters();
                this.updateFilterCounts();
                this.updateURL();
            }, 300));
        }

        // Sort functionality
        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.sortBy = sortSelect.value;
                this.applyFilters();
                this.updateURL();
            });
        }

        const sortOrderBtn = document.getElementById('sortOrder');
        if (sortOrderBtn) {
            sortOrderBtn.addEventListener('click', () => {
                this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
                sortOrderBtn.innerHTML = this.sortOrder === 'desc' ? '↓' : '↑';
                this.applyFilters();
                this.updateURL();
            });
        }



        // Filter panel toggle
        const filterToggleBtn = document.getElementById('filterToggle');
        const filterPanel = document.getElementById('filterPanel');
        
        if (filterToggleBtn && filterPanel) {
            filterToggleBtn.addEventListener('click', () => {
                const isOpen = !filterPanel.classList.contains('active');
                this.setFilterPanelOpen(isOpen);
            });
        }

        // Clear filters button
        const clearFiltersBtn = document.getElementById('clearFilters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearAllFilters());
        }

        // Filter category collapse/expand
        document.querySelectorAll('.filter-category-title').forEach(title => {
            title.addEventListener('click', function() {
                const category = this.parentElement;
                category.classList.toggle('collapsed');
            });
        });

        // Load more button
        const loadBtn = document.getElementById('loadBtn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadMore());
        }

        // Infinite scroll
        window.addEventListener('scroll', () => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
                if (this.currentIndex < this.filteredPapers.length && !this.isLoading) {
                    this.loadMore();
                }
            }
        });

        // Back/forward browser navigation
        window.addEventListener('popstate', () => {
            this.loadStateFromURL();
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GestureResearchGallery();
    window.app = app;
});
