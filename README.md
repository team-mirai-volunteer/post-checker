# post-checker

チームみらいとしての発信（SNS文言・動画台本）などをチェックするウェブアプリ

## 想定利用者

- SNSで発信するチームみらいの候補者
- 動画や記事を作成・レビューするサポーター

## できること

- 文章を入れると、発言のリスクやファクト相違の可能性を指摘してくれて、公開前に修正することができる

> OK/NGをジャッジするというよりは、リスク指摘をもとに利用者が自己判断するくらいの機能性が良さそう

## チェック項目

- ファクトとして、チームみらいの掲げている政策や実績と矛盾する点がないか
- ファクトとして、触れられている内容について事実誤認がないか
- チームみらいが掲げているバリューと反する部分がないか
- 炎上リスク（誰かを傷つける表現、配慮に欠けた表現など）がないか
- 公選法上NGとされている表現が含まれていないか
- 誤字脱字がないか

## 作り方イメージ

1. チームみらいのこれまでの発信（マニフェスト・バリュー・note・動画文字起こしなど）を全てRAG DB(Dify)に入れる
2. チェック対象となる文字列を、適度に要素分解しつつ上記のDB内容と比較し、上記のチェック項目に該当する点がないかLLMで調べる
   - 並列処理でそれぞれをチェックする専門のプロンプトがあると精度があがりそう
3. チームみらい外の事実にまつわるものは必要に応じてWeb検索も絡めて検証する

## 主要コマンド

```bash
# Dify環境のセットアップ（初回のみ）
npm run setup:dify

# Difyを起動（http://localhost/apps でアクセス）
npm run start

# Difyを停止
npm run stop

# テスト実行
npm test

# 統合テスト実行
npm run test:integration

# DifyアプリのDSLをエクスポート（git管理用）
npm run dify:export

# セッションをクリア（再ログインしたい時）
npm run dify:logout

# note.comから記事を取得してknowledges/note/に保存
npm run fetch:note-articles <username>
# 例: npm run fetch:note-articles team_mirai_jp
```
## ローカルLLMを使った動作確認

DifyのLLMブロックを動かすには、ローカルLLMが必要です。Ollamaを使う場合の手順：

### 1. Ollamaのインストール

```bash
# macOS（Homebrew）
brew install ollama

# または公式サイトからダウンロード
# https://ollama.com/download
```

### 2. モデルの起動

```bash
# LLMモデル（チャット用）
ollama run qwen2.5:32b

# 埋め込みモデル（ナレッジベース用）
ollama pull nomic-embed-text
```

> 初回はモデルのダウンロードに時間がかかります（qwen2.5:32bは約20GB）。
> 軽量モデルを使いたい場合は `ollama run qwen2.5:7b` でも動作します。

### 3. DifyでOllamaを設定

1. Dify起動後、http://localhost/apps にアクセス
2. 右上のユーザーアイコン → 「設定」
3. 「モデルプロバイダー」→「Ollama」を追加

**LLMモデル（チャット用）:**
- Model Name: `qwen2.5:32b`
- Model Type: `LLM`
- Base URL: `http://host.docker.internal:11434`

**埋め込みモデル（ナレッジベース用）:**
- Model Name: `nomic-embed-text`
- Model Type: `Text Embedding`
- Base URL: `http://host.docker.internal:11434`

4. 保存後、ワークフローのLLMブロック・ナレッジベースで選択可能になります

### 4. 終了時

```bash
# Ollamaサーバーを停止
ollama stop qwen2.5:32b
ollama stop nomic-embed-text
```

## ディレクトリ構成

```
├── dify-local/       # Difyリポジトリのclone（git submodule）
├── dify-settings/    # Difyアプリ設定のgit管理用
│   └── dsl/          # エクスポートしたDSLファイル
├── docs/             # 設計ドキュメント
├── infra/            # インフラ設定
│   └── terraform/    # Terraform設定 → [デプロイ手順](infra/terraform/README.md)
├── knowledges/       # RAG用ナレッジファイル
│   ├── manifesto/    # マニフェスト等
│   └── note/         # note.com記事（index.yaml含む）
└── scripts/          # ユーティリティスクリプト
    ├── src/          # スクリプト本体
    └── test/         # テスト
```

## Dify設定のgit管理

DifyアプリのDSL（ワークフロー定義）は `dify-settings/dsl/` に保存されます。
プロンプトチューニング後は `npm run dify:export` を実行してDSLをエクスポートし、コミットしてください。

```bash
# プロンプト調整後
npm run dify:export
git add dify-settings/
git commit -m "Update: プロンプト調整"
```
