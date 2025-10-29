import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { gameEngine, GameState } from "@/lib/gameEngine";
import { Heart, Coins, Scroll, Sword, Shield, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState>(gameEngine.getState());
  const [showInventory, setShowInventory] = useState(false);
  const [command, setCommand] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Starting narrative
  useEffect(() => {
    if (!gameStarted) {
      setMessages([{
        role: "assistant",
        content: "You awaken in Eldergrove Village, a peaceful settlement on the edge of darkness. The village Elder urgently seeks you - whispers speak of corrupted crystals and a looming shadow. Your journey as the Chosen One begins now."
      }]);
      setGameStarted(true);
    }
  }, [gameStarted]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCommand = async (cmd: string) => {
    if (!cmd.trim() || isLoading) return;
    
    setIsLoading(true);
    setCommand("");
    
    const userMessage: Message = { role: "user", content: cmd };
    setMessages((prev) => [...prev, userMessage]);

    // Local game logic
    const parsedCmd = gameEngine.parseCommand(cmd);
    
    // Handle inventory locally
    if (parsedCmd.action === 'inventory') {
      setShowInventory(true);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Opening your inventory..."
      }]);
      setIsLoading(false);
      return;
    }

    try {
      const history = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const { data, error } = await supabase.functions.invoke("dungeon-master", {
        body: {
          action: cmd,
          history: history,
          currentState: gameEngine.getState(),
        },
      });

      if (error) throw error;

      // Update game state from AI response
      if (data.gameEffects) {
        const effects = data.gameEffects;
        
        if (effects.healthChange) {
          if (effects.healthChange < 0) {
            gameEngine.takeDamage(Math.abs(effects.healthChange));
          } else {
            gameEngine.heal(effects.healthChange);
          }
        }
        
        if (effects.goldChange) gameEngine.addGold(effects.goldChange);
        if (effects.experienceGain) {
          const result = gameEngine.gainExperience(effects.experienceGain);
          if (result.leveledUp) {
            toast({
              title: "Level Up!",
              description: `You reached level ${result.newLevel}!`,
            });
          }
        }
        
        if (effects.itemsFound?.length > 0) {
          effects.itemsFound.forEach((item: any) => gameEngine.addItem(item));
        }
        
        if (effects.locationUpdate) {
          gameEngine.setState({ currentLocation: effects.locationUpdate });
        }

        if (effects.questUpdate) {
          const { questId, status } = effects.questUpdate;
          if (status === 'complete') {
            gameEngine.completeQuest(questId);
            toast({
              title: "Quest Complete!",
              description: `You completed a quest!`,
            });
          }
        }

        if (effects.crystalRestored) {
          gameEngine.restoreCrystal(effects.crystalRestored);
          toast({
            title: "Crystal Restored!",
            description: `${effects.crystalRestored} Crystal has been purified!`,
          });
        }
      }

      setGameState(gameEngine.getState());

      const assistantMessage: Message = {
        role: "assistant",
        content: data.narrative,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.imageUrl) setImageUrl(data.imageUrl);

    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to process command",
        variant: "destructive",
      });

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "The mystical forces are disturbed... Try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCommand(command);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.1),_transparent_50%),_linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--background)/0.95))] p-2 md:p-4">
      <div className="max-w-[1800px] mx-auto h-screen flex flex-col gap-2">
        
        <header className="glass-panel rounded-xl p-3 shadow-[0_8px_32px_hsl(var(--primary)/0.15)] flex-shrink-0 border-t border-primary/20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight glow-text" style={{
                background: 'linear-gradient(120deg, hsl(var(--primary)), hsl(var(--primary-glow)), hsl(var(--secondary)))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Chronicles of Aethermoor
              </h1>
              <p className="text-xs text-muted-foreground/80 mt-1 font-medium">{gameState.currentLocation}</p>
            </div>
            
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex items-center gap-2 bg-gradient-to-br from-destructive/10 to-destructive/5 px-3 py-1.5 rounded-lg border border-destructive/30 shadow-sm">
                <Heart className="w-4 h-4 text-destructive drop-shadow-[0_0_6px_hsl(var(--destructive)/0.6)]" />
                <div className="min-w-[80px]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{gameState.health}/{gameState.maxHealth}</span>
                  </div>
                  <Progress value={(gameState.health / gameState.maxHealth) * 100} className="h-1.5 mt-1" />
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-gradient-to-br from-secondary/10 to-secondary/5 px-3 py-1.5 rounded-lg border border-secondary/30 shadow-sm">
                <Coins className="w-4 h-4 text-secondary drop-shadow-[0_0_6px_hsl(var(--secondary)/0.6)]" />
                <span className="text-sm font-bold">{gameState.gold}</span>
              </div>
              
              <div className="flex items-center gap-2 bg-gradient-to-br from-accent/10 to-accent/5 px-3 py-1.5 rounded-lg border border-accent/30 shadow-sm">
                <Scroll className="w-4 h-4 text-accent drop-shadow-[0_0_6px_hsl(var(--accent)/0.6)]" />
                <span className="text-sm font-bold">Lvl {gameState.level}</span>
              </div>

              <div className="flex items-center gap-2 bg-gradient-to-br from-primary/10 to-primary/5 px-3 py-1.5 rounded-lg border border-primary/30 shadow-sm">
                <span className="text-xs font-bold">Act {gameState.currentAct}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs font-bold">💎 {gameState.crystalsRestored.length}/5</span>
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowInventory(!showInventory)}
                className="border-primary/40 hover:border-primary/70 hover:bg-primary/10 transition-all duration-300 shadow-sm"
              >
                <Package className="w-4 h-4 mr-2" />
                {showInventory ? 'Quests' : 'Inventory'}
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-2 min-h-0 overflow-hidden">
          
          <div className="lg:col-span-2 relative overflow-hidden rounded-xl glass-panel shadow-[0_8px_32px_hsl(var(--secondary)/0.12)] border-t border-secondary/20">
            {imageUrl ? (
              <img src={imageUrl} alt="Scene" className="w-full h-full object-cover opacity-95" />
            ) : (
              <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--primary)/0.08),_transparent_70%)]" />
                <div className="text-center relative z-10">
                  {isLoading ? (
                    <div className="animate-pulse">
                      <Sword className="w-16 h-16 mx-auto text-primary mb-4 animate-bounce drop-shadow-[0_0_12px_hsl(var(--primary)/0.5)]" />
                      <p className="text-muted-foreground font-medium">Conjuring scene...</p>
                    </div>
                  ) : (
                    <>
                      <Shield className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground/70 font-medium">Your adventure awaits</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 overflow-hidden">
            {showInventory ? (
              <div className="flex-1 glass-panel rounded-xl p-4 shadow-[0_8px_32px_hsl(var(--primary)/0.12)] overflow-hidden flex flex-col border-t border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-primary glow-text">Quest Log</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowInventory(false)} className="hover:bg-primary/10">Close</Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground mb-2">ACTIVE QUESTS</h4>
                      {gameState.activeQuests.length > 0 ? (
                        gameState.activeQuests.map((quest) => (
                          <div key={quest.id} className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 rounded-lg p-3 mb-2">
                            <p className="font-bold text-sm text-foreground">{quest.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{quest.description}</p>
                            <p className="text-xs text-primary mt-1">📍 {quest.region}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No active quests</p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground mb-2">CRYSTALS</h4>
                      <div className="grid grid-cols-5 gap-1">
                        {['Nature', 'Water', 'Fire', 'Air', 'Earth'].map(crystal => (
                          <div key={crystal} className={`h-10 rounded border flex items-center justify-center text-xs ${
                            gameState.crystalsRestored.includes(crystal)
                              ? 'bg-primary/20 border-primary/50 text-primary'
                              : 'bg-card/30 border-border/30 text-muted-foreground'
                          }`}>
                            💎
                          </div>
                        ))}
                      </div>
                    </div>

                    {gameState.completedQuests.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground mb-2">COMPLETED ({gameState.completedQuests.length})</h4>
                        <p className="text-xs text-muted-foreground/60">Quest archive available</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex-1 glass-panel rounded-xl overflow-hidden flex flex-col shadow-[0_8px_32px_hsl(var(--primary)/0.12)] border-t border-primary/20">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3 pb-4">
                    {messages.map((msg, i) => (
                      <div key={i} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block max-w-[90%] p-2.5 rounded-lg shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-gradient-to-br from-primary/25 to-primary/15 border border-primary/40 text-foreground' 
                            : 'bg-gradient-to-br from-secondary/15 to-secondary/5 border border-secondary/25 text-foreground'
                        }`}>
                          <p className="text-xs font-bold mb-1 opacity-70">
                            {msg.role === 'user' ? 'You' : 'DM'}
                          </p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                <div className="border-t border-border/50 p-3 bg-gradient-to-b from-transparent to-background/40 backdrop-blur-sm">
                  <form onSubmit={handleSubmit} className="flex gap-2">
                    <Input
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="What do you do?"
                      className="flex-1 bg-card/60 border-border/50 focus:border-primary/50 text-sm h-9 shadow-sm"
                      disabled={isLoading}
                    />
                    <Button
                      type="submit"
                      disabled={!command.trim() || isLoading}
                      className="h-9 px-4 shadow-[0_4px_12px_hsl(var(--primary)/0.3)] hover:shadow-[0_6px_16px_hsl(var(--primary)/0.4)] transition-all"
                      style={{
                        background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))',
                      }}
                      size="sm"
                    >
                      {isLoading ? '...' : 'Act'}
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
