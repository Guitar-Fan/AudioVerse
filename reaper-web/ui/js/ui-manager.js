/*
 * REAPER Web - UI Manager
 * Manages overall UI state and interactions
 */

class UIManager {
    constructor(app) {
        this.app = app;
        this.contextMenus = new Map();
        this.dragState = null;
        this.resizeState = null;
    }
    
    initialize() {
        console.log('Initializing UI Manager...');
        
        // Initialize menu bar
        this.initializeMenuBar();
        
        // Initialize context menus
        this.initializeContextMenus();
        
        // Set up global UI event listeners
        this.setupGlobalEventListeners();
        
        // Initialize drag and drop
        this.initializeDragAndDrop();
        
        // Initialize panel resizing
        this.initializePanelResizing();
        
        console.log('UI Manager initialized');
    }
    
    initializeMenuBar() {
        const menuItems = document.querySelectorAll('.menu-item');
        
        menuItems.forEach(menuItem => {
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenuDropdown(menuItem);
            });
            
            menuItem.addEventListener('mouseenter', () => {
                // Close other open menus and open this one if any menu is open
                const openMenu = document.querySelector('.menu-item.active');
                if (openMenu && openMenu !== menuItem) {
                    this.closeAllMenus();
                    this.showMenuDropdown(menuItem);
                }
            });
        });
        
        // Close menus when clicking outside
        document.addEventListener('click', () => {
            this.closeAllMenus();
        });
        
        console.log('Menu bar initialized');
    }
    
    toggleMenuDropdown(menuItem) {
        const isActive = menuItem.classList.contains('active');
        this.closeAllMenus();
        
        if (!isActive) {
            this.showMenuDropdown(menuItem);
        }
    }
    
    showMenuDropdown(menuItem) {
        menuItem.classList.add('active');
        
        // Create dropdown menu
        const dropdown = this.createMenuDropdown(menuItem.textContent);
        menuItem.appendChild(dropdown);
        
        // Position dropdown
        const rect = menuItem.getBoundingClientRect();
        dropdown.style.top = `${rect.height}px`;
        dropdown.style.left = '0px';
    }
    
    closeAllMenus() {
        const activeMenus = document.querySelectorAll('.menu-item.active');
        activeMenus.forEach(menu => {
            menu.classList.remove('active');
            const dropdown = menu.querySelector('.menu-dropdown');
            if (dropdown) {
                dropdown.remove();
            }
        });
    }
    
    createMenuDropdown(menuName) {
        const dropdown = document.createElement('div');
        dropdown.className = 'menu-dropdown';
        
        const menuItems = this.getMenuItems(menuName);
        
        menuItems.forEach(item => {
            const menuItemEl = document.createElement('div');
            menuItemEl.className = 'menu-dropdown-item';
            menuItemEl.textContent = item.text;
            
            if (item.shortcut) {
                const shortcut = document.createElement('span');
                shortcut.className = 'menu-shortcut';
                shortcut.textContent = item.shortcut;
                menuItemEl.appendChild(shortcut);
            }
            
            if (item.separator) {
                menuItemEl.classList.add('separator');
            }
            
            if (item.action) {
                menuItemEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.action();
                    this.closeAllMenus();
                });
            }
            
            dropdown.appendChild(menuItemEl);
        });
        
        return dropdown;
    }
    
    getMenuItems(menuName) {
        const menus = {
            'File': [
                { text: 'New Project', shortcut: 'Ctrl+N', action: () => this.app.newProject() },
                { text: 'Open Project...', shortcut: 'Ctrl+O', action: () => this.app.openProject() },
                { text: 'Save Project', shortcut: 'Ctrl+S', action: () => this.app.saveProject() },
                { text: 'Save Project As...', shortcut: 'Ctrl+Shift+S', action: () => this.app.saveProjectAs() },
                { text: '', separator: true },
                { text: 'Import Audio...', action: () => this.app.importAudio() },
                { text: 'Export Audio...', shortcut: 'Ctrl+E', action: () => this.app.exportAudio() },
                { text: '', separator: true },
                { text: 'Recent Projects', action: () => this.app.showRecentProjects() }
            ],
            'Edit': [
                { text: 'Undo', shortcut: 'Ctrl+Z', action: () => this.app.undo() },
                { text: 'Redo', shortcut: 'Ctrl+Y', action: () => this.app.redo() },
                { text: '', separator: true },
                { text: 'Cut', shortcut: 'Ctrl+X', action: () => this.app.cut() },
                { text: 'Copy', shortcut: 'Ctrl+C', action: () => this.app.copy() },
                { text: 'Paste', shortcut: 'Ctrl+V', action: () => this.app.paste() },
                { text: '', separator: true },
                { text: 'Select All', shortcut: 'Ctrl+A', action: () => this.app.selectAll() },
                { text: 'Select None', shortcut: 'Ctrl+D', action: () => this.app.selectNone() }
            ],
            'View': [
                { text: 'Track Manager', action: () => this.app.toggleTrackManager() },
                { text: 'Mixer', shortcut: 'Ctrl+M', action: () => this.app.toggleMixer() },
                { text: 'Navigator', action: () => this.app.toggleNavigator() },
                { text: '', separator: true },
                { text: 'Zoom In', shortcut: 'Ctrl++', action: () => this.app.zoomIn() },
                { text: 'Zoom Out', shortcut: 'Ctrl+-', action: () => this.app.zoomOut() },
                { text: 'Zoom to Fit', shortcut: 'Ctrl+0', action: () => this.app.zoomToFit() },
                { text: '', separator: true },
                { text: 'Grid', shortcut: 'G', action: () => this.app.toggleGrid() }
            ],
            'Insert': [
                { text: 'New Track', shortcut: 'Ctrl+T', action: () => this.app.addTrack() },
                { text: 'New Folder Track', action: () => this.app.addFolderTrack() },
                { text: '', separator: true },
                { text: 'Audio Item', action: () => this.app.insertAudioItem() },
                { text: 'MIDI Item', action: () => this.app.insertMIDIItem() },
                { text: '', separator: true },
                { text: 'Marker', shortcut: 'M', action: () => this.app.insertMarker() },
                { text: 'Region', shortcut: 'R', action: () => this.app.insertRegion() }
            ],
            'Track': [
                { text: 'Record Arm', shortcut: 'Ctrl+R', action: () => this.app.toggleRecordArm() },
                { text: 'Mute', shortcut: 'M', action: () => this.app.toggleMute() },
                { text: 'Solo', shortcut: 'S', action: () => this.app.toggleSolo() },
                { text: '', separator: true },
                { text: 'Add FX...', shortcut: 'F', action: () => this.app.addFX() },
                { text: 'Track Color...', action: () => this.app.setTrackColor() },
                { text: 'Track Icon...', action: () => this.app.setTrackIcon() },
                { text: '', separator: true },
                { text: 'Duplicate Track', shortcut: 'Ctrl+Shift+D', action: () => this.app.duplicateTrack() },
                { text: 'Delete Track', shortcut: 'Delete', action: () => this.app.deleteTrack() }
            ],
            'Item': [
                { text: 'Split at Cursor', shortcut: 'S', action: () => this.app.splitAtCursor() },
                { text: 'Glue Items', shortcut: 'Ctrl+G', action: () => this.app.glueItems() },
                { text: '', separator: true },
                { text: 'Fade In', action: () => this.app.fadeIn() },
                { text: 'Fade Out', action: () => this.app.fadeOut() },
                { text: 'Crossfade', action: () => this.app.crossfade() },
                { text: '', separator: true },
                { text: 'Reverse', action: () => this.app.reverseItem() },
                { text: 'Normalize', action: () => this.app.normalizeItem() }
            ],
            'Take': [
                { text: 'Previous Take', shortcut: 'T', action: () => this.app.previousTake() },
                { text: 'Next Take', shortcut: 'Shift+T', action: () => this.app.nextTake() },
                { text: '', separator: true },
                { text: 'Crop to Active Take', action: () => this.app.cropToActiveTake() },
                { text: 'Delete Active Take', action: () => this.app.deleteActiveTake() }
            ],
            'Actions': [
                { text: 'Action List...', action: () => this.app.showActionList() },
                { text: '', separator: true },
                { text: 'Record', shortcut: 'R', action: () => this.app.record() },
                { text: 'Play', shortcut: 'Space', action: () => this.app.play() },
                { text: 'Stop', shortcut: 'Space', action: () => this.app.stop() }
            ],
            'Options': [
                { text: 'Preferences...', shortcut: 'Ctrl+P', action: () => this.app.showPreferences() },
                { text: '', separator: true },
                { text: 'Audio Device...', action: () => this.app.showAudioDeviceSettings() },
                { text: 'MIDI Devices...', action: () => this.app.showMIDIDeviceSettings() },
                { text: '', separator: true },
                { text: 'Global Startup Action...', action: () => this.app.showStartupAction() }
            ],
            'Extensions': [
                { text: 'ReaScript', action: () => this.app.showReaScript() },
                { text: 'JS Effects', action: () => this.app.showJSEffects() },
                { text: '', separator: true },
                { text: 'Extension Manager...', action: () => this.app.showExtensionManager() }
            ],
            'Help': [
                { text: 'Quick Start Guide', action: () => this.app.showQuickStart() },
                { text: 'User Guide', action: () => this.app.showUserGuide() },
                { text: '', separator: true },
                { text: 'About ReaVerse...', action: () => this.app.showAbout() }
            ]
        };
        
        return menus[menuName] || [];
    }
    
    initializeContextMenus() {
        // Track context menu
        const trackContextMenu = document.getElementById('track-context-menu');
        this.contextMenus.set('track', trackContextMenu);
        
        // Add context menu event listeners
        document.addEventListener('contextmenu', (e) => {
            this.handleContextMenu(e);
        });
        
        // Hide context menus on click
        document.addEventListener('click', () => {
            this.hideAllContextMenus();
        });
    }
    
    setupGlobalEventListeners() {
        // Toolbar buttons
        document.getElementById('new-project')?.addEventListener('click', () => {
            this.app.newProject();
        });
        
        document.getElementById('open-project')?.addEventListener('click', () => {
            this.app.loadProject();
        });
        
        document.getElementById('save-project')?.addEventListener('click', () => {
            this.app.saveProject();
        });
        
        document.getElementById('undo')?.addEventListener('click', () => {
            this.app.undo();
        });
        
        document.getElementById('redo')?.addEventListener('click', () => {
            this.app.redo();
        });
        
        document.getElementById('add-track')?.addEventListener('click', () => {
            this.app.addTrack();
        });
        
        document.getElementById('delete-track')?.addEventListener('click', () => {
            this.app.removeSelectedTracks();
        });
        
        // Panel controls
        document.getElementById('tcp-minimize')?.addEventListener('click', () => {
            this.minimizePanel('track-panel');
        });
        
        document.getElementById('tcp-close')?.addEventListener('click', () => {
            this.hidePanel('track-panel');
        });
        
        document.getElementById('mixer-close')?.addEventListener('click', () => {
            this.hidePanel('mixer-panel');
        });
    }
    
    initializeDragAndDrop() {
        // Will be implemented for media items and track reordering
        console.log('Drag and drop initialized');
    }
    
    initializePanelResizing() {
        // Track panel resizing
        const trackPanel = document.querySelector('.track-panel');
        if (trackPanel) {
            this.makeResizable(trackPanel, 'horizontal');
        }
        
        // Mixer panel resizing
        const mixerPanel = document.querySelector('.mixer-panel');
        if (mixerPanel) {
            this.makeResizable(mixerPanel, 'vertical');
        }
    }
    
    makeResizable(element, direction) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = `resize-handle resize-${direction}`;
        
        if (direction === 'horizontal') {
            resizeHandle.style.cssText = `
                position: absolute;
                right: 0;
                top: 0;
                bottom: 0;
                width: 4px;
                cursor: ew-resize;
                background: transparent;
                z-index: 1000;
            `;
        } else {
            resizeHandle.style.cssText = `
                position: absolute;
                left: 0;
                right: 0;
                top: 0;
                height: 4px;
                cursor: ns-resize;
                background: transparent;
                z-index: 1000;
            `;
        }
        
        element.appendChild(resizeHandle);
        
        resizeHandle.addEventListener('mousedown', (e) => {
            this.startResize(e, element, direction);
        });
    }
    
    startResize(e, element, direction) {
        e.preventDefault();
        
        this.resizeState = {
            element,
            direction,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: parseInt(window.getComputedStyle(element).width, 10),
            startHeight: parseInt(window.getComputedStyle(element).height, 10)
        };
        
        document.addEventListener('mousemove', this.handleResize.bind(this));
        document.addEventListener('mouseup', this.stopResize.bind(this));
        
        document.body.style.cursor = direction === 'horizontal' ? 'ew-resize' : 'ns-resize';
        document.body.style.userSelect = 'none';
    }
    
    handleResize(e) {
        if (!this.resizeState) return;
        
        const { element, direction, startX, startY, startWidth, startHeight } = this.resizeState;
        
        if (direction === 'horizontal') {
            const deltaX = e.clientX - startX;
            const newWidth = Math.max(200, Math.min(500, startWidth + deltaX));
            element.style.width = newWidth + 'px';
        } else {
            const deltaY = startY - e.clientY;
            const newHeight = Math.max(150, Math.min(600, startHeight + deltaY));
            element.style.height = newHeight + 'px';
        }
    }
    
    stopResize() {
        this.resizeState = null;
        document.removeEventListener('mousemove', this.handleResize.bind(this));
        document.removeEventListener('mouseup', this.stopResize.bind(this));
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
    
    handleContextMenu(e) {
        const target = e.target;
        
        // Track context menu
        if (target.closest('.track-control') || target.closest('.track-lane')) {
            e.preventDefault();
            this.showContextMenu('track', e.clientX, e.clientY);
        }
    }
    
    showContextMenu(type, x, y) {
        this.hideAllContextMenus();
        
        const menu = this.contextMenus.get(type);
        if (menu) {
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.classList.remove('hidden');
        }
    }
    
    hideAllContextMenus() {
        this.contextMenus.forEach(menu => {
            menu.classList.add('hidden');
        });
    }
    
    minimizePanel(panelId) {
        const panel = document.getElementById(panelId) || document.querySelector(`.${panelId}`);
        if (panel) {
            panel.classList.toggle('minimized');
        }
    }
    
    hidePanel(panelId) {
        const panel = document.getElementById(panelId) || document.querySelector(`.${panelId}`);
        if (panel) {
            panel.classList.add('hidden');
        }
    }
    
    showPanel(panelId) {
        const panel = document.getElementById(panelId) || document.querySelector(`.${panelId}`);
        if (panel) {
            panel.classList.remove('hidden');
        }
    }
    
    togglePanel(panelId) {
        const panel = document.getElementById(panelId) || document.querySelector(`.${panelId}`);
        if (panel) {
            panel.classList.toggle('hidden');
        }
    }
    
    updateTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--reaper-panel-bg);
            color: var(--reaper-text-primary);
            padding: 12px 16px;
            border-radius: 4px;
            border-left: 4px solid var(--reaper-accent-blue);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-size: 12px;
            max-width: 300px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        if (type === 'error') {
            notification.style.borderLeftColor = 'var(--reaper-accent-red)';
        } else if (type === 'warning') {
            notification.style.borderLeftColor = 'var(--reaper-accent-orange)';
        } else if (type === 'success') {
            notification.style.borderLeftColor = 'var(--reaper-accent-green)';
        }
        
        document.body.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });
        
        // Auto remove
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
}