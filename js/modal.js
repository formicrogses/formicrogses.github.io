// Paper Modal Class
class PaperModal {
    constructor(paper) {
        this.paper = paper;
        this.modal = document.getElementById('modal');
        this.relatedPanel = document.getElementById('relatedPapersPanel');
        this.relatedTitle = document.getElementById('relatedPapersTitle');
        this.relatedDescription = document.getElementById('relatedPapersDescription');
        this.relatedTag = document.getElementById('relatedPapersTag');
        this.relatedBody = document.getElementById('relatedPapersBody');
        this.relatedCloseBtn = document.getElementById('relatedPapersClose');
        this.activeRelatedTagButton = null;
        this.escHandler = null;
        this.relatedHideTimer = null;
    }

    show() {
        if (!this.modal) return;

        // Set basic information
        const modalImage = document.getElementById('modalImage');
        modalImage.src = this.paper.image || 'images/placeholder.png';
        modalImage.alt = this.paper.title || 'Paper preview';
        modalImage.onerror = function() {
            this.src = 'images/placeholder.png';
        };

        document.getElementById('modalTitle').textContent = this.paper.title;
        document.getElementById('modalYear').textContent = this.paper.year;
        document.getElementById('modalCategory').textContent = this.formatCategory(this.paper.category);

        // Show DOI if available
        const doiDiv = document.getElementById('modalDoi');
        if (this.paper.doi && this.paper.doi.trim()) {
            doiDiv.style.display = 'block';
            const doiLink = doiDiv.querySelector('a');
            doiLink.href = this.paper.doi;
            doiLink.textContent = this.paper.doi;
        } else {
            doiDiv.style.display = 'none';
        }

        // Show authors if available
        const authorsContainer = document.getElementById('modalAuthorsContainer');
        if (this.paper.authors && this.paper.authors.trim()) {
            authorsContainer.style.display = 'block';
            document.getElementById('modalAuthors').textContent = this.paper.authors;
        } else {
            authorsContainer.style.display = 'none';
        }

        // Show journal/conference if available
        const journalContainer = document.getElementById('modalJournalContainer');
        if (this.paper.journal && this.paper.journal.trim()) {
            journalContainer.style.display = 'block';
            document.getElementById('modalJournal').textContent = this.paper.journal;
        } else {
            journalContainer.style.display = 'none';
        }

        this.resetRelatedPapers();

        // Show all tag groups
        this.showTags('hardware', this.paper.hardwareDevices, 'hardwareDevices', 'tag-hardware');
        this.showTags('sensing', this.paper.sensingTechnology, 'sensingTechnology', 'tag-sensing');
        this.showTags('recognition', this.paper.recognitionClassification, 'recognitionClassification', 'tag');
        this.showTags('interaction', this.paper.interactionModalities, 'interactionModalities', 'tag-interaction');
        this.showTags('gesture', this.paper.gestureTypes, 'gestureTypes', 'tag-gesture');
        this.showTags('application', this.paper.applicationScenarios, 'applicationScenarios', 'tag-application');
        this.showTags('feedback', this.paper.feedbackOutput, 'feedbackOutput', 'tag-feedback');
        this.showTags('ux', this.paper.userExperienceDesign, 'userExperienceDesign', 'tag-ux');

        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        this.modal.scrollTop = 0;

        // Setup close handlers
        this.setupCloseHandlers();
    }

