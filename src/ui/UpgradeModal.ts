// ============================================================================
// Magnet Junkyard - Interactive Upgrade Modal & Shop UI
// ============================================================================

import Phaser from 'phaser';
import {
  JUNKYARD_TIERS,
  PlayerUpgrades,
  UPGRADE_MAX_LEVEL,
  getUpgradeCost,
  getMagnetRange,
  getAttractPower,
  getCarryCapacity,
  getMovementSpeed,
} from '../config/constants';
import { JunkyardScene } from '../scenes/JunkyardScene';
import { AchievementPanel } from './AchievementPanel';
import { getCrazyGamesSDK } from '../services/crazygames/MockCrazyGamesSDK';
import { PRESTIGE_PERKS, PrestigeManager } from '../services/economy/PrestigeManager';
import { ProceduralAudioService } from '../services/audio/ProceduralAudioService';

export class UpgradeModal {
  private scene: Phaser.Scene;
  private junkyard: JunkyardScene;
  private container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Graphics;
  private isOpen: boolean = false;

  private workshopContainer!: Phaser.GameObjects.Container;
  private achievementPanel!: AchievementPanel;
  private prestigeShopContainer!: Phaser.GameObjects.Container;
  private activeTab: 'workshop' | 'achievements' | 'prestige' = 'workshop';

  private tabWorkshopBg!: Phaser.GameObjects.Graphics;
  private tabWorkshopText!: Phaser.GameObjects.Text;
  private tabAchBg!: Phaser.GameObjects.Graphics;
  private tabAchText!: Phaser.GameObjects.Text;
  private tabPrestigeBg!: Phaser.GameObjects.Graphics;
  private tabPrestigeText!: Phaser.GameObjects.Text;

  private coinText!: Phaser.GameObjects.Text;
  private prestigeTokensText!: Phaser.GameObjects.Text;
  private prestigeActionBtn!: Phaser.GameObjects.Container;
  private prestigeActionBtnText!: Phaser.GameObjects.Text;

