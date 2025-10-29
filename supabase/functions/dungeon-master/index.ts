import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2';
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, history, currentState } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    console.log('Processing command:', { action, health: currentState?.health });

    const systemPrompt = `You are a Dungeon Master for "Chronicles of Aethermoor" - a structured fantasy RPG with natural language understanding.

=== STORY STRUCTURE ===
ACT 1 - THE AWAKENING (Eldergrove): Learn about the Shadow Lich and corrupted crystals. Meet the Elder who reveals you're the Chosen One.

ACT 2 - THE FIVE CRYSTALS (Semi-Open World): Restore 5 Elemental Crystals in any order:
- Nature Crystal (Whispering Woods): Ancient forest, corrupted by dark vines
- Water Crystal (Azure Depths): Underwater temple, flooded caves
- Fire Crystal (Ember Mountains): Volcanic peaks, lava flows
- Air Crystal (Sky Citadel): Floating fortress, wind elementals
- Earth Crystal (Stone Hollow): Underground caverns, rock golems

ACT 3 - THE FINALE (Shadow Keep): Confront the Shadow Lich using all 5 crystals.

=== PLAYER STATE ===
Health: ${currentState?.health || 100}/${currentState?.maxHealth || 100} | Gold: ${currentState?.gold || 50} | Level: ${currentState?.level || 1}
Act: ${currentState?.currentAct || 1} | Region: ${currentState?.currentRegion || 'Eldergrove'}
Phase: ${currentState?.storyPhase || 'awakening'}
Crystals: ${currentState?.crystalsRestored?.length || 0}/5 (${currentState?.crystalsRestored?.join(', ') || 'none'})
Active Quests: ${currentState?.activeQuests?.map((q: any) => q.title).join(', ') || 'None'}

=== CRITICAL RULES ===
- MAXIMUM 2-3 LINES PER RESPONSE (40-60 words)
- Guide player based on their current Act/Phase
- Understand natural language commands (fight, explore, talk to elder, etc.)
- Track quest completion and crystal restoration
- If Act 1: Guide to meet Elder, learn story
- If Act 2: Let player choose which crystal region to explore
- If Act 3: Only accessible when all 5 crystals restored

RESPONSE FORMAT (JSON):
{
  "narrative": "2-3 line response",
  "sceneDescription": "Visual scene (one sentence)",
  "gameEffects": {
    "healthChange": 0,
    "goldChange": 0,
    "experienceGain": 0,
    "itemsFound": [],
    "locationUpdate": "",
    "questUpdate": { "questId": "", "status": "complete" },
    "crystalRestored": ""
  }
}`;

    // Generate story response using direct Gemini API
    const conversationText = history.map((msg: any) => 
      `${msg.role}: ${msg.content}`
    ).join('\n') + `\nuser: ${action}`;
    
    const storyResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nConversation:\n${conversationText}\n\nRespond with JSON only.`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.8
        }
      }),
    });

    if (!storyResponse.ok) {
      const errorText = await storyResponse.text();
      console.error('Story generation error:', storyResponse.status, errorText);
      throw new Error(`Story generation failed: ${storyResponse.status}`);
    }

    const storyData = await storyResponse.json();
    console.log('Story response received');
    
    const content = storyData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsedContent;
    
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[1]);
      } else {
        parsedContent = JSON.parse(content);
      }
    } catch (e) {
      console.log('Could not parse as JSON, using raw content:', content);
      parsedContent = {
        narrative: content,
        sceneDescription: content.substring(0, 200),
        gameEffects: {
          healthChange: 0,
          goldChange: 0,
          experienceGain: 0,
          itemsFound: [],
          locationUpdate: "",
          questUpdate: null,
          crystalRestored: ""
        }
      };
    }

    // Generate scene image using Hugging Face
    console.log('Generating scene image...');
    const imagePrompt = `Fantasy RPG scene: ${parsedContent.sceneDescription}. Detailed digital art, dramatic lighting, fantasy game aesthetic.`;

    let imageUrl = '';
    try {
      const HF_TOKEN = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
      if (HF_TOKEN) {
        const hf = new HfInference(HF_TOKEN);
        const imageBlob = await hf.textToImage({
          inputs: imagePrompt,
          model: 'black-forest-labs/FLUX.1-schnell',
        });

        // Convert blob to base64 safely (avoid call stack overflow)
        const arrayBuffer = await imageBlob.arrayBuffer();
        const base64 = base64Encode(arrayBuffer);
        imageUrl = `data:image/png;base64,${base64}`;
        console.log('Image generated successfully');
      } else {
        console.log('HF token not available, skipping image generation');
      }
    } catch (e) {
      console.error('Non-fatal image generation failure:', e);
    }

    return new Response(
      JSON.stringify({
        narrative: parsedContent.narrative,
        sceneDescription: parsedContent.sceneDescription,
        gameEffects: parsedContent.gameEffects || {},
        imageUrl: imageUrl || ''
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in dungeon-master function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        narrative: 'The mystical forces seem disturbed... Please try again.',
        imageUrl: ''
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
