import OpenAI from 'openai';

// Initialize OpenAI client (API key will be set from environment variable)
let openai = null;

export function initializeOpenAI(apiKey) {
  if (apiKey) {
    openai = new OpenAI({ apiKey });
    console.log('OpenAI API initialized for AI player');
  } else {
    console.warn('No OpenAI API key provided - AI player will use random prices');
  }
}

export function isOpenAIInitialized() {
  return openai !== null;
}

export async function getAIPriceDecision(config, history = [], opponentHistory = []) {
  // If OpenAI is not initialized, return a random price
  if (!openai) {
    const randomPrice = config.priceBounds.min + Math.random() * (config.priceBounds.max - config.priceBounds.min);
    return Math.round(randomPrice * 100) / 100;
  }

  try {
    // Build the game description
    const gameDescription = buildGamePrompt(config, history, opponentHistory);
    
    // Call ChatGPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert in game theory and pricing strategy. You are playing a competitive pricing game. Analyze the situation carefully and provide ONLY a numerical price value as your response, nothing else."
        },
        {
          role: "user",
          content: gameDescription
        }
      ],
      temperature: 0.7,
      max_tokens: 50
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Extract the number from the response
    const priceMatch = responseText.match(/[\d.]+/);
    if (priceMatch) {
      let price = parseFloat(priceMatch[0]);
      
      // Ensure price is within bounds
      price = Math.max(config.priceBounds.min, Math.min(config.priceBounds.max, price));
      price = Math.round(price * 100) / 100; // Round to 2 decimal places
      
      console.log(`[AI Player] ChatGPT suggested price: ${price}`);
      return price;
    } else {
      console.warn('[AI Player] Could not parse price from ChatGPT response, using random price');
      const randomPrice = config.priceBounds.min + Math.random() * (config.priceBounds.max - config.priceBounds.min);
      return Math.round(randomPrice * 100) / 100;
    }
  } catch (error) {
    console.error('[AI Player] Error calling OpenAI API:', error.message);
    // Fallback to random price
    const randomPrice = config.priceBounds.min + Math.random() * (config.priceBounds.max - config.priceBounds.min);
    return Math.round(randomPrice * 100) / 100;
  }
}

function buildGamePrompt(config, history, opponentHistory) {
  const currentRound = history.length + 1;
  
  let prompt = `You are playing a competitive pricing game. Here are the rules:

GAME RULES:
- Market size: ${config.marketSize} units
- Price range: $${config.priceBounds.min} to $${config.priceBounds.max}
- Total rounds: ${config.rounds}
- Current round: ${currentRound}

DEMAND MODEL (Logit):
Your demand = MarketSize × exp(-alpha × YourPrice) / [exp(-alpha × YourPrice) + exp(-alpha × OpponentPrice)]
Where alpha = ${config.alpha}, sigma = ${config.sigma}

This means:
- If you set a LOWER price than your opponent, you get MORE demand
- If you set a HIGHER price than your opponent, you get LESS demand
- Your profit = YourPrice × YourDemand

OBJECTIVE:
Maximize your total profit across all rounds.
`;

  // Add history if this is not the first round
  if (history.length > 0) {
    prompt += `\n\nGAME HISTORY:\n`;
    
    for (let i = 0; i < history.length; i++) {
      const myRound = history[i];
      const oppRound = opponentHistory[i];
      
      prompt += `Round ${myRound.round}:
  Your price: $${myRound.price.toFixed(2)} → Demand: ${myRound.demand.toFixed(1)} → Profit: $${myRound.profit.toFixed(2)}
  Opponent price: $${myRound.opponentPrice.toFixed(2)} → Demand: ${oppRound.demand.toFixed(1)} → Profit: $${oppRound.profit.toFixed(2)}
`;
    }
    
    // Calculate cumulative profits
    const myTotalProfit = history.reduce((sum, r) => sum + r.profit, 0);
    const oppTotalProfit = opponentHistory.reduce((sum, r) => sum + r.profit, 0);
    
    prompt += `\nCumulative Profit:
  Your total: $${myTotalProfit.toFixed(2)}
  Opponent total: $${oppTotalProfit.toFixed(2)}
`;
  }

  prompt += `\n\nDECISION:
Based on the game rules${history.length > 0 ? ' and the history above' : ''}, what price will you set for round ${currentRound}?

Consider:
1. Your opponent's pricing patterns (if any)
2. The trade-off between price and market share
3. The remaining rounds (${config.rounds - currentRound + 1} left including this one)

Respond with ONLY the numerical price value (e.g., "15.50" or "42.00"), nothing else.`;

  return prompt;
}