  private upgradeButtons: Map<keyof PlayerUpgrades, { btn: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text; costText: Phaser.GameObjects.Text; lvlText: Phaser.GameObjects.Text; valText: Phaser.GameObjects.Text }> = new Map();
  private tierButtons: Map<number, { btn: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text }> = new Map();
  private perkCards: Map<string, { btn: Phaser.GameObjects.Container; btnText: Phaser.GameObjects.Text; lvlText: Phaser.GameObjects.Text; bonusText: Phaser.GameObjects.Text }> = new Map();
  private prestigeBtn!: Phaser.GameObjects.Container;
  private prestigeText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, junkyardScene: JunkyardScene) {
    this.scene = scene;
    this.junkyard = junkyardScene;
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setVisible(false);

    // Fullscreen interactive backdrop blocking inputs to the world
    this.backdrop = this.scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.78);
    this.backdrop.fillRect(0, 0, 1280, 720);
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 1280, 720),
      Phaser.Geom.Rectangle.Contains
    );
    this.container.add(this.backdrop);

    this.buildModal();
  }

  public get visible(): boolean {
    return this.isOpen;
  }

  private buildModal(): void {
    const cx = 640;
    const cy = 360;
    const w = 780;
    const h = 600;

    // Panel Window Base
    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0x13171c, 0.98);
    panelBg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
    panelBg.lineStyle(2, 0x00e5ff, 0.85);
    panelBg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 14);
    this.container.add(panelBg);

    // Tab 1: Workshop Tab Button
    const tab1Btn = this.scene.add.container(cx - w / 2 + 80, cy - h / 2 + 32);
    this.tabWorkshopBg = this.scene.add.graphics();
    this.tabWorkshopText = this.scene.add.text(0, 0, '⚙️ UPGRADES', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    tab1Btn.add([this.tabWorkshopBg, this.tabWorkshopText]);
    tab1Btn.setSize(120, 30);
    tab1Btn.setInteractive({ useHandCursor: true });
    tab1Btn.on('pointerdown', () => this.switchTab('workshop'));
    this.container.add(tab1Btn);

    // Tab 2: Achievements Tab Button
    const tab2Btn = this.scene.add.container(cx - w / 2 + 215, cy - h / 2 + 32);
    this.tabAchBg = this.scene.add.graphics();
    this.tabAchText = this.scene.add.text(0, 0, '🏆 TROPHIES', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#90a4ae',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    tab2Btn.add([this.tabAchBg, this.tabAchText]);
    tab2Btn.setSize(130, 30);
    tab2Btn.setInteractive({ useHandCursor: true });
    tab2Btn.on('pointerdown', () => this.switchTab('achievements'));
    this.container.add(tab2Btn);

    // Tab 3: Prestige Shop Tab Button
    const tab3Btn = this.scene.add.container(cx - w / 2 + 360, cy - h / 2 + 32);
    this.tabPrestigeBg = this.scene.add.graphics();
    this.tabPrestigeText = this.scene.add.text(0, 0, '⭐ PRESTIGE', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#90a4ae',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    tab3Btn.add([this.tabPrestigeBg, this.tabPrestigeText]);
    tab3Btn.setSize(140, 30);
    tab3Btn.setInteractive({ useHandCursor: true });
    tab3Btn.on('pointerdown', () => this.switchTab('prestige'));
    this.container.add(tab3Btn);

    // Coin Counter in Modal Header
    this.coinText = this.scene.add.text(cx + 175, cy - h / 2 + 32, `🪙 ${this.junkyard.coins} COINS`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '15px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.coinText);

    // Close Button [X]
    const closeBtn = this.scene.add.container(cx + w / 2 - 36, cy - h / 2 + 32);
    const closeBg = this.scene.add.graphics();
    closeBg.fillStyle(0x263238, 0.9);
    closeBg.fillCircle(0, 0, 16);
    closeBg.lineStyle(1.5, 0xef5350, 0.9);
    closeBg.strokeCircle(0, 0, 16);
    const closeTxt = this.scene.add.text(0, 0, '✕', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    closeBtn.add([closeBg, closeTxt]);
    closeBtn.setSize(32, 32);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    closeBtn.on('pointerover', () => closeBtn.setScale(1.1));
    closeBtn.on('pointerout', () => closeBtn.setScale(1.0));
    this.container.add(closeBtn);

    // Subtitle Divider
    const div1 = this.scene.add.graphics();
    div1.lineStyle(1, 0x37474f, 0.7);
    div1.lineBetween(cx - w / 2 + 28, cy - h / 2 + 56, cx + w / 2 - 28, cy - h / 2 + 56);
    this.container.add(div1);

    // Container 1: Workshop
    this.workshopContainer = this.scene.add.container(0, 0);
    this.container.add(this.workshopContainer);

    // Container 2: Achievement Panel
    this.achievementPanel = new AchievementPanel(this.scene, this.junkyard, cx, cy, w, h);
    this.container.add(this.achievementPanel.container);
    this.achievementPanel.setVisible(false);

    // Container 3: Prestige Shop
    this.buildPrestigeShop(cx, cy, w, h);

    // 4 Upgrades Cards
    const upgradeStats: { key: keyof PlayerUpgrades; name: string; icon: string; getVal: (lvl: number) => string }[] = [
      { key: 'magnetRange', name: 'MAGNET RANGE', icon: '🧲', getVal: (l) => `${getMagnetRange(l)} px` },
      { key: 'attractPower', name: 'ATTRACT POWER', icon: '⚡', getVal: (l) => `${getAttractPower(l)} px/s²` },
      { key: 'carryCapacity', name: 'CARRY CAPACITY', icon: '🎒', getVal: (l) => `${getCarryCapacity(l)} kg` },
      { key: 'movementSpeed', name: 'ROVER SPEED', icon: '🏎️', getVal: (l) => `${getMovementSpeed(l)} px/s` },
    ];

    const startY = cy - h / 2 + 85;
    const cardH = 58;

    upgradeStats.forEach((stat, i) => {
      const y = startY + i * (cardH + 10);
      const card = this.createUpgradeCard(cx, y, w - 60, cardH, stat);
      this.workshopContainer.add(card);
    });

    // Tier Unlocks Divider & Section
    const tierY = startY + 4 * (cardH + 10) + 10;
    const tierTitle = this.scene.add.text(cx - w / 2 + 32, tierY, '🗺️ UNLOCK JUNKYARD TIERS', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '15px',
      color: '#44dd88',
      fontStyle: 'bold',
    });
    this.workshopContainer.add(tierTitle);

    // 3 Tier Buttons (Tier 2, 3, 4)
    const tiersToUnlock = JUNKYARD_TIERS.filter((t) => t.id > 1);
    const tierBtnW = 225;
    tiersToUnlock.forEach((t, idx) => {
      const bx = cx - w / 2 + 40 + idx * (tierBtnW + 20) + tierBtnW / 2;
      const by = tierY + 42;
      const tCard = this.createTierCard(bx, by, tierBtnW, 46, t);
      this.workshopContainer.add(tCard);
    });

    // Rewarded Ads Boost Section
    const adsY = tierY + 85;
    const adsTitle = this.scene.add.text(cx - w / 2 + 32, adsY, '🎁 CRAZYGAMES REWARDED BOOSTS (FREE)', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '15px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });
    this.workshopContainer.add(adsTitle);

    // Boost 1: 2X Selling Coins
    const adBtn1 = this.createAdButton(cx - 180, adsY + 44, 340, 48, '2X RECYCLE COINS', '🎁 Watch Ad: Double next sell', () => {
      this.junkyard.triggerAdReward('double_coins');
      this.refresh();
    });
    this.workshopContainer.add(adBtn1);

    // Boost 2: Mega Magnet 60s
    const adBtn2 = this.createAdButton(cx + 180, adsY + 44, 340, 48, '⚡ MEGA MAGNET (60s)', '⚡ Watch Ad: Overcharge range & power', () => {
      this.junkyard.triggerAdReward('mega_magnet');
      this.refresh();
    });
    this.workshopContainer.add(adBtn2);

    // Prestige Button (Appears when Tier 4 is unlocked)
    this.prestigeBtn = this.createPrestigeButton(cx, cy + h / 2 - 48);
    this.workshopContainer.add(this.prestigeBtn);

    // Bottom Action: Reset Game
    const resetBtn = this.scene.add.text(cx, cy + h / 2 - 16, '🗑️ Reset Progress to Factory Defaults', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      color: '#78909c',
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });

    resetBtn.on('pointerdown', () => {
      this.showConfirmDialog('Reset all coins, upgrades, and unlocked tiers?', () => {
        this.junkyard.resetGame();
        this.refresh();
      });
    });
    resetBtn.on('pointerover', () => resetBtn.setColor('#ff5252'));
    resetBtn.on('pointerout', () => resetBtn.setColor('#78909c'));
    this.workshopContainer.add(resetBtn);

    this.switchTab('workshop');
  }

  private createUpgradeCard(
    cx: number,
    y: number,
    w: number,
    h: number,
    stat: { key: keyof PlayerUpgrades; name: string; icon: string; getVal: (lvl: number) => string }
  ): Phaser.GameObjects.Container {
    const card = this.scene.add.container(cx, y);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a2129, 0.85);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(1, 0x2e3c48, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    card.add(bg);

    const iconText = this.scene.add.text(-w / 2 + 18, -12, stat.icon, { fontSize: '20px' });
    const nameText = this.scene.add.text(-w / 2 + 52, -14, stat.name, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    });

    const currentLvl = this.junkyard.upgrades[stat.key];
    const lvlText = this.scene.add.text(-w / 2 + 52, 6, `Level ${currentLvl} / ${UPGRADE_MAX_LEVEL}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#00e5ff',
    });

    const valText = this.scene.add.text(-w / 2 + 250, -4, stat.getVal(currentLvl), {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      color: '#b0bec5',
      fontStyle: 'bold',
    });

    // Buy Button Container
    const btnW = 150;
    const btnH = 38;
    const btnX = w / 2 - btnW / 2 - 14;
    const buyBtn = this.scene.add.container(btnX, 0);

    const buyBg = this.scene.add.graphics();
    const buyText = this.scene.add.text(0, -7, 'UPGRADE', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const costText = this.scene.add.text(0, 8, '0 🪙', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      color: '#263238',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    buyBtn.add([buyBg, buyText, costText]);
    buyBtn.setSize(btnW, btnH);
    buyBtn.setInteractive({ useHandCursor: true });

    buyBtn.on('pointerdown', () => {
      const success = this.junkyard.purchaseUpgrade(stat.key);
      if (success) {
        if (this.scene && this.scene.tweens) {
          this.scene.tweens.add({
            targets: buyBtn,
            scaleX: 1.18,
            scaleY: 1.18,
            duration: 75,
            yoyo: true,
            ease: 'Back.out',
          });
        }
        this.refresh();
      }
    });

    card.add([iconText, nameText, lvlText, valText, buyBtn]);

    this.upgradeButtons.set(stat.key, {
      btn: buyBtn,
      text: buyText,
      costText,
      lvlText,
      valText,
    });

    return card;
  }

  private createTierCard(
    x: number,
    y: number,
    w: number,
    h: number,
    tier: { id: number; name: string; unlockCost: number; accentColor: string }
  ): Phaser.GameObjects.Container {
    const card = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a2129, 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.lineStyle(1.5, 0x37474f, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    card.add(bg);

    const text = this.scene.add.text(0, 0, '', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    card.add(text);

    card.setSize(w, h);
    card.setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => {
      this.junkyard.unlockTier(tier.id);
      if (this.scene && this.scene.tweens) {
        this.scene.tweens.add({
          targets: card,
          scaleX: 1.12,
          scaleY: 1.12,
          duration: 75,
          yoyo: true,
          ease: 'Back.out',
        });
      }
      this.refresh();
    });

    this.tierButtons.set(tier.id, { btn: card, text });
    return card;
  }

  private createAdButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    sublabel: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const btn = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1b281f, 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(1.5, 0x00e676, 0.85);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    const t1 = this.scene.add.text(0, -9, label, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      color: '#00e676',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const t2 = this.scene.add.text(0, 9, sublabel, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      color: '#b9f6ca',
    }).setOrigin(0.5, 0.5);

    btn.add([bg, t1, t2]);
    btn.setSize(w, h);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => btn.setScale(1.03));
    btn.on('pointerout', () => btn.setScale(1.0));
    return btn;
  }

  private createPrestigeButton(x: number, y: number): Phaser.GameObjects.Container {
    const btn = this.scene.add.container(x, y);
    const w = 460;
    const h = 38;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x4a148c, 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.lineStyle(1.5, 0xe1bee7, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);

    this.prestigeText = this.scene.add.text(0, 0, '⭐ SCRAP MASTERY PRESTIGE', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    btn.add([bg, this.prestigeText]);
    btn.setSize(w, h);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      const bonusPct = (this.junkyard.prestigeLevel + 1) * 10;
      this.showConfirmDialog(
        `Prestige to Rank ${this.junkyard.prestigeLevel + 1}?\n\nThis will reset your coins, upgrades, and tiers, but grants a permanent +${bonusPct}% coin multiplier on all scrap recycled!`,
        () => {
          this.junkyard.triggerPrestige();
          this.refresh();
        }
      );
    });

    btn.on('pointerover', () => btn.setScale(1.02));
    btn.on('pointerout', () => btn.setScale(1.0));

    return btn;
  }

  private buildPrestigeShop(cx: number, cy: number, w: number, h: number): void {
    this.prestigeShopContainer = this.scene.add.container(0, 0);
    this.container.add(this.prestigeShopContainer);
    this.prestigeShopContainer.setVisible(false);

    const startY = cy - h / 2 + 75;

    // Header info
    const subTitle = this.scene.add.text(cx, startY, '⭐ PERMANENT META-PERKS (PERSIST ACROSS ALL PRESTIGE RESETS)', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      color: '#ce93d8',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.prestigeTokensText = this.scene.add.text(cx, startY + 24, `⭐ AVAILABLE TOKENS: ${this.junkyard.prestigeTokens || 0}`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '17px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.prestigeShopContainer.add([subTitle, this.prestigeTokensText]);

    // Prestige Trigger Banner / Action
    const actionY = startY + 68;
    this.prestigeActionBtn = this.scene.add.container(cx, actionY);
    const pBg = this.scene.add.graphics();
    pBg.fillStyle(0x4a148c, 0.9);
    pBg.fillRoundedRect(-350, -18, 700, 36, 8);
    pBg.lineStyle(1.5, 0xe1bee7, 0.9);
    pBg.strokeRoundedRect(-350, -18, 700, 36, 8);

    this.prestigeActionBtnText = this.scene.add.text(0, 0, '⭐ TRIGGER PRESTIGE RESET (+Tokens)', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.prestigeActionBtn.add([pBg, this.prestigeActionBtnText]);
    this.prestigeActionBtn.setSize(700, 36);
    this.prestigeActionBtn.setInteractive({ useHandCursor: true });
    this.prestigeActionBtn.on('pointerdown', () => {
      if (!this.junkyard.unlockedTiers.includes(4)) {
        alert('Reach Tier 4 (Titanium Ridge) first to unlock Prestige!');
        return;
      }
      const awarded = PrestigeManager.calculateTokensAwarded(
        this.junkyard.achievementManager.getUnlockedCount(),
        this.junkyard.totalScrapCollected
      );
      this.showConfirmDialog(
        `Perform Prestige to Rank ${this.junkyard.prestigeLevel + 1}?\n\n- Awards +${awarded} Prestige Tokens\n- Grants permanent +${(this.junkyard.prestigeLevel + 1) * 10}% coin multiplier\n- Resets tiers, temporary stats, and coins`,
        () => {
          this.junkyard.triggerPrestige();
          this.refresh();
        }
      );
    });
    this.prestigeShopContainer.add(this.prestigeActionBtn);

    // 6 Perks Grid: 2 columns x 3 rows
    const perkDefs = Object.values(PRESTIGE_PERKS);
    const colW = 345;
    const rowH = 92;
    const gridStartY = actionY + 36;

    perkDefs.forEach((perk, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const px = cx - w / 2 + 45 + col * (colW + 15) + colW / 2;
      const py = gridStartY + row * (rowH + 10) + rowH / 2;

      const card = this.createPerkCard(px, py, colW, rowH, perk);
      this.prestigeShopContainer.add(card);
    });
  }

  private createPerkCard(x: number, y: number, w: number, h: number, perk: any): Phaser.GameObjects.Container {
    const card = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1e1e24, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(1.5, 0xba68c8, 0.7);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    const icon = this.scene.add.text(-w / 2 + 24, -h / 2 + 24, perk.icon, { fontSize: '20px' }).setOrigin(0.5, 0.5);

    const name = this.scene.add.text(-w / 2 + 44, -h / 2 + 14, perk.name, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });

    const desc = this.scene.add.text(-w / 2 + 44, -h / 2 + 30, perk.description, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '10px',
      color: '#b0bec5',
      wordWrap: { width: 280 },
    });

    const lvlText = this.scene.add.text(-w / 2 + 44, -h / 2 + 65, 'Lv 0 / 5', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      color: '#ce93d8',
      fontStyle: 'bold',
    });

    const bonusText = this.scene.add.text(-w / 2 + 110, -h / 2 + 65, '+0', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      color: '#80cbc4',
    });

    // Upgrade Button
    const btnContainer = this.scene.add.container(w / 2 - 58, h / 2 - 25);
    const btnBg = this.scene.add.graphics();
    const btnText = this.scene.add.text(0, 0, `+1 (${perk.costTokens} ⭐)`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    btnContainer.add([btnBg, btnText]);
    btnContainer.setSize(95, 28);
    btnContainer.setInteractive({ useHandCursor: true });
    btnContainer.on('pointerdown', () => {
      const bought = this.junkyard.purchasePrestigePerk(perk.id);
      if (bought) {
        this.refresh();
      }
    });

    card.add([bg, icon, name, desc, lvlText, bonusText, btnContainer]);
    this.perkCards.set(perk.id, { btn: btnContainer, btnText, lvlText, bonusText });
    return card;
  }

  public switchTab(tab: 'workshop' | 'achievements' | 'prestige'): void {
    this.activeTab = tab;
    if (!this.tabWorkshopBg || !this.tabAchBg || !this.tabPrestigeBg) return;

    this.tabWorkshopBg.clear();
    this.tabAchBg.clear();
    this.tabPrestigeBg.clear();

    // Reset all tabs to inactive slate style
    const setInactiveTab = (bg: Phaser.GameObjects.Graphics, txt: Phaser.GameObjects.Text, w: number) => {
      bg.fillStyle(0x21272e, 0.85);
      bg.fillRoundedRect(-w / 2, -15, w, 30, 6);
      bg.lineStyle(1, 0x37474f, 0.8);
      bg.strokeRoundedRect(-w / 2, -15, w, 30, 6);
      txt.setColor('#90a4ae');
    };

    setInactiveTab(this.tabWorkshopBg, this.tabWorkshopText, 120);
    setInactiveTab(this.tabAchBg, this.tabAchText, 130);
    setInactiveTab(this.tabPrestigeBg, this.tabPrestigeText, 140);

    this.workshopContainer.setVisible(tab === 'workshop');
    this.achievementPanel.setVisible(tab === 'achievements');
    this.prestigeShopContainer.setVisible(tab === 'prestige');

    if (tab === 'workshop') {
      this.tabWorkshopBg.clear();
      this.tabWorkshopBg.fillStyle(0x00e5ff, 0.95);
      this.tabWorkshopBg.fillRoundedRect(-60, -15, 120, 30, 6);
      this.tabWorkshopText.setColor('#000000');
    } else if (tab === 'achievements') {
      this.achievementPanel.refresh();
      this.tabAchBg.clear();
      this.tabAchBg.fillStyle(0xffd54f, 0.95);
      this.tabAchBg.fillRoundedRect(-65, -15, 130, 30, 6);
      this.tabAchText.setColor('#000000');
    } else if (tab === 'prestige') {
      this.tabPrestigeBg.clear();
      this.tabPrestigeBg.fillStyle(0xba68c8, 0.95);
      this.tabPrestigeBg.fillRoundedRect(-70, -15, 140, 30, 6);
      this.tabPrestigeText.setColor('#000000');
    }
  }

  public open(): void {
    getCrazyGamesSDK().game.gameplayStop();
    this.isOpen = true;
    this.container.setVisible(true);
    this.switchTab(this.activeTab || 'workshop');
    this.refresh();
    ProceduralAudioService.getInstance().playCoinClink(1.3);

    if (this.scene.tweens && typeof this.container.setScale === 'function') {
      this.container.setScale(0.92);
      this.container.setAlpha(0);
      this.scene.tweens.add({
        targets: this.container,
        scale: 1,
        alpha: 1,
        duration: 200,
        ease: 'Back.out',
      });
    }
  }

  public close(): void {
    if (this.scene.tweens && typeof this.container.setScale === 'function') {
      this.scene.tweens.add({
        targets: this.container,
        scale: 0.95,
        alpha: 0,
        duration: 120,
        ease: 'Quad.in',
        onComplete: () => {
          this.isOpen = false;
          this.container.setVisible(false);
          this.container.setScale(1);
          this.container.setAlpha(1);
          getCrazyGamesSDK().game.gameplayStart();
        },
      });
    } else {
      this.isOpen = false;
      this.container.setVisible(false);
      getCrazyGamesSDK().game.gameplayStart();
    }
  }

  public refresh(): void {
    const coins = this.junkyard.coins;
    this.coinText.setText(`🪙 ${coins.toLocaleString()} COINS`);
    if (this.achievementPanel && this.activeTab === 'achievements') {
      this.achievementPanel.refresh();
    }

    // Refresh Prestige Button visibility & label
    const canPrestige = this.junkyard.unlockedTiers.includes(4);
    this.prestigeBtn.setVisible(canPrestige);
    if (canPrestige) {
      const nextBonus = (this.junkyard.prestigeLevel + 1) * 10;
      this.prestigeText.setText(
        `⭐ PRESTIGE (Rank ${this.junkyard.prestigeLevel}) → Reset for Permanent +${nextBonus}% Coins`
      );
    }

    // Refresh Prestige Shop
    if (this.prestigeTokensText) {
      this.prestigeTokensText.setText(`⭐ AVAILABLE TOKENS: ${this.junkyard.prestigeTokens || 0}`);
    }

    if (this.prestigeActionBtn && this.prestigeActionBtnText) {
      const pBg = this.prestigeActionBtn.getAt(0) as Phaser.GameObjects.Graphics;
      pBg.clear();
      if (canPrestige) {
        pBg.fillStyle(0x4a148c, 0.95);
        pBg.fillRoundedRect(-350, -18, 700, 36, 8);
        pBg.lineStyle(1.5, 0xffd54f, 1);
        pBg.strokeRoundedRect(-350, -18, 700, 36, 8);
        const tokensToAward = PrestigeManager.calculateTokensAwarded(
          this.junkyard.achievementManager.getUnlockedCount(),
          this.junkyard.totalScrapCollected
        );
        this.prestigeActionBtnText.setText(
          `⭐ TRIGGER PRESTIGE RESET (Rank ${this.junkyard.prestigeLevel} → ${this.junkyard.prestigeLevel + 1}) | Claim +${tokensToAward} Tokens!`
        );
        this.prestigeActionBtnText.setColor('#ffd54f');
      } else {
        pBg.fillStyle(0x263238, 0.8);
        pBg.fillRoundedRect(-350, -18, 700, 36, 8);
        pBg.lineStyle(1, 0x455a64, 0.7);
        pBg.strokeRoundedRect(-350, -18, 700, 36, 8);
        this.prestigeActionBtnText.setText('🔒 Unlock Tier 4 (Titanium Ridge) to unlock Prestige & earn Tokens');
        this.prestigeActionBtnText.setColor('#90a4ae');
      }
    }

    // Refresh Prestige Perk Cards
    const currentPerks = this.junkyard.prestigePerks || {};
    const tokens = this.junkyard.prestigeTokens || 0;
    this.perkCards.forEach((elements, perkId) => {
      const def = PRESTIGE_PERKS[perkId];
      if (!def) return;
      const lvl = currentPerks[perkId] || 0;
      const isMax = lvl >= def.maxLevel;
      const canAfford = tokens >= def.costTokens && !isMax;

      elements.lvlText.setText(`Lv ${lvl} / ${def.maxLevel}`);
      const currentBonus = PrestigeManager.getPerkBonus(perkId, lvl);
      elements.bonusText.setText(`(+${currentBonus} ${def.unit})`);

      const btnBg = elements.btn.getAt(0) as Phaser.GameObjects.Graphics;
      btnBg.clear();

      if (isMax) {
        btnBg.fillStyle(0x37474f, 0.6);
        btnBg.fillRoundedRect(-47, -14, 95, 28, 5);
        elements.btnText.setText('MAX');
        elements.btnText.setColor('#78909c');
      } else {
        btnBg.fillStyle(canAfford ? 0x7b1fa2 : 0x263238, canAfford ? 0.95 : 0.6);
        btnBg.fillRoundedRect(-47, -14, 95, 28, 5);
        btnBg.lineStyle(1, canAfford ? 0xba68c8 : 0x37474f, 1);
        btnBg.strokeRoundedRect(-47, -14, 95, 28, 5);

        elements.btnText.setText(`+1 (${def.costTokens} ⭐)`);
        elements.btnText.setColor(canAfford ? '#ffffff' : '#78909c');
      }
    });

    // Refresh Upgrade Buttons
    this.upgradeButtons.forEach((elements, key) => {
      const lvl = this.junkyard.upgrades[key];
      const isMax = lvl >= UPGRADE_MAX_LEVEL;
      const cost = getUpgradeCost(key, lvl);
      const canAfford = coins >= cost && !isMax;

      elements.lvlText.setText(`Level ${lvl} / ${UPGRADE_MAX_LEVEL}`);
      
      let valStr = '';
      if (key === 'magnetRange') valStr = `${getMagnetRange(lvl)} px`;
      else if (key === 'attractPower') valStr = `${getAttractPower(lvl)} px/s²`;
      else if (key === 'carryCapacity') valStr = `${getCarryCapacity(lvl)} kg`;
      else if (key === 'movementSpeed') valStr = `${getMovementSpeed(lvl)} px/s`;
      elements.valText.setText(valStr);

      const btnBg = elements.btn.getAt(0) as Phaser.GameObjects.Graphics;
      btnBg.clear();

      if (isMax) {
        btnBg.fillStyle(0x37474f, 0.6);
        btnBg.fillRoundedRect(-75, -19, 150, 38, 6);
        elements.text.setText('MAX LEVEL');
        elements.text.setColor('#78909c');
        elements.costText.setText('—');
      } else {
        btnBg.fillStyle(canAfford ? 0x00e5ff : 0x263238, canAfford ? 0.95 : 0.6);
        btnBg.fillRoundedRect(-75, -19, 150, 38, 6);
        btnBg.lineStyle(1, canAfford ? 0x80d8ff : 0x37474f, 1);
        btnBg.strokeRoundedRect(-75, -19, 150, 38, 6);

        elements.text.setText('UPGRADE');
        elements.text.setColor(canAfford ? '#000000' : '#78909c');
        elements.costText.setText(`${cost.toLocaleString()} 🪙`);
        elements.costText.setColor(canAfford ? '#1a237e' : '#546e7a');
      }
    });

    // Refresh Tier Buttons
    this.tierButtons.forEach((elements, tierId) => {
      const isUnlocked = this.junkyard.unlockedTiers.includes(tierId);
      const tier = JUNKYARD_TIERS.find((t) => t.id === tierId);
      if (!tier) return;

      const canAfford = coins >= tier.unlockCost;
      const btnBg = elements.btn.getAt(0) as Phaser.GameObjects.Graphics;
      btnBg.clear();

      if (isUnlocked) {
        btnBg.fillStyle(0x1b5e20, 0.8);
        btnBg.fillRoundedRect(-112, -23, 225, 46, 6);
        elements.text.setText(`TIER ${tier.id}: UNLOCKED ✅`);
        elements.text.setColor('#a5d6a7');
      } else {
        btnBg.fillStyle(canAfford ? 0xff6f00 : 0x263238, canAfford ? 0.9 : 0.6);
        btnBg.fillRoundedRect(-112, -23, 225, 46, 6);
        btnBg.lineStyle(1.5, canAfford ? 0xffb300 : 0x37474f, 1);
        btnBg.strokeRoundedRect(-112, -23, 225, 46, 6);

        elements.text.setText(`UNLOCK TIER ${tier.id} (${tier.unlockCost} 🪙)`);
        elements.text.setColor(canAfford ? '#ffffff' : '#78909c');
      }
    });
  }

  private showConfirmDialog(message: string, onConfirm: () => void): void {
    const dialogContainer = this.scene.add.container(640, 360);
    dialogContainer.setDepth(9999);

    const overlay = this.scene.add.rectangle(0, 0, 1280, 720, 0x000000, 0.7);
    overlay.setInteractive(); // Block clicks

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x263238, 1);
    bg.fillRoundedRect(-250, -120, 500, 240, 12);
    bg.lineStyle(2, 0x4fc3f7, 1);
    bg.strokeRoundedRect(-250, -120, 500, 240, 12);

    const text = this.scene.add.text(0, -30, message, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 440 }
    }).setOrigin(0.5, 0.5);

    // Yes Button
    const yesBtn = this.scene.add.container(-100, 70);
    const yesBg = this.scene.add.graphics();
    yesBg.fillStyle(0x388e3c, 1);
    yesBg.fillRoundedRect(-60, -20, 120, 40, 6);
    const yesText = this.scene.add.text(0, 0, 'YES', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0.5);
    yesBtn.add([yesBg, yesText]);
    yesBtn.setSize(120, 40);
    yesBtn.setInteractive({ useHandCursor: true });
    yesBtn.on('pointerdown', () => {
      dialogContainer.destroy();
      onConfirm();
    });

    // No Button
    const noBtn = this.scene.add.container(100, 70);
    const noBg = this.scene.add.graphics();
    noBg.fillStyle(0xd32f2f, 1);
    noBg.fillRoundedRect(-60, -20, 120, 40, 6);
    const noText = this.scene.add.text(0, 0, 'NO', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0.5);
    noBtn.add([noBg, noText]);
    noBtn.setSize(120, 40);
    noBtn.setInteractive({ useHandCursor: true });
    noBtn.on('pointerdown', () => dialogContainer.destroy());

    dialogContainer.add([overlay, bg, text, yesBtn, noBtn]);
  }
}
