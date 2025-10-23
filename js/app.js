// Main application logic
class GestureResearchGallery {
    constructor() {
        this.allPapers = [];
        this.filteredPapers = [];
        this.currentIndex = 0;
        this.itemsPerBatch = 40;
        this.isLoading = false;
        this.searchQuery = '';
        this.sortBy = 'year';
        this.sortOrder = 'desc';
        
        // Filter state
        this.filterState = {
            mainCategory: [],
            hardwareDevices: [],
            sensingTechnology: [],
            recognitionClassification: [],
            interactionModalities: [],
            gestureTypes: [],
            applicationScenarios: [],
            feedbackOutput: [],
            userExperienceDesign: []
        };

        this.init();
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
            await navigator.serviceWorker.register('sw.js');
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
            const checkData = setInterval(() => {
                if (typeof PAPERS_DATA !== 'undefined') {
                    this.allPapers = PAPERS_DATA.papers
                        .filter(p => p.image)
                        .sort((a, b) => parseInt(b.year) - parseInt(a.year));
                    
                    console.log(`Loaded ${this.allPapers.length} papers`);
                    clearInterval(checkData);
                    resolve();
                }
            }, 100);
        });
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
            userExperienceDesign: new Set()
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
    }

    generateFilterOptions(containerId, tags, categoryKey, tagCounts) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        tags.sort().forEach(tag => {
            const countKey = categoryKey === 'category' ? `category_${tag}` : `${categoryKey}_${tag}`;
            const count = tagCounts[countKey] || 0;
            
            const optionDiv = document.createElement('div');
            optionDiv.className = 'filter-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${categoryKey}_${tag}`;
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
        this.updateURL();
    }

    applyFilters() {
        let papers = [...this.allPapers];
        
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
        const hasActiveFilters = Object.values(this.filterState).some(arr => arr.length > 0);
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
                    if (key === 'mainCategory' || selectedTags.length === 0) continue;
                    
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
            ...(paper.userExperienceDesign || [])
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
            ...(paper.userExperienceDesign || [])
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
        
        const year = document.createElement('div');
        year.className = 'paper-year';
        year.textContent = paper.year;
        
        item.appendChild(imageContainer);
        item.appendChild(title);
        item.appendChild(year);
        
        item.addEventListener('click', () => {
            item.classList.add('clicked');
            setTimeout(() => {
                item.classList.remove('clicked');
            }, 600);
            
            this.showModal(paper);
        });
        
        return item;
    }

    showModal(paper) {
        // Implementation remains the same as original
        const modal = new PaperModal(paper);
        modal.show();
    }

    updateStatistics() {
        const totalSelected = Object.values(this.filterState).reduce((sum, arr) => sum + arr.length, 0);
        document.getElementById('selectedCount').textContent = totalSelected;
        document.getElementById('filteredCount').textContent = this.filteredPapers.length;
        document.getElementById('currentCount').textContent = Math.min(this.currentIndex, this.filteredPapers.length);
        document.getElementById('totalCount').textContent = this.filteredPapers.length;
    }

    formatTag(tag) {
        tag = tag.replace(/^#/, '');
        tag = tag.replace(/([A-Z])/g, ' $1');
        tag = tag.replace(/EMG/g, 'EMG');
        tag = tag.replace(/VR/g, 'VR');
        tag = tag.replace(/AR/g, 'AR');
        tag = tag.replace(/IMU/g, 'IMU');
        tag = tag.replace(/IOT/g, 'IoT');
        tag = tag.replace(/3D/g, '3D');
        tag = tag.replace(/2D/g, '2D');
        tag = tag.replace(/QWERTY/g, 'QWERTY');
        return tag.trim().replace(/\b\w/g, l => l.toUpperCase());
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
            if (values.length > 0) {
                params.set(key, values.join(','));
            }
        });
        
        const url = params.toString() ? `?${params.toString()}` : window.location.pathname;
        window.history.replaceState({}, '', url);
    }

    loadStateFromURL() {
        const params = new URLSearchParams(window.location.search);
        
        // Load search query
        const query = params.get('q');
        if (query) {
            this.searchQuery = query;
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = query;
            }
        }
        
        // Load sort settings
        const sort = params.get('sort');
        if (sort) {
            this.sortBy = sort;
            const sortSelect = document.getElementById('sortBy');
            if (sortSelect) {
                sortSelect.value = sort;
            }
        }
        
        const order = params.get('order');
        if (order) {
            this.sortOrder = order;
        }
        
        // Load filter states
        Object.keys(this.filterState).forEach(key => {
            const values = params.get(key);
            if (values) {
                this.filterState[key] = values.split(',');
                // Update checkboxes
                values.split(',').forEach(value => {
                    const checkbox = document.querySelector(`#${key === 'mainCategory' ? 'category' : key}_${value}`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        });
        
        this.applyFilters();
    }

    clearAllFilters() {
        // Clear filter state
        Object.keys(this.filterState).forEach(key => {
            this.filterState[key] = [];
        });
        
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
        
        this.applyFilters();
        this.updateURL();
    }



    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.searchQuery = searchInput.value;
                this.applyFilters();
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
        const gallery = document.getElementById('gallery');
        const mainContainer = document.querySelector('.main-container');
        
        if (filterToggleBtn && filterPanel) {
            filterToggleBtn.addEventListener('click', () => {
                filterToggleBtn.classList.toggle('active');
                filterPanel.classList.toggle('active');
                gallery.classList.toggle('filter-active');
                mainContainer.classList.toggle('filter-active');
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
});