    hide() {
        if (!this.modal) return;

        this.modal.classList.remove('show');
        document.body.style.overflow = 'auto';
        this.resetRelatedPapers();

        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }
    }

    setupCloseHandlers() {
        const closeBtn = document.getElementById('modalClose');
        if (closeBtn) {
            closeBtn.onclick = () => this.hide();
        }

        const doneBtn = document.getElementById('modalDone');
        if (doneBtn) {
            doneBtn.onclick = () => this.hide();
        }

        if (this.relatedCloseBtn) {
            this.relatedCloseBtn.onclick = () => this.resetRelatedPapers();
        }

        this.modal.onclick = (e) => {
            if (e.target === this.modal) {
                if (this.isRelatedPanelOpen()) {
                    this.resetRelatedPapers();
                } else {
                    this.hide();
                }
            }
        };

        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }

        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                if (this.isRelatedPanelOpen()) {
                    this.resetRelatedPapers();
                } else {
                    this.hide();
                }
            }
        };

        document.addEventListener('keydown', this.escHandler);
    }

    showTags(type, tags, categoryKey, tagClass = 'tag') {
        const section = document.getElementById(type + 'Section');
        const container = document.getElementById(type + 'Tags');

        if (!section || !container) return;

        if (tags && tags.length > 0) {
            section.style.display = 'block';
            container.innerHTML = '';

            tags.forEach(tag => {
                const tagButton = document.createElement('button');
                tagButton.type = 'button';
                tagButton.className = `related-tag-button ${tagClass}`;
                tagButton.textContent = this.formatTag(tag);
                tagButton.dataset.tag = tag;
                tagButton.dataset.categoryKey = categoryKey;
                tagButton.addEventListener('click', () => this.toggleRelatedPapers(categoryKey, tag, tagButton));
                container.appendChild(tagButton);
            });
        } else {
            section.style.display = 'none';
            container.innerHTML = '';
        }
    }

    toggleRelatedPapers(categoryKey, tag, triggerButton) {
        if (this.activeRelatedTagButton === triggerButton && this.isRelatedPanelOpen()) {
            this.resetRelatedPapers();
            return;
        }

        this.showRelatedPapers(categoryKey, tag, triggerButton);
    }

    showRelatedPapers(categoryKey, tag, triggerButton) {
        if (!this.relatedPanel || !this.relatedBody || !this.relatedTitle || !this.relatedDescription) {
            return;
        }

        if (this.activeRelatedTagButton) {
            this.activeRelatedTagButton.classList.remove('is-active');
        }

        this.activeRelatedTagButton = triggerButton;
        this.activeRelatedTagButton.classList.add('is-active');

        const relatedPapers = this.getRelatedPapers(categoryKey, tag);
        this.relatedTitle.textContent = `Other Papers Tagged "${this.formatTag(tag)}"`;
        this.relatedDescription.textContent = `${relatedPapers.length} related paper${relatedPapers.length === 1 ? '' : 's'} in ${this.formatSectionLabel(categoryKey)}. Click a row to open that paper.`;
        if (this.relatedTag) {
            this.relatedTag.textContent = this.formatTag(tag);
        }
        this.renderRelatedPapers(relatedPapers);
        this.openRelatedSheet();
    }

    renderRelatedPapers(relatedPapers) {
        this.relatedBody.innerHTML = '';

        if (relatedPapers.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'related-paper-empty';
            emptyState.textContent = 'No other papers share this tag yet.';
            this.relatedBody.appendChild(emptyState);
            return;
        }

        const tableWrap = document.createElement('div');
        tableWrap.className = 'related-papers-table-wrap';

        const table = document.createElement('table');
        table.className = 'related-papers-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        [
            { label: 'Preview', className: 'related-paper-preview-col' },
            { label: 'Paper' },
            { label: 'Year', className: 'related-paper-year-col' }
        ].forEach(({ label, className }) => {
            const th = document.createElement('th');
            th.textContent = label;
            if (className) {
                th.className = className;
            }
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        const tbody = document.createElement('tbody');
        relatedPapers.forEach(paper => {
            const row = document.createElement('tr');

            const previewCell = document.createElement('td');
            previewCell.className = 'related-paper-preview-col';

            const thumbnail = document.createElement('img');
            thumbnail.className = 'related-paper-thumb';
            thumbnail.src = paper.image || 'images/placeholder.png';
            thumbnail.alt = `${paper.title} preview`;
            thumbnail.loading = 'lazy';
            thumbnail.onerror = function() {
                this.src = 'images/placeholder.png';
            };
            previewCell.appendChild(thumbnail);

            const paperCell = document.createElement('td');
            const paperButton = document.createElement('button');
            paperButton.type = 'button';
            paperButton.className = 'related-paper-link';

            const copy = document.createElement('div');
            copy.className = 'related-paper-copy';

            const title = document.createElement('strong');
            title.textContent = paper.title;
            copy.appendChild(title);

            const detail = document.createElement('span');
            detail.textContent = this.buildPaperDescription(paper);
            copy.appendChild(detail);

            const metaRow = document.createElement('div');
            metaRow.className = 'related-paper-meta-row';

            const categoryBadge = document.createElement('span');
            categoryBadge.className = 'related-paper-category-badge';
            categoryBadge.textContent = this.formatCategory(paper.category);
            metaRow.appendChild(categoryBadge);

            copy.appendChild(metaRow);
            paperButton.appendChild(copy);

            paperButton.addEventListener('click', () => this.openRelatedPaper(paper));
            paperCell.appendChild(paperButton);

            const yearCell = document.createElement('td');
            yearCell.className = 'related-paper-year related-paper-year-col';
            yearCell.textContent = paper.year || '-';

            row.appendChild(previewCell);
            row.appendChild(paperCell);
            row.appendChild(yearCell);
            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        tableWrap.appendChild(table);
        this.relatedBody.appendChild(tableWrap);
    }

    buildPaperDescription(paper) {
        const details = [];

        if (paper.authors && paper.authors.trim()) {
            details.push(paper.authors.trim());
        }

        if (paper.journal && paper.journal.trim()) {
            details.push(paper.journal.trim());
        }

        return details.join(' · ') || 'Open this paper';
    }

    getRelatedPapers(categoryKey, tag) {
        return this.getAllPapers()
            .filter(candidate => {
                const candidateTags = candidate[categoryKey] || [];
                return candidateTags.includes(tag) && this.getPaperIdentity(candidate) !== this.getPaperIdentity(this.paper);
            })
            .sort((a, b) => {
                const yearDiff = parseInt(b.year, 10) - parseInt(a.year, 10);
                if (yearDiff !== 0) {
                    return yearDiff;
                }

                return a.title.localeCompare(b.title);
            });
    }

    getAllPapers() {
        if (typeof PAPERS_DATA !== 'undefined' && Array.isArray(PAPERS_DATA.papers)) {
            return PAPERS_DATA.papers.filter(paper => paper.image);
        }

        return [];
    }

    getPaperIdentity(paper) {
        return [paper.title, paper.year, paper.image].join('::');
    }

    openRelatedPaper(paper) {
        this.resetRelatedPapers();
        this.paper = paper;
        this.show();
    }

    resetRelatedPapers() {
        if (this.activeRelatedTagButton) {
            this.activeRelatedTagButton.classList.remove('is-active');
            this.activeRelatedTagButton = null;
        }

        if (this.relatedPanel) {
            this.closeRelatedSheet();
        }

        if (this.relatedBody) {
            this.relatedBody.innerHTML = '';
        }

        if (this.relatedDescription) {
            this.relatedDescription.textContent = '';
        }

        if (this.relatedTitle) {
            this.relatedTitle.textContent = 'Related Papers';
        }

        if (this.relatedTag) {
            this.relatedTag.textContent = 'Tag';
        }
    }

    isRelatedPanelOpen() {
        return Boolean(this.relatedPanel && !this.relatedPanel.hidden && this.relatedPanel.classList.contains('is-open'));
    }

    openRelatedSheet() {
        if (!this.relatedPanel) {
            return;
        }

        if (this.relatedHideTimer) {
            clearTimeout(this.relatedHideTimer);
            this.relatedHideTimer = null;
        }

        this.relatedPanel.hidden = false;
        this.relatedPanel.setAttribute('aria-hidden', 'false');

        requestAnimationFrame(() => {
            this.relatedPanel.classList.add('is-open');
        });
    }

    closeRelatedSheet() {
        if (!this.relatedPanel) {
            return;
        }

        if (this.relatedHideTimer) {
            clearTimeout(this.relatedHideTimer);
        }

        this.relatedPanel.classList.remove('is-open');
        this.relatedPanel.setAttribute('aria-hidden', 'true');

        this.relatedHideTimer = setTimeout(() => {
            this.relatedPanel.hidden = true;
            this.relatedHideTimer = null;
        }, 220);
    }

    formatSectionLabel(categoryKey) {
        const labels = {
            hardwareDevices: 'Hardware Devices',
            sensingTechnology: 'Sensing Technology',
            recognitionClassification: 'Recognition & Classification',
            interactionModalities: 'Interaction Modalities',
            gestureTypes: 'Gesture Types',
            applicationScenarios: 'Application Scenarios',
            feedbackOutput: 'Feedback & Output',
            userExperienceDesign: 'User Experience & Design'
        };

        return labels[categoryKey] || categoryKey;
    }

    formatCategory(category) {
        const map = {
            hardware: 'Hardware',
            software: 'Software',
            GestureDesign: 'Gesture Design',
            'gesture-design': 'Gesture Design'
        };
        return map[category] || category;
    }

    formatTag(tag) {
        // Direct mappings for specific tags
        const tagMap = {
            GestureDesign: 'Gesture Design',
            SmartPhone: 'Smart Phone',
            ARGlasses: 'AR Glasses',
            VRHeadset: 'VR Headset',
            Etextile: 'E-Textile',
            'E-Textile': 'E-Textile',
            'Bio-Sensor': 'Bio-Sensor',
            EMG: 'EMG',
            IMU: 'IMU',
            RFSensing: 'RF Sensing',
            '3DPoseEstimation': '3D Pose Estimation',
            BackofDevices: 'Back of Devices',
            'Thumb-Index': 'Thumb-Index',
            AR: 'AR',
            VR: 'VR',
            MR: 'MR',
            IoT: 'IoT',
            IOT: 'IoT',
            '\u952e\u76d8': 'Keyboard',
            '\u6309\u4f4f': 'Hold',
            '\u634f\u5408': 'Pinch',
            '\u6ed1\u52a8': 'Swipe',
            '\u5bfc\u822a': 'Navigation',
            '\u8bad\u7ec3\u4e2d': 'Training',
            QWERTYLayout: 'QWERTY Layout',
            OtherDevices: 'Other Devices',
            OtherTechnology: 'Other Technology',
            OtherScenarios: 'Other Scenarios'
        };

        if (tagMap[tag]) {
            return tagMap[tag];
        }

        tag = tag.replace(/^#/, '');
        tag = tag.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
        tag = tag.replace(/[_/]+/g, ' ');
        return tag.replace(/\s+/g, ' ').trim().replace(/\b\w/g, letter => letter.toUpperCase());
    }
}
