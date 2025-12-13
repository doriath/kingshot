use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Gear {
    pub mastery: i32,
    pub enhancement: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HeroGear {
    pub helmet: Gear,
    pub gloves: Gear,
    pub breastplate: Gear,
    pub boots: Gear,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StatWeights {
    pub lethality: f64,
    pub health: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HeroWeights {
    pub name: String,
    pub gear: HeroGear,
    pub weights: StatWeights,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Stats {
    pub lethality: f64,
    pub health: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GearResult {
    #[serde(rename = "type")]
    pub gear_type: String,
    #[serde(rename = "currentMastery")]
    pub current_mastery: i32,
    #[serde(rename = "recommendedMastery")]
    pub recommended_mastery: i32,
    #[serde(rename = "currentEnhancement")]
    pub current_enhancement: i32,
    #[serde(rename = "recommendedEnhancement")]
    pub recommended_enhancement: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OptimizationResult {
    #[serde(rename = "heroName")]
    pub hero_name: String,
    pub gear: Vec<GearResult>,
    #[serde(rename = "beforeStats")]
    pub before_stats: Stats,
    #[serde(rename = "afterStats")]
    pub after_stats: Stats,
    #[serde(rename = "beforeScore")]
    pub before_score: f64,
    #[serde(rename = "afterScore")]
    pub after_score: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OptimizationOutput {
    pub results: Vec<OptimizationResult>,
    #[serde(rename = "totalBeforeScore")]
    pub total_before_score: f64,
    #[serde(rename = "totalAfterScore")]
    pub total_after_score: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InputData {
    pub heroes: Vec<HeroWeights>,
    pub exp: i32,
}

const EXP_COSTS: [i32; 201] = [
    0, 10, 25, 45, 70, 100, 135, 175, 220, 270, 325, 385, 450, 520, 595, 675, 760, 850, 945, 1045,
    1150, 1260, 1375, 1495, 1620, 1750, 1885, 2025, 2170, 2320, 2480, 2650, 2830, 3020, 3220, 3430,
    3650, 3880, 4120, 4370, 4640, 4930, 5240, 5570, 5920, 6290, 6680, 7090, 7520, 7970, 8440, 8930,
    9440, 9970, 10520, 11090, 11680, 12290, 12920, 13570, 14250, 14960, 15700, 16470, 17270, 18100,
    18960, 19850, 20770, 21720, 22710, 23740, 24810, 25920, 27070, 28260, 29490, 30760, 32070,
    33420, 34820, 36270, 37770, 39320, 40920, 42570, 44270, 46020, 47820, 49670, 51570, 53520,
    55520, 57570, 59670, 61820, 64020, 66270, 68570, 70920, 73320, 73320, 75820, 78370, 80970,
    83620, 86320, 89070, 91870, 94720, 97620, 100570, 103570, 106620, 109720, 112870, 116070,
    119320, 122620, 125970, 125970, 129470, 133020, 136620, 140270, 143970, 147720, 151520, 155370,
    159270, 163220, 167220, 171270, 175370, 179520, 183720, 187970, 192270, 196620, 201020, 201020,
    205470, 209970, 214520, 219120, 223770, 228470, 233220, 238020, 242870, 247770, 252720, 257720,
    262770, 267870, 273020, 278220, 283470, 288770, 294120, 294120, 299620, 305220, 310920, 316720,
    322620, 328620, 334720, 340920, 347220, 353620, 360120, 366720, 373420, 380220, 387120, 394120,
    401220, 408420, 415720, 415720, 423220, 430820, 438520, 446320, 454220, 462220, 470320, 478520,
    486820, 495220, 503720, 512320, 521020, 529820, 538720, 547720, 556820, 566020, 575320, 575320,
];

fn exp_cost(enhancement: i32) -> i32 {
    if enhancement < 0 || enhancement >= EXP_COSTS.len() as i32 {
        return 0;
    }
    EXP_COSTS[enhancement as usize]
}

fn stat(enh: i32, mastery: i32) -> f64 {
    let enh_f = enh as f64;
    let mastery_f = mastery as f64;
    let base = 0.15 + enh_f.min(100.0) * 0.0035 + (enh_f - 100.0).max(0.0) * 0.005;
    base * (1.0 + mastery_f * 0.1)
}

fn calculate_stats(gear: &HeroGear) -> Stats {
    let lethality = stat(gear.helmet.enhancement, gear.helmet.mastery)
        + stat(gear.boots.enhancement, gear.boots.mastery);
    let health = stat(gear.breastplate.enhancement, gear.breastplate.mastery)
        + stat(gear.gloves.enhancement, gear.gloves.mastery);
    Stats { lethality, health }
}


struct OptimizationItem {
    // hero_name: String, // Not strictly needed for calculation but good for debugging
    // gear_type: String,
    is_lethality: bool,
    mastery: i32,
    weights_lethality: f64,
    weights_health: f64,
    current_enhancement: i32,
}


#[wasm_bindgen]
pub fn solve(data: &str) -> String {
    let input: InputData = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(e) => return format!("Error parsing input: {}", e),
    };

    let mut total_exp = input.exp;
    for hero in &input.heroes {
        total_exp += exp_cost(hero.gear.helmet.enhancement);
        total_exp += exp_cost(hero.gear.gloves.enhancement);
        total_exp += exp_cost(hero.gear.breastplate.enhancement);
        total_exp += exp_cost(hero.gear.boots.enhancement);
    }

    let mut all_gear = Vec::new();
    for hero in &input.heroes {
        all_gear.push(OptimizationItem {
            is_lethality: true,
            mastery: hero.gear.helmet.mastery,
            weights_lethality: hero.weights.lethality,
            weights_health: hero.weights.health,
            current_enhancement: 0,
        });
        all_gear.push(OptimizationItem {
            is_lethality: false,
            mastery: hero.gear.gloves.mastery,
            weights_lethality: hero.weights.lethality,
            weights_health: hero.weights.health,
            current_enhancement: 0,
        });
        all_gear.push(OptimizationItem {
            is_lethality: false,
            mastery: hero.gear.breastplate.mastery,
            weights_lethality: hero.weights.lethality,
            weights_health: hero.weights.health,
            current_enhancement: 0,
        });
        all_gear.push(OptimizationItem {
            is_lethality: true,
            mastery: hero.gear.boots.mastery,
            weights_lethality: hero.weights.lethality,
            weights_health: hero.weights.health,
            current_enhancement: 0,
        });
    }

    let max_enhancement = (EXP_COSTS.len() - 1) as i32;
    let mut remaining_exp = total_exp;

    fn calculate_item_score_internal(item: &OptimizationItem, enhancement: i32) -> f64 {
        let s = stat(enhancement, item.mastery);
        if item.is_lethality {
            s * item.weights_lethality
        } else {
            s * item.weights_health
        }
    }

    // Greedy Algorithm
    loop {
        let mut best_idx = None;
        let mut best_efficiency = -1.0;
        let mut best_cost = 0;

        for (i, item) in all_gear.iter().enumerate() {
            if item.current_enhancement >= max_enhancement {
                continue;
            }

            let next_lvl = item.current_enhancement + 1;
            let cost = exp_cost(next_lvl) - exp_cost(item.current_enhancement);

            if cost > remaining_exp {
                continue;
            }

            let current_score = calculate_item_score_internal(item, item.current_enhancement);
            let next_score = calculate_item_score_internal(item, next_lvl);
            let gain = next_score - current_score;

            // Avoid division by zero if cost is 0 (though exp costs are usually > 0 for levels > 0)
            // If cost is 0, efficiency is infinite.
            let efficiency = if cost == 0 {
                f64::INFINITY
            } else {
                gain / (cost as f64)
            };

            if efficiency > best_efficiency {
                best_efficiency = efficiency;
                best_idx = Some(i);
                best_cost = cost;
            }
        }

        if let Some(idx) = best_idx {
            all_gear[idx].current_enhancement += 1;
            remaining_exp -= best_cost;
        } else {
            break;
        }
    }

    // Reconstruct results
    let mut new_heroes = input.heroes.clone();
    let mut solution_index = 0;

    for hero in &mut new_heroes {
        // Order: helmet, gloves, breastplate, boots
        if solution_index < all_gear.len() { hero.gear.helmet.enhancement = all_gear[solution_index].current_enhancement; } solution_index += 1;
        if solution_index < all_gear.len() { hero.gear.gloves.enhancement = all_gear[solution_index].current_enhancement; } solution_index += 1;
        if solution_index < all_gear.len() { hero.gear.breastplate.enhancement = all_gear[solution_index].current_enhancement; } solution_index += 1;
        if solution_index < all_gear.len() { hero.gear.boots.enhancement = all_gear[solution_index].current_enhancement; } solution_index += 1;
    }

    let mut total_before_score = 0.0;
    let mut total_after_score = 0.0;
    let mut results = Vec::new();

    for i in 0..input.heroes.len() {
        let before_stats = calculate_stats(&input.heroes[i].gear);
        let before_score = before_stats.lethality * input.heroes[i].weights.lethality
            + before_stats.health * input.heroes[i].weights.health;
        total_before_score += before_score;

        let after_stats = calculate_stats(&new_heroes[i].gear);
        let after_score = after_stats.lethality * new_heroes[i].weights.lethality
            + after_stats.health * new_heroes[i].weights.health;
        total_after_score += after_score;

        let mut gear_results = Vec::new();
        // Helmet
        gear_results.push(GearResult {
            gear_type: "helmet".to_string(),
            current_mastery: input.heroes[i].gear.helmet.mastery,
            recommended_mastery: input.heroes[i].gear.helmet.mastery,
            current_enhancement: input.heroes[i].gear.helmet.enhancement,
            recommended_enhancement: new_heroes[i].gear.helmet.enhancement,
        });
        // Gloves
        gear_results.push(GearResult {
            gear_type: "gloves".to_string(),
            current_mastery: input.heroes[i].gear.gloves.mastery,
            recommended_mastery: input.heroes[i].gear.gloves.mastery,
            current_enhancement: input.heroes[i].gear.gloves.enhancement,
            recommended_enhancement: new_heroes[i].gear.gloves.enhancement,
        });
        // Breastplate
        gear_results.push(GearResult {
            gear_type: "breastplate".to_string(),
            current_mastery: input.heroes[i].gear.breastplate.mastery,
            recommended_mastery: input.heroes[i].gear.breastplate.mastery,
            current_enhancement: input.heroes[i].gear.breastplate.enhancement,
            recommended_enhancement: new_heroes[i].gear.breastplate.enhancement,
        });
        // Boots
        gear_results.push(GearResult {
            gear_type: "boots".to_string(),
            current_mastery: input.heroes[i].gear.boots.mastery,
            recommended_mastery: input.heroes[i].gear.boots.mastery,
            current_enhancement: input.heroes[i].gear.boots.enhancement,
            recommended_enhancement: new_heroes[i].gear.boots.enhancement,
        });

        results.push(OptimizationResult {
            hero_name: input.heroes[i].name.clone(),
            gear: gear_results,
            before_stats,
            after_stats,
            before_score,
            after_score,
        });
    }

    let output = OptimizationOutput {
        results,
        total_before_score,
        total_after_score,
    };

    serde_json::to_string(&output).unwrap_or_else(|e| format!("Error serializing output: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exp_cost() {
        assert_eq!(exp_cost(0), 0);
        assert_eq!(exp_cost(1), 10);
        assert_eq!(exp_cost(200), 575320);
        assert_eq!(exp_cost(-1), 0);
        assert_eq!(exp_cost(1000), 0);
    }

    #[test]
    fn test_stat() {
        // Base case: enh 0, mastery 0 -> 0.15
        assert!((stat(0, 0) - 0.15).abs() < 1e-10);
        
        // Enh 100, mastery 0 -> 0.15 + 100 * 0.0035 = 0.15 + 0.35 = 0.5
        assert!((stat(100, 0) - 0.5).abs() < 1e-10);

        // Enh 101, mastery 0 -> 0.5 + 1 * 0.005 = 0.505
        assert!((stat(101, 0) - 0.505).abs() < 1e-10);

        // Enh 0, mastery 10 -> 0.15 * (1 + 10 * 0.1) = 0.15 * 2 = 0.3
        assert!((stat(0, 10) - 0.3).abs() < 1e-10);
    }

    #[test]
    fn test_solve_greedy() {
        let hero = HeroWeights {
            name: "TestHero".to_string(),
            gear: HeroGear {
                helmet: Gear { mastery: 0, enhancement: 0 },
                gloves: Gear { mastery: 0, enhancement: 0 },
                breastplate: Gear { mastery: 0, enhancement: 0 },
                boots: Gear { mastery: 0, enhancement: 0 },
            },
            weights: StatWeights { lethality: 1.0, health: 1.0 },
        };
        
        let input = InputData {
            heroes: vec![hero],
            exp: 1000, // Enough for a few upgrades
        };

        let json_input = serde_json::to_string(&input).unwrap();
        let json_output = solve(&json_input);
        
        let output: OptimizationOutput = serde_json::from_str(&json_output).unwrap();
        
        assert_eq!(output.results.len(), 1);
        assert!(output.total_after_score > output.total_before_score);
        
        // Verify total cost used is valid
        // We started with 0 exp used on gear.
        // We gave 1000 exp.
        // We should verify we didn't use more than 1000.
        // But we don't easily have the used cost in output, just the resulting levels.
        // Let's calculate cost of resulting gear.
        let mut used_exp = 0;
        for res in &output.results[0].gear {
             used_exp += exp_cost(res.recommended_enhancement);
        }
        assert!(used_exp <= 1000);
    }
}
