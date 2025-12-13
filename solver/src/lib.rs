use wasm_bindgen::prelude::*;

mod types;
mod greedy;

use types::*;
use greedy::solve_greedy;

#[wasm_bindgen]
pub fn solve(data: &str) -> String {
    let input: InputData = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(e) => return format!("Error parsing input: {}", e),
    };

    let output = solve_greedy(input);

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
    fn test_hammer_cost() {
        assert_eq!(hammer_cost(1), 10);
        assert_eq!(hammer_cost(2), 20);
        assert_eq!(hammer_cost(20), 200);
        assert_eq!(hammer_cost(21), 0); // Invalid
    }

    #[test]
    fn test_solve_greedy_level_101() {
        let hero = HeroWeights {
            name: "TestHero".to_string(),
            gear: HeroGear {
                helmet: Gear { mastery: 0, enhancement: 105 }, // Should NOT be reset
                gloves: Gear { mastery: 0, enhancement: 10 }, // Should be reset
                breastplate: Gear { mastery: 0, enhancement: 0 },
                boots: Gear { mastery: 0, enhancement: 0 },
            },
            weights: StatWeights { lethality: 1.0, health: 1.0 },
        };
        
        let input = InputData {
            heroes: vec![hero],
            exp: 100, // Small amount of extra exp
            hammers: 0,
            mythics: 0,
            mythril: 0,
        };

        let json_input = serde_json::to_string(&input).unwrap();
        let json_output = solve(&json_input);
        
        let output: OptimizationOutput = serde_json::from_str(&json_output).unwrap();
        
        assert_eq!(output.results.len(), 1);
        
        let helmet_res = &output.results[0].gear[0];
        let _gloves_res = &output.results[0].gear[1];
        
        // Helmet started at 105, should be >= 105
        assert!(helmet_res.recommended_enhancement >= 105);
    }

    #[test]
    fn test_reset_at_level_100() {
        let hero = HeroWeights {
            name: "TestReset".to_string(),
            gear: HeroGear {
                helmet: Gear { mastery: 10, enhancement: 100 }, // Should be reset
                gloves: Gear { mastery: 0, enhancement: 0 },
                breastplate: Gear { mastery: 0, enhancement: 0 },
                boots: Gear { mastery: 0, enhancement: 0 },
            },
            weights: StatWeights { lethality: 1.0, health: 1.0 },
        };
        
        // 0 extra exp, but we reclaim exp from helmet (level 100)
        let input = InputData {
            heroes: vec![hero],
            exp: 0, 
            hammers: 0,
            mythics: 0,
            mythril: 0,
        };

        let json_input = serde_json::to_string(&input).unwrap();
        let json_output = solve(&json_input);
        let output: OptimizationOutput = serde_json::from_str(&json_output).unwrap();
        
        let res = &output.results[0];
        
        // Helmet should have been reset and exp distributed.
        // Since weights are equal, exp should be roughly split.
        // So helmet level should be significantly less than 100.
        assert!(res.gear[0].recommended_enhancement < 100);
        
        // Other items should have gained some levels
        assert!(res.gear[1].recommended_enhancement > 0);
        assert!(res.gear[2].recommended_enhancement > 0);
        assert!(res.gear[3].recommended_enhancement > 0);
        
        // Mastery should be preserved
        assert_eq!(res.gear[0].recommended_mastery, 10);
    }

    #[test]
    fn test_no_reset_at_level_101() {
        let hero = HeroWeights {
            name: "TestNoReset".to_string(),
            gear: HeroGear {
                helmet: Gear { mastery: 10, enhancement: 101 }, // Should NOT be reset
                gloves: Gear { mastery: 0, enhancement: 0 },
                breastplate: Gear { mastery: 0, enhancement: 0 },
                boots: Gear { mastery: 0, enhancement: 0 },
            },
            weights: StatWeights { lethality: 1.0, health: 1.0 },
        };
        
        // 0 extra exp. Helmet is 101, so no reclaim.
        let input = InputData {
            heroes: vec![hero],
            exp: 0, 
            hammers: 0,
            mythics: 0,
            mythril: 0,
        };

        let json_input = serde_json::to_string(&input).unwrap();
        let json_output = solve(&json_input);
        let output: OptimizationOutput = serde_json::from_str(&json_output).unwrap();
        
        let res = &output.results[0];
        
        // Helmet should stay at 101
        assert_eq!(res.gear[0].recommended_enhancement, 101);
        
        // Other items should stay at 0
        assert_eq!(res.gear[1].recommended_enhancement, 0);
        assert_eq!(res.gear[2].recommended_enhancement, 0);
        assert_eq!(res.gear[3].recommended_enhancement, 0);
        
        // Mastery should be preserved
        assert_eq!(res.gear[0].recommended_mastery, 10);
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
            hammers: 100, // Enough for some mastery upgrades
            mythics: 0,
            mythril: 0,
        };

        let json_input = serde_json::to_string(&input).unwrap();
        let json_output = solve(&json_input);
        
        let output: OptimizationOutput = serde_json::from_str(&json_output).unwrap();
        
        assert_eq!(output.results.len(), 1);
        assert!(output.total_after_score > output.total_before_score);
        
        // Verify total cost used is valid
        let mut used_exp = 0;
        let mut used_hammers = 0;
        for res in &output.results[0].gear {
             used_exp += exp_cost(res.recommended_enhancement);
             // Mastery cost is incremental from current (0) to recommended
             for m in (res.current_mastery + 1)..=res.recommended_mastery {
                 used_hammers += hammer_cost(m);
             }
        }
        assert!(used_exp <= 1000);
        assert!(used_hammers <= 100);
    }
}
