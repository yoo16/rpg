import { NPC } from '../models/npc.js';

export class NpcManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
    }

    async create(mapData, loader) {
        if (!mapData.npcs) return;

        this.mapManager.npcs = [];
        this.mapManager.npcMeshes = [];

        const promises = mapData.npcs.map(async (npcData) => {
            // NPCの生成
            const npc = await NPC.spawn(npcData, loader);
            // NPCをリストに追加
            this.mapManager.npcs.push(npc);
            // NPCのメッシュをリストに追加
            this.mapManager.npcMeshes.push(npc.group);
            // NPCをグループに追加
            this.mapManager.group.add(npc.group);
        });
        // NPCを生成する
        await Promise.all(promises);
    }

    update(delta) {
        this.mapManager.npcs.forEach(npc => npc.update(delta));
    }
}