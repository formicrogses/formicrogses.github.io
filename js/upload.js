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
            year: document.getElementById('uploadYearInput'),
            category: document.getElementById('uploadCategoryInput'),
            imageFile: document.getElementById('uploadImageInput'),
            imageChoose: document.getElementById('uploadImageChoose'),
            imageName: document.getElementById('uploadImageName'),
            imageUrl: document.getElementById('uploadImageUrlInput'),
            tags: document.getElementById('uploadTagsInput'),
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
        this.elements.modal.addEventListener('click', (event) => {
            if (event.target === this.elements.modal) {
                this.close();
            }
        });
        document.addEventListener('keydown', this.handleDocumentKeydown);

        this.populateTagSuggestionsWhenReady();
    }

    async populateTagSuggestionsWhenReady() {
        if (window.app?.ready) {
            await window.app.ready;
        }

        const allTags = new Set();
        const tagFields = [
            'hardwareDevices',
            'sensingTechnology',
            'recognitionClassification',
            'interactionModalities',
            'gestureTypes',
            'applicationScenarios',
            'feedbackOutput',
            'userExperienceDesign',
            'tags'
        ];

        (window.app?.allPapers || []).forEach((paper) => {
            tagFields.forEach((field) => {
                (paper[field] || []).forEach((tag) => allTags.add(tag));
            });
        });

        if (this.elements.suggestions) {
            this.elements.suggestions.innerHTML = '';
            Array.from(allTags).sort((a, b) => a.localeCompare(b)).forEach((tag) => {
                const option = document.createElement('option');
                option.value = tag;
                this.elements.suggestions.appendChild(option);
            });
        }
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

        if (!this.elements.year.value) {
            this.elements.year.value = String(new Date().getFullYear());
        }

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
        const tags = this.parseTags(this.elements.tags.value);

        return {
            id: `upload-${Date.now()}`,
            title,
            year,
            category: this.elements.category.value,
            hardwareDevices: [],
            sensingTechnology: [],
            recognitionClassification: [],
            interactionModalities: [],
            gestureTypes: [],
            applicationScenarios: [],
            feedbackOutput: [],
            userExperienceDesign: [],
            tags,
            image: imagePath,
            url,
            doi: '',
            authors: '',
            journal: '',
            uploadedAt: new Date().toISOString(),
            source: 'upload'
        };
    }

    validateForm({ token, imageFile, imageUrl }) {
        const title = this.elements.title.value.trim();
        const url = this.elements.url.value.trim();
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

    isValidUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    parseTags(value) {
        return value
            .split(/[,，;；\n]+/)
            .map((tag) => tag.trim().replace(/^#/, ''))
            .filter(Boolean)
            .filter((tag, index, list) => list.indexOf(tag) === index);
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
        this.elements.title.value = '';
        this.elements.url.value = '';
        this.elements.imageFile.value = '';
        this.elements.imageUrl.value = '';
        this.elements.tags.value = '';
        this.updateSelectedImageName();
        this.clearFieldValidity();
    }

    setBusy(isBusy) {
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
            this.elements.year,
            this.elements.category,
            this.elements.imageChoose,
            this.elements.imageUrl,
            this.elements.token
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
