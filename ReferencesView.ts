import { ItemView, MarkdownView, WorkspaceLeaf, setIcon } from 'obsidian';

import BibcitePlugin from './main';
import { exportItems, attachments } from "ZoteroFunctions.ts";

export const ReferencesViewType = 'ReferencesView';

export class ReferencesView extends ItemView {
  plugin: BibcitePlugin;
  activeMarkdownLeaf: MarkdownView;
  references: Set;

  constructor(leaf: WorkspaceLeaf, plugin: ReferenceList) {
    super(leaf);
    this.plugin = plugin;
    this.contentEl.addClass('bibcite-references');
    this.setNoContentMessage();
  }

  setViewContent(bib: HTMLElement) {
    this.contentEl.empty();
    this.button = this.contentEl.createEl("button", { text: "Refresh Bibiography" });
    this.button.onclick = (e) => {
      this.processReferences();
    }
    if (!bib) {
      this.setNoContentMessage();
    } else {
      this.contentEl.append(bib);
    }
  }

  setNoContentMessage() {
    this.setMessage('No citations found in the current document.');
  }

  setMessage(message: string) {
    this.contentEl.empty();
    this.button = this.contentEl.createEl("button", { text: "Refresh Bibiography" });
    this.button.onclick = (e) => {
      this.processReferences();
    }
    this.contentEl.createDiv({
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
    return 'quote-glyph';
  }

  processReferences = async () => {

    const refs = await this.plugin.processReferences();

    this.setViewContent(await this.renderReferences(refs))

  };

  async renderReferences(refsArray) {
    const containerDiv = document.createElement('div')
    
    const refData = JSON.parse(await exportItems(refsArray, "json", "ENT"))

    console.log(refData.flat(1));
    
    for (const item of refsArray) {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('reference-div');

      const itemData = refData.flat(1).filter(r => r['id'] == item)[0]

      itemData['attachments'] = await attachments(item)

      const itemAttachments = itemData['attachments'].filter(attach => attach.path != false)

      if (itemAttachments.length){
        console.log(itemAttachments[0]['open'])
      }


      itemDiv.innerHTML += `<div class="reference-citekey">@${itemData['id']}<div>`;
      itemDiv.innerHTML += `<div class="reference-title">${itemData['title']}</div>`;

      const journal = itemData['container-title-short'] != '' ? itemData['container-title-short'] : itemData['container-title']
      const issueDate = itemData['issued']['date-parts'][0][0] != undefined ? itemData['issued']['date-parts'][0][0] : ''

      itemDiv.innerHTML += `<div class="reference-journal">${journal} ${issueDate}</div>`;

      containerDiv.appendChild(itemDiv);

  }

    return containerDiv;

  };

}
