// ============================================================================
// Magnet Junkyard - UI Overlay Scene (Decoupled HUD & Virtual Joystick)
// ============================================================================

import Phaser from 'phaser';
import { CargoState, GAME_CONSTANTS, JUNKYARD_TIERS } from '../config/constants';
import { UpgradeModal } from '../ui/UpgradeModal';
import { JunkyardScene } from './JunkyardScene';
import { ComboState } from '../services/economy/ComboManager';
import { getCrazyGamesSDK } from '../services/crazygames/MockCrazyGamesSDK';
import { ProceduralAudioService } from '../services/audio/ProceduralAudioService';
import { DailyLoginManager } from '../services/persistence/DailyLoginManager';
import { SaveManager } from '../services/persistence/SaveManager';
import { TutorialOverlay } from '../ui/TutorialOverlay';

export class UIScene extends Phaser.Scene {
  private upgradeModal!: UpgradeModal;
  public tutorialOverlay?: TutorialOverlay;

  // Input Vectors
  private joystickVector: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
  private keyboardVector: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
  private unifiedVector: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);

  // Audio, Screen Shake & Compass Navigation
  private audioBtnContainer!: Phaser.GameObjects.Container;
  private audioIconText!: Phaser.GameObjects.Text;
  private musicBtnContainer!: Phaser.GameObjects.Container;
  private musicIconText!: Phaser.GameObjects.Text;
  private shakeBtnContainer!: Phaser.GameObjects.Container;
  private shakeIconText!: Phaser.GameObjects.Text;
  private isScreenShakeOn: boolean = true;
  private compassContainer!: Phaser.GameObjects.Container;
  private compassArrow!: Phaser.GameObjects.Graphics;
  private compassDistText!: Phaser.GameObjects.Text;

  // Active Pulse Ability UI
  private pulseBtnContainer!: Phaser.GameObjects.Container;
  private pulseBtnBg!: Phaser.GameObjects.Graphics;
  private pulseCooldownFill!: Phaser.GameObjects.Graphics;
  private pulseStatusText!: Phaser.GameObjects.Text;
  private keySpace!: Phaser.Input.Keyboard.Key;

  // Daily Login Retention Modal
  private dailyLoginManager: DailyLoginManager = new DailyLoginManager();
  private dailyLoginModalContainer!: Phaser.GameObjects.Container;

  // Virtual Joystick Elements
  private joystickContainer!: Phaser.GameObjects.Container;
  private joystickBase!: Phaser.GameObjects.Graphics;
  private joystickThumb!: Phaser.GameObjects.Graphics;
  private activeJoystickPointerId: number | null = null;
  private joystickOrigin: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);

  // Keyboard Keys (WASD + ZQSD / AZERTY + Arrow Keys)
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyZ!: Phaser.Input.Keyboard.Key;
  private keyQ!: Phaser.Input.Keyboard.Key;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // HUD Elements
  private cargoBarBg!: Phaser.GameObjects.Graphics;
  private cargoBarFill!: Phaser.GameObjects.Graphics;
  private cargoText!: Phaser.GameObjects.Text;
  private cargoFullWarning!: Phaser.GameObjects.Container;
  private coinText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Sprite;
  private tierBadgeText!: Phaser.GameObjects.Text;
  private tierPillBg!: Phaser.GameObjects.Graphics;

  // Dynamic Combo & Fever HUD Elements
  private comboContainer!: Phaser.GameObjects.Container;
  private comboBg!: Phaser.GameObjects.Graphics;
  private comboText!: Phaser.GameObjects.Text;
  private comboTimerBar!: Phaser.GameObjects.Graphics;
  private feverBannerContainer!: Phaser.GameObjects.Container;
  private feverBannerBg!: Phaser.GameObjects.Graphics;
  private feverBannerText!: Phaser.GameObjects.Text;
  private currentComboState: ComboState | null = null;

  // Prestige & Challenge HUD
  private prestigeBadgeText!: Phaser.GameObjects.Text;
  private challengeContainer!: Phaser.GameObjects.Container;
  private challengeText!: Phaser.GameObjects.Text;
  private offlineModalContainer!: Phaser.GameObjects.Container;

  // Cached state for rendering
  private lastDisplayedCoins: number = 0;
  private isWarningActive: boolean = false;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Ensure this overlay renders on top of the world scene
    this.scene.bringToTop();

    this.setupKeyboardInput();
    this.setupVirtualJoystick();
    this.setupHUD();
    this.setupComboAndFeverHUD();
    this.setupPrestigeBadge();
    this.setupChallengeBanner();
    this.setupAudioToggle();
    this.setupMusicToggle();
    this.setupScreenShakeToggle();
    this.setupCompass();
    this.setupPulseButton();
    this.checkDailyLoginReward();
    this.tutorialOverlay = new TutorialOverlay(this);

    this.events.on('shutdown', this.shutdown, this);

    // Listen for events from JunkyardScene
    const junkyard = this.scene.get('JunkyardScene') as JunkyardScene;
    if (junkyard) {
      this.upgradeModal = new UpgradeModal(this, junkyard);
      this.setupShopButton();

      junkyard.events.on('cargo-updated', this.updateCargoDisplay, this);
      junkyard.events.on('coins-updated', this.updateCoinsDisplay, this);
      junkyard.events.on('tier-updated', this.updateTierDisplay, this);
      junkyard.events.on('buff-activated', this.showBuffToast, this);
      junkyard.events.on('combo-updated', this.updateComboDisplay, this);
      junkyard.events.on('fever-started', this.handleFeverStarted, this);
      junkyard.events.on('fever-ended', this.handleFeverEnded, this);
      junkyard.events.on('combo-expired', this.handleComboExpired, this);
      junkyard.events.on('prestige-updated', this.updatePrestigeDisplay, this);
      junkyard.events.on('challenge-updated', this.updateChallengeDisplay, this);
      junkyard.events.on('hazard-hit', this.onHazardHit, this);
      junkyard.events.on('hazard-repelled', this.onHazardRepelled, this);
      junkyard.events.on('offline-earnings', this.onOfflineEarnings, this);
      junkyard.events.on('screenshake-toggled', this.onScreenShakeToggled, this);

      // If JunkyardScene is already initialized, sync initial values immediately
      if (junkyard.playerRover && junkyard.playerRover.cargo) {
        this.updateCargoDisplay(junkyard.playerRover.cargo);
        this.updateCoinsDisplay(junkyard.coins || 0);
        const lastTier = junkyard.unlockedTiers ? junkyard.unlockedTiers[junkyard.unlockedTiers.length - 1] : 1;
        this.updateTierDisplay(lastTier);
      }
      if (junkyard.comboManager) {
        this.updateComboDisplay(junkyard.comboManager.getState());
      }
      if (junkyard.prestigeLevel !== undefined) {
        this.updatePrestigeDisplay(junkyard.prestigeLevel);
      }
      if (junkyard.challengeManager) {
        this.updateChallengeDisplay(junkyard.challengeManager.getState());
      }
    }
  }

  // --------------------------------------------------------------------------
  // Keyboard Input Handling
  // --------------------------------------------------------------------------
  private setupKeyboardInput(): void {
    if (!this.input.keyboard) return;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keySpace.on('down', () => {
      this.triggerPulseAction();
    });
  }

  // --------------------------------------------------------------------------
  // Virtual Joystick Setup (52px radius, 8px deadzone)
  // --------------------------------------------------------------------------
  private setupVirtualJoystick(): void {
    this.joystickContainer = this.add.container(0, 0);
    this.joystickContainer.setVisible(false);
    this.joystickContainer.setDepth(100);

    // Joystick Base Outer Circle
    this.joystickBase = this.add.graphics();
    this.joystickBase.fillStyle(0x001e28, 0.45);
    this.joystickBase.fillCircle(0, 0, GAME_CONSTANTS.JOYSTICK_RADIUS);
    this.joystickBase.lineStyle(2.5, 0x00e5ff, 0.65);
    this.joystickBase.strokeCircle(0, 0, GAME_CONSTANTS.JOYSTICK_RADIUS);

    // Joystick Center Deadzone Indicator
    this.joystickBase.lineStyle(1, 0x00e5ff, 0.25);
    this.joystickBase.strokeCircle(0, 0, GAME_CONSTANTS.JOYSTICK_DEADZONE);

    // Joystick Thumb Knob
    this.joystickThumb = this.add.graphics();
    this.joystickThumb.fillStyle(0x00e5ff, 0.8);
    this.joystickThumb.fillCircle(0, 0, 22);
    this.joystickThumb.lineStyle(2, 0xffffff, 0.9);
    this.joystickThumb.strokeCircle(0, 0, 22);

    this.joystickContainer.add([this.joystickBase, this.joystickThumb]);

    // Touch / Pointer Listeners
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Disambiguate: Only trigger on touches in the bottom or left 75% of screen, away from top HUD
      if (pointer.y < 90) return;
      if (this.activeJoystickPointerId !== null) return;

      this.tweens.killTweensOf(this.joystickContainer);

      this.activeJoystickPointerId = pointer.id;
      this.joystickOrigin.set(pointer.x, pointer.y);
      this.joystickContainer.setPosition(pointer.x, pointer.y);
      this.joystickThumb.setPosition(0, 0);
      this.joystickContainer.setAlpha(1);
      this.joystickContainer.setVisible(true);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.activeJoystickPointerId !== pointer.id) return;

      const dx = pointer.x - this.joystickOrigin.x;
      const dy = pointer.y - this.joystickOrigin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < GAME_CONSTANTS.JOYSTICK_DEADZONE) {
        this.joystickVector.set(0, 0);
        this.joystickThumb.setPosition(0, 0);
        return;
      }

      const clampedDist = Math.min(GAME_CONSTANTS.JOYSTICK_RADIUS, dist);
      const angle = Math.atan2(dy, dx);

      // Clamp knob visual
      this.joystickThumb.setPosition(
        Math.cos(angle) * clampedDist,
        Math.sin(angle) * clampedDist
      );

      // Normalized vector [0..1]
      const strength = Math.min(1.0, (dist - GAME_CONSTANTS.JOYSTICK_DEADZONE) / (GAME_CONSTANTS.JOYSTICK_RADIUS - GAME_CONSTANTS.JOYSTICK_DEADZONE));
      this.joystickVector.set(Math.cos(angle) * strength, Math.sin(angle) * strength);
    });

    const resetJoystick = (pointer: Phaser.Input.Pointer) => {
      if (this.activeJoystickPointerId === pointer.id) {
        this.activeJoystickPointerId = null;
        this.joystickVector.set(0, 0);
        this.tweens.killTweensOf(this.joystickContainer);
        this.tweens.add({
          targets: this.joystickContainer,
          alpha: 0,
          duration: 120,
          onComplete: () => {
            this.joystickContainer.setVisible(false);
          },
        });
      }
    };

    this.input.on('pointerup', resetJoystick);
    this.input.on('pointerupoutside', resetJoystick);
  }

  // --------------------------------------------------------------------------
  // HUD Elements Setup
  // --------------------------------------------------------------------------
  private setupHUD(): void {
    // 1. Junkyard Tier Badge (Top-Left)
    this.tierPillBg = this.add.graphics();
    this.tierPillBg.fillStyle(0x1a1816, 0.85);
    this.tierPillBg.fillRoundedRect(20, 16, 260, 36, 8);
    this.tierPillBg.lineStyle(1.5, 0x44dd88, 0.7);
    this.tierPillBg.strokeRoundedRect(20, 16, 260, 36, 8);

    this.tierBadgeText = this.add.text(34, 25, 'TIER 1: THE RUSTED BASIN', {
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
      color: '#44dd88',
      fontStyle: 'bold',
    });

    // 2. Cargo Capacity Gauge (Top-Center)
    const centerX = 640;
    const barWidth = 320;
    const barHeight = 24;

    this.cargoBarBg = this.add.graphics();
    this.cargoBarBg.fillStyle(0x14181d, 0.9);
    this.cargoBarBg.fillRoundedRect(centerX - barWidth / 2, 16, barWidth, barHeight, 6);
    this.cargoBarBg.lineStyle(1.5, 0x37474f, 0.9);
    this.cargoBarBg.strokeRoundedRect(centerX - barWidth / 2, 16, barWidth, barHeight, 6);

    this.cargoBarFill = this.add.graphics();
    this.updateCargoBarFill(0, 6, false);

    this.cargoText = this.add.text(centerX, 28, 'CARGO: 0.0 / 6.0 KG', {
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.cargoText.setOrigin(0.5, 0.5);

    // Full Cargo Warning Banner
    this.cargoFullWarning = this.add.container(centerX, 58);
    const warnBg = this.add.graphics();
    warnBg.fillStyle(0xd50000, 0.9);
    warnBg.fillRoundedRect(-140, -12, 280, 24, 6);
    warnBg.lineStyle(1, 0xff8a80, 1);
    warnBg.strokeRoundedRect(-140, -12, 280, 24, 6);

    const warnText = this.add.text(0, 0, '⚠️ CARGO FULL! GO TO RECYCLER', {
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    warnText.setOrigin(0.5, 0.5);

    this.cargoFullWarning.add([warnBg, warnText]);
    this.cargoFullWarning.setVisible(false);

    // 3. Coin Display Counter (Top-Right)
    const rightX = 1260;
    const coinBg = this.add.graphics();
    coinBg.fillStyle(0x1a1816, 0.85);
    coinBg.fillRoundedRect(rightX - 220, 16, 200, 36, 8);
    coinBg.lineStyle(1.5, 0xffd54f, 0.7);
    coinBg.strokeRoundedRect(rightX - 220, 16, 200, 36, 8);

    this.coinIcon = this.add.sprite(rightX - 200, 34, 'coin_icon');
    this.coinIcon.setScale(1.1);

    this.coinText = this.add.text(rightX - 180, 25, '0 COINS', {
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '16px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });
  }

  // --------------------------------------------------------------------------
  // Dynamic Combo & Fever HUD Setup
  // --------------------------------------------------------------------------
  private setupComboAndFeverHUD(): void {
    // 1. Combo Meter Widget (Top-Left below Tier badge, x: 20, y: 58)
    this.comboContainer = this.add.container(20, 58);
    this.comboContainer.setDepth(90);

    this.comboBg = this.add.graphics();
    this.comboTimerBar = this.add.graphics();

    this.comboText = this.add.text(130, 15, '', {
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.comboText.setOrigin(0.5, 0.5);

    this.comboContainer.add([this.comboBg, this.comboTimerBar, this.comboText]);
    this.comboContainer.setVisible(false);

    // 2. Fever Banner (Top-Center, x: 640, y: 88)
    this.feverBannerContainer = this.add.container(640, 88);
    this.feverBannerContainer.setDepth(95);

    this.feverBannerBg = this.add.graphics();
    this.feverBannerText = this.add.text(0, 0, '🔥 FEVER MODE! 5x COINS (10s) 🔥', {
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.feverBannerText.setOrigin(0.5, 0.5);

    this.feverBannerContainer.add([this.feverBannerBg, this.feverBannerText]);
    this.feverBannerContainer.setVisible(false);
  }

  // --------------------------------------------------------------------------
  // Update Callbacks
  // --------------------------------------------------------------------------
  public updateCargoDisplay(cargo: CargoState): void {
    this.updateCargoBarFill(cargo.currentMassKg, cargo.maxCapacityKg, cargo.isFull);
    this.cargoText.setText(
      `CARGO: ${cargo.currentMassKg.toFixed(1)} / ${cargo.maxCapacityKg.toFixed(1)} KG (${cargo.itemsCount})`
    );

    if (cargo.isFull && !this.isWarningActive) {
      this.isWarningActive = true;
      this.cargoFullWarning.setVisible(true);
      this.tweens.add({
        targets: this.cargoFullWarning,
        alpha: { from: 1, to: 0.35 },
        duration: 250,
        yoyo: true,
        repeat: -1,
      });
    } else if (!cargo.isFull && this.isWarningActive) {
      this.isWarningActive = false;
      this.tweens.killTweensOf(this.cargoFullWarning);
      this.cargoFullWarning.setAlpha(1);
      this.cargoFullWarning.setVisible(false);
    }
  }

  private updateCargoBarFill(current: number, max: number, isFull: boolean): void {
    this.cargoBarFill.clear();
    const centerX = 640;
    const barWidth = 320;
    const barHeight = 24;
    const innerWidth = barWidth - 4;
    const innerHeight = barHeight - 4;

    const ratio = Math.max(0, Math.min(1.0, current / Math.max(1, max)));
    const fillW = Math.max(0, Math.floor(innerWidth * ratio));

    if (fillW > 0) {
      let fillColor = 0x00e676; // Emerald
      if (isFull || ratio >= 0.9) {
        fillColor = 0xff1744; // Crimson
      } else if (ratio >= 0.6) {
        fillColor = 0xffab00; // Amber
      }

      this.cargoBarFill.fillStyle(fillColor, 0.95);
      this.cargoBarFill.fillRoundedRect(centerX - barWidth / 2 + 2, 18, fillW, innerHeight, 4);
    }
  }

  public updateCoinsDisplay(coins: number): void {
    if (coins !== this.lastDisplayedCoins) {
      this.lastDisplayedCoins = coins;
      this.coinText.setText(`${coins.toLocaleString()} COINS`);

      // Pop Animation on Currency Increment
      this.tweens.add({
        targets: [this.coinText, this.coinIcon],
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 90,
        yoyo: true,
        ease: 'Quad.out',
      });
    }
  }

  public updateTierDisplay(tierId: number): void {
    const tier = JUNKYARD_TIERS.find((t) => t.id === tierId) || JUNKYARD_TIERS[0];
    this.tierBadgeText.setText(`TIER ${tier.id}: ${tier.name.toUpperCase()}`);
    this.tierBadgeText.setColor(tier.accentColor);

    this.tierPillBg.clear();
    this.tierPillBg.fillStyle(0x1a1816, 0.85);
    this.tierPillBg.fillRoundedRect(20, 16, 260, 36, 8);
    this.tierPillBg.lineStyle(1.5, tier.color, 0.8);
    this.tierPillBg.strokeRoundedRect(20, 16, 260, 36, 8);
  }

  private setupShopButton(): void {
    const rightX = 1260;
    const shopBtn = this.add.container(rightX - 120, 72);

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x00e5ff, 0.95);
    btnBg.fillRoundedRect(-100, -18, 200, 36, 8);
    btnBg.lineStyle(1.5, 0x80d8ff, 1);
    btnBg.strokeRoundedRect(-100, -18, 200, 36, 8);

    const btnText = this.add
      .text(0, 0, '⚙️ UPGRADES & SHOP', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        color: '#000000',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);

    shopBtn.add([btnBg, btnText]);
    shopBtn.setSize(200, 36);
    shopBtn.setInteractive({ useHandCursor: true });
    shopBtn.on('pointerdown', () => {
      if (this.upgradeModal) {
        this.upgradeModal.open();
      }
    });
    shopBtn.on('pointerover', () => shopBtn.setScale(1.05));
    shopBtn.on('pointerout', () => shopBtn.setScale(1.0));
  }

  private showBuffToast(message: string, bgColor: number = 0x00c853, strokeColor: number = 0xb9f6ca): void {
    const toast = this.add.container(640, 95);
    const toastBg = this.add.graphics();
    toastBg.fillStyle(bgColor, 0.95);
    toastBg.fillRoundedRect(-175, -16, 350, 32, 6);
    toastBg.lineStyle(1.5, strokeColor, 1);
    toastBg.strokeRoundedRect(-175, -16, 350, 32, 6);

    const toastTxt = this.add
      .text(0, 0, message, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);

    toast.add([toastBg, toastTxt]);
    toast.setDepth(150);

    this.tweens.add({
      targets: toast,
      y: 110,
      alpha: { from: 0, to: 1 },
      duration: 250,
      yoyo: true,
      hold: 2500,
      onComplete: () => toast.destroy(),
    });
  }

  // --------------------------------------------------------------------------
  // Prestige & Challenge HUD
  // --------------------------------------------------------------------------
  private setupPrestigeBadge(): void {
    this.prestigeBadgeText = this.add.text(28, 54, '', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });
    this.prestigeBadgeText.setVisible(false);
  }

  public updatePrestigeDisplay(level: number): void {
    if (!this.prestigeBadgeText) return;
    if (level > 0) {
      this.prestigeBadgeText.setText(`⭐ PRESTIGE RANK ${level} (+${level * 10}% 🪙)`);
      this.prestigeBadgeText.setVisible(true);
    } else {
      this.prestigeBadgeText.setVisible(false);
    }
  }

  private setupChallengeBanner(): void {
    this.challengeContainer = this.add.container(640, 48);
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a24, 0.85);
    bg.fillRoundedRect(-180, -11, 360, 22, 5);
    bg.lineStyle(1, 0x5c6bc0, 0.8);
    bg.strokeRoundedRect(-180, -11, 360, 22, 5);

    this.challengeText = this.add.text(0, 0, '🎯 Loading challenge...', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      color: '#c5cae9',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.challengeContainer.add([bg, this.challengeText]);
  }

  public updateChallengeDisplay(state: any): void {
    if (!state || !state.activeChallenge || !this.challengeText) return;
    const ch = state.activeChallenge;
    this.challengeText.setText(`${ch.title}: ${ch.description} (+${ch.rewardCoins} 🪙)`);
  }

  // --------------------------------------------------------------------------
  // Offline Earnings Modal Dialog
  // --------------------------------------------------------------------------
  public showOfflineEarningsModal(data: { elapsedMinutes: number; offlineCoins: number }): void {
    if (this.offlineModalContainer) {
      this.offlineModalContainer.destroy();
    }

    const cx = 640;
    const cy = 360;
    const w = 460;
    const h = 260;

    this.offlineModalContainer = this.add.container(0, 0);
    this.offlineModalContainer.setDepth(300);

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.7);
    backdrop.fillRect(0, 0, 1280, 720);
    backdrop.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1280, 720), Phaser.Geom.Rectangle.Contains);

    const dialogBg = this.add.graphics();
    dialogBg.fillStyle(0x1a1816, 0.98);
    dialogBg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
    dialogBg.lineStyle(2, 0xffd54f, 1);
    dialogBg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);

    const title = this.add.text(cx, cy - 80, 'WELCOME BACK, SCAVENGER!', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '20px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const desc = this.add.text(
      cx,
      cy - 40,
      `Your automated scrap compactors gathered coins while you were away (${data.elapsedMinutes} mins):`,
      {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        color: '#b0bec5',
        align: 'center',
        wordWrap: { width: 400 },
      }
    ).setOrigin(0.5, 0.5);

    const coinsText = this.add.text(cx, cy, `+${data.offlineCoins.toLocaleString()} 🪙`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '28px',
      color: '#00e676',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const junkyard = this.scene.get('JunkyardScene') as JunkyardScene;

    // Normal Claim Button
    const claimBtn = this.add.container(cx - 110, cy + 65);
    const claimBg = this.add.graphics();
    claimBg.fillStyle(0x37474f, 1);
    claimBg.fillRoundedRect(-95, -20, 190, 40, 6);
    const claimTxt = this.add.text(0, 0, 'CLAIM COINS', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    claimBtn.add([claimBg, claimTxt]);
    claimBtn.setSize(190, 40);
    claimBtn.setInteractive({ useHandCursor: true });
    claimBtn.on('pointerdown', () => {
      if (junkyard) {
        junkyard.addCoins(data.offlineCoins);
      }
      this.offlineModalContainer.destroy();
    });

    // 3X Rewarded Ad Button
    const adBtn = this.add.container(cx + 110, cy + 65);
    const adBg = this.add.graphics();
    adBg.fillStyle(0xff6f00, 1);
    adBg.fillRoundedRect(-100, -20, 200, 40, 6);
    adBg.lineStyle(1.5, 0xffd54f, 1);
    adBg.strokeRoundedRect(-100, -20, 200, 40, 6);
    const adTxt = this.add.text(0, 0, `🎁 3X AD (+${(data.offlineCoins * 3).toLocaleString()} 🪙)`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    adBtn.add([adBg, adTxt]);
    adBtn.setSize(200, 40);
    adBtn.setInteractive({ useHandCursor: true });
    adBtn.on('pointerdown', () => {
      const sdk = getCrazyGamesSDK();
      sdk.ad.requestAd('rewarded', {
        adStarted: () => {
          this.scene.pause('JunkyardScene');
          ProceduralAudioService.getInstance().setMuted(true);
        },
        adFinished: () => {
          this.scene.resume('JunkyardScene');
          ProceduralAudioService.getInstance().setMuted(false);
          if (junkyard) {
            junkyard.addCoins(data.offlineCoins * 3);
          }
          this.offlineModalContainer.destroy();
        },
        adError: (err) => {
          console.warn('[OfflineModal] Ad error:', err);
          this.scene.resume('JunkyardScene');
          ProceduralAudioService.getInstance().setMuted(false);
        }
      });
    });

    this.offlineModalContainer.add([backdrop, dialogBg, title, desc, coinsText, claimBtn, adBtn]);

    if (this.tweens && typeof this.offlineModalContainer.setScale === 'function') {
      this.offlineModalContainer.setScale(0.92);
      this.offlineModalContainer.setAlpha(0);
      this.tweens.add({
        targets: this.offlineModalContainer,
        scale: 1,
        alpha: 1,
        duration: 200,
        ease: 'Back.out',
      });
    }
  }

  // --------------------------------------------------------------------------
  // Unified Input Vector Aggregation
  // --------------------------------------------------------------------------
  public getInputVector(): Phaser.Math.Vector2 {
    // If upgrade shop or offline modal is open, stop rover movement
    if (
      (this.upgradeModal && this.upgradeModal.visible) ||
      (this.offlineModalContainer && this.offlineModalContainer.visible)
    ) {
      return new Phaser.Math.Vector2(0, 0);
    }

    let kx = 0;
    let ky = 0;

    if (this.cursors && this.keyW) {
      if (this.cursors.left.isDown || this.keyA.isDown || (this.keyQ && this.keyQ.isDown)) kx -= 1;
      if (this.cursors.right.isDown || this.keyD.isDown) kx += 1;
      if (this.cursors.up.isDown || this.keyW.isDown || (this.keyZ && this.keyZ.isDown)) ky -= 1;
      if (this.cursors.down.isDown || this.keyS.isDown) ky += 1;
    }

    if (kx !== 0 || ky !== 0) {
      const len = Math.sqrt(kx * kx + ky * ky);
      this.keyboardVector.set(kx / len, ky / len);
    } else {
      this.keyboardVector.set(0, 0);
    }

    // Combine Keyboard & Joystick: Joystick takes priority if actively dragged, otherwise keyboard
    if (this.joystickVector.lengthSq() > 0.01) {
      this.unifiedVector.copy(this.joystickVector);
    } else {
      this.unifiedVector.copy(this.keyboardVector);
    }

    return this.unifiedVector;
  }

  // --------------------------------------------------------------------------
  // Dynamic Combo & Fever Handlers & Rendering
  // --------------------------------------------------------------------------
  public getCurrentComboState(): ComboState | null {
    return this.currentComboState;
  }

  public updateComboDisplay(state: ComboState): void {
    this.currentComboState = { ...state };
    if (!state.isFever && state.count < 2) {
      if (this.comboContainer) this.comboContainer.setVisible(false);
      if (this.feverBannerContainer) this.feverBannerContainer.setVisible(false);
      return;
    }

    if (this.comboContainer) this.comboContainer.setVisible(true);

    if (state.isFever) {
      if (this.feverBannerContainer) this.feverBannerContainer.setVisible(true);
      const sec = (state.remainingFeverMs / 1000).toFixed(1);
      if (this.feverBannerText) {
        this.feverBannerText.setText(`🔥 FEVER MODE! 5x COINS (${sec}s) 🔥`);
      }
      if (this.comboText) {
        this.comboText.setText(`🔥 FEVER: 5.0x COINS (${sec}s)`);
      }
    } else {
      if (this.feverBannerContainer) this.feverBannerContainer.setVisible(false);
      if (this.comboText) {
        this.comboText.setText(`⚡ COMBO: x${state.count} (${state.multiplier.toFixed(1)}x COINS)`);
      }
    }
  }

  private handleFeverStarted(state: ComboState): void {
    this.updateComboDisplay(state);
    if (this.feverBannerContainer) {
      this.feverBannerContainer.setScale(0.8);
      this.tweens.add({
        targets: this.feverBannerContainer,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 160,
        yoyo: true,
        ease: 'Back.out',
      });
    }
  }

  private handleFeverEnded(state: ComboState): void {
    this.updateComboDisplay(state);
  }

  private handleComboExpired(state: ComboState): void {
    this.updateComboDisplay(state);
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    this.renderComboTimer(time);
    this.updateCompass();
    this.updatePulseButton(time);

    if (this.tutorialOverlay) {
      const junkyard = this.scene.get('JunkyardScene') as JunkyardScene;
      if (junkyard) {
        this.tutorialOverlay.update(time, delta, this, junkyard);
      }
    }
  }

  private renderComboTimer(time: number): void {
    const junkyard = this.scene.get('JunkyardScene') as JunkyardScene;
    if (!junkyard || !junkyard.comboManager || !this.comboContainer || !this.comboBg || !this.comboTimerBar) {
      return;
    }

    const state = junkyard.comboManager.getState(time);
    this.currentComboState = state;

    if (!state.isFever && state.count < 2) {
      if (this.comboContainer.visible) this.comboContainer.setVisible(false);
      if (this.feverBannerContainer && this.feverBannerContainer.visible) {
        this.feverBannerContainer.setVisible(false);
      }
      return;
    }

    if (!this.comboContainer.visible) {
      this.comboContainer.setVisible(true);
    }

    const totalW = 260;
    const totalH = 30;

    this.comboBg.clear();
    this.comboTimerBar.clear();

    if (state.isFever) {
      if (this.feverBannerContainer && !this.feverBannerContainer.visible) {
        this.feverBannerContainer.setVisible(true);
      }
      const remSec = (state.remainingFeverMs / 1000).toFixed(1);
      if (this.feverBannerText) {
        this.feverBannerText.setText(`🔥 FEVER MODE! 5x COINS (${remSec}s) 🔥`);
      }
      if (this.comboText) {
        this.comboText.setText(`🔥 FEVER: 5.0x COINS (${remSec}s)`);
      }

      // Pulsing rainbow border for combo widget
      const rainbowColors = [0xff1744, 0xff9100, 0xffea00, 0x00e676, 0x00e5ff, 0xd500f9];
      const colIdx = Math.floor((time * 0.005) % rainbowColors.length);
      const activeColor = rainbowColors[colIdx];

      this.comboBg.fillStyle(0x1a1816, 0.9);
      this.comboBg.fillRoundedRect(0, 0, totalW, totalH, 6);
      this.comboBg.lineStyle(1.5, activeColor, 0.9);
      this.comboBg.strokeRoundedRect(0, 0, totalW, totalH, 6);

      // Remaining fever bar fill
      const feverRatio = Math.max(0, Math.min(1.0, state.remainingFeverMs / 10000));
      const fillW = Math.max(0, Math.floor((totalW - 4) * feverRatio));
      if (fillW > 0) {
        this.comboTimerBar.fillStyle(activeColor, 0.4);
        this.comboTimerBar.fillRoundedRect(2, 2, fillW, totalH - 4, 4);
      }

      // Render Fever Banner background with animated rainbow pulse
      if (this.feverBannerBg) {
        this.feverBannerBg.clear();
        this.feverBannerBg.fillStyle(0x210015, 0.92);
        this.feverBannerBg.fillRoundedRect(-170, -16, 340, 32, 8);
        this.feverBannerBg.lineStyle(2, activeColor, 0.95);
        this.feverBannerBg.strokeRoundedRect(-170, -16, 340, 32, 8);
      }
    } else {
      if (this.feverBannerContainer && this.feverBannerContainer.visible) {
        this.feverBannerContainer.setVisible(false);
      }

      if (this.comboText) {
        this.comboText.setText(`⚡ COMBO: x${state.count} (${state.multiplier.toFixed(1)}x COINS)`);
      }

      let borderColor = 0x00e676; // 1.5x
      if (state.multiplier >= 3.0) borderColor = 0xff9100;
      else if (state.multiplier >= 2.0) borderColor = 0x00e5ff;

      this.comboBg.fillStyle(0x1a1816, 0.85);
      this.comboBg.fillRoundedRect(0, 0, totalW, totalH, 6);
      this.comboBg.lineStyle(1.5, borderColor, 0.8);
      this.comboBg.strokeRoundedRect(0, 0, totalW, totalH, 6);

      const windowRatio = Math.max(0, Math.min(1.0, state.remainingWindowMs / 2000));
      const fillW = Math.max(0, Math.floor((totalW - 4) * windowRatio));
      if (fillW > 0) {
        this.comboTimerBar.fillStyle(borderColor, 0.35);
        this.comboTimerBar.fillRoundedRect(2, 2, fillW, totalH - 4, 4);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Audio Controls & Navigation Compass
  // --------------------------------------------------------------------------
  private setupAudioToggle(): void {
    const audio = ProceduralAudioService.getInstance();
    this.audioBtnContainer = this.add.container(1005, 34);

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1a1816, 0.85);
    btnBg.fillCircle(0, 0, 18);
    btnBg.lineStyle(1.5, 0x00e5ff, 0.7);
    btnBg.strokeCircle(0, 0, 18);

    this.audioIconText = this.add
      .text(0, 0, audio.isMuted() ? '🔇' : '🔊', {
        fontSize: '16px',
      })
      .setOrigin(0.5, 0.5);

    this.audioBtnContainer.add([btnBg, this.audioIconText]);
    this.audioBtnContainer.setSize(36, 36);
    this.audioBtnContainer.setInteractive({ useHandCursor: true });

    this.audioBtnContainer.on('pointerdown', () => {
      const isMuted = !audio.isMuted();
      audio.setMuted(isMuted);
      this.audioIconText.setText(isMuted ? '🔇' : '🔊');
      this.tweens.add({
        targets: this.audioBtnContainer,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 80,
        yoyo: true,
      });
    });

    this.audioBtnContainer.on('pointerover', () => this.audioBtnContainer.setScale(1.1));
    this.audioBtnContainer.on('pointerout', () => this.audioBtnContainer.setScale(1.0));
  }

  private setupMusicToggle(): void {
    const audio = ProceduralAudioService.getInstance();
    this.musicBtnContainer = this.add.container(905, 34);

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1a1816, 0.85);
    btnBg.fillCircle(0, 0, 18);
    btnBg.lineStyle(1.5, 0x00e5ff, 0.7);
    btnBg.strokeCircle(0, 0, 18);

    this.musicIconText = this.add
      .text(0, 0, audio.getIsMusicPlaying() ? '🎵' : '🔇', {
        fontSize: '16px',
      })
      .setOrigin(0.5, 0.5);

    this.musicBtnContainer.add([btnBg, this.musicIconText]);
    this.musicBtnContainer.setSize(36, 36);
    this.musicBtnContainer.setInteractive({ useHandCursor: true });

    this.musicBtnContainer.on('pointerdown', () => {
      if (audio.getIsMusicPlaying()) {
        audio.stopAmbientMusic();
        this.musicIconText.setText('🔇');
        this.showBuffToast('🎵 Ambient Music: OFF', 0x263238, 0x00e5ff);
      } else {
        audio.startAmbientMusic();
        this.musicIconText.setText('🎵');
        this.showBuffToast('🎵 Ambient Music: ON', 0x004d40, 0x00e5ff);
      }

      this.tweens.add({
        targets: this.musicBtnContainer,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 80,
        yoyo: true,
      });
    });

    this.musicBtnContainer.on('pointerover', () => this.musicBtnContainer.setScale(1.1));
    this.musicBtnContainer.on('pointerout', () => this.musicBtnContainer.setScale(1.0));
  }

  private onHazardHit = (msg: string): void => {
    this.showBuffToast(msg, 0xd50000, 0xff8a80);
  };

  private onHazardRepelled = (msg: string): void => {
    this.showBuffToast(msg, 0x00c853, 0xb9f6ca);
  };

  private onOfflineEarnings = (data: any): void => {
    this.showOfflineEarningsModal(data);
  };

  private onScreenShakeToggled = (enabled: boolean): void => {
    this.isScreenShakeOn = enabled;
    this.updateScreenShakeDisplay(enabled);
  };

  private setupScreenShakeToggle(): void {
    const junkyard = this.scene.get('JunkyardScene') as JunkyardScene;
    const saveManager = SaveManager.getInstance();
    this.isScreenShakeOn =
      junkyard && typeof junkyard.screenShakeEnabled === 'boolean'
        ? junkyard.screenShakeEnabled
        : (saveManager.load().settings?.screenShake ?? true);

    this.shakeBtnContainer = this.add.container(955, 34);

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1a1816, 0.85);
    btnBg.fillCircle(0, 0, 18);
    btnBg.lineStyle(1.5, 0x00e5ff, 0.7);
    btnBg.strokeCircle(0, 0, 18);

    this.shakeIconText = this.add
      .text(0, 0, this.isScreenShakeOn ? '📳' : '📴', {
        fontSize: '16px',
      })
      .setOrigin(0.5, 0.5);

    this.shakeBtnContainer.add([btnBg, this.shakeIconText]);
    this.shakeBtnContainer.setSize(36, 36);
    this.shakeBtnContainer.setInteractive({ useHandCursor: true });

    this.shakeBtnContainer.on('pointerdown', () => {
      const junkyardScene = this.scene.get('JunkyardScene') as JunkyardScene;
      const currentState =
        junkyardScene && typeof junkyardScene.screenShakeEnabled === 'boolean'
          ? junkyardScene.screenShakeEnabled
          : this.isScreenShakeOn;
      const nextState = !currentState;
      this.isScreenShakeOn = nextState;

      if (junkyardScene && typeof junkyardScene.setScreenShakeEnabled === 'function') {
        junkyardScene.setScreenShakeEnabled(nextState);
      } else {
        const saved = saveManager.load();
        saved.settings.screenShake = nextState;
        saveManager.save(saved);
      }
      this.updateScreenShakeDisplay(nextState);

      this.tweens.killTweensOf(this.shakeBtnContainer);
      this.shakeBtnContainer.setScale(1.0);
      this.tweens.add({
        targets: this.shakeBtnContainer,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 80,
        yoyo: true,
        onComplete: () => {
          if (this.shakeBtnContainer && this.shakeBtnContainer.active) {
            this.shakeBtnContainer.setScale(1.0);
          }
        },
      });
      this.showBuffToast(nextState ? '📳 Screen Shake: ON' : '📴 Screen Shake: OFF', 0x263238, 0x00e5ff);
    });

    this.shakeBtnContainer.on('pointerover', () => {
      if (!this.tweens.isTweening(this.shakeBtnContainer)) {
        this.shakeBtnContainer.setScale(1.1);
      }
    });
    this.shakeBtnContainer.on('pointerout', () => {
      if (!this.tweens.isTweening(this.shakeBtnContainer)) {
        this.shakeBtnContainer.setScale(1.0);
      }
    });
  }

  public updateScreenShakeDisplay(enabled: boolean): void {
    this.isScreenShakeOn = enabled;
    if (this.shakeIconText) {
      this.shakeIconText.setText(enabled ? '📳' : '📴');
    }
  }

  public shutdown(): void {
    const junkyard = this.scene.get('JunkyardScene') as JunkyardScene;
    if (junkyard && junkyard.events) {
      junkyard.events.off('cargo-updated', this.updateCargoDisplay, this);
      junkyard.events.off('coins-updated', this.updateCoinsDisplay, this);
      junkyard.events.off('tier-updated', this.updateTierDisplay, this);
      junkyard.events.off('buff-activated', this.showBuffToast, this);
      junkyard.events.off('combo-updated', this.updateComboDisplay, this);
      junkyard.events.off('fever-started', this.handleFeverStarted, this);
      junkyard.events.off('fever-ended', this.handleFeverEnded, this);
      junkyard.events.off('combo-expired', this.handleComboExpired, this);
      junkyard.events.off('prestige-updated', this.updatePrestigeDisplay, this);
      junkyard.events.off('challenge-updated', this.updateChallengeDisplay, this);
      junkyard.events.off('hazard-hit', this.onHazardHit, this);
      junkyard.events.off('hazard-repelled', this.onHazardRepelled, this);
      junkyard.events.off('offline-earnings', this.onOfflineEarnings, this);
      junkyard.events.off('screenshake-toggled', this.onScreenShakeToggled, this);
    }
    if (this.shakeBtnContainer) {
      this.tweens.killTweensOf(this.shakeBtnContainer);
    }
    if (this.tutorialOverlay) {
      this.tutorialOverlay.destroy();
      this.tutorialOverlay = undefined;
    }
  }

  private setupCompass(): void {
    this.compassContainer = this.add.container(640, 360);
    this.compassContainer.setDepth(110);
    this.compassContainer.setVisible(false);

    // Arrow graphics pointing right (0 rad)
    this.compassArrow = this.add.graphics();
    this.compassArrow.fillStyle(0x00e5ff, 0.95);
    this.compassArrow.beginPath();
    this.compassArrow.moveTo(18, 0);
    this.compassArrow.lineTo(-12, -12);
    this.compassArrow.lineTo(-6, 0);
    this.compassArrow.lineTo(-12, 12);
    this.compassArrow.closePath();
    this.compassArrow.fillPath();
    this.compassArrow.lineStyle(1.5, 0xffffff, 1);
    this.compassArrow.strokePath();

    this.compassDistText = this.add.text(0, 16, '', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '11px',
      color: '#ffd54f',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0);

    this.compassContainer.add([this.compassArrow, this.compassDistText]);
  }

  private updateCompass(): void {
    const junkyard = this.scene.get('JunkyardScene') as JunkyardScene;
    if (!junkyard || !junkyard.playerRover || !this.compassContainer) return;

    const rover = junkyard.playerRover;
    const rc = GAME_CONSTANTS.RECYCLER_CENTER;
    const dx = rc.x - rover.x;
    const dy = rc.y - rover.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Hide if very close to recycler
    if (dist < 180) {
      if (this.compassContainer.visible) this.compassContainer.setVisible(false);
      return;
    }

    const cam = junkyard.cameras.main;
    const isRecyclerOnScreen = cam && cam.worldView && cam.worldView.contains(rc.x, rc.y);
    const cargoRatio = rover.cargo.currentMassKg / Math.max(1, rover.cargo.maxCapacityKg);

    // Show if recycler is off-screen OR cargo is loaded (>35%)
    const shouldShow = !isRecyclerOnScreen || cargoRatio >= 0.35 || rover.cargo.isFull;

    if (!shouldShow) {
      if (this.compassContainer.visible) this.compassContainer.setVisible(false);
      return;
    }

    if (!this.compassContainer.visible) {
      this.compassContainer.setVisible(true);
    }

    const angle = Math.atan2(dy, dx);
    const meterDist = Math.round(dist / 10);

    // Position arrow on a clamped oval around the screen viewport
    const cx = 640;
    const cy = 360;
    const radiusX = 560;
    const radiusY = 280;

    const posX = cx + Math.cos(angle) * radiusX;
    const posY = cy + Math.sin(angle) * radiusY;

    this.compassContainer.setPosition(posX, posY);
    this.compassArrow.setRotation(angle);

    const fullTag = rover.cargo.isFull ? '⚠️ ' : '';
    this.compassDistText.setText(`${fullTag}RECYCLER ${meterDist}m`);
    this.compassDistText.setColor(rover.cargo.isFull ? '#ff5252' : '#00e5ff');
  }

  // --------------------------------------------------------------------------
  // Active Pulse Ability UI (Bottom-Right Button + Space Key)
  // --------------------------------------------------------------------------
  private triggerPulseAction(): void {
    const junkyard = this.scene.get('JunkyardScene') as JunkyardScene;
    if (junkyard && typeof junkyard.triggerMagneticPulse === 'function') {
      const pulsed = junkyard.triggerMagneticPulse();
      if (pulsed && this.pulseBtnContainer) {
        this.tweens.add({
          targets: this.pulseBtnContainer,
          scaleX: 1.25,
          scaleY: 1.25,
          duration: 70,
          yoyo: true,
        });
      }
    }
  }

  private setupPulseButton(): void {
    const bx = 1190;
    const by = 635;
    this.pulseBtnContainer = this.add.container(bx, by);
    this.pulseBtnContainer.setDepth(115);

    this.pulseBtnBg = this.add.graphics();
    this.pulseCooldownFill = this.add.graphics();

    const icon = this.add.text(0, -6, '💥', { fontSize: '24px' }).setOrigin(0.5, 0.5);
    this.pulseStatusText = this.add.text(0, 16, 'SPACE', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '10px',
      color: '#00e5ff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.pulseBtnContainer.add([this.pulseBtnBg, this.pulseCooldownFill, icon, this.pulseStatusText]);
    this.pulseBtnContainer.setSize(68, 68);
    this.pulseBtnContainer.setInteractive({ useHandCursor: true });

    this.pulseBtnContainer.on('pointerdown', () => {
      this.triggerPulseAction();
    });

    this.pulseBtnContainer.on('pointerover', () => this.pulseBtnContainer.setScale(1.08));
    this.pulseBtnContainer.on('pointerout', () => this.pulseBtnContainer.setScale(1.0));
  }

  private updatePulseButton(time: number): void {
    const junkyard = this.scene.get('JunkyardScene') as JunkyardScene;
    if (!junkyard || !junkyard.abilityManager || !this.pulseBtnContainer) return;

    const state = junkyard.abilityManager.getState(time);
    this.pulseBtnBg.clear();
    this.pulseCooldownFill.clear();

    const r = 32;
    if (state.ready) {
      this.pulseBtnBg.fillStyle(0x004d40, 0.95);
      this.pulseBtnBg.fillCircle(0, 0, r);
      this.pulseBtnBg.lineStyle(2.5, 0x00e5ff, 1);
      this.pulseBtnBg.strokeCircle(0, 0, r);

      this.pulseStatusText.setText('SPACE');
      this.pulseStatusText.setColor('#00e5ff');
    } else {
      this.pulseBtnBg.fillStyle(0x1a2129, 0.85);
      this.pulseBtnBg.fillCircle(0, 0, r);
      this.pulseBtnBg.lineStyle(1.5, 0x37474f, 0.8);
      this.pulseBtnBg.strokeCircle(0, 0, r);

      // Arc cooldown sweep
      this.pulseCooldownFill.fillStyle(0x00e5ff, 0.35);
      this.pulseCooldownFill.beginPath();
      this.pulseCooldownFill.moveTo(0, 0);
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + state.progress * Math.PI * 2;
      this.pulseCooldownFill.arc(0, 0, r - 2, startAngle, endAngle, false);
      this.pulseCooldownFill.closePath();
      this.pulseCooldownFill.fillPath();

      const secRemaining = (state.remainingCooldownMs / 1000).toFixed(1);
      this.pulseStatusText.setText(`${secRemaining}s`);
      this.pulseStatusText.setColor('#90a4ae');
    }
  }

  // --------------------------------------------------------------------------
  // Retention: Daily Login Streak Modal
  // --------------------------------------------------------------------------
  private checkDailyLoginReward(): void {
    const status = this.dailyLoginManager.getStatus();
    if (!status.canClaim) return;

    this.time.delayedCall(400, () => {
      this.showDailyLoginModal(status);
    });
  }

  private showDailyLoginModal(status: any): void {
    const sdk = getCrazyGamesSDK();
    sdk.game.gameplayStop();

    this.dailyLoginModalContainer = this.add.container(640, 360);
    this.dailyLoginModalContainer.setDepth(300);

    // Fullscreen backdrop
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.82);
    backdrop.fillRect(-640, -360, 1280, 720);
    backdrop.setInteractive(new Phaser.Geom.Rectangle(-640, -360, 1280, 720), Phaser.Geom.Rectangle.Contains);

    // Main Card
    const cardBg = this.add.graphics();
    const mw = 680;
    const mh = 380;
    cardBg.fillStyle(0x13171c, 0.98);
    cardBg.fillRoundedRect(-mw / 2, -mh / 2, mw, mh, 12);
    cardBg.lineStyle(2, 0xffd54f, 0.9);
    cardBg.strokeRoundedRect(-mw / 2, -mh / 2, mw, mh, 12);

    const title = this.add.text(0, -mh / 2 + 30, '🎁 DAILY LOGIN STREAK REWARDS', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '20px',
      color: '#ffd54f',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    const subtitle = this.add.text(0, -mh / 2 + 58, 'Log in every day for escalating coin rewards! Day 7 is a 1,000 🪙 Jackpot!', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#90a4ae',
    }).setOrigin(0.5, 0.5);

    this.dailyLoginModalContainer.add([backdrop, cardBg, title, subtitle]);

    // 7 Day Cards
    const dayW = 82;
    const dayH = 110;
    const startX = -((7 * (dayW + 8)) - 8) / 2 + dayW / 2;
    const dayY = -mh / 2 + 155;

    status.streakDays.forEach((dayNum: number, idx: number) => {
      const dx = startX + idx * (dayW + 8);
      const isToday = dayNum === status.streakDay;
      const isPassed = dayNum < status.streakDay;
      const reward = status.allRewards[idx];

      const dayBox = this.add.graphics();
      if (isToday) {
        dayBox.fillStyle(0x2e2508, 0.95);
        dayBox.fillRoundedRect(dx - dayW / 2, dayY - dayH / 2, dayW, dayH, 8);
        dayBox.lineStyle(2, 0xffd54f, 1);
        dayBox.strokeRoundedRect(dx - dayW / 2, dayY - dayH / 2, dayW, dayH, 8);
      } else if (isPassed) {
        dayBox.fillStyle(0x132e1f, 0.85);
        dayBox.fillRoundedRect(dx - dayW / 2, dayY - dayH / 2, dayW, dayH, 8);
        dayBox.lineStyle(1, 0x00e676, 0.6);
        dayBox.strokeRoundedRect(dx - dayW / 2, dayY - dayH / 2, dayW, dayH, 8);
      } else {
        dayBox.fillStyle(0x1c232b, 0.85);
        dayBox.fillRoundedRect(dx - dayW / 2, dayY - dayH / 2, dayW, dayH, 8);
        dayBox.lineStyle(1, 0x37474f, 0.6);
        dayBox.strokeRoundedRect(dx - dayW / 2, dayY - dayH / 2, dayW, dayH, 8);
      }

      const dNumText = this.add.text(dx, dayY - dayH / 2 + 16, `DAY ${dayNum}`, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '11px',
        color: isToday ? '#ffd54f' : (isPassed ? '#00e676' : '#78909c'),
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);

      const dIcon = this.add.text(dx, dayY - 4, isPassed ? '✅' : (dayNum === 7 ? '👑' : '🪙'), {
        fontSize: '22px',
      }).setOrigin(0.5, 0.5);

      const dReward = this.add.text(dx, dayY + dayH / 2 - 16, `+${reward}`, {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '12px',
        color: isToday ? '#ffd54f' : '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);

      this.dailyLoginModalContainer.add([dayBox, dNumText, dIcon, dReward]);
    });

    // Action Button 1: Normal Claim
    const claim1Btn = this.add.container(-130, mh / 2 - 50);
    const c1Bg = this.add.graphics();
    c1Bg.fillStyle(0x37474f, 0.95);
    c1Bg.fillRoundedRect(-100, -22, 200, 44, 8);
    c1Bg.lineStyle(1.5, 0x78909c, 1);
    c1Bg.strokeRoundedRect(-100, -22, 200, 44, 8);
    const c1Txt = this.add.text(0, 0, `CLAIM (+${status.rewardCoins} 🪙)`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    claim1Btn.add([c1Bg, c1Txt]);
    claim1Btn.setSize(200, 44);
    claim1Btn.setInteractive({ useHandCursor: true });
    claim1Btn.on('pointerdown', () => {
      const coins = this.dailyLoginManager.claim(false);
      this.closeDailyLoginModal(coins);
    });
    this.dailyLoginModalContainer.add(claim1Btn);

    // Action Button 2: 2X Rewarded Ad Claim
    const claim2Btn = this.add.container(130, mh / 2 - 50);
    const c2Bg = this.add.graphics();
    c2Bg.fillStyle(0xff6f00, 0.95);
    c2Bg.fillRoundedRect(-120, -22, 240, 44, 8);
    c2Bg.lineStyle(2, 0xffd54f, 1);
    c2Bg.strokeRoundedRect(-120, -22, 240, 44, 8);
    const c2Txt = this.add.text(0, 0, `🎁 2X WITH AD (+${status.rewardCoins * 2} 🪙)`, {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    claim2Btn.add([c2Bg, c2Txt]);
    claim2Btn.setSize(240, 44);
    claim2Btn.setInteractive({ useHandCursor: true });
    claim2Btn.on('pointerdown', () => {
      sdk.ad.requestAd('rewarded', {
        adStarted: () => {
          this.scene.pause('JunkyardScene');
          ProceduralAudioService.getInstance().setMuted(true);
        },
        adFinished: () => {
          this.scene.resume('JunkyardScene');
          ProceduralAudioService.getInstance().setMuted(false);
          const coins = this.dailyLoginManager.claim(true);
          this.closeDailyLoginModal(coins);
        },
        adError: (err) => {
          console.warn('[DailyLogin] Ad error:', err);
          this.scene.resume('JunkyardScene');
          ProceduralAudioService.getInstance().setMuted(false);
        }
      });
    });
    this.dailyLoginModalContainer.add(claim2Btn);

    if (this.tweens && typeof this.dailyLoginModalContainer.setScale === 'function') {
      this.dailyLoginModalContainer.setScale(0.92);
      this.dailyLoginModalContainer.setAlpha(0);
      this.tweens.add({
        targets: this.dailyLoginModalContainer,
        scale: 1,
        alpha: 1,
        duration: 200,
        ease: 'Back.out',
      });
    }
  }

  private closeDailyLoginModal(coinsAwarded: number): void {
    if (this.dailyLoginModalContainer) {
      this.dailyLoginModalContainer.destroy();
    }
    const sdk = getCrazyGamesSDK();
    sdk.game.gameplayStart();

    const junkyard = this.scene.get('JunkyardScene') as JunkyardScene;
    if (junkyard && coinsAwarded > 0) {
      junkyard.addCoins(coinsAwarded);
      this.showBuffToast(`🎁 DAILY REWARD: +${coinsAwarded} 🪙 CLAIMED!`, 0xff6f00, 0xffd54f);
    }
  }
}
