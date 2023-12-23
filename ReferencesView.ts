import { ItemView, MarkdownView, WorkspaceLeaf, setIcon } from 'obsidian';

import BibcitePlugin from './main';
import { exportItems, attachments, collectionCitekeys } from "ZoteroFunctions.ts";

export const ReferencesViewType = 'ReferencesView';

interface ReferencesViewPersistedState {
  zotero_collection: string;
  libraryName: string;
  citations: string[];
}

export class ReferencesView extends ItemView {
  plugin: BibcitePlugin;
  activeMarkdownLeaf: MarkdownView;
  references: [];

  constructor(leaf: WorkspaceLeaf, plugin: BibcitePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.contentEl.addClass('bibcite-references');
    this.setEmptyView();
    this.addAction("refresh-cw", "Refresh References", () => {
      this.renderReferences();
    })
  }

  setViewContent(bib: HTMLElement) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    this.button = containerDiv.createEl("button", { text: "Refresh Bibliography" });
    this.button.onclick = (e) => {
      this.renderReferences();
    }
    if (!bib) {
      this.setEmptyView();
    } else {
      this.contentEl.append(bib);
    }
  }

  setEmptyView() {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    this.button = containerDiv.createEl("button", { text: "Refresh Bibliography" });
    this.button.onclick = (e) => {
      this.renderReferences();
    }
    containerDiv.createDiv({
      cls: 'pane-empty',
      text: 'No citations found in the current document.',
    });
  }


  setMessage(message: string) {
    this.contentEl.empty();
    const containerDiv = this.contentEl.createDiv({cls:"container-div" });
    this.button = containerDiv.createEl("button", { text: "Refresh Bibliography" });
    this.button.onclick = (e) => {
      this.renderReferences();
    }
    containerDiv.createDiv({
      cls: 'pane-empty',
      text: message,
    });
  }

  getViewType() {
    return ReferencesViewType;
  }

  getDisplayText() {
    return 'References';
  }

  getIcon() {
    return 'graduation-cap';
  }

  processReferences = async () => {

		const { settings, view } = this;

		const activeView = this.plugin.app.workspace.getActiveFileView();
		const activeFile = this.plugin.app.workspace.getActiveFile();

		if (activeFile) {
			try {
				const fileContent = await this.plugin.app.vault.cachedRead(activeView.file);
        const cache = this.plugin.app.metadataCache.getFileCache(activeFile);
		    const frontMatter = cache.frontmatter;

        if (!frontMatter){
          return {'library': null, 'citations': []}
        }
        if (!Object.hasOwn(frontMatter, 'zotero_collection')){
          return {'library': null, 'citations': []}
        }

        const libraryName = frontMatter.zotero_collection.split("/")[0];

        const citekeys = await collectionCitekeys(frontMatter.zotero_collection);
        
				const re = /\[(@[a-zA-Z0-9_-]+[ ]*;?[ ]*)+\]/g

				let matches = fileContent.match(re).map(item => item.slice(1, -1).split(";").map( i => i.trim().replace("@", "") ));
        
        matches = matches.flat(1).filter((item) => citekeys.includes(item));

				const matches_unique = new Set(matches)

				return  {'library': libraryName, 'citations': [...matches_unique]};

			} catch (e) {
				console.error(e);
				return {'library': null, 'citations': []};
			}
		} else {
			return {'library': null, 'citations': []};
		};
	};

  async renderReferences() {

    const refs = await this.processReferences();

    const containerDiv = document.createElement('div');
    containerDiv.classList.add('references-div');
    
    const refData = JSON.parse(await exportItems(refs.citations, "json", refs.library))
        
    if (refs.citations.length == 0){
      this.setEmptyView();
      return
    }

    for (const item of refs.citations) {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('reference-div');

      const itemData = refData.flat(1).filter(r => r['id'] == item)[0]

      itemData['attachments'] = await attachments(item)

      const itemAttachments = itemData['attachments'].filter(attach => attach.path != false)


      itemDiv.innerHTML += `<div class="reference-citekey">@${itemData['id']}<div>`;

      if (itemAttachments.length){
        const linkAttachment = itemAttachments[0]['open']
        itemDiv.innerHTML += `<div class="reference-title"><a href='${linkAttachment}'>${itemData['title']}</a></div>`;
      } else {
        itemDiv.innerHTML += `<div class="reference-title">${itemData['title']}</div>`;
      }

      const journal = itemData['container-title-short'] != '' ? itemData['container-title-short'] : itemData['container-title']
      const issueDate = itemData['issued']['date-parts'][0][0] != undefined ? itemData['issued']['date-parts'][0][0] : ''

      itemDiv.innerHTML += `<div class="reference-journal">${journal} ${issueDate}</div>`;

      containerDiv.appendChild(itemDiv);

    }

  this.setViewContent(containerDiv);

  };

}
