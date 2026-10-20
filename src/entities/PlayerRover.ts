// ============================================================================
// Magnet Junkyard - Player Rover Entity
// ============================================================================

import Phaser from 'phaser';
import {
  CargoState,
  GAME_CONSTANTS,
  PlayerUpgrades,
  ScrapItemData,
  getAttractPower,
  getCarryCapacity,
  getMagnetRange,
  getMovementSpeed,
} from '../config/constants';

export class PlayerRover extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;

  // Kinetic & Steering Attributes
  public effectiveSpeed: number = 200;
  public effectiveRadius: number = 120;
  public effectivePower: number = 350;
  public readonly turnRate: number = GAME_CONSTANTS.ROVER_TURN_RATE;
  public readonly dragDecel: number = GAME_CONSTANTS.ROVER_DRAG;

  // Upgrades & Cargo State
  public isFever: boolean = false;
  public isOvercharged: boolean = false;
  public isMagnetDisabled: boolean = false;
  public magnetDisabledUntil: number = 0;

  public upgrades: PlayerUpgrades = {
    magnetRange: 1,
    attractPower: 1,
    carryCapacity: 1,
    movementSpeed: 1,
  };

  public cargo: CargoState = {
    currentMassKg: 0,
    maxCapacityKg: 6,
    itemsCount: 0,
    items: [],
    isFull: false,
  };

  // Visual Children
  private treadsSprite: Phaser.GameObjects.Sprite;
  private chassisSprite: Phaser.GameObjects.Sprite;
  private cargoSprite: Phaser.GameObjects.Sprite;
  private emitterSprite: Phaser.GameObjects.Sprite;

  // Dedicated Magnetic Field Visuals
  private fieldGraphics: Phaser.GameObjects.Graphics;
  private nextDustEmitTime: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // 1. Visual Assembly inside Container
    this.treadsSprite = scene.add.sprite(0, 0, 'rover_treads').setScale(0.55);
    this.chassisSprite = scene.add.sprite(0, 0, 'rover_chassis').setScale(0.55);
    this.cargoSprite = scene.add.sprite(-10, 0, 'cargo_empty');
    this.emitterSprite = scene.add.sprite(GAME_CONSTANTS.MAGNET_FORWARD_OFFSET, 0, 'magnet_emitter').setScale(0.65);

    this.add([this.treadsSprite, this.chassisSprite, this.cargoSprite, this.emitterSprite]);

    // 2. Scene mounting & Physics Body Setup
    scene.add.existing(this);
    scene.physics.world.enable(this);

    this.body.setSize(44, 44);
    this.body.setCircle(
      GAME_CONSTANTS.ROVER_COLLISION_RADIUS,
      -GAME_CONSTANTS.ROVER_COLLISION_RADIUS,
      -GAME_CONSTANTS.ROVER_COLLISION_RADIUS
    );
    this.body.setDrag(this.dragDecel);
    this.body.setCollideWorldBounds(true);

    // 3. Dynamic Magnetic Field Graphics in Scene Space
    this.fieldGraphics = scene.add.graphics();
    this.fieldGraphics.setDepth(this.depth - 1);

    // 4. Initialize default stats from Level 1
    this.updateStats(this.upgrades);
  }

  public getMagnetPosition(): Phaser.Math.Vector2 {
    const forwardOffset = GAME_CONSTANTS.MAGNET_FORWARD_OFFSET;
    return new Phaser.Math.Vector2(
      this.x + Math.cos(this.rotation) * forwardOffset,
      this.y + Math.sin(this.rotation) * forwardOffset
    );
  }

  public getAvailableCapacityKg(): number {
    return Math.max(0, Math.round((this.cargo.maxCapacityKg - this.cargo.currentMassKg) * 100) / 100);
  }

  public canCollect(massKg: number): boolean {
    return (this.cargo.currentMassKg + massKg) <= (this.cargo.maxCapacityKg + 0.001);
  }

  public addItem(item: ScrapItemData): boolean {
    if (!this.canCollect(item.massKg)) {
      return false;
    }

    this.cargo.items.push(item);
    this.cargo.currentMassKg = Math.round((this.cargo.currentMassKg + item.massKg) * 100) / 100;
    this.cargo.itemsCount = this.cargo.items.length;
    this.cargo.isFull = this.cargo.currentMassKg >= this.cargo.maxCapacityKg - 0.001;
    this.updateCargoVisual();

    // Squash & stretch juice on cargo sprite
    if (this.cargoSprite && this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this.cargoSprite);
      this.cargoSprite.setScale(1.22, 0.82);
      this.scene.tweens.add({
        targets: this.cargoSprite,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 160,
        ease: 'Back.out',
      });
    }

    return true;
  }

  public emptyCargo(): ScrapItemData[] {
    const dumped = [...this.cargo.items];
    this.cargo.items = [];
    this.cargo.currentMassKg = 0;
    this.cargo.itemsCount = 0;
    this.cargo.isFull = false;
    this.updateCargoVisual();
    return dumped;
  }

  public clearCargo(): void {
    this.emptyCargo();
  }

  public disableMagnet(durationMs: number = 3000, currentTime: number = Date.now()): void {
    this.isMagnetDisabled = true;
    this.magnetDisabledUntil = Math.max(this.magnetDisabledUntil, currentTime + durationMs);
  }

  /**
   * Knocks loose a specific number of items from cargo (e.g. from Scrap Critter contact).
   */
  public ejectCargo(count: number = 1): ScrapItemData[] {
    const toEject = Math.min(count, this.cargo.items.length);
    if (toEject <= 0) return [];

    const ejected: ScrapItemData[] = [];
    for (let i = 0; i < toEject; i++) {
      const item = this.cargo.items.pop();
      if (item) {
        ejected.push(item);
      }
    }

    const removedMass = ejected.reduce((acc, it) => acc + it.massKg, 0);
    this.cargo.currentMassKg = Math.max(0, Math.round((this.cargo.currentMassKg - removedMass) * 100) / 100);
    this.cargo.itemsCount = this.cargo.items.length;
    this.cargo.isFull = this.cargo.currentMassKg >= this.cargo.maxCapacityKg - 0.001;
    this.updateCargoVisual();
    return ejected;
  }

  /**
   * Dumps a percentage of cargo (e.g. 30% from EMP mine blast).
   */
  public dumpCargoPercentage(percentage: number = 0.3): ScrapItemData[] {
    const totalItems = this.cargo.items.length;
    if (totalItems === 0) return [];
    const countToDump = Math.max(1, Math.ceil(totalItems * percentage));
    return this.ejectCargo(countToDump);
  }

  private updateCargoVisual(): void {
    const ratio = this.cargo.currentMassKg / Math.max(1, this.cargo.maxCapacityKg);
    if (ratio <= 0.01) {
      this.cargoSprite.setTexture('cargo_empty');
    } else if (ratio < 0.36) {
      this.cargoSprite.setTexture('cargo_low');
    } else if (ratio < 0.76) {
      this.cargoSprite.setTexture('cargo_med');
    } else {
      this.cargoSprite.setTexture('cargo_high');
    }
  }

  public updateStats(
    upgrades: PlayerUpgrades,
    buffs?: { overcharge?: boolean; fever?: boolean },
    prestigePerks?: Record<string, number>
  ): void {
    this.upgrades = { ...upgrades };
    if (buffs) {
      if (buffs.overcharge !== undefined) this.isOvercharged = buffs.overcharge;
      if (buffs.fever !== undefined) this.isFever = buffs.fever;
    }

    let radius = getMagnetRange(this.upgrades.magnetRange) + (prestigePerks?.magnet_aura || 0) * 15;
    let power = getAttractPower(this.upgrades.attractPower);
    let speed = getMovementSpeed(this.upgrades.movementSpeed) + (prestigePerks?.swift_treads || 0) * 12;
    const capacity = getCarryCapacity(this.upgrades.carryCapacity) + (prestigePerks?.titan_cargo || 0) * 4;

    if (this.isOvercharged) {
      radius += 100;
      power *= 3;
    }

    // 2.0x attraction radius in Fever Mode
    if (this.isFever) {
      radius *= 2.0;
    }

    this.effectiveRadius = radius;
    this.effectivePower = power;
    this.effectiveSpeed = speed;
    this.cargo.maxCapacityKg = capacity;
    this.cargo.isFull = this.cargo.currentMassKg >= this.cargo.maxCapacityKg - 0.001;
    this.updateCargoVisual();

    // Visual evolution: swap chassis texture based on upgrade tier
    const avgLvl = (this.upgrades.magnetRange + this.upgrades.attractPower + this.upgrades.carryCapacity + this.upgrades.movementSpeed) / 4;
    if (avgLvl >= 7) {
      if (this.scene.textures.exists('rover_chassis_elite')) {
        this.chassisSprite.setTexture('rover_chassis_elite');
      }
    } else if (avgLvl >= 4) {
      if (this.scene.textures.exists('rover_chassis_reinforced')) {
        this.chassisSprite.setTexture('rover_chassis_reinforced');
      }
    } else {
      if (this.scene.textures.exists('rover_chassis')) {
        this.chassisSprite.setTexture('rover_chassis');
      }
    }
  }

  public setFever(active: boolean): void {
    this.isFever = active;
    this.updateStats(this.upgrades, { fever: active, overcharge: this.isOvercharged });
  }

  public updateMovement(deltaMs: number, inputVector: Phaser.Math.Vector2, time: number): void {
    const deltaSec = deltaMs / 1000;

    // Unified steering & velocity kinematics
    if (inputVector.lengthSq() > 0.005) {
      const targetAngle = inputVector.angle();
      this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, targetAngle, this.turnRate * deltaSec);

      const targetSpeed = this.effectiveSpeed * Math.min(1.0, inputVector.length());
      const vx = Math.cos(this.rotation) * targetSpeed;
      const vy = Math.sin(this.rotation) * targetSpeed;

      this.body.setVelocity(vx, vy);
    } else {
      // Smooth drag deceleration
      const currentSpeedSq = this.body.velocity.lengthSq();
      if (currentSpeedSq > 1) {
        const decay = Math.max(0, 1 - (this.dragDecel * deltaSec) / Math.max(1, this.effectiveSpeed));
        this.body.setVelocity(this.body.velocity.x * decay, this.body.velocity.y * decay);
      } else {
        this.body.setVelocity(0, 0);
      }
    }

    // Update Magnet Disabled Timer
    if (this.isMagnetDisabled && time > this.magnetDisabledUntil) {
      this.isMagnetDisabled = false;
      this.magnetDisabledUntil = 0;
    }

    // Dynamic field ring graphics
    this.renderFieldGraphics(time);

    // High-speed dust trail emission (velocity > 130 px/s)
    const currentSpeed = this.body ? this.body.velocity.length() : 0;
    if (currentSpeed > 130 && time >= this.nextDustEmitTime) {
      this.nextDustEmitTime = time + 65;
      const junkyard = this.scene as any;
      if (junkyard && junkyard.roverDustEmitter && junkyard.roverDustEmitter.active) {
        const rearAngle = this.rotation + Math.PI;
        const cosA = Math.cos(rearAngle);
        const sinA = Math.sin(rearAngle);
        const perpCos = -sinA;
        const perpSin = cosA;
        junkyard.roverDustEmitter.emitParticleAt(
          this.x + cosA * 18 + perpCos * 14,
          this.y + sinA * 18 + perpSin * 14,
          1
        );
        junkyard.roverDustEmitter.emitParticleAt(
          this.x + cosA * 18 - perpCos * 14,
          this.y + sinA * 18 - perpSin * 14,
          1
        );
      }
    }
  }

  private renderFieldGraphics(time: number): void {
    this.fieldGraphics.clear();
    const magnetPos = this.getMagnetPosition();
    const radius = this.effectiveRadius;

    if (this.isMagnetDisabled) {
      // Disabled Magnet: Distorted, flickering gray/sparks
      const flash = Math.sin(time * 0.04) > 0;
      if (flash) {
        this.fieldGraphics.lineStyle(2, 0x78909c, 0.6);
        this.fieldGraphics.strokeCircle(magnetPos.x, magnetPos.y, radius * 0.4);
      }
      return;
    }

    if (this.isFever) {
      // Rainbow / Chromatic Field Visuals during Fever Mode
      const rainbowColors = [0xff1744, 0xff9100, 0xffea00, 0x00e676, 0x00e5ff, 0xd500f9];
      const segmentCount = 6;
      const arcLength = (Math.PI * 2) / segmentCount - 0.25;
      const rot = time * 0.004;

      // Soft rotating outer glow ring
      const primaryColor =
        typeof Phaser.Display?.Color?.HSLToColor === 'function'
          ? Phaser.Display.Color.HSLToColor((time * 0.001) % 1, 1, 0.5).color
          : 0x00e5ff;

      this.fieldGraphics.lineStyle(6, primaryColor, 0.35);
      this.fieldGraphics.strokeCircle(magnetPos.x, magnetPos.y, radius);

      // Rotating chromatic rainbow arc segments
      for (let i = 0; i < segmentCount; i++) {
        const col = rainbowColors[i % rainbowColors.length];
        this.fieldGraphics.lineStyle(3.5, col, 0.95);
        const startAngle = rot + (i * Math.PI * 2) / segmentCount;
        const endAngle = startAngle + arcLength;

        this.fieldGraphics.beginPath();
        this.fieldGraphics.arc(magnetPos.x, magnetPos.y, radius, startAngle, endAngle);
        this.fieldGraphics.strokePath();
      }
    } else if (this.cargo.isFull) {
      // Blinking Red Warning Strobe (3 Hz)
      const flash = Math.sin(time * 0.018) > 0;
      this.fieldGraphics.lineStyle(2.5, 0xff1744, flash ? 0.9 : 0.2);
      this.fieldGraphics.strokeCircle(magnetPos.x, magnetPos.y, radius);

      // Warning Tick Marks
      if (flash) {
        const tickLen = 8;
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2 + time * 0.001;
          const x1 = magnetPos.x + Math.cos(angle) * (radius - tickLen);
          const y1 = magnetPos.y + Math.sin(angle) * (radius - tickLen);
          const x2 = magnetPos.x + Math.cos(angle) * (radius + tickLen);
          const y2 = magnetPos.y + Math.sin(angle) * (radius + tickLen);
          this.fieldGraphics.lineBetween(x1, y1, x2, y2);
        }
      }
    } else {
      // Rotating Cyan Dashed Arcs with Soft Glow
      // Soft outer glow ring
      this.fieldGraphics.lineStyle(5, 0x00e5ff, 0.15);
      this.fieldGraphics.strokeCircle(magnetPos.x, magnetPos.y, radius);

      // Rotating dashed arc segments
      const segmentCount = 4;
      const arcLength = (Math.PI * 2) / segmentCount - 0.4;
      const rot = time * 0.002;

      this.fieldGraphics.lineStyle(2.5, 0x00e5ff, 0.8);
      for (let i = 0; i < segmentCount; i++) {
        const startAngle = rot + (i * Math.PI * 2) / segmentCount;
        const endAngle = startAngle + arcLength;

        this.fieldGraphics.beginPath();
        this.fieldGraphics.arc(magnetPos.x, magnetPos.y, radius, startAngle, endAngle);
        this.fieldGraphics.strokePath();
      }
    }
  }

  public override destroy(fromScene?: boolean): void {
    if (this.scene && this.scene.tweens && this.cargoSprite) {
      this.scene.tweens.killTweensOf(this.cargoSprite);
    }
    if (this.fieldGraphics) {
      this.fieldGraphics.destroy();
    }
    super.destroy(fromScene);
  }
}
