// ============================================================================
// Magnet Junkyard - Non-Blocking Guided Onboarding Tutorial Overlay
// ============================================================================

import Phaser from 'phaser';
import { SaveManager } from '../services/persistence/SaveManager';
import { UIScene } from '../scenes/UIScene';
import { JunkyardScene } from '../scenes/JunkyardScene';

export type TutorialStepId = 'move' | 'collect' | 'recycle' | 'upgrade' | 'pulse' | 'completed';

export interface TutorialStep {
  id: TutorialStepId;
  text: string;
  icon: string;
}

export class TutorialOverlay extends Phaser.GameObjects.Container {
  public currentStep: TutorialStepId = 'move';
  public isCompleted: boolean = false;

  private bannerBg!: Phaser.GameObjects.Graphics;
  private iconText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private skipButton!: Phaser.GameObjects.Container;
  private moveElapsedMs: number = 0;
  private pulsePromptTime: number = 0;

  private readonly STEPS: Record<TutorialStepId, TutorialStep> = {
    move: {
      id: 'move',
      icon: '🕹️',
      text: 'Use WASD / ZQSD / Arrow Keys or Touch Drag to steer your Rover',
    },
    collect: {
      id: 'collect',
      icon: '🧲',
      text: 'Drive near scrap metal — your electromagnetic field attracts it!',
    },
    recycle: {
      id: 'recycle',
      icon: '♻️',
      text: 'Cargo loaded! Follow the compass ➡️ to the central Recycler Station',
    },
    upgrade: {
      id: 'upgrade',
      icon: '⚙️',
      text: 'Nice haul! Tap "UPGRADES & SHOP" to increase capacity & speed',
    },
    pulse: {
      id: 'pulse',
      icon: '💥',
      text: 'Press SPACE or tap 💥 to fire a Magnetic Pulse & shatter crates!',
    },
    completed: {
      id: 'completed',
      icon: '⭐',
      text: 'You are ready! Scavenge, upgrade, and conquer all 4 zones!',
    },
  };

  constructor(scene: Phaser.Scene) {
    super(scene, 640, 650);

    const saved = SaveManager.getInstance().load();
    if (saved.settings?.tutorialCompleted) {
      this.isCompleted = true;
      this.setVisible(false);
      return;
    }

    this.setDepth(160);
    this.createUI();
    scene.add.existing(this);
    this.showStep('move');
  }

  private createUI(): void {
    // 1. Banner Background
    this.bannerBg = this.scene.add.graphics();
    this.add(this.bannerBg);
    this.drawBanner();

    // 2. Icon & Text
    this.iconText = this.scene.add.text(-280, 0, '🕹️', {
      fontSize: '22px',
    }).setOrigin(0.5, 0.5);

    this.messageText = this.scene.add.text(-255, 0, '', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      color: '#e0f7fa',
      fontStyle: 'bold',
      wordWrap: { width: 440 },
    }).setOrigin(0, 0.5);

    // 3. Skip Button
    const skipBg = this.scene.add.graphics();
    skipBg.fillStyle(0x37474f, 0.7);
    skipBg.fillRoundedRect(-50, -14, 100, 28, 6);
    skipBg.lineStyle(1, 0x78909c, 0.8);
    skipBg.strokeRoundedRect(-50, -14, 100, 28, 6);

    const skipLabel = this.scene.add.text(0, 0, 'SKIP ✕', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      color: '#b0bec5',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.skipButton = this.scene.add.container(240, 0, [skipBg, skipLabel]);
    this.skipButton.setSize(100, 28);
    this.skipButton.setInteractive({ useHandCursor: true });
    this.skipButton.on('pointerdown', () => this.completeTutorial(true));
    this.skipButton.on('pointerover', () => skipLabel.setColor('#ffffff'));
    this.skipButton.on('pointerout', () => skipLabel.setColor('#b0bec5'));

    this.add([this.iconText, this.messageText, this.skipButton]);
  }

  private drawBanner(): void {
    this.bannerBg.clear();
    const w = 620;
    const h = 48;

    // Dark sleek pill with glowing cyan border
    this.bannerBg.fillStyle(0x10171d, 0.92);
    this.bannerBg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    this.bannerBg.lineStyle(1.5, 0x00e5ff, 0.7);
    this.bannerBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  }

  public showStep(stepId: TutorialStepId): void {
    if (this.isCompleted) return;
    this.currentStep = stepId;
    const step = this.STEPS[stepId];
    if (!step) return;

    this.iconText.setText(step.icon);
    this.messageText.setText(step.text);

    // Subtle scale bounce
    this.setScale(0.96);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 180,
      ease: 'Back.out',
    });

    if (stepId === 'pulse') {
      this.pulsePromptTime = Date.now();
    }
  }

  public update(_time: number, delta: number, uiScene: UIScene, junkyard: JunkyardScene): void {
    if (this.isCompleted || !this.visible) return;

    switch (this.currentStep) {
      case 'move': {
        const inputVec = uiScene.getInputVector();
        if (inputVec.lengthSq() > 0.05) {
          this.moveElapsedMs += delta;
          if (this.moveElapsedMs >= 1200) {
            this.showStep('collect');
          }
        }
        break;
      }
      case 'collect': {
        if (junkyard.playerRover && junkyard.playerRover.cargo.itemsCount > 0) {
          this.showStep('recycle');
        }
        break;
      }
      case 'recycle': {
        if (junkyard.totalRecycledRuns > 0) {
          this.showStep('upgrade');
        }
        break;
      }
      case 'upgrade': {
        if ((uiScene as any).upgradeModal?.isOpen || (uiScene as any).upgradeModal?.visible) {
          this.showStep('pulse');
        }
        break;
      }
      case 'pulse': {
        const abilityState = junkyard.abilityManager.getState();
        // If player triggered pulse or 8 seconds passed after prompt
        if (!abilityState.ready || (this.pulsePromptTime > 0 && Date.now() - this.pulsePromptTime >= 8000)) {
          this.completeTutorial();
        }
        break;
      }
    }
  }

  public completeTutorial(skipped: boolean = false): void {
    if (this.isCompleted) return;
    this.isCompleted = true;

    // Save to persistence
    const saveManager = SaveManager.getInstance();
    const current = saveManager.load();
    current.settings = current.settings || {} as any;
    current.settings.tutorialCompleted = true;
    saveManager.save(current);

    if (!skipped) {
      this.showStep('completed');
      this.scene.time.delayedCall(2500, () => {
        this.fadeOutAndDestroy();
      });
    } else {
      this.fadeOutAndDestroy();
    }
  }

  private fadeOutAndDestroy(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y + 20,
      duration: 300,
      ease: 'Quad.in',
      onComplete: () => {
        this.destroy();
      },
    });
  }
}
