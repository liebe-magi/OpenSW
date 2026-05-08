# OpenSW Roadmap

本ドキュメントは、現バージョン `0.1.1` 以降のアップデート計画をまとめたものです。フェーズごとにリリースを区切り、依存整理・バグ修正・新機能追加を段階的に進めます。

## 全体方針

- 1 リリースに詰め込みすぎず、回帰調査の難易度を下げるため 3 フェーズに分割。
- 録音パイプラインを根本から触る大物（ストリーミング認識）は最後の Phase C にまとめる。
- Phase B / C の前提となる `WhisperContext` キャッシュ化など土台改善を Phase A で先に行う。

## Phase A — `0.1.2`（土台 / 目安 1〜2 週）

依存とバグを片付け、後続フェーズの前提を整える。

### 依存整理

滞留している Renovate PR を minor → major の順にマージする。

- minor / patch
  - `fix(deps): update all non-major dependencies` (#41)
  - `chore(deps): lock file maintenance` (#34)
  - `chore(deps): update tauri packages to v2.6.1` (#37)
  - `chore(deps): update dependency eslint-plugin-react-refresh to ^0.5.0` (#40)
- major（個別検証してから）
  - whisper-rs `0.15` → `0.16`
  - rodio `0.21` → `0.22`
  - rubato `1.0` → `2.0`
  - audioadapter-buffers `2.0` → `3.0`
  - TypeScript `5` → `6`、ESLint `9` → `10`（#43）
  - Vite `7` → `8`、`@vitejs/plugin-react` `5` → `6`

### 既知バグ・性能修正

1. `src/components/AudioRecorder.tsx:155` — UI で選択した `language` state を `transcribe_audio` 呼び出しに渡す（現状 `'ja'` ハードコード）。
2. `src-tauri/src/main.rs:97` `transcribe_audio` — `WhisperContext` を `AudioState` にキャッシュし、モデルパス／GPU 設定変更時のみ再ロード。Phase C のストリーミング前提。
3. `src-tauri/src/audio.rs:193` — `sleep(100ms)` をやめ、`JoinHandle` または ack チャネルでスレッド終了を正しく待機。
4. 録音 WAV のファイルパスを uuid または pid 付きで一意化。多重起動と前回ゴミ混入の回避。
5. `IS_MACOS` を `navigator.userAgent` ではなく Tauri 側 (`@tauri-apps/plugin-os` 等) で判定。

### Phase C 向け事前検証 (spike)

- whisper-rs 0.16 の `WhisperState` 再利用時の連続推論レイテンシを実測。
- macOS Metal / Windows CUDA / CPU の各環境でフレームレートを計測。
- spike 結果を踏まえて Phase C のストリーミング方式（後述 1 / 2 / 4）を確定。
- spike は別ブランチで行い、本リリースには含めない。

## Phase B — `0.2.0`（UX 4 機能 / 目安 3〜4 週）

軽い順に実装する。

### 1. Ollama thinking 無効化トグル（最小）

- 目的: thinking を発生させずスループットを上げる。表示の切替が目的ではない。
- 実装: `src-tauri/src/ollama.rs` の `GenerateRequest` に `think: bool` を追加し、デフォルト `false`。レスポンスの `thinking` フィールドは捨てる。
- UI: Ollama 設定セクションに「Disable thinking (faster)」チェックボックスを追加し localStorage に永続化。

### 2. 新バージョン自動通知（小）

- 起動時に `@tauri-apps/plugin-updater` の `check()` をバックグラウンドで 1 回実行。
- 新版があれば OS 通知を送り、Settings タブの UpdateChecker にバッジ表示。
- 設定: 「起動時自動チェック ON/OFF」「自動 DL ON/OFF」を追加。

### 3. グローバルショートカット設定化（中）

- キーキャプチャ可能な入力コンポーネントを設定 UI に追加。
- 既存ショートカットを `unregister()` → `register()` で動的差し替え。
- localStorage に永続化、起動時に再登録。
- 競合や登録失敗時はフォールバック表示。

### 4. Whisper モデル自動 DL（中〜大）

- HuggingFace `ggerganov/whisper.cpp` から GGML プリセット一覧を表示（tiny / base / small / medium / large-v3-turbo / large-v3）。
- `reqwest` でストリーム DL し、進捗を Tauri イベントで emit。
- SHA256 検証、`AppDataDir` 配下に保存。
- 既存「Select」フローと共存し、ローカル選択 / ダウンロードの 2 択に。

## Phase C — `0.3.0`（大物 2 件 / 目安 4〜6 週）

Phase A の spike 結果で方式を確定してから着手する。

### ストリーミング認識・リアルタイム表示

候補方式の比較:

| # | 方式                | 仕組み                                                            | リアルタイム性 | 実装難度 | 計算コスト | 主な欠点                                       |
| - | ------------------- | ----------------------------------------------------------------- | -------------- | -------- | ---------- | ---------------------------------------------- |
| 1 | チャンク再推論       | N 秒ごとに過去 M 秒の累積バッファで `full()` を再実行              | ◎              | 中       | 高         | 暫定テキストがちらつく、GPU ほぼ必須             |
| 2 | VAD セグメント       | 無音検出で区切り、各セグメントを 1 回ずつ転写                      | △              | 中       | 低         | 文中の途中表示ができない                        |
| 3 | whisper.cpp stream流 | KV キャッシュを使い回し、小さなウィンドウを連続推論                 | ◎              | 高       | 低〜中     | whisper-rs が KV 再利用 API を素直に出していない可能性 |
| 4 | ハイブリッド (1+2)  | VAD で粗く区切り、確定前は方式 1 で暫定、無音で確定                | ◎ + 安定       | 高       | 中         | 状態管理と UI が複雑                            |

最初は方式 1 で MVP を作って体感を確認し、必要に応じて方式 4 へ発展させる二段構え。Compact ウィンドウに暫定（グレー）／確定（白）の 2 段階表示を入れる。CPU 環境では方式 2 の自動フォールバックを設定で選択可能にする。

### 転写履歴

- ストレージは `tauri-plugin-store`（軽量 JSON）を採用予定。件数が増えたら `tauri-plugin-sql` (SQLite) へ移行可能な抽象を挟む。
- 保存項目: 日時、言語、生テキスト、整形後テキスト、使用モデル、所要時間。ストリーミング暫定結果は保存せず確定テキストのみ。
- UI: Settings の隣に History タブを新設。検索、再コピー、個別削除、全削除に対応。
- プライバシー観点でデフォルト ON / OFF を選べるように。

## 将来候補（Phase D 以降）

- macOS notarize（README の `xattr` 手順撤廃）
- Linux `.deb` / `.AppImage`、macOS Intel ビルドの追加
- `AudioRecorder.tsx`（623 行）をフック分離 + コンポーネント分割
- Rust / TS 単体テストの整備、CI に組み込み
