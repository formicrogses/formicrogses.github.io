class ArticleUploader {
    constructor() {
        this.owner = 'formicrogses';
        this.repo = 'formicrogses.github.io';
        this.branch = 'main';
        this.dataPath = 'data/user-submissions.json';
        this.imageDirectory = 'uploads/images';
        this.tokenStorageKey = 'microgesture_upload_github_token';
        this.previousBodyOverflow = '';
        this.lastFocusedElement = null;
        this.metadataLookupTimer = null;
        this.metadataLookupId = 0;
        this.metadataAbortController = null;
        this.lastMetadataLookupKey = '';
        this.isUploading = false;
        this.availableTags = [];
        this.selectedTags = [];
        this.tagGroupConfigs = [
            { key: 'hardwareDevices', label: 'Hardware Devices' },
            { key: 'sensingTechnology', label: 'Sensing Technology' },
            { key: 'recognitionClassification', label: 'Recognition & Classification' },
            { key: 'interactionModalities', label: 'Interaction Modalities' },
            { key: 'gestureTypes', label: 'Gesture Types' },
            { key: 'applicationScenarios', label: 'Application Scenarios' },
            { key: 'feedbackOutput', label: 'Feedback & Output' },
            { key: 'userExperienceDesign', label: 'User Experience & Design' }
        ];
        this.availableTagGroups = this.createEmptyTagGroups();
        this.selectedTagGroups = this.createEmptyTagGroups();
        this.focusableSelector = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');
        this.handleDocumentKeydown = (event) => this.onDocumentKeydown(event);

        this.elements = {
            openButton: document.getElementById('uploadOpen'),
            modal: document.getElementById('uploadModal'),
            form: document.getElementById('uploadForm'),
            closeButton: document.getElementById('uploadClose'),
            cancelButton: document.getElementById('uploadCancel'),
            submitButton: document.getElementById('uploadSubmit'),
            status: document.getElementById('uploadStatus'),
            title: document.getElementById('uploadTitleInput'),
            url: document.getElementById('uploadUrlInput'),
            doi: document.getElementById('uploadDoiInput'),
            authors: document.getElementById('uploadAuthorsInput'),
            journal: document.getElementById('uploadJournalInput'),
            year: document.getElementById('uploadYearInput'),
            category: document.getElementById('uploadCategoryInput'),
            imageFile: document.getElementById('uploadImageInput'),
            imageChoose: document.getElementById('uploadImageChoose'),
            imageName: document.getElementById('uploadImageName'),
            imageUrl: document.getElementById('uploadImageUrlInput'),
            detailGroups: document.getElementById('uploadDetailTagGroups'),
            tags: document.getElementById('uploadTagsInput'),
            addTagButton: document.getElementById('uploadAddTag'),
            selectedTags: document.getElementById('uploadSelectedTags'),
            suggestions: document.getElementById('uploadTagSuggestions'),
            token: document.getElementById('uploadTokenInput'),
            rememberToken: document.getElementById('uploadRememberToken')
        };

        this.init();
    }

    init() {
        if (!this.elements.openButton || !this.elements.modal || !this.elements.form) {
            return;
        }

        const savedToken = localStorage.getItem(this.tokenStorageKey);
        if (savedToken) {
            this.elements.token.value = savedToken;
            this.elements.rememberToken.checked = true;
        }

        this.elements.openButton.addEventListener('click', () => this.open());
        this.elements.closeButton?.addEventListener('click', () => this.close());
        this.elements.cancelButton?.addEventListener('click', () => this.close());
        this.elements.form.addEventListener('submit', (event) => this.handleSubmit(event));
        this.elements.imageChoose?.addEventListener('click', () => this.elements.imageFile?.click());
        this.elements.imageFile?.addEventListener('change', () => this.updateSelectedImageName());
        this.elements.url?.addEventListener('input', () => this.scheduleMetadataLookup());
        this.elements.url?.addEventListener('blur', () => this.scheduleMetadataLookup(0));
        this.elements.doi?.addEventListener('input', () => this.scheduleMetadataLookup());
        this.elements.doi?.addEventListener('blur', () => this.scheduleMetadataLookup(0));
        this.elements.addTagButton?.addEventListener('click', () => this.addTagsFromInput());
        this.elements.detailGroups?.addEventListener('click', (event) => this.handleDetailGroupClick(event));
        this.elements.detailGroups?.addEventListener('keydown', (event) => this.handleDetailGroupKeydown(event));
        this.elements.tags?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
                event.preventDefault();
                this.addTagsFromInput();
            }
        });
        this.elements.modal.addEventListener('click', (event) => {
            if (event.target === this.elements.modal) {
                this.close();
            }
        });
        document.addEventListener('keydown', this.handleDocumentKeydown);

        this.renderSelectedTags();
        this.renderDetailTagGroups();
        this.populateTagSuggestionsWhenReady();
    }

    async populateTagSuggestionsWhenReady() {
        if (window.app?.ready) {
            await window.app.ready;
        }

        const allTags = new Set();
        const groupedTags = this.createEmptyTagGroups();
        const tagFields = [...this.tagGroupConfigs.map((config) => config.key), 'tags'];

        (window.app?.allPapers || []).forEach((paper) => {
            tagFields.forEach((field) => {
                (paper[field] || []).forEach((tag) => {
                    allTags.add(tag);

                    if (groupedTags[field]) {
                        groupedTags[field].push(tag);
                    }
                });
            });
        });

        this.availableTags = Array.from(allTags).sort((a, b) => a.localeCompare(b));
        this.availableTagGroups = this.dedupeTagGroups(groupedTags);
        this.renderDetailTagGroups();
        this.renderTagSuggestions();
    }

    open() {
        this.lastFocusedElement = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : this.elements.openButton;
        this.previousBodyOverflow = document.body.style.overflow;
        this.elements.modal.hidden = false;
        this.elements.modal.setAttribute('aria-hidden', 'false');
        this.elements.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        this.clearStatus();

        setTimeout(() => this.elements.title?.focus(), 0);
    }

    close() {
        this.elements.modal.classList.remove('show');
        this.elements.modal.hidden = true;
        this.elements.modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = this.previousBodyOverflow || 'auto';
        this.clearStatus();

        if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
            this.lastFocusedElement.focus();
        }
    }

    onDocumentKeydown(event) {
        if (!this.elements.modal.classList.contains('show')) {
            return;
        }

        if (event.key === 'Escape') {
            this.close();
            return;
        }

        if (event.key === 'Tab') {
            this.trapFocus(event);
        }
    }

    trapFocus(event) {
        const focusableElements = Array.from(this.elements.modal.querySelectorAll(this.focusableSelector))
            .filter((element) => element.tabIndex >= 0 && (element.offsetParent !== null || element === document.activeElement));

        if (focusableElements.length === 0) {
            event.preventDefault();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    }

    async handleSubmit(event) {
        event.preventDefault();
        this.cancelMetadataLookup();
        this.clearStatus();
        this.clearFieldValidity();

        const token = this.elements.token.value.trim();
        const imageFile = this.elements.imageFile.files?.[0] || null;
        const imageUrl = this.elements.imageUrl.value.trim();
        const validationError = this.validateForm({ token, imageFile, imageUrl });

        if (validationError) {
            this.setFieldError(validationError.element, validationError.message);
            return;
        }

        this.setBusy(true);

        try {
            if (this.elements.rememberToken.checked) {
                localStorage.setItem(this.tokenStorageKey, token);
            } else {
                localStorage.removeItem(this.tokenStorageKey);
            }

            this.setStatus('Preparing upload...');
            let imagePath = imageUrl;

            if (imageFile) {
                this.setStatus('Uploading image...');
                imagePath = await this.uploadImageFile(imageFile, token);
            }

            const paper = this.buildPaperRecord(imagePath);
            this.setStatus('Saving article data...');
            const savedPaper = await this.savePaperRecord(paper, token);

            window.app?.addUploadedPaper(savedPaper);
            await this.populateTagSuggestionsWhenReady();
            this.resetArticleFields();
            this.setStatus('Uploaded. GitHub Pages may take 1-2 minutes to publish the new data.', 'success');
        } catch (error) {
            this.setStatus(error.message || 'Upload failed.', 'error');
        } finally {
            this.setBusy(false);
        }
    }

    buildPaperRecord(imagePath) {
        const year = this.elements.year.value.trim() || String(new Date().getFullYear());
        const title = this.elements.title.value.trim();
        const url = this.elements.url.value.trim();
        const tags = this.getSelectedTags();

        return {
            id: `upload-${Date.now()}`,
            title,
            year,
            category: this.elements.category.value,
            hardwareDevices: this.getSelectedDetailTags('hardwareDevices'),
            sensingTechnology: this.getSelectedDetailTags('sensingTechnology'),
            recognitionClassification: this.getSelectedDetailTags('recognitionClassification'),
            interactionModalities: this.getSelectedDetailTags('interactionModalities'),
            gestureTypes: this.getSelectedDetailTags('gestureTypes'),
            applicationScenarios: this.getSelectedDetailTags('applicationScenarios'),
            feedbackOutput: this.getSelectedDetailTags('feedbackOutput'),
            userExperienceDesign: this.getSelectedDetailTags('userExperienceDesign'),
            tags,
            image: imagePath,
            url,
            doi: this.normalizeDoiValue(this.elements.doi.value.trim()),
            authors: this.elements.authors.value.trim(),
            journal: this.elements.journal.value.trim(),
            uploadedAt: new Date().toISOString(),
            source: 'upload'
        };
    }

    validateForm({ token, imageFile, imageUrl }) {
        const title = this.elements.title.value.trim();
        const url = this.elements.url.value.trim();
        const doi = this.elements.doi.value.trim();
        const year = this.elements.year.value.trim();
        const category = this.elements.category.value.trim();

        if (!title) {
            return {
                element: this.elements.title,
                message: 'Enter an article title.'
            };
        }

        if (!url) {
            return {
                element: this.elements.url,
                message: 'Enter the article URL.'
            };
        }

        if (!this.isValidUrl(url)) {
            return {
                element: this.elements.url,
                message: 'Enter a valid article URL, including https://.'
            };
        }

        if (year && (Number(year) < 1900 || Number(year) > 2100)) {
            return {
                element: this.elements.year,
                message: 'Enter a year between 1900 and 2100.'
            };
        }

        if (doi && !this.isValidDoiValue(doi)) {
            return {
                element: this.elements.doi,
                message: 'Enter a valid DOI, for example 10.xxxx/xxxx or https://doi.org/10.xxxx/xxxx.'
            };
        }

        if (!category) {
            return {
                element: this.elements.category,
                message: 'Choose an article category.'
            };
        }

        if (!imageFile && !imageUrl) {
            return {
                element: this.elements.imageChoose,
                message: 'Add either an image file or an image URL.'
            };
        }

        if (imageUrl && !this.isValidUrl(imageUrl)) {
            return {
                element: this.elements.imageUrl,
                message: 'Enter a valid image URL, including https://.'
            };
        }

        if (!token) {
            return {
                element: this.elements.token,
                message: 'GitHub Access Token is required to write to the repository.'
            };
        }

        return null;
    }

    createEmptyTagGroups() {
        return this.tagGroupConfigs.reduce((groups, config) => {
            groups[config.key] = [];
            return groups;
        }, {});
    }

    dedupeTagGroups(tagGroups) {
        return this.tagGroupConfigs.reduce((groups, config) => {
            groups[config.key] = this.dedupeTags(tagGroups[config.key] || [])
                .sort((a, b) => a.localeCompare(b));
            return groups;
        }, {});
    }

    dedupeTags(tags) {
        const uniqueTags = [];

        tags.forEach((tag) => {
            const cleanTag = String(tag || '').trim().replace(/^#/, '');

            if (!cleanTag) {
                return;
            }

            if (!uniqueTags.some((selectedTag) => selectedTag.toLowerCase() === cleanTag.toLowerCase())) {
                uniqueTags.push(cleanTag);
            }
        });

        return uniqueTags;
    }

    isValidUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    isValidDoiValue(value) {
        return Boolean(this.extractDoi(value));
    }

    scheduleMetadataLookup(delay = 700) {
        window.clearTimeout(this.metadataLookupTimer);

        if (this.isUploading) {
            return;
        }

        this.metadataLookupTimer = window.setTimeout(() => {
            this.lookupMetadataFromInputs();
        }, delay);
    }

    cancelMetadataLookup() {
        window.clearTimeout(this.metadataLookupTimer);
        this.metadataLookupTimer = null;
        this.metadataLookupId += 1;

        if (this.metadataAbortController) {
            this.metadataAbortController.abort();
            this.metadataAbortController = null;
        }
    }

    getMetadataLookupInput() {
        const articleUrl = this.elements.url.value.trim();
        const doiValue = this.elements.doi.value.trim();
        const doi = this.extractDoi(doiValue) || this.extractDoi(articleUrl);

        if (doi) {
            return {
                type: 'doi',
                value: doi,
                key: `doi:${doi.toLowerCase()}`
            };
        }

        if (this.isValidUrl(articleUrl)) {
            return {
                type: 'url',
                value: articleUrl,
                key: `url:${articleUrl}`
            };
        }

        return null;
    }

    async lookupMetadataFromInputs() {
        const lookup = this.getMetadataLookupInput();

        if (!lookup || lookup.key === this.lastMetadataLookupKey || this.isUploading) {
            return;
        }

        this.lastMetadataLookupKey = lookup.key;
        const lookupId = this.metadataLookupId + 1;
        this.metadataLookupId = lookupId;

        if (this.metadataAbortController) {
            this.metadataAbortController.abort();
        }

        this.metadataAbortController = new AbortController();
        this.setStatus('Looking up metadata from DOI/URL...');

        try {
            const metadata = await this.fetchArticleMetadata(lookup, this.metadataAbortController.signal);

            if (lookupId !== this.metadataLookupId || this.isUploading) {
                return;
            }

            if (!metadata) {
                this.setStatus('No matching metadata found. You can fill the fields manually.', 'error');
                return;
            }

            const filledFields = this.applyMetadata(metadata);

            if (filledFields.length > 0) {
                this.setStatus(`Metadata found. Filled ${filledFields.join(', ')}.`, 'success');
            } else {
                this.setStatus('Metadata found, but existing field values were kept.', 'success');
            }
        } catch (error) {
            if (error.name === 'AbortError' || lookupId !== this.metadataLookupId || this.isUploading) {
                return;
            }

            this.setStatus('Metadata lookup failed. You can fill the fields manually.', 'error');
        } finally {
            if (lookupId === this.metadataLookupId) {
                this.metadataAbortController = null;
            }
        }
    }

    async fetchArticleMetadata(lookup, signal) {
        const crossrefMetadata = await this.fetchCrossrefMetadata(lookup, signal).catch(() => null);
        if (crossrefMetadata) {
            return crossrefMetadata;
        }

        return this.fetchOpenAlexMetadata(lookup, signal).catch(() => null);
    }

    async fetchCrossrefMetadata(lookup, signal) {
        const endpoint = lookup.type === 'doi'
            ? `https://api.crossref.org/works/${encodeURIComponent(lookup.value)}`
            : `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(lookup.value)}&rows=1`;
        const response = await fetch(endpoint, {
            headers: { Accept: 'application/json' },
            signal
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        const item = lookup.type === 'doi'
            ? payload?.message
            : payload?.message?.items?.[0];

        return this.normalizeCrossrefMetadata(item);
    }

    async fetchOpenAlexMetadata(lookup, signal) {
        const endpoint = lookup.type === 'doi'
            ? `https://api.openalex.org/works?filter=doi:${encodeURIComponent(this.normalizeDoiValue(lookup.value))}&per-page=1`
            : `https://api.openalex.org/works?search=${encodeURIComponent(lookup.value)}&per-page=1`;
        const response = await fetch(endpoint, {
            headers: { Accept: 'application/json' },
            signal
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        const item = payload?.results?.[0];

        return this.normalizeOpenAlexMetadata(item);
    }

    normalizeCrossrefMetadata(item) {
        if (!item || typeof item !== 'object') {
            return null;
        }

        const metadata = {
            title: this.firstTextValue(item.title) || this.firstTextValue(item.subtitle),
            authors: this.formatCrossrefAuthors(item.author),
            journal: this.firstTextValue(item['container-title']) ||
                this.firstTextValue(item['short-container-title']) ||
                item.event?.name ||
                item.publisher ||
                '',
            year: this.extractCrossrefYear(item.issued || item.published || item['published-print'] || item['published-online']),
            doi: item.DOI ? this.normalizeDoiValue(item.DOI) : ''
        };

        return this.hasUsefulMetadata(metadata) ? metadata : null;
    }

    normalizeOpenAlexMetadata(item) {
        if (!item || typeof item !== 'object') {
            return null;
        }

        const sourceName = item.primary_location?.source?.display_name ||
            item.host_venue?.display_name ||
            (Array.isArray(item.locations)
                ? item.locations.find((location) => location?.source?.display_name)?.source?.display_name
                : '') ||
            '';
        const metadata = {
            title: item.display_name || item.title || '',
            authors: Array.isArray(item.authorships)
                ? item.authorships
                    .map((authorship) => authorship?.author?.display_name)
                    .filter(Boolean)
                    .join(', ')
                : '',
            journal: sourceName,
            year: item.publication_year ? String(item.publication_year) : '',
            doi: item.doi ? this.normalizeDoiValue(item.doi) : ''
        };

        return this.hasUsefulMetadata(metadata) ? metadata : null;
    }

    applyMetadata(metadata) {
        const fieldConfigs = [
            { key: 'title', label: 'title', element: this.elements.title },
            { key: 'authors', label: 'authors', element: this.elements.authors },
            { key: 'journal', label: 'journal/conference', element: this.elements.journal },
            { key: 'year', label: 'year', element: this.elements.year },
            { key: 'doi', label: 'DOI', element: this.elements.doi }
        ];
        const filledFields = [];

        fieldConfigs.forEach((config) => {
            const value = String(metadata[config.key] || '').trim();

            if (!value || config.element.value.trim()) {
                return;
            }

            config.element.value = value;
            filledFields.push(config.label);
        });

        return filledFields;
    }

    hasUsefulMetadata(metadata) {
        return ['title', 'authors', 'journal', 'year', 'doi']
            .some((key) => Boolean(String(metadata[key] || '').trim()));
    }

    firstTextValue(value) {
        if (Array.isArray(value)) {
            return String(value[0] || '').trim();
        }

        return String(value || '').trim();
    }

    formatCrossrefAuthors(authors) {
        if (!Array.isArray(authors)) {
            return '';
        }

        return authors
            .map((author) => {
                const parts = [author.given, author.family]
                    .filter(Boolean)
                    .join(' ')
                    .trim();

                return parts || author.name || '';
            })
            .filter(Boolean)
            .join(', ');
    }

    extractCrossrefYear(dateValue) {
        const year = dateValue?.['date-parts']?.[0]?.[0];
        return year ? String(year) : '';
    }

    extractDoi(value) {
        if (!value) {
            return '';
        }

        let cleanValue = String(value).trim();

        try {
            cleanValue = decodeURIComponent(cleanValue);
        } catch (error) {
            // Keep the original value when it is not valid percent-encoded text.
        }

        cleanValue = cleanValue
            .replace(/^doi:\s*/i, '')
            .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');

        const match = cleanValue.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);

        return match ? match[0].replace(/[.,;)\]]+$/g, '') : '';
    }

    normalizeDoiValue(value) {
        const doi = this.extractDoi(value);

        if (!doi) {
            return String(value || '').trim();
        }

        return `https://doi.org/${doi}`;
    }

    parseTags(value) {
        return value
            .split(/[,，;；\n]+/)
            .map((tag) => tag.trim().replace(/^#/, ''))
            .filter(Boolean)
            .filter((tag, index, list) => list.indexOf(tag) === index);
    }

    addTagsFromInput() {
        const tags = this.parseTags(this.elements.tags.value);

        if (tags.length === 0) {
            return;
        }

        tags.forEach((tag) => this.addTag(tag));
        this.elements.tags.value = '';
        this.renderSelectedTags();
        this.updateSuggestionSelectionStates();
    }

    addTag(tag) {
        const cleanTag = tag.trim().replace(/^#/, '');

        if (!cleanTag) {
            return;
        }

        const hasTag = this.selectedTags.some((selectedTag) => selectedTag.toLowerCase() === cleanTag.toLowerCase());
        if (!hasTag) {
            this.selectedTags.push(cleanTag);
        }
    }

    removeTag(tag) {
        this.selectedTags = this.selectedTags.filter((selectedTag) => selectedTag.toLowerCase() !== tag.toLowerCase());
        this.renderSelectedTags();
        this.updateSuggestionSelectionStates();
    }

    toggleSuggestedTag(tag) {
        const isSelected = this.selectedTags.some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase());

        if (isSelected) {
            this.removeTag(tag);
            return;
        }

        this.addTag(tag);
        this.renderSelectedTags();
        this.updateSuggestionSelectionStates();
    }

    getSelectedTags() {
        const combinedTags = [...this.selectedTags, ...this.parseTags(this.elements.tags.value)];
        const uniqueTags = [];

        combinedTags.forEach((tag) => {
            if (!uniqueTags.some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase())) {
                uniqueTags.push(tag);
            }
        });

        return uniqueTags;
    }

    renderSelectedTags() {
        if (!this.elements.selectedTags) {
            return;
        }

        this.elements.selectedTags.innerHTML = '';

        if (this.selectedTags.length === 0) {
            const emptyState = document.createElement('span');
            emptyState.className = 'upload-selected-empty';
            emptyState.textContent = 'No tags selected yet.';
            this.elements.selectedTags.appendChild(emptyState);
            return;
        }

        this.selectedTags.forEach((tag) => {
            const tagButton = document.createElement('button');
            tagButton.type = 'button';
            tagButton.className = 'upload-selected-tag';
            tagButton.setAttribute('aria-label', `Remove tag ${tag}`);
            tagButton.addEventListener('click', () => this.removeTag(tag));

            const tagLabel = document.createElement('span');
            tagLabel.textContent = this.formatTagLabel(tag);

            const removeIcon = document.createElement('span');
            removeIcon.className = 'upload-tag-remove';
            removeIcon.setAttribute('aria-hidden', 'true');
            removeIcon.textContent = 'x';

            tagButton.appendChild(tagLabel);
            tagButton.appendChild(removeIcon);
            this.elements.selectedTags.appendChild(tagButton);
        });
    }

    renderTagSuggestions() {
        if (!this.elements.suggestions) {
            return;
        }

        this.elements.suggestions.innerHTML = '';

        this.availableTags.forEach((tag) => {
            const tagButton = document.createElement('button');
            tagButton.type = 'button';
            tagButton.className = 'upload-suggestion-tag';
            tagButton.dataset.tag = tag;
            tagButton.setAttribute('aria-pressed', 'false');
            tagButton.textContent = this.formatTagLabel(tag);
            tagButton.addEventListener('click', () => this.toggleSuggestedTag(tag));
            this.elements.suggestions.appendChild(tagButton);
        });

        this.updateSuggestionSelectionStates();
    }

    updateSuggestionSelectionStates() {
        if (!this.elements.suggestions) {
            return;
        }

        this.elements.suggestions.querySelectorAll('.upload-suggestion-tag').forEach((button) => {
            const tag = button.dataset.tag || '';
            const isSelected = this.selectedTags.some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase());
            button.setAttribute('aria-pressed', String(isSelected));
        });
    }

    handleDetailGroupClick(event) {
        const suggestionButton = event.target.closest('[data-upload-detail-suggestion]');
        const selectedButton = event.target.closest('[data-upload-detail-selected]');
        const addButton = event.target.closest('[data-upload-detail-add]');

        if (suggestionButton) {
            this.toggleSuggestedDetailTag(
                suggestionButton.dataset.uploadDetailSuggestionGroup,
                suggestionButton.dataset.uploadDetailSuggestion
            );
            return;
        }

        if (selectedButton) {
            this.removeDetailTag(
                selectedButton.dataset.uploadDetailSelectedGroup,
                selectedButton.dataset.uploadDetailSelected
            );
            return;
        }

        if (addButton) {
            this.addDetailTagsFromInput(addButton.dataset.uploadDetailAdd);
        }
    }

    handleDetailGroupKeydown(event) {
        const input = event.target.closest('[data-upload-detail-input]');

        if (!input || (event.key !== 'Enter' && event.key !== ',' && event.key !== ';')) {
            return;
        }

        event.preventDefault();
        this.addDetailTagsFromInput(input.dataset.uploadDetailInput);
    }

    addDetailTagsFromInput(groupKey) {
        const input = this.getDetailInput(groupKey);
        if (!input) {
            return;
        }

        const tags = this.parseTags(input.value);
        if (tags.length === 0) {
            return;
        }

        tags.forEach((tag) => this.addDetailTag(groupKey, tag));
        input.value = '';
        this.renderDetailTagGroups();
    }

    addDetailTag(groupKey, tag) {
        if (!this.selectedTagGroups[groupKey]) {
            return;
        }

        const cleanTag = String(tag || '').trim().replace(/^#/, '');
        if (!cleanTag) {
            return;
        }

        const hasTag = this.selectedTagGroups[groupKey].some((selectedTag) => selectedTag.toLowerCase() === cleanTag.toLowerCase());
        if (!hasTag) {
            this.selectedTagGroups[groupKey].push(cleanTag);
        }
    }

    removeDetailTag(groupKey, tag) {
        if (!this.selectedTagGroups[groupKey]) {
            return;
        }

        this.selectedTagGroups[groupKey] = this.selectedTagGroups[groupKey]
            .filter((selectedTag) => selectedTag.toLowerCase() !== String(tag || '').toLowerCase());
        this.renderDetailTagGroups();
    }

    toggleSuggestedDetailTag(groupKey, tag) {
        if (!this.selectedTagGroups[groupKey]) {
            return;
        }

        const isSelected = this.selectedTagGroups[groupKey]
            .some((selectedTag) => selectedTag.toLowerCase() === String(tag || '').toLowerCase());

        if (isSelected) {
            this.removeDetailTag(groupKey, tag);
            return;
        }

        this.addDetailTag(groupKey, tag);
        this.renderDetailTagGroups();
    }

    getSelectedDetailTags(groupKey) {
        const input = this.getDetailInput(groupKey);
        return this.dedupeTags([
            ...(this.selectedTagGroups[groupKey] || []),
            ...this.parseTags(input?.value || '')
        ]);
    }

    getDetailInput(groupKey) {
        return this.elements.detailGroups?.querySelector(`[data-upload-detail-input="${groupKey}"]`) || null;
    }

    renderDetailTagGroups() {
        if (!this.elements.detailGroups) {
            return;
        }

        const draftValues = this.getDetailInputValues();
        this.elements.detailGroups.innerHTML = '';

        this.tagGroupConfigs.forEach((config) => {
            const group = document.createElement('section');
            group.className = 'upload-detail-tag-group';
            group.dataset.uploadDetailGroup = config.key;

            const header = document.createElement('div');
            header.className = 'upload-detail-tag-header';

            const title = document.createElement('h3');
            title.textContent = config.label;
            header.appendChild(title);

            const helper = document.createElement('p');
            helper.textContent = 'Choose existing tags or add custom tags for this section.';
            header.appendChild(helper);
            group.appendChild(header);

            const controls = document.createElement('div');
            controls.className = 'upload-tag-controls';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'upload-detail-tag-input';
            input.placeholder = `Add custom ${config.label.toLowerCase()} tag`;
            input.value = draftValues[config.key] || '';
            input.dataset.uploadDetailInput = config.key;
            input.setAttribute('aria-label', `Add custom ${config.label} tag`);
            controls.appendChild(input);

            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.className = 'upload-tag-add';
            addButton.dataset.uploadDetailAdd = config.key;
            addButton.textContent = 'Add';
            controls.appendChild(addButton);
            group.appendChild(controls);

            const selectedContainer = document.createElement('div');
            selectedContainer.className = 'upload-selected-tags';
            selectedContainer.setAttribute('aria-live', 'polite');
            this.renderDetailSelectedTags(selectedContainer, config);
            group.appendChild(selectedContainer);

            const suggestionsContainer = document.createElement('div');
            suggestionsContainer.className = 'upload-tag-suggestions';
            suggestionsContainer.setAttribute('role', 'group');
            suggestionsContainer.setAttribute('aria-label', `${config.label} suggestions`);
            this.renderDetailSuggestedTags(suggestionsContainer, config);
            group.appendChild(suggestionsContainer);

            this.elements.detailGroups.appendChild(group);
        });
    }

    getDetailInputValues() {
        const values = this.createEmptyTagGroups();

        this.elements.detailGroups?.querySelectorAll('[data-upload-detail-input]').forEach((input) => {
            values[input.dataset.uploadDetailInput] = input.value || '';
        });

        return values;
    }

    renderDetailSelectedTags(container, config) {
        const selectedTags = this.selectedTagGroups[config.key] || [];

        if (selectedTags.length === 0) {
            const emptyState = document.createElement('span');
            emptyState.className = 'upload-selected-empty';
            emptyState.textContent = 'No tags selected.';
            container.appendChild(emptyState);
            return;
        }

        selectedTags.forEach((tag) => {
            const tagButton = document.createElement('button');
            tagButton.type = 'button';
            tagButton.className = 'upload-selected-tag';
            tagButton.dataset.uploadDetailSelectedGroup = config.key;
            tagButton.dataset.uploadDetailSelected = tag;
            tagButton.setAttribute('aria-label', `Remove ${config.label} tag ${tag}`);

            const tagLabel = document.createElement('span');
            tagLabel.textContent = this.formatTagLabel(tag);

            const removeIcon = document.createElement('span');
            removeIcon.className = 'upload-tag-remove';
            removeIcon.setAttribute('aria-hidden', 'true');
            removeIcon.textContent = 'x';

            tagButton.appendChild(tagLabel);
            tagButton.appendChild(removeIcon);
            container.appendChild(tagButton);
        });
    }

    renderDetailSuggestedTags(container, config) {
        const availableTags = this.availableTagGroups[config.key] || [];

        if (availableTags.length === 0) {
            const emptyState = document.createElement('span');
            emptyState.className = 'upload-selected-empty';
            emptyState.textContent = 'No suggestions yet. Add custom tags above.';
            container.appendChild(emptyState);
            return;
        }

        availableTags.forEach((tag) => {
            const tagButton = document.createElement('button');
            tagButton.type = 'button';
            tagButton.className = 'upload-suggestion-tag';
            tagButton.dataset.uploadDetailSuggestionGroup = config.key;
            tagButton.dataset.uploadDetailSuggestion = tag;
            tagButton.setAttribute('aria-pressed', String(
                (this.selectedTagGroups[config.key] || []).some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase())
            ));
            tagButton.textContent = this.formatTagLabel(tag);
            container.appendChild(tagButton);
        });
    }

    formatTagLabel(tag) {
        return tag
            .replace(/^#/, '')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_/]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async uploadImageFile(file, token) {
        const extension = this.getFileExtension(file);
        const filename = `${Date.now()}-${this.slugify(file.name.replace(/\.[^.]+$/, ''))}.${extension}`;
        const path = `${this.imageDirectory}/${filename}`;
        const content = await this.fileToBase64(file);

        await this.putGitHubFile({
            token,
            path,
            content,
            message: `Upload article image: ${file.name}`
        });

        return path;
    }

    async savePaperRecord(paper, token) {
        const existingFile = await this.getGitHubFile(this.dataPath, token);
        const data = existingFile?.json || { papers: [] };
        const papers = Array.isArray(data.papers) ? data.papers : [];

        const duplicate = papers.some((entry) => {
            const sameUrl = paper.url && entry.url === paper.url;
            const sameTitleYear = entry.title === paper.title && String(entry.year) === String(paper.year);
            return sameUrl || sameTitleYear;
        });

        if (duplicate) {
            throw new Error('This article already exists in uploaded records.');
        }

        const nextData = {
            papers: [paper, ...papers]
        };

        await this.putGitHubFile({
            token,
            path: this.dataPath,
            content: this.textToBase64(JSON.stringify(nextData, null, 2) + '\n'),
            message: `Add article: ${paper.title}`,
            sha: existingFile?.sha
        });

        return paper;
    }

    async deletePaperRecord(paper, token) {
        if (!this.isUploadedPaper(paper)) {
            throw new Error('Only uploaded articles can be deleted here.');
        }

        const existingFile = await this.getGitHubFile(this.dataPath, token);
        if (!existingFile) {
            throw new Error('Uploaded records file was not found.');
        }

        const data = existingFile.json || { papers: [] };
        const papers = Array.isArray(data.papers) ? data.papers : [];
        const paperIndex = papers.findIndex((entry) => this.isSamePaperRecord(entry, paper));

        if (paperIndex === -1) {
            throw new Error('This uploaded article was not found in the saved records.');
        }

        const [deletedPaper] = papers.splice(paperIndex, 1);
        const nextData = {
            papers
        };

        await this.putGitHubFile({
            token,
            path: this.dataPath,
            content: this.textToBase64(JSON.stringify(nextData, null, 2) + '\n'),
            message: `Delete article: ${deletedPaper.title || paper.title}`,
            sha: existingFile.sha
        });

        return deletedPaper;
    }

    isUploadedPaper(paper) {
        return Boolean(paper && (paper.source === 'upload' || String(paper.id || '').startsWith('upload-')));
    }

    isSamePaperRecord(entry, paper) {
        const entryId = String(entry?.id || '');
        const paperId = String(paper?.id || '');

        if (entryId && paperId && entryId === paperId) {
            return true;
        }

        return this.getPaperRecordKey(entry) === this.getPaperRecordKey(paper);
    }

    getPaperRecordKey(paper) {
        return [
            paper?.url || paper?.doi || '',
            paper?.title || '',
            paper?.year || '',
            paper?.image || ''
        ].map((value) => String(value).trim()).join('::');
    }

    getStoredToken() {
        return localStorage.getItem(this.tokenStorageKey) || '';
    }

    async getGitHubFile(path, token) {
        const response = await fetch(this.githubContentsUrl(path, true), {
            headers: this.githubHeaders(token)
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(await this.githubErrorMessage(response, `Failed to read ${path}.`));
        }

        const payload = await response.json();
        const text = this.base64ToText(payload.content || '');
        let json = null;

        try {
            json = JSON.parse(text);
        } catch (error) {
            throw new Error(`${path} is not valid JSON.`);
        }

        return {
            sha: payload.sha,
            json
        };
    }

    async putGitHubFile({ token, path, content, message, sha }) {
        const body = {
            message,
            content,
            branch: this.branch
        };

        if (sha) {
            body.sha = sha;
        }

        const response = await fetch(this.githubContentsUrl(path), {
            method: 'PUT',
            headers: this.githubHeaders(token),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(await this.githubErrorMessage(response, `Failed to write ${path}.`));
        }

        return response.json();
    }

    githubContentsUrl(path, includeRef = false) {
        const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
        const baseUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${encodedPath}`;
        return includeRef ? `${baseUrl}?ref=${this.branch}` : baseUrl;
    }

    githubHeaders(token) {
        return {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        };
    }

    async githubErrorMessage(response, fallback) {
        try {
            const payload = await response.json();
            return payload.message ? `${fallback} GitHub: ${payload.message}` : fallback;
        } catch (error) {
            return fallback;
        }
    }

    getFileExtension(file) {
        const fromName = file.name.split('.').pop()?.toLowerCase();
        if (fromName && /^[a-z0-9]+$/.test(fromName)) {
            return fromName;
        }

        const mimeMap = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/avif': 'avif'
        };

        return mimeMap[file.type] || 'png';
    }

    slugify(value) {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 70) || 'article-image';
    }

    async fileToBase64(file) {
        const buffer = await file.arrayBuffer();
        return this.arrayBufferToBase64(buffer);
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }

        return btoa(binary);
    }

    textToBase64(text) {
        return this.arrayBufferToBase64(new TextEncoder().encode(text).buffer);
    }

    base64ToText(value) {
        const compact = value.replace(/\s/g, '');
        const binary = atob(compact);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }

        return new TextDecoder().decode(bytes);
    }

    resetArticleFields() {
        this.cancelMetadataLookup();
        this.lastMetadataLookupKey = '';
        this.elements.title.value = '';
        this.elements.url.value = '';
        this.elements.doi.value = '';
        this.elements.authors.value = '';
        this.elements.journal.value = '';
        this.elements.imageFile.value = '';
        this.elements.imageUrl.value = '';
        this.elements.tags.value = '';
        this.selectedTags = [];
        this.selectedTagGroups = this.createEmptyTagGroups();
        this.renderSelectedTags();
        this.renderDetailTagGroups();
        this.updateSuggestionSelectionStates();
        this.updateSelectedImageName();
        this.clearFieldValidity();
    }

    setBusy(isBusy) {
        this.isUploading = isBusy;

        if (isBusy) {
            this.cancelMetadataLookup();
        }

        this.elements.submitButton.disabled = isBusy;
        this.elements.submitButton.textContent = isBusy ? 'Uploading...' : 'Upload';
        this.elements.form.setAttribute('aria-busy', String(isBusy));
    }

    setStatus(message, type = '') {
        this.elements.status.textContent = message;
        this.elements.status.classList.toggle('is-success', type === 'success');
        this.elements.status.classList.toggle('is-error', type === 'error');
    }

    clearStatus() {
        this.setStatus('');
    }

    setFieldError(element, message) {
        this.setStatus(message, 'error');

        if (element) {
            element.setAttribute('aria-invalid', 'true');
            element.focus();
        }
    }

    clearFieldValidity() {
        [
            this.elements.title,
            this.elements.url,
            this.elements.doi,
            this.elements.year,
            this.elements.category,
            this.elements.imageChoose,
            this.elements.imageUrl,
            this.elements.token,
            ...(this.elements.detailGroups ? Array.from(this.elements.detailGroups.querySelectorAll('[data-upload-detail-input]')) : [])
        ].forEach((element) => {
            if (element) {
                element.removeAttribute('aria-invalid');
            }
        });
    }

    updateSelectedImageName() {
        if (!this.elements.imageName) {
            return;
        }

        const file = this.elements.imageFile.files?.[0];
        this.elements.imageName.textContent = file ? file.name : 'No image selected';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.articleUploader = new ArticleUploader();
});
