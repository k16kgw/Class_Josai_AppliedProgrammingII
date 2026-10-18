# Class_Josai_AppliedProgrammingII

応用プログラミングII - 城西大学 応用プログラミングII

## ローカルプレビュー

```bash
# 依存パッケージをインストール（初回のみ）
npm install -g mystmd
uv pip install -r requirements.txt

# ローカルサーバーを起動 → http://localhost:3000
myst start
# または
make start
```

## GitHub Pages

`main` ブランチに push すると自動的にデプロイされます。

初回のみ GitHub リポジトリの **Settings → Pages → Source: GitHub Actions** を設定してください。

## 解答例の公開・非公開

`plugins/answer-toggle.mjs`を`myst.yml`で登録しています。分類ではなく公開状態でタグを選びます。

`````text
````{hidden-answer} 演習1の解答例
解答の文章・数式・コード・図をここに記載する。
````
`````

- 非公開：`{hidden-answer}`。タイトル・本文を出力用の構文木から除外し、内部の画像やincludeも処理しません。HTML・検索データ・PDFに出力されません。
- 公開：タグだけを`{visible-answer}`へ変更します。HTMLでは閉じたdropdown、PDFでは通常の解答欄になります。
- HTMLコメントで囲む必要はありません。コードブロックを含む場合は、外側のバッククォートを内側より多くしてください。
- 第1〜3回の既存解答例は、移行時の公開状態を維持しています。通常のコード補足のdropdownは変更していません。

MySTは原稿のMarkdownも配信用フォルダへコピーするため、プラグインはビルド終了時に生成されたハッシュ付きMarkdownコピーを除去します。原稿やCSVは削除しません。ソースのダウンロードを無効にする`downloads: []`と`source_url: null`も維持してください。

公開用には静的ビルドを使用してください。`myst start`は著者向けプレビューであり、終了時のソース除去がまだ実行されないため、外部公開しないでください。公開済みの解答を非公開へ戻す場合は、以前のHTML・画像・PDFを含むビルド出力を再利用せず、クリーンな環境で再ビルド・再配信してください。GitHub Actionsは毎回新しい環境でビルドします。公開済みのGit履歴や閲覧者の保存済みファイルは、この仕組みでは取り消せません。

検証（先に`myst build --site --strict`でテンプレートを取得）：

```bash
node --test tests/answer-toggle.test.mjs
myst build --html --strict
```

実装は[MySTのJavaScriptプラグイン仕様](https://mystmd.org/guide/javascript-plugins)と[標準のdropdown表示](https://mystmd.org/guide/admonitions)に基づきます。
