# デプロイ手順

Live Reaction Systemを無料でデプロイする手順です。

## 📋 構成

- **バックエンド**: Render (無料) + PostgreSQL (無料)
- **フロントエンド**: Vercel (無料)
- **合計コスト**: 完全無料

---

## 🚀 1. バックエンドのデプロイ（Render）

### 1-1. Renderアカウント作成

1. [Render](https://render.com/)にアクセス
2. GitHubアカウントで Sign Up
3. GitHubリポジトリとの連携を許可

### 1-2. PostgreSQLデータベースの作成

1. Renderダッシュボードで「New +」→「PostgreSQL」を選択
2. 以下の設定:
   - **Name**: `live-reaction-db`
   - **Database**: `live_reaction`
   - **User**: `live_reaction_user` (自動生成でもOK)
   - **Region**: `Singapore` (アジア最寄り)
   - **Plan**: `Free` を選択
3. 「Create Database」をクリック
4. **Internal Database URL** をメモしておく（後で使用）

### 1-3. Webサービスの作成

1. Renderダッシュボードで「New +」→「Web Service」を選択
2. GitHubリポジトリ `live-reaction-system` を選択
3. 以下の設定:

   **Basic Settings:**
   - **Name**: `live-reaction-backend`
   - **Region**: `Singapore`
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**:
     ```bash
     python -c "from app.database import init_database; init_database()" && uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```

   **Advanced Settings (環境変数):**
   - `DATABASE_URL`:
     - 先ほど作成したPostgreSQLの **Internal Database URL** を貼り付け
   - `FRONTEND_URL`:
     - 後でVercelのURLを設定（まずは `https://temp.vercel.app` と入力）
   - `PYTHON_VERSION`: `3.12.0`

4. **Plan**: `Free` を選択
5. 「Create Web Service」をクリック

### 1-4. デプロイ完了を確認

1. デプロイログを確認（5〜10分程度）
2. 「✅ データベース初期化完了!」と表示されればOK
3. サービスのURLをメモ（例: `https://live-reaction-backend.onrender.com`）

---

## 🌐 2. フロントエンドのデプロイ（Vercel）

### 2-1. Vercelアカウント作成

1. [Vercel](https://vercel.com/)にアクセス
2. GitHubアカウントで Sign Up
3. GitHubリポジトリとの連携を許可

### 2-2. プロジェクトのインポート

1. Vercelダッシュボードで「Add New...」→「Project」を選択
2. GitHubリポジトリ `live-reaction-system` をインポート
3. 以下の設定:

   **Project Settings:**
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (自動設定)
   - **Output Directory**: `dist` (自動設定)

   **Environment Variables:**
   - `VITE_WS_URL`:
     - Renderのバックエンドのwss URLを入力
     - 例: `wss://live-reaction-backend.onrender.com/ws`
     - ⚠️ `wss://` (SSL付き) を使用すること

4. 「Deploy」をクリック

### 2-3. デプロイ完了を確認

1. デプロイログを確認（3〜5分程度）
2. デプロイ完了後、URLをメモ（例: `https://live-reaction-system.vercel.app`）

---

## 🔄 3. 環境変数の相互更新

### 3-1. バックエンドのFRONTEND_URLを更新

1. Renderダッシュボード → `live-reaction-backend` → Environment
2. `FRONTEND_URL` の値を Vercel の URL に更新
   - 例: `https://live-reaction-system.vercel.app`
3. 「Save Changes」→ 自動的に再デプロイ

### 3-2. 動作確認

1. VercelのURLにブラウザでアクセス
2. カメラとマイクの許可を出す
3. デバッグパネルで「接続状態」が✅になることを確認
4. リアクションを取ってエフェクトが表示されることを確認

---

## 🛠️ 4. トラブルシューティング

### ❌ WebSocket接続エラー

**症状**: 「WebSocket接続エラー」と表示される

**原因と対処法**:
1. **CORS設定の確認**
   - RenderのログでCORSエラーが出ていないか確認
   - `FRONTEND_URL` がVercelのURLと一致しているか確認

2. **WebSocket URL の確認**
   - Vercelの環境変数 `VITE_WS_URL` が正しいか確認
   - `wss://` (SSL付き) になっているか確認

3. **Renderのスリープ**
   - 無料プランは15分間アクセスがないとスリープ
   - 初回アクセス時は起動に30秒〜1分かかる
   - リロードすれば接続できる

### ❌ データベースエラー

**症状**: 「データベース接続エラー」

**対処法**:
1. RenderのログでPostgreSQL接続エラーを確認
2. `DATABASE_URL` 環境変数が正しく設定されているか確認
3. PostgreSQLデータベースが起動しているか確認

### ❌ カメラ・マイクが使えない

**症状**: カメラやマイクの許可が出ない

**対処法**:
- HTTPSでアクセスしているか確認
- Vercelは自動的にHTTPSなので問題なし
- ブラウザの設定でカメラ・マイクを許可

---

## 📊 5. モニタリング

### Renderのログ確認

1. Renderダッシュボード → `live-reaction-backend` → Logs
2. リアルタイムでサーバーログを確認可能
3. エラーが出ていないかチェック

### Vercelのログ確認

1. Vercelダッシュボード → プロジェクト → Deployments
2. ビルドログとランタイムログを確認可能

### データベースの確認

1. Renderダッシュボード → `live-reaction-db` → Connect
2. 「PSQL Command」をコピー
3. ローカルターミナルで実行（psqlが必要）
4. SQLでデータを確認:
   ```sql
   \c live_reaction
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM reactions_log;
   SELECT COUNT(*) FROM effects_log;
   ```

---

## 🔧 6. 再デプロイ

### コード変更後の再デプロイ

1. **バックエンド（Render）**:
   - GitHubにプッシュすると自動的に再デプロイ
   - または、Renderダッシュボードで「Manual Deploy」

2. **フロントエンド（Vercel）**:
   - GitHubにプッシュすると自動的に再デプロイ
   - プレビューURLで確認可能

### 環境変数の変更

1. **Render**: Environment → 変更 → Save Changes → 自動再デプロイ
2. **Vercel**: Settings → Environment Variables → 変更 → 手動で Redeploy

---

## 💡 7. コスト最適化

### 無料プランの制限

**Render (無料)**:
- 750時間/月の稼働時間
- 15分間アクセスなしでスリープ
- PostgreSQL: 90日間アクセスなしで削除

**Vercel (無料)**:
- 100GB帯域/月
- 無制限のデプロイ

### 実験期間のみ使用する場合

1. 実験終了後、サービスを削除すればコスト発生なし
2. データベースは削除前にエクスポート推奨:
   ```bash
   # Renderのデータベース接続情報を使用
   pg_dump DATABASE_URL > backup.sql
   ```

---

## 📝 8. チェックリスト

デプロイ完了時の確認項目:

- [ ] Renderでバックエンドがデプロイ完了
- [ ] PostgreSQLデータベースが作成済み
- [ ] Vercelでフロントエンドがデプロイ完了
- [ ] FRONTEND_URLがVercelのURLに更新済み
- [ ] VITE_WS_URLがRenderのwss URLに設定済み
- [ ] ブラウザでフロントエンドにアクセス可能
- [ ] WebSocket接続が成功（デバッグパネルで確認）
- [ ] カメラ・マイクが動作
- [ ] リアクション検出が動作
- [ ] エフェクトが表示される
- [ ] データベースにデータが記録される

---

## 🎯 次のステップ

デプロイが完了したら:

1. **実験参加者にURLを共有**
   - フロントエンドのVercel URL
   - 実験グループの指定方法を説明

2. **データ収集**
   - 定期的にデータベースを確認
   - 必要に応じてエクスポート

3. **パフォーマンス監視**
   - Renderのログで異常がないか確認
   - 同時接続数が多い場合は有料プランを検討

---

**デプロイ完了おめでとうございます！ 🎉**

問題が発生した場合は、RenderとVercelのログを確認してください。
