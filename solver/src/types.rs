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
    pub hammers: i32,
    pub mythics: i32,
    pub mythril: i32,
}

pub const EXP_COSTS: [i32; 201] = [
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

pub fn exp_cost(enhancement: i32) -> i32 {
    if enhancement < 0 || enhancement >= EXP_COSTS.len() as i32 {
        return 0;
    }
    EXP_COSTS[enhancement as usize]
}

pub fn stat(enh: i32, mastery: i32) -> f64 {
    let enh_f = enh as f64;
    let mastery_f = mastery as f64;
    let base = 0.15 + enh_f.min(100.0) * 0.0035 + (enh_f - 100.0).max(0.0) * 0.005;
    base * (1.0 + mastery_f * 0.1)
}

pub fn calculate_stats(gear: &HeroGear) -> Stats {
    let lethality = stat(gear.helmet.enhancement, gear.helmet.mastery)
        + stat(gear.boots.enhancement, gear.boots.mastery);
    let health = stat(gear.breastplate.enhancement, gear.breastplate.mastery)
        + stat(gear.gloves.enhancement, gear.gloves.mastery);
    Stats { lethality, health }
}
