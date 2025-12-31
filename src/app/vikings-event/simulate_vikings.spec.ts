
import { calculateAssignments } from './vikings-assignment-logic';
import { CharacterAssignment, VikingsStatus } from './vikings.types';

function createMockCharacter(id: string, status: VikingsStatus, confidence: number = 0.5): CharacterAssignment {
    return {
        characterId: id,
        characterName: `User ${id}`,
        powerLevel: 10_000_000,
        marchesCount: 6,
        status: status,
        mainCharacterId: undefined,
        extraMarches: 0,
        reinforcementCapacity: 1_500_000, // 10 reinforcements ~ 1.5M / 150k
        confidenceLevel: confidence,
        reinforce: []
    };
}

function runSimulation() {
    // Scenario: 10 Online, 10 OfflineEmpty, 10 OfflineNotEmpty
    // Online have high confidence (0.9), others Low (0.5)

    const online = Array.from({ length: 10 }, (_, i) => createMockCharacter(`ON_${i}`, 'online', 0.9));
    const offEmpty = Array.from({ length: 10 }, (_, i) => createMockCharacter(`OE_${i}`, 'offline_empty', 0.5));
    const offBusy = Array.from({ length: 10 }, (_, i) => createMockCharacter(`OB_${i}`, 'offline_not_empty', 0.1));

    const allChars = [...online, ...offEmpty, ...offBusy];

    console.log("Running Assignment...");
    const start = Date.now();
    const result = calculateAssignments(allChars);
    console.log(`Assignment took ${Date.now() - start}ms`);

    // Metrics
    let totalOnlineScore = 0;
    let totalOfflineEmptyScore = 0;
    let onlineSurvivors = 0;
    let offlineEmptySurvivors = 0;

    const survivalThreshold = 1.5; // Arbitrary for comparison

    result.forEach(c => {
        let expectedReinforcement = 0;
        // Calculate Expected Reinforcement from Sources
        const sources = result.filter(s => s.reinforce.some(r => r.characterId === c.characterId));
        sources.forEach(s => {
            expectedReinforcement += (s.confidenceLevel || 0.5);
        });

        if (c.status === 'online') {
            if (expectedReinforcement >= survivalThreshold) onlineSurvivors++;
            // Calculate "Value" based on doc? Or just raw expected value?
            // Doc says maximize "score". If score is marginal, integral is total utility.
            // Let's just track Avg Expected Reinforcement.
            totalOnlineScore += expectedReinforcement;
        } else if (c.status === 'offline_empty') {
            if (expectedReinforcement >= survivalThreshold) offlineEmptySurvivors++;
            totalOfflineEmptyScore += expectedReinforcement;
        }
    });

    console.log("\n--- Results ---");
    console.log(`Online: Survivors (Exp >= ${survivalThreshold}): ${onlineSurvivors}/10`);
    console.log(`Online: Avg Expected Reinforcement: ${(totalOnlineScore / 10).toFixed(2)}`);
    console.log(`OfflineEmpty: Survivors: ${offlineEmptySurvivors}/10`);
    console.log(`OfflineEmpty: Avg Expected Reinforcement: ${(totalOfflineEmptyScore / 10).toFixed(2)}`);
}

runSimulation();
