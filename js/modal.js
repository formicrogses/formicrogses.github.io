// Paper Modal Class
class PaperModal {
    constructor(paper) {
        this.paper = paper;
        this.modal = document.getElementById('modal');
    }

    show() {
        if (!this.modal) return;
        
        // Set basic information
        document.getElementById('modalImage').src = this.paper.image || 'images/placeholder.png';
        document.getElementById('modalImage').onerror = function() {
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
        
        // Show all tag groups
        this.showTags('hardware', this.paper.hardwareDevices, 'tag-hardware');
        this.showTags('sensing', this.paper.sensingTechnology, 'tag-sensing');
        this.showTags('recognition', this.paper.recognitionClassification, 'tag');
        this.showTags('interaction', this.paper.interactionModalities, 'tag-interaction');
        this.showTags('gesture', this.paper.gestureTypes, 'tag-gesture');
        this.showTags('application', this.paper.applicationScenarios, 'tag-application');
        this.showTags('feedback', this.paper.feedbackOutput, 'tag-feedback');
        this.showTags('ux', this.paper.userExperienceDesign, 'tag-ux');
        
        // Removed action buttons (share and copy citation)
        
        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Setup close handlers
        this.setupCloseHandlers();
    }

    hide() {
        this.modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }

    setupCloseHandlers() {
        const closeBtn = document.getElementById('modalClose');
        if (closeBtn) {
            closeBtn.onclick = () => this.hide();
        }
        
        this.modal.onclick = (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        };
        
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }



    showTags(type, tags, tagClass = 'tag') {
        const section = document.getElementById(type + 'Section');
        const container = document.getElementById(type + 'Tags');
        
        if (tags && tags.length > 0) {
            section.style.display = 'block';
            container.innerHTML = tags.map(tag => 
                `<span class="${tagClass}">${this.formatTag(tag)}</span>`
            ).join('');
        } else {
            section.style.display = 'none';
        }
    }

    formatCategory(category) {
        const map = {
            'hardware': 'Hardware',
            'software': 'Software',
            'gesture-design': 'Gesture Design'
        };
        return map[category] || category;
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
}
