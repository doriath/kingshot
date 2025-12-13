use crate::types::*;

struct OptimizationItem {
    // hero_name: String, // Not strictly needed for calculation but good for debugging
    // gear_type: String,
    is_lethality: bool,
    mastery: i32,
    weights_lethality: f64,
    weights_health: f64,
    current_enhancement: i32,
}

pub fn solve_greedy(input: InputData) -> OptimizationOutput {
    let mut total_exp = input.exp;
    // We do NOT pool hammers. We only use the available hammers.
    let mut remaining_hammers = input.hammers;

    let mut all_gear = Vec::new();
    
    // Helper to process a single gear piece
    let mut process_gear = |gear: &Gear, is_lethality: bool, weights_lethality: f64, weights_health: f64| {
        let (start_enhancement, cost_to_reclaim) = if gear.enhancement >= 101 {
            (gear.enhancement, 0)
        } else {
            (0, exp_cost(gear.enhancement))
        };
        
        total_exp += cost_to_reclaim;
        
        all_gear.push(OptimizationItem {
            is_lethality,
            mastery: gear.mastery,
            weights_lethality,
            weights_health,
            current_enhancement: start_enhancement,
        });
    };

    for hero in &input.heroes {
        process_gear(&hero.gear.helmet, true, hero.weights.lethality, hero.weights.health);
        process_gear(&hero.gear.gloves, false, hero.weights.lethality, hero.weights.health);
        process_gear(&hero.gear.breastplate, false, hero.weights.lethality, hero.weights.health);
        process_gear(&hero.gear.boots, true, hero.weights.lethality, hero.weights.health);
    }

    let max_enhancement = (EXP_COSTS.len() - 1) as i32;
    let max_mastery = 20;
    let mut remaining_exp = total_exp;

    fn calculate_item_score_internal(item: &OptimizationItem, enhancement: i32, mastery: i32) -> f64 {
        let s = stat(enhancement, mastery);
        if item.is_lethality {
            s * item.weights_lethality
        } else {
            s * item.weights_health
        }
    }

    // Greedy Algorithm
    loop {
        let mut did_upgrade = false;

        // 1. Find best EXP upgrade
        let mut best_exp_idx = None;
        let mut best_exp_efficiency = -1.0;
        let mut best_exp_cost = 0;

        for (i, item) in all_gear.iter().enumerate() {
            if item.current_enhancement >= max_enhancement {
                continue;
            }

            let next_lvl = item.current_enhancement + 1;
            let cost = exp_cost(next_lvl) - exp_cost(item.current_enhancement);

            if cost > remaining_exp {
                continue;
            }

            let current_score = calculate_item_score_internal(item, item.current_enhancement, item.mastery);
            let next_score = calculate_item_score_internal(item, next_lvl, item.mastery);
            let gain = next_score - current_score;

            let efficiency = if cost == 0 {
                f64::INFINITY
            } else {
                gain / (cost as f64)
            };

            if efficiency > best_exp_efficiency {
                best_exp_efficiency = efficiency;
                best_exp_idx = Some(i);
                best_exp_cost = cost;
            }
        }

        // 2. Find best Hammer upgrade
        let mut best_hammer_idx = None;
        let mut best_hammer_efficiency = -1.0;
        let mut best_hammer_cost = 0;

        for (i, item) in all_gear.iter().enumerate() {
            if item.mastery >= max_mastery {
                continue;
            }

            let next_lvl = item.mastery + 1;
            let cost = hammer_cost(next_lvl);

            if cost > remaining_hammers {
                continue;
            }

            let current_score = calculate_item_score_internal(item, item.current_enhancement, item.mastery);
            let next_score = calculate_item_score_internal(item, item.current_enhancement, next_lvl);
            let gain = next_score - current_score;

            let efficiency = if cost == 0 {
                f64::INFINITY
            } else {
                gain / (cost as f64)
            };

            if efficiency > best_hammer_efficiency {
                best_hammer_efficiency = efficiency;
                best_hammer_idx = Some(i);
                best_hammer_cost = cost;
            }
        }

        // Apply upgrades
        if let Some(idx) = best_exp_idx {
            all_gear[idx].current_enhancement += 1;
            remaining_exp -= best_exp_cost;
            did_upgrade = true;
        }

        if let Some(idx) = best_hammer_idx {
            all_gear[idx].mastery += 1;
            remaining_hammers -= best_hammer_cost;
            did_upgrade = true;
        }

        if !did_upgrade {
            break;
        }
    }

    // Reconstruct results
    let mut new_heroes = input.heroes.clone();
    let mut solution_index = 0;

    for hero in &mut new_heroes {
        // Order: helmet, gloves, breastplate, boots
        if solution_index < all_gear.len() { 
            hero.gear.helmet.enhancement = all_gear[solution_index].current_enhancement; 
            hero.gear.helmet.mastery = all_gear[solution_index].mastery;
        } 
        solution_index += 1;
        
        if solution_index < all_gear.len() { 
            hero.gear.gloves.enhancement = all_gear[solution_index].current_enhancement; 
            hero.gear.gloves.mastery = all_gear[solution_index].mastery;
        } 
        solution_index += 1;
        
        if solution_index < all_gear.len() { 
            hero.gear.breastplate.enhancement = all_gear[solution_index].current_enhancement; 
            hero.gear.breastplate.mastery = all_gear[solution_index].mastery;
        } 
        solution_index += 1;
        
        if solution_index < all_gear.len() { 
            hero.gear.boots.enhancement = all_gear[solution_index].current_enhancement; 
            hero.gear.boots.mastery = all_gear[solution_index].mastery;
        } 
        solution_index += 1;
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

    OptimizationOutput {
        results,
        total_before_score,
        total_after_score,
    }
}
