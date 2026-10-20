// ============================================================================
// Magnet Junkyard - Daily Login Rewards & Retention Streak
// ============================================================================

export interface DailyLoginStatus {
  canClaim: boolean;
  streakDay: number; // 1 to 7
  rewardCoins: number;
  streakDays: number[];
  allRewards: number[];
}

export class DailyLoginManager {
  public static readonly DAILY_REWARDS = [100, 150, 200, 300, 450, 600, 1000];
  public static readonly STORAGE_KEY = 'magnet_junkyard_daily_login';

  private storage: Storage | any;

  constructor(storage?: any) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  }

  private getDateString(timestamp: number = Date.now()): string {
    const d = new Date(timestamp);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  public getStatus(currentTime: number = Date.now()): DailyLoginStatus {
    const todayStr = this.getDateString(currentTime);
    const data = this.loadData();

    let streakDay = data.streak || 1;
    let canClaim = false;

    if (!data.lastClaimDate) {
      // First time player
      canClaim = true;
      streakDay = 1;
    } else if (data.lastClaimDate === todayStr) {
      // Already claimed today
      canClaim = false;
    } else {
      // Check if consecutive day in UTC calendar days
      const lastDayEpoch = Math.floor(new Date(data.lastClaimDate + 'T00:00:00Z').getTime() / 86400000);
      const todayEpoch = Math.floor(new Date(todayStr + 'T00:00:00Z').getTime() / 86400000);
      const diffDays = todayEpoch - lastDayEpoch;

      if (diffDays === 1) {
        // Consecutive day
        streakDay = (streakDay % 7) + 1;
        canClaim = true;
      } else if (diffDays > 1) {
        // Missed day -> reset to Day 1
        streakDay = 1;
        canClaim = true;
      }
    }

    const rewardCoins = DailyLoginManager.DAILY_REWARDS[streakDay - 1];

    return {
      canClaim,
      streakDay,
      rewardCoins,
      streakDays: [1, 2, 3, 4, 5, 6, 7],
      allRewards: DailyLoginManager.DAILY_REWARDS,
    };
  }

  public claim(doubleWithAd: boolean = false, currentTime: number = Date.now()): number {
    const status = this.getStatus(currentTime);
    if (!status.canClaim) return 0;

    const baseReward = status.rewardCoins;
    const finalReward = doubleWithAd ? baseReward * 2 : baseReward;

    this.saveData({
      lastClaimDate: this.getDateString(currentTime),
      streak: status.streakDay,
    });

    return finalReward;
  }

  private loadData(): { lastClaimDate?: string; streak?: number } {
    if (!this.storage) return {};
    try {
      const raw = this.storage.getItem(DailyLoginManager.STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return {};
  }

  private saveData(data: { lastClaimDate: string; streak: number }): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(DailyLoginManager.STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore
    }
  }
}
