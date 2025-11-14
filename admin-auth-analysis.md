# 管理者認証が通ってしまう原因の分析

setting.html から authorize.gs の Apps Script に送信しているリクエストには、ログイン中ユーザの `playerId` が常に含まれています。このリクエストを受け取った `authorize.gs` 側では、`buildRequiredPlayerIds` 関数内で `request.playerId` を優先して許可候補に追加しており、`DEFAULT_REQUIRED_PLAYER_ID` の `admin` よりも前に評価されます。そのため管理者以外のユーザであっても、スプレッドシートに該当の `playerId` が登録されている場合は `requiredPlayerIds` にその ID が含まれ、`verifyAdminAccess` のチェックを通過してしまいます。

結果として、`setting.html` 上で管理者のみが閲覧できる想定のコンテンツにも、管理者以外のユーザがアクセスできてしまいます。
