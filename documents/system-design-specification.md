0. システム概要（MVP） 

* 目的 

視聴者の自然なリアクション（表情・動き・音声）をクライアントで検出し、サーバーで集約して、盛り上がりに応じたエフェクトを YouTube ライブ画面の周囲に表示する Web アプリを実装する。 

* 方針 

    * Zero-effort participation：カメラの前で普通に楽しむだけで反映される 

    * プライバシー：生の映像・音声はサーバーに送らず、検出結果のみ送信 

    * シンプル実装：   

        * Redis なし 

        * 時刻同期・seq 番号などの高度な同期は行わない 

        * リアクション種類・エフェクト種類は最小限から始める 

1.  システム構成・技術スタック 

1.1 コンポーネント 

フロントエンド（ブラウザ） 

* React + TypeScript 

* YouTube IFrame Player API（ライブ埋め込み） 

* MediaPipe（Face, Pose） 

* Canvas 2D API（エフェクト描画） 

* WebSocket  クライアント 

バックエンド 

* Python + FastAPI 

* WebSocket サーバー（/ws） 

* 集約・判定ロジック（メモリ上の簡単なバッファ） 

* DB：SQLite 

2.  画面・UX（MVP） 

2.1 画面構成 

    1. 初期画面   

        * YouTube Live の URL 入力フォーム（テキストボックス + 「視聴開始」ボタン） 
        * 「カメラ」の利用許可ダイアログ（ブラウザの許可要求を呼び出す） 

    2. 視聴画面   

        * 中央：YouTube ライブプレイヤー 

        * 周囲：Canvas 要素（エフェクト描画領域） 
 
        * 画面下部：簡易ステータス   

            * 「リアクション送信中 / オフ」 

3. クライアント側リアクション検出 

3.1 共通仕様 

* カメラから入力ストリームを取得 

* 検出更新頻度：0.1〜0.2秒ごと（5〜10fps） 

* 各フレームで MediaPipe を用いて状態更新 

* 送信頻度：1秒ごとに直近1秒の集計結果をサーバーへ送信 

3.2 検出するリアクション（MVP） 

State 型（bool） 

1. isSmiling（笑顔） 

2. isSurprised（驚き） 

3. isConcentrating（集中）

4. isHandUp（手を上げている）

Event 型（カウント） 

1. nod（頷き） 

2. shakeHead（頭の横揺れ） 

3. swayVertical（体の縦揺れ） 

4. swayHorizontal（体の横揺れ） 

3.3 判定ロジック（シンプル版） 

※数値はすべて「仮の初期値」。実装後に実験で調整。 

* 共通前処理   

    * 顔/ポーズ座標は顔の大きさ or 肩幅で正規化 

    * 2〜3フレームの移動平均でノイズ除去 

State 判定 

* isSmiling   

    * MediaPipe BlendShapes  が閾値以上 

    * 例：両方とも0.5以上の状態が連続3フレーム続いたら true 

* isSurprised   

    * eyeWideLeft, eyeWideRight, mouthOpen がすべて閾値以上 

    * 例：各0.55以上が3フレーム継続したら true 

* isConcentrating   

    * browDownLeft, browDownRig が閾値以上 

    * 例：両方0.5以上 + 直近1秒の頭部の動きが小さい場合に true 

* isHandUp   

    * Pose の wrist_y < shoulder_y - Δ となるとき 

    * Δ は肩幅の0.15倍程度、3フレーム継続で true 

Event 判定 

* nod（頷き）   

    * 顔の中心 y 座標が「DOWN → UP」の一往復をしたら1カウント 

    * DOWN/UP の閾値は顔サイズの0.08倍程度 

    * 一往復の時間が0.2〜0.9秒のときのみカウント 

* swayVertical（体の縦揺れ）   

    * 両肩中心の y 座標が DOWN→UP で一往復したら1カウント 

    * 頻度1〜3Hz 程度の揺れのみを対象とする（極端に遅い/速い揺れは無視） 

4. 通信仕様（WebSocket / JSON） 

4.1 クライアント → サーバー（C→S） 

* 送信タイミング：1秒ごと 

* 内容：現在の State（最後のフレームの状態）と、直近1秒の Event 回数 

{ 

    "userId": "user-abc-123", 

    "timestamp": 1699999999999,      // ms  単位  UNIX time（クライアント側） 

    "states": { 

        "isSmiling": true, 

        "isSurprised": false, 

        "isConcentrating": true, 

        "isHandUp": false}, 

    "events": { 

        "nod": 1, 

        "swayVertical": 0, 

        "cheer": 0, 

        "clap": 2 

    } 

} 

4.2 サーバー → クライアント（S→C） 

