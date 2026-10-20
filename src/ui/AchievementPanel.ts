// ============================================================================
// Magnet Junkyard - Achievements Trophy Room UI Panel
// ============================================================================

import Phaser from 'phaser';
import { ACHIEVEMENTS_CATALOG, AchievementDef } from '../services/economy/AchievementManager';
import { JunkyardScene } from '../scenes/JunkyardScene';

export class AchievementPanel {
  public container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private junkyard: JunkyardScene;
  private cardContainers: Map<string, { bg: Phaser.GameObjects.Graphics; statusText: Phaser.GameObjects.Text }> = new Map();
  private progressText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, junkyard: JunkyardScene, cx: number, cy: number, w: number, h: number) {
    this.scene = scene;
    this.junkyard = junkyard;
    this.container = this.scene.add.container(0, 0);

    this.buildPanel(cx, cy, w, h);
  }

  private buildPanel(cx: number, cy: number, w: number, h: number): void {
    const startX = cx - w / 2 + 35;
    const startY = cy - h / 2 + 105;
    const cols = 3;
    const cellW = (w - 90) / cols; // ~230px
    const cellH = 92;
    const gapX = 10;
    const gapY = 8;

    ACHIEVEMENTS_CATALOG.forEach((ach, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const cardX = startX + col * (cellW + gapX) + cellW / 2;
      const cardY = startY + row * (cellH + gapY) + cellH / 2;

      const card = this.createAchievementCard(cardX, cardY, cellW, cellH, ach);
      this.container.add(card);
    });

    // Summary progress bar at bottom
    this.progressText = this.scene.add.text(cx, cy + h / 2 - 32, '', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.progressText);
  }

  private createAchievementCard(
    x: number,
    y: number,
    w: number,
    h: number,
    ach: AchievementDef
  ): Phaser.GameObjects.Container {
    const card = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    card.add(bg);

    // Icon (large on left)
    const icon = this.scene.add.text(-w / 2 + 20, -10, ach.icon, {
      fontSize: '24px',
    }).setOrigin(0.5, 0.5);

    // Title
    const title = this.scene.add.text(-w / 2 + 42, -h / 2 + 10, ach.title, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    });

    // Description (word wrap)
    const desc = this.scene.add.text(-w / 2 + 42, -h / 2 + 28, ach.description, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '10px',
      color: '#90a4ae',
      wordWrap: { width: w - 50 },
    });

    // Reward & Status tag
    const rewardText = this.scene.add.text(-w / 2 + 42, h / 2 - 16, `+${ach.rewardCoins} 🪙`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });

    const statusText = this.scene.add.text(w / 2 - 10, h / 2 - 16, '🔒 LOCKED', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '10px',
      color: '#78909c',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    card.add([icon, title, desc, rewardText, statusText]);
    this.cardContainers.set(ach.id, { bg, statusText });

    return card;
  }

  public refresh(): void {
    const unlockedIds = new Set(this.junkyard.achievementManager.getUnlocked());
    let unlockedCount = 0;
    let earnedCoins = 0;

    ACHIEVEMENTS_CATALOG.forEach((ach) => {
      const isUnlocked = unlockedIds.has(ach.id);
      const card = this.cardContainers.get(ach.id);
      if (!card) return;

      const w = 230;
      const h = 92;
      card.bg.clear();

      if (isUnlocked) {
        unlockedCount++;
        earnedCoins += ach.rewardCoins;
        card.bg.fillStyle(0x132e1f, 0.95);
        card.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
        card.bg.lineStyle(1.5, 0x00e676, 0.85);
        card.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);

        card.statusText.setText('✅ UNLOCKED');
        card.statusText.setColor('#00e676');
      } else {
        card.bg.fillStyle(0x181e24, 0.85);
        card.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
        card.bg.lineStyle(1, 0x37474f, 0.6);
        card.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);

        card.statusText.setText('🔒 LOCKED');
        card.statusText.setColor('#78909c');
      }
    });

    if (this.progressText) {
      this.progressText.setText(`🏆 PROGRESS: ${unlockedCount} / ${ACHIEVEMENTS_CATALOG.length} UNLOCKED (+${earnedCoins.toLocaleString()} 🪙 EARNED)`);
    }
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
    if (visible) {
      this.refresh();
    }
  }
}
