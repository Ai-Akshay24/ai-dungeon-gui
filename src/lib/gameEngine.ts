// Local Game Engine - Handles all game mechanics and state
export interface Quest {
  id: string;
  title: string;
  description: string;
  region: string;
  completed: boolean;
  crystal?: string;
}

export interface GameState {
  health: number;
  maxHealth: number;
  inventory: Item[];
  gold: number;
  currentLocation: string;
  experience: number;
  level: number;
  currentAct: number;
  currentRegion: string;
  activeQuests: Quest[];
  completedQuests: string[];
  crystalsRestored: string[];
  storyPhase: 'awakening' | 'exploration' | 'finale';
}

export interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'potion' | 'key' | 'treasure';
  value: number;
  description: string;
  effect?: {
    health?: number;
    damage?: number;
    defense?: number;
  };
}

export const INITIAL_STATE: GameState = {
  health: 100,
  maxHealth: 100,
  inventory: [
    {
      id: 'starter-sword',
      name: 'Rusty Sword',
      type: 'weapon',
      value: 10,
      description: 'A worn but reliable blade',
      effect: { damage: 15 }
    },
    {
      id: 'health-potion',
      name: 'Health Potion',
      type: 'potion',
      value: 25,
      description: 'Restores 30 HP',
      effect: { health: 30 }
    }
  ],
  gold: 50,
  currentLocation: 'Eldergrove Village',
  experience: 0,
  level: 1,
  currentAct: 1,
  currentRegion: 'Eldergrove',
  activeQuests: [
    {
      id: 'awakening',
      title: 'The Awakening',
      description: 'Meet the Elder and learn about the corrupted crystals',
      region: 'Eldergrove',
      completed: false
    }
  ],
  completedQuests: [],
  crystalsRestored: [],
  storyPhase: 'awakening'
};

export class GameEngine {
  private state: GameState;

  constructor(initialState: GameState = INITIAL_STATE) {
    this.state = { ...initialState };
  }

  getState(): GameState {
    return { ...this.state };
  }

  setState(newState: Partial<GameState>): void {
    this.state = { ...this.state, ...newState };
  }

  // Combat mechanics
  takeDamage(amount: number): { newHealth: number; isDead: boolean } {
    this.state.health = Math.max(0, this.state.health - amount);
    return {
      newHealth: this.state.health,
      isDead: this.state.health === 0
    };
  }

  heal(amount: number): number {
    const oldHealth = this.state.health;
    this.state.health = Math.min(this.state.maxHealth, this.state.health + amount);
    return this.state.health - oldHealth;
  }

  // Inventory management
  addItem(item: Item): void {
    this.state.inventory.push(item);
  }

  removeItem(itemId: string): Item | null {
    const index = this.state.inventory.findIndex(i => i.id === itemId);
    if (index === -1) return null;
    const item = this.state.inventory[index];
    this.state.inventory.splice(index, 1);
    return item;
  }

  useItem(itemId: string): { success: boolean; message: string; effect?: any } {
    const item = this.state.inventory.find(i => i.id === itemId);
    if (!item) return { success: false, message: 'Item not found' };

    if (item.type === 'potion' && item.effect?.health) {
      const healed = this.heal(item.effect.health);
      this.removeItem(itemId);
      return {
        success: true,
        message: `Used ${item.name}. Restored ${healed} HP!`,
        effect: { healthRestored: healed }
      };
    }

    return { success: false, message: 'Cannot use this item now' };
  }

  // Economy
  addGold(amount: number): void {
    this.state.gold += amount;
  }

  spendGold(amount: number): boolean {
    if (this.state.gold >= amount) {
      this.state.gold -= amount;
      return true;
    }
    return false;
  }

  // Progress
  gainExperience(amount: number): { leveledUp: boolean; newLevel?: number } {
    this.state.experience += amount;
    const expNeeded = this.state.level * 100;
    
    if (this.state.experience >= expNeeded) {
      this.state.level++;
      this.state.experience -= expNeeded;
      this.state.maxHealth += 20;
      this.state.health = this.state.maxHealth;
      return { leveledUp: true, newLevel: this.state.level };
    }
    
    return { leveledUp: false };
  }

  // Quest management
  completeQuest(questId: string): void {
    const quest = this.state.activeQuests.find(q => q.id === questId);
    if (quest) {
      quest.completed = true;
      this.state.completedQuests.push(questId);
      this.state.activeQuests = this.state.activeQuests.filter(q => q.id !== questId);
    }
  }

  addQuest(quest: Quest): void {
    if (!this.state.activeQuests.find(q => q.id === quest.id)) {
      this.state.activeQuests.push(quest);
    }
  }

  restoreCrystal(crystalType: string): void {
    if (!this.state.crystalsRestored.includes(crystalType)) {
      this.state.crystalsRestored.push(crystalType);
      
      // Progress story phase
      if (this.state.crystalsRestored.length === 1 && this.state.currentAct === 1) {
        this.state.currentAct = 2;
        this.state.storyPhase = 'exploration';
      } else if (this.state.crystalsRestored.length === 5) {
        this.state.currentAct = 3;
        this.state.storyPhase = 'finale';
      }
    }
  }

  // Command parsing helpers
  parseCommand(command: string): {
    action: string;
    target?: string;
    itemName?: string;
  } {
    const lower = command.toLowerCase().trim();
    
    if (lower.includes('attack')) {
      return { action: 'attack', target: this.extractTarget(lower) };
    }
    if (lower.includes('defend') || lower.includes('block')) {
      return { action: 'defend' };
    }
    if (lower.includes('open') || lower.includes('unlock')) {
      return { action: 'unlock', target: this.extractTarget(lower) };
    }
    if (lower.includes('pickup') || lower.includes('take') || lower.includes('grab')) {
      return { action: 'pickup', itemName: this.extractTarget(lower) };
    }
    if (lower.includes('use')) {
      return { action: 'use', itemName: this.extractTarget(lower) };
    }
    if (lower.includes('inventory')) {
      return { action: 'inventory' };
    }
    
    return { action: 'explore' };
  }

  private extractTarget(command: string): string {
    const words = command.split(' ');
    return words.slice(1).join(' ') || 'unknown';
  }
}

export const gameEngine = new GameEngine();
