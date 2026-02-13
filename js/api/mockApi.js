/**
 * Mock API - サーバー通信をシミュレート
 * 実際の fetch の代わりに Promise と setTimeout を使用
 */

class MockApi {
    /**
     * プレイヤーの初期データを取得
     * @returns {Promise<Object>} プレイヤーデータを含むレスポンス
     */
    static getPlayerInitData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    status: "success",
                    data: {
                        player: {
                            id: "p001",
                            name: "Hero",
                            color: "#00ff00",
                            size: 1.0,
                            position: {
                                x: 0,
                                y: 0,
                                z: 0
                            },
                            stats: {
                                hp: 100,
                                maxHp: 100,
                                attack: 15,
                                defense: 3
                            }
                        }
                    }
                });
            }, 500); // ネットワーク遅延をシミュレート
        });
    }

    /**
     * マップデータを取得
     * @returns {Promise<Object>} マップデータ
     */
    static getMapData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    status: "success",
                    data: {
                        map: {
                            mapId: 1,
                            width: 10,
                            height: 10,
                            tiles: [
                                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                                [1, 0, 0, 0, 0, 0, 0, 1, 2, 1],
                                [1, 0, 0, 0, 0, 0, 0, 1, 2, 1],
                                [1, 0, 0, 1, 1, 0, 0, 0, 0, 1],
                                [1, 0, 0, 1, 0, 0, 0, 0, 0, 1],
                                [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                                [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                                [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                                [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
                                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
                            ],
                            legend: {
                                0: "floor",
                                1: "wall",
                                2: "water"
                            },
                            events: [
                                {
                                    id: "ev001",
                                    type: "npc",
                                    x: 3,
                                    z: 2,
                                    name: "村人",
                                    message: "この先はモンスターが出るぞ。気をつけろ！"
                                },
                                {
                                    id: "ev002",
                                    type: "sign",
                                    x: 6,
                                    z: 3,
                                    message: "【北: 迷いの森】\n危険な場所です"
                                },
                                {
                                    id: "ev003",
                                    type: "heal",
                                    x: 2,
                                    z: 4,
                                    message: "この場所は聖域。体力が全快した！"
                                }
                            ]
                        }
                    }
                });
            }, 300);
        });
    }

    /**
     * ゲーム設定を取得
     * @returns {Promise<Object>} ゲーム設定
     */
    static getGameConfig() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    status: "success",
                    data: {
                        config: {
                            gameTitle: "Web 3D RPG",
                            version: "1.0.0",
                            maxPlayers: 1
                        }
                    }
                });
            }, 200);
        });
    }

    /**
     * 敵データを取得
     * @returns {Promise<Object>} 敵データ
     */
    static getEnemyData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    status: "success",
                    data: {
                        enemy: {
                            id: "e001",
                            name: "Red Slime",
                            color: "#ff0000",
                            scale: 1.5,
                            position: {
                                x: 0,
                                y: 0.5,
                                z: 0
                            },
                            stats: {
                                hp: 40,
                                maxHp: 40,
                                attack: 8,
                                defense: 1
                            }
                        }
                    }
                });
            }, 300);
        });
    }
}
