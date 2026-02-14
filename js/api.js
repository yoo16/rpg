/**
 * Real API - Fetch API を使用したサーバー通信
 * PHP API からデータを取得する
 */

export default class GameApi {
    /**
     * APIのベースURL（初期値、get_config.php から上書きされます）
     */
    static BASE_URL = './api';

    /**
     * 設定を初期化（アプリケーション起動時に呼び出す）
     * @returns {Promise<void>}
     */
    static async initConfig() {
        try {
            const response = await fetch('./api/get_config.php');
            if (!response.ok) {
                console.warn('⚠️ 設定ファイルの読み込みに失敗。デフォルト設定を使用します。');
                return;
            }

            const data = await response.json();
            if (data.status === 'success' && data.data.config.baseUrl) {
                this.BASE_URL = data.data.config.baseUrl;
                console.log(`%c⚙️ 設定を読み込みました: BASE_URL = ${this.BASE_URL}`, 'color: #00ccff; font-weight: bold;');
                return data.data.config;
            }
        } catch (error) {
            console.warn('⚠️ 設定の読み込みエラー:', error);
        }
    }

    /**
     * マップデータを取得
     * @param {number} mapId - マップID
     * @returns {Promise<Object>} マップデータ
     */
    static async getMapData(mapId = 1) {
        try {
            const response = await fetch(`${this.BASE_URL}/get_map.php?id=${mapId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('%c🗺️ マップデータを取得しました', 'color: #0f0; font-weight: bold;');
            return data;
        } catch (error) {
            console.error('❌ マップデータ取得エラー:', error);
            throw error;
        }
    }

    /**
     * 敵マスターデータを取得
     * @returns {Promise<Object>} 敵データ
     */
    static async getEnemyData() {
        try {
            const response = await fetch(`${this.BASE_URL}/get_enemies.php`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('%c👹 敵マスターデータを取得しました', 'color: #ff6600; font-weight: bold;');
            return data;
        } catch (error) {
            console.error('❌ 敵データ取得エラー:', error);
            throw error;
        }
    }

    /**
     * プレイヤーの初期データを取得
     * @returns {Promise<Object>} プレイヤーデータ
     */
    static async getPlayerInitData() {
        try {
            // プレイヤーデータはサーバーから取得（現在はクライアント側で定義）
            const playerData = {
                status: 'success',
                data: {
                    player: {
                        id: 'p001',
                        name: '勇者',
                        color: '#ff0000',
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
            };
            console.log('%c👤 プレイヤーデータを初期化しました', 'color: #0f0; font-weight: bold;');
            return playerData;
        } catch (error) {
            console.error('❌ プレイヤーデータ取得エラー:', error);
            throw error;
        }
    }
}
