const { Plugin, Notice, Modal, PluginSettingTab, Setting } = require('obsidian');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = class HugoNoteConverter extends Plugin {
    async onload() {
        console.log('Loading HugoNoteConverter');

        // デフォルト設定を読み込む
        this.settings = Object.assign({
            imageDirectory: 'Config/Extra'
        }, await this.loadData());

        // 設定タブを追加
        this.addSettingTab(new HugoNoteConverterSettingTab(this.app, this));

        // コマンドを登録
        this.addCommand({
            id: 'convert-note',
            name: 'Convert Note for Hugo',
            callback: () => this.convertNoteForHugo(),
        });
    }

    async convertNoteForHugo() {
        try {
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('No active note open.');
                console.log('No active note open.');
                return;
            }

            console.log('Active note found:', activeFile.path);

            const newDirName = await this.askForDirectoryName();
            if (!newDirName) {
                new Notice('Directory name is required.');
                console.log('Directory name is required.');
                return;
            }

            const sanitizedDirName = this.sanitizeFileName(newDirName);
            const downloadDir = path.join(os.homedir(), 'Downloads', sanitizedDirName);
            if (!fs.existsSync(downloadDir)) {
                fs.mkdirSync(downloadDir, { recursive: true });
            }

            const fileContents = await this.app.vault.read(activeFile);
            const addedFrontMatterContents = this.createFromtMatter(fileContents,activeFile.name.replace(/\.md$/, ""));
            const convertedContents = this.convertWikiLinksToMarkdown(addedFrontMatterContents);

            fs.writeFileSync(path.join(downloadDir, 'index.md'), convertedContents);
            await this.copyImagesToDirectory(fileContents, downloadDir);

            new Notice('Conversion complete.');
            console.log('Conversion complete.');
        } catch (error) {
            new Notice('Error during conversion. Check console for details.');
            console.error('Error during conversion:', error);
        }
    }

    sanitizeFileName(name) {
        return name.replace(/[<>:"\/\\|?*]/g, '_');
    }

    async askForDirectoryName() {
        return new Promise((resolve, reject) => {
            const modal = new Modal(this.app);
            let inputValue = '';

            modal.contentEl.createEl('h2', { text: 'Enter directory name' });
            const input = modal.contentEl.createEl('input', { type: 'text' });

            input.addEventListener('input', (e) => {
                inputValue = e.target.value;
            });

            modal.contentEl.createEl('button', { text: 'OK' }, (buttonEl) => {
                buttonEl.addEventListener('click', () => {
                    modal.close();
                    resolve(inputValue);
                });
            });

            modal.open();
        });
    }

    createFromtMatter(contents,title){
        // フォーマットされた日付を生成(コマンド実行時の時間を使用する)
        const date = new Date();
        const formattedDate = date.toISOString();
        // タグをカンマ区切りで保存する変数
        const tags = (contents.match(/#\w+(\/\w+)*/g) || []).map(tag => tag.slice(1)).join(', ');

        // タグを削除したテキストのみが入っている変数
        const textWithoutTags = contents.replace(/#\w+(\/\w+)*/g, '').trim();

        // YAMLフロントマターを生成
        const yamlFrontmatter = 
        ["---",
        `title: ${title}`,
        `date: ${formattedDate}`,
        "draft: false",
        `tags: [${tags}]`,
        `categories: [${formattedDate.substring(0, 4)}]`,  
        "---\n\n"].join("\n");

        // YAMLフロントマターとcontentsを組み合わせて新しいテキストを生成
        const newContents = yamlFrontmatter + textWithoutTags;

        return newContents;
    }

    convertWikiLinksToMarkdown(contents) {
        // 画像の形式にマッチする正規表現
        const imageRegex = /!\[\[([^\]]+)\]\]/g;
        // wikilinkの形式にマッチする正規表現
        const linkRegex = /\[\[([^\]]+)\]\]/g;

        // 画像の形式にマッチする部分を置換
        let convertedContents = contents.replace(imageRegex, '![]($1)');
        // wikilinkの形式にマッチする部分を置換
        convertedContents = convertedContents.replace(linkRegex, '$1');

        return convertedContents;
    }

    async copyImagesToDirectory(contents, dirPath) {
        console.log('Copying images to directory.');
        const imageLinks = contents.match(/!\[\[([^\]]+)\]\]/g);
        if (!imageLinks) return;

        for (const link of imageLinks) {
            const imageName = link.match(/!\[\[([^\]]+)\]\]/)[1];
            const imagePath = `${this.app.vault.adapter.basePath}/${this.settings.imageDirectory}/${imageName}`;
            const newImagePath = path.join(dirPath, imageName);
            fs.copyFileSync(imagePath, newImagePath);
            console.log(`Copied ${imageName} to ${newImagePath}`);
        }
    }

    async saveData(data) {
        await this.saveData(data);
    }
};

// 設定タブを定義
class HugoNoteConverterSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Settings for My Plugin' });

        new Setting(containerEl)
            .setName('Image Directory')
            .setDesc('Directory where images are stored')
            .addText(text => text
                .setPlaceholder('Config/Extra')
                .setValue(this.plugin.settings.imageDirectory)
                .onChange(async (value) => {
                    this.plugin.settings.imageDirectory = value;
                    await this.plugin.saveData(this.plugin.settings);
                }));
    }
}

