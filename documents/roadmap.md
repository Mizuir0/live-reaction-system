1. YouTube 埋め込み + 初期画面/視聴画面の切り替え 

* 初期画面で userId を発行して localStorage に保存 

  * 後の WebSocket・DB の user_id にそのまま使える 

* 視聴画面に最低限の UI を用意 

  * YouTube プレイヤー 

  * Canvas（まだ描画しないけど DOM だけ置いておく） 

  * 画面下に「リアクション送信：OFF/ON」（後で ON になる） 

2.  カメラ取得 + MediaPipe でステート型，イベント型リアクション1種類ずつログ出し 

  1.  カメラ取得（getUserMedia）だけ先にやる 

    * まずは <video> に生映像が映ることを確認 

  2. MediaPipe をつないで「顔 or ポーズのランドマークが取れているか」を確認 

    * ランドマーク座標をコンソールに出す 

  3. ステート型1種類（例：isSmiling）だけ実装 

    * 画面に isSmiling: true/false と文字表示 

  4. イベント型1種類（例：nod）だけ実装 

    * 直近1秒の回数を数字で表示（nod: 2 みたいな感じ） 

さらに： 

  * デバッグ用オーバーレイ 
  Canvas  か別の <canvas> でランドマークを描いておくと、判定ロジック調整がめちゃくちゃ楽。 

3. WebSocket で C→S の送信（1秒ごとに JSON）

* 最初はサーバー側で「受け取った JSON をそのまま echo して返す」だけの実装にする 

  * クライアント側で「送った内容」と「サーバーから返ってきた内容」を両方画面に表示しておくと、シリアライズ・時刻・userId ミスに気づきやすいです。 

* 1秒ごとの送信タイマーと、0.1〜0.2秒ごとの検出更新タイマーをきちんと分けておく 

  * 例：updateReactionState() は0.1秒ごと、sendToServer() は1秒ごと 

4.  サーバー側で3秒窓の集約 + if 文でエフェクト判定 

実装イメージ： 

* ユーザごとに deque または単純な配列で「直近3つ分のサンプル」を持つ 

  * 1秒ごと送信なので、3秒窓 = 最新3件で OK 
 
* 集約のタイミングは1秒ごと（asyncio.sleep(1) 的なループ） 

ロジック： 

  1. 3秒以内にデータがある userId を「有効ユーザー」とみなす 

  2. ステート型 

    * ratio_state[x] = true のユーザー数 / 有効ユーザー数 

  3. イベント型 

    * density_event[x] = 合計カウント / (有効ユーザー数 * 3秒) 

最初は条件も超シンプルで OK です： 

* sparkle: ratio_state["isSmiling"] >= 0.3 なら intensity = ratio_state 

5. S→C エフェクト指示 + Canvas で1種類のエフェクト表示 

おすすめの進め方： 

  1. サーバー側は「ダミーで一定間隔で sparkle を送る」コードから始める 

  2. クライアント側で onmessage を受けて、currentEffect オブジェクトに保存 

  3. requestAnimationFrame のループで currentEffect を見ながら Canvas に描画 

sparkle の中身は本当に適当で OK： 

* 画面周りに小さい円をランダムに描く 

* intensity が大きいほど「粒の数とスピード」が増える 

Canvas 部分だけ別の小さなサンプルページを作って、YouTube なしでも動作確認できるようにしておくと、デバッグが楽。

6. 2〜3種類のリアクション＆エフェクトに拡張 

この時点でやること： 

* ステート型を +1〜2種類（例：isConcentrating） 

* イベント型を +1〜2種類（例：swayVertical） 

* エフェクトを +1〜2種類（例：wave, clapping_icons） 

実装のコツ： 

* サーバー側の「優先順位」を先に決めておく 

例：wave > sparkle > clapping_icons 

* intensity の計算ルールを全部「0〜1に収まるようにする」 

後から「intensity をそのまま粒子数や透明度に掛ける」だけで済むようにする 

7.  ログを DB に INSERT（リアクション/エフェクト） 

ここは評価実験に直結する重要パートなので、早めに最低限だけ実装しておくのもアリ（6と並行でも OK）。 

* すでにシステム設計書にあるテーブル定義で十分： 

  * users 

  * reactions_log 

  * effects_log 

* 実装の注意： 

  * WebSocket 受信のたびに同期的に INSERT すると重くなる可能性があるので、 

    * まずは素直に同期 INSERT 

    * 重くなったら「メモリバッファに溜めて一定間隔でまとめてINSERT」の形にする 