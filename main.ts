import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';

import { CitationSuggest } from "CitationSuggest";
import { ReferencesView, ReferencesViewType } from 'ReferencesView';


interface BibcitePluginSettings {
	defaultViewMode: string;
	defaultAnnotationsMode: string;
}

const DEFAULT_SETTINGS: BibcitePluginSettings = {
	defaultViewMode: 'references',
	defaultAnnotationsMode: 'modal'
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

			if (this.settings.defaultViewMode == 'references'){
				this.view?.renderReferences();
			} else if (this.settings.defaultViewMode == 'bibliography'){
				this.view?.renderBibliography();
			} else {
				this.view?.renderReferences();
			}
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
	  
		this.addSettingTab(new BibciteSettingTab(this.app, this));

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
			this.view?.renderReferences();
		}
	}

	revealLeaf() {
		const leaves = this.app.workspace.getLeavesOfType(ReferencesViewType);
		if (!leaves?.length) return;
		this.app.workspace.revealLeaf(leaves[0]);
	}

}

class BibciteSettingTab extends PluginSettingTab {
	plugin: BibcitePlugin;

	constructor(app: App, plugin: BibcitePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Bibcite Plugin Settings' });

		new Setting(containerEl)
			.setName('Default Reference List View Mode')
			.setDesc('The default view mode for the References view. Options include "References mode" (default) and "Bibliography mode".')
			.addDropdown((dropdown) => {
				dropdown
				.addOption('references', "References mode")
				.addOption('bibliography', 'Bibliography mode')
				.setValue(this.plugin.settings.defaultViewMode)
				.onChange(async (value) => {
							this.plugin.settings.defaultViewMode = value;
							this.plugin.saveSettings();
			  				})
			});

		new Setting(containerEl)
			.setName('Default Annotations View Mode')
			.setDesc('The default view mode for the Annotations. Options include "Modal" (default) and "In Leaf".')
			.addDropdown((dropdown) => {
				dropdown
				.addOption('modal', "Modal")
				.addOption('leaf', 'In Leaf')
				.setValue(this.plugin.settings.defaultAnnotationsMode)
				.onChange(async (value) => {
							this.plugin.settings.defaultAnnotationsMode = value;
							this.plugin.saveSettings();
							})
			});
			  
	}
	
}