* 全クライアントにブロードキャスト 

* 1つのメッセージにつき1種類のエフェクト指示 

{ 

    "effectType": "sparkle",                  // "wave"  など 

 
 
    "intensity": 0.6,                                // 0.0〜1.0 

    "durationMs": 2000,                            //  表示時間 

    "timestamp": 1699999999999              //  サーバー側送信時刻 

} 

※開始時刻の補正や priority などは MVP では導入しない。 

5. サーバー側集約・判定ロジック 

5.1 集約窓 

* 時間窓：直近3秒  のデータを使用 

* 集約処理：1秒ごとに実行（asyncio のループなどで） 

5.2 集計方法 

    1. 3秒以内に送信があった userId を「有効ユーザー」とみなす 

    2. 各 State について 

    ratio_state[x] = 真 (true) のユーザー数 / 有効ユーザー数 

    3. 各 Event について 

    density_event[x] = 合計カウント / (有効ユーザー数  * 3秒) 

5.3 発火条件（MVP の例） 

* sparkle（笑顔エフェクト）   

    * 条件: ratio_state["isSmiling"] >= 0.35 

    * intensity: ratio_state["isSmiling"] をそのまま 

* wave（縦揺れエフェクト）   

    * 条件: density_event["swayVertical"] >= 0.25 

    * intensity: density_event["swayVertical"] 

※複数条件が成立したら、「優先順位は固定」（例：nod > smile > sway）として一つだけ送出。 

6. エフェクト表示（クライアント） 

* 描画：Canvas 2D API 

* effectType に応じて、以下のような簡単な表現を実装   

    * sparkle：画面周囲に小さなキラキラが散る 

    * clapping_icons：手のアイコンが上下にポンポン出る 

    * wave：画面上下に波打つリボン風の帯 

* intensity の使い方（共通）   

    * 描画数（粒子数） 

    * 移動速度 

    * アルファ値（透明度）を線形にスケーリングするだけのシンプルな実装 

7. データベース設計（MVP） 

7.1 保存方針 

* 実験評価で必要になる最低限のログのみ保存   

    1. 被験者情報（どの群か） 

    2. クライアント→サーバーのリアクションログ 

    3. サーバー→クライアントのエフェクトログ 

7.2 テーブル定義（例：SQLite） 

CREATE TABLE users ( 

    id TEXT PRIMARY KEY, 

    experiment_group TEXT NOT NULL,    -- 'experimental' / 'placebo' / 'control' 

    created_at INTEGER NOT NULL            -- ms 

); 

CREATE TABLE reactions_log ( 

    id INTEGER PRIMARY KEY AUTOINCREMENT, 

    user_id TEXT NOT NULL, 

    timestamp INTEGER NOT NULL,            -- ms (サーバー受信時) 

    is_smiling BOOLEAN, 

    is_surprised BOOLEAN, 

    is_concentrating BOOLEAN, 

    is_hand_up BOOLEAN, 

    nod_count INTEGER DEFAULT 0, 

    sway_vertical_count INTEGER DEFAULT 0, 

    cheer_count INTEGER DEFAULT 0, 

    clap_count INTEGER DEFAULT 0, 

    FOREIGN KEY (user_id) REFERENCES users(id) 

); 

CREATE TABLE effects_log ( 

    id INTEGER PRIMARY KEY AUTOINCREMENT, 

    timestamp INTEGER NOT NULL,            -- ms 

    effect_type TEXT NOT NULL, 

    intensity REAL NOT NULL, 

 
 
 
    duration_ms INTEGER NOT NULL 

); 

8. 余裕があれば実装 

* 初期画面でカメラ・マイクが許可されなかったときに視聴のみモードに移行する 

* Web Audio API を使って歓声と手拍子を検知する 

Event 判定 

    * cheer（歓声）   

        * Web Audio API の RMS 音量が一定以上 + 1〜4kHz帯域のエネルギー比が上昇したフレームがあった場合1カウント 

        * 同じ0.5秒内で重複カウントしないようクールダウンを入れる 

    * clap（手拍子）   

        * getByteTimeDomainData から得られる波形で、短時間の急激な音量ピークを検出したら1カウント 

        * 「立ち上がりが急」「すぐ減衰する」というパターンにマッチした場合のみカウント 

        * こちらも0.2〜0.4秒のクールダウンを入れる 

発火条件 

    * clapping_icons（手拍子アイコン）   

        * 条件: density_event["clap"] >= 0.3 

        * intensity: min(1.0, density_event["clap"] / 0.8) 

* 複数の発火条件を満たした場合は特殊なエフェクト or エフェクトが重複するようにする 
