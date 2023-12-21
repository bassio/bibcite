import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';

import { CitationSuggest } from "CitationSuggest.ts";
import { ReferencesView, ReferencesViewType } from './ReferencesView.ts';

// Remember to rename these classes and interfaces!

interface BibcitePluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: BibcitePluginSettings = {
	mySetting: 'default'
}

export default class BibcitePlugin extends Plugin {
	settings: BibcitePluginSettings;
	_activeFilePath: string;

    get activeFilePath() {
        return this._activeFilePath;
    }
    set activeFilePath(path) {
        if (path != this._activeFilePath){
			this._activeFilePath = path;
			console.log("activeFilePath changed!");
			this.view.processReferences();
		}
    }

	async onload() {

		console.log("Loading Bibcite plugin.")

		await this.loadSettings();

		this.registerEditorSuggest(new CitationSuggest(this.app, this));

		this.registerView(ReferencesViewType,
						 (leaf: WorkspaceLeaf) => new ReferencesView(leaf, this)
						  );

		this.addCommand({
			id: 'show-references-view',
			name: 'Show References',
			callback: async () => {
				this.initLeaf();
			},
		});
		
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			const activeFile = this.app.workspace.getActiveFile();
			this.activeFilePath = activeFile.path;
		}));
	  

		await this.initLeaf();

		/*
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
		*/

	}

	onunload() {
		this.app.workspace.getLeavesOfType(ReferencesViewType)
		.forEach((leaf) => leaf.detach());
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	get view() {
		const leaves = this.app.workspace.getLeavesOfType(ReferencesViewType);
		if (!leaves?.length) return null;
		return leaves[0].view as ReferencesView;
	}

	async initLeaf() {
		if (this.view) return this.revealLeaf();

		await this.app.workspace.getRightLeaf(false).setViewState({
			type: ReferencesViewType,
		});

		this.revealLeaf();

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView) {
			this.processReferences();
		}
	}

	revealLeaf() {
		const leaves = this.app.workspace.getLeavesOfType(ReferencesViewType);
		if (!leaves?.length) return;
		this.app.workspace.revealLeaf(leaves[0]);
	}

	processReferences = async () => {

		const { settings, view } = this;

		const activeView = this.app.workspace.getActiveFileView();
		const activeFile = this.app.workspace.getActiveFile();

		console.log("processing references")

		if (activeFile) {
			try {
				const fileContent = await this.app.vault.cachedRead(activeView.file);
				const cache = this.app.metadataCache.fileCache[activeFile.path];

				const re = /\[(@[a-zA-Z0-9_-]+[ ]*;?[ ]*)+\]/g

				const matches = fileContent.match(re).map(item => item.slice(1, -1).split(";").map( i => i.trim().replace("@", "") ));

				const matches_unique = new Set(matches.flat(1))

				return  [...matches_unique];

			} catch (e) {
				console.error(e);
				return [];
			}
		} else {
			return [];
		};
	};
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: BibcitePlugin;

	constructor(app: App, plugin: BibcitePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
