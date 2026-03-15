// WHO Growth Standards for children 0-5 years
// Based on WHO Child Growth Standards (2006)

// Weight-for-age (kg) - Boys
const weightBoysLMS = {
  0: { L: 0.3487, M: 3.3464, S: 0.14602 },
  1: { L: 0.2297, M: 4.4709, S: 0.13395 },
  2: { L: 0.197, M: 5.5675, S: 0.12385 },
  3: { L: 0.1738, M: 6.3762, S: 0.11727 },
  6: { L: 0.1395, M: 7.934, S: 0.10878 },
  9: { L: 0.1211, M: 9.0351, S: 0.10424 },
  12: { L: 0.1087, M: 9.8959, S: 0.10119 },
  18: { L: 0.0903, M: 11.1641, S: 0.09797 },
  24: { L: 0.0758, M: 12.2515, S: 0.09584 },
  36: { L: 0.0527, M: 14.3441, S: 0.09295 },
  48: { L: 0.0317, M: 16.3489, S: 0.09103 },
  60: { L: 0.0117, M: 18.3671, S: 0.08997 },
  72: { L: -0.01, M: 20.5, S: 0.092 },
  96: { L: -0.05, M: 25.4, S: 0.105 },
  120: { L: -0.1, M: 31.2, S: 0.125 },
  144: { L: -0.15, M: 39.5, S: 0.145 },
  168: { L: -0.2, M: 49.8, S: 0.165 },
  192: { L: -0.25, M: 58.5, S: 0.175 },
  216: { L: -0.3, M: 65.2, S: 0.185 },
  228: { L: -0.32, M: 68.4, S: 0.19 }
};

// Weight-for-age (kg) - Girls
const weightGirlsLMS = {
  0: { L: 0.3809, M: 3.2322, S: 0.14171 },
  1: { L: 0.2437, M: 4.1873, S: 0.13724 },
  2: { L: 0.2017, M: 5.1282, S: 0.12926 },
  3: { L: 0.1738, M: 5.8458, S: 0.12347 },
  6: { L: 0.1395, M: 7.297, S: 0.11494 },
  9: { L: 0.1211, M: 8.2981, S: 0.11024 },
  12: { L: 0.1087, M: 9.1879, S: 0.10698 },
  18: { L: 0.0903, M: 10.5687, S: 0.10314 },
  24: { L: 0.0758, M: 11.8016, S: 0.10054 },
  36: { L: 0.0527, M: 14.0917, S: 0.09686 },
  48: { L: 0.0317, M: 16.0908, S: 0.09494 },
  60: { L: 0.0117, M: 18.2026, S: 0.09391 },
  72: { L: -0.01, M: 20.8, S: 0.098 },
  96: { L: -0.05, M: 25.8, S: 0.115 },
  120: { L: -0.1, M: 32.2, S: 0.138 },
  144: { L: -0.15, M: 41.2, S: 0.165 },
  168: { L: -0.2, M: 50.2, S: 0.185 },
  192: { L: -0.25, M: 56.5, S: 0.195 },
  216: { L: -0.3, M: 60.5, S: 0.2 },
  228: { L: -0.32, M: 62.5, S: 0.205 }
};

// Height/Length-for-age (cm) - Boys
const heightBoysLMS = {
  0: { L: 1, M: 49.8842, S: 0.03795 },
  1: { L: 1, M: 54.7244, S: 0.03557 },
  2: { L: 1, M: 58.4249, S: 0.03424 },
  3: { L: 1, M: 61.4292, S: 0.03328 },
  6: { L: 1, M: 67.6236, S: 0.03169 },
  9: { L: 1, M: 72.0888, S: 0.03072 },
  12: { L: 1, M: 75.7488, S: 0.03003 },
  18: { L: 1, M: 82.2188, S: 0.02899 },
  24: { L: 1, M: 87.1161, S: 0.02838 },
  36: { L: 1, M: 96.0833, S: 0.02763 },
  48: { L: 1, M: 103.3032, S: 0.02717 },
  60: { L: 1, M: 110.0106, S: 0.02691 },
  72: { L: 1, M: 116.0, S: 0.027 },
  96: { L: 1, M: 127.3, S: 0.0275 },
  120: { L: 1, M: 138.4, S: 0.028 },
  144: { L: 1, M: 151.2, S: 0.029 },
  168: { L: 1, M: 164.8, S: 0.031 },
  192: { L: 1, M: 173.2, S: 0.032 },
  216: { L: 1, M: 176.0, S: 0.0325 },
  228: { L: 1, M: 176.5, S: 0.0326 }
};

// Height/Length-for-age (cm) - Girls
const heightGirlsLMS = {
  0: { L: 1, M: 49.1477, S: 0.0379 },
  1: { L: 1, M: 53.6872, S: 0.0364 },
  2: { L: 1, M: 57.0673, S: 0.03568 },
  3: { L: 1, M: 59.8029, S: 0.03518 },
  6: { L: 1, M: 65.7311, S: 0.03416 },
  9: { L: 1, M: 70.1435, S: 0.03353 },
  12: { L: 1, M: 74.0015, S: 0.03309 },
  18: { L: 1, M: 80.7991, S: 0.03248 },
  24: { L: 1, M: 86.4204, S: 0.03211 },
  36: { L: 1, M: 95.0778, S: 0.03168 },
  48: { L: 1, M: 102.7115, S: 0.03142 },
  60: { L: 1, M: 109.4341, S: 0.03124 },
  72: { L: 1, M: 115.1, S: 0.0315 },
  96: { L: 1, M: 126.6, S: 0.032 },
  120: { L: 1, M: 138.6, S: 0.033 },
  144: { L: 1, M: 151.0, S: 0.035 },
  168: { L: 1, M: 160.4, S: 0.037 },
  192: { L: 1, M: 163.0, S: 0.038 },
  216: { L: 1, M: 163.4, S: 0.0385 },
  228: { L: 1, M: 163.6, S: 0.0386 }
};

// Head circumference (cm) - Boys
const headBoysLMS = {
  0: { L: 1, M: 34.4618, S: 0.03686 },
  1: { L: 1, M: 37.2759, S: 0.03133 },
  2: { L: 1, M: 39.1285, S: 0.02997 },
  3: { L: 1, M: 40.5135, S: 0.02918 },
  6: { L: 1, M: 43.3306, S: 0.02789 },
  9: { L: 1, M: 45.1859, S: 0.02715 },
  12: { L: 1, M: 46.4985, S: 0.02667 },
  18: { L: 1, M: 48.1069, S: 0.02612 },
  24: { L: 1, M: 49.0042, S: 0.02582 }
};

// Head circumference (cm) - Girls
const headGirlsLMS = {
  0: { L: 1, M: 33.8787, S: 0.03496 },
  1: { L: 1, M: 36.5463, S: 0.03181 },
  2: { L: 1, M: 38.2521, S: 0.03052 },
  3: { L: 1, M: 39.5328, S: 0.02974 },
  6: { L: 1, M: 42.1843, S: 0.02846 },
  9: { L: 1, M: 43.8096, S: 0.02774 },
  12: { L: 1, M: 44.9959, S: 0.02727 },
  18: { L: 1, M: 46.4102, S: 0.02668 },
  24: { L: 1, M: 47.2252, S: 0.02637 }
};

function interpolateLMS(data, ageMonths) {
  const ages = Object.keys(data).map(Number).sort((a, b) => a - b);
  
  if (ageMonths <= ages[0]) return data[ages[0]];
  if (ageMonths >= ages[ages.length - 1]) return data[ages[ages.length - 1]];
  
  let lower = ages[0];
  let upper = ages[ages.length - 1];
  
  for (let i = 0; i < ages.length - 1; i++) {
    if (ageMonths >= ages[i] && ageMonths < ages[i + 1]) {
      lower = ages[i];
      upper = ages[i + 1];
      break;
    }
  }
  
  const ratio = (ageMonths - lower) / (upper - lower);
  const lowerLMS = data[lower];
  const upperLMS = data[upper];
  
  return {
    L: lowerLMS.L + ratio * (upperLMS.L - lowerLMS.L),
    M: lowerLMS.M + ratio * (upperLMS.M - lowerLMS.M),
    S: lowerLMS.S + ratio * (upperLMS.S - lowerLMS.S)
  };
}

function calculateZScore(value, L, M, S) {
  if (L === 0) {
    return Math.log(value / M) / S;
  }
  return (Math.pow(value / M, L) - 1) / (L * S);
}

function zScoreToPercentile(zScore) {
  // Approximation of the cumulative distribution function
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = zScore < 0 ? -1 : 1;
  const z = Math.abs(zScore) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  
  return 50 * (1.0 + sign * y);
}

function getIdealValue(L, M, S, percentile = 50) {
  // For 50th percentile, z-score is 0, so ideal = M
  if (percentile === 50) return M;
  
  // Convert percentile to z-score (simplified)
  const zScore = (percentile - 50) / 15.87; // Approximate
  
  if (L === 0) {
    return M * Math.exp(S * zScore);
  }
  return M * Math.pow(1 + L * S * zScore, 1 / L);
}

function calculateGrowthMetrics(gender, ageMonths, weight, height, headCircumference = null) {
  const isMale = gender === 'male';
  
  const weightData = isMale ? weightBoysLMS : weightGirlsLMS;
  const heightData = isMale ? heightBoysLMS : heightGirlsLMS;
  const headData = isMale ? headBoysLMS : headGirlsLMS;
  
  const result = {
    ageMonths,
    weight: null,
    height: null,
    headCircumference: null
  };
  
  // Weight metrics
  if (weight) {
    const wLMS = interpolateLMS(weightData, ageMonths);
    const wZScore = calculateZScore(weight, wLMS.L, wLMS.M, wLMS.S);
    result.weight = {
      value: weight,
      zScore: Math.round(wZScore * 100) / 100,
      percentile: Math.round(zScoreToPercentile(wZScore) * 10) / 10,
      ideal: Math.round(wLMS.M * 100) / 100,
      p3: Math.round(getIdealValue(wLMS.L, wLMS.M, wLMS.S, 3) * 100) / 100,
      p15: Math.round(getIdealValue(wLMS.L, wLMS.M, wLMS.S, 15) * 100) / 100,
      p50: Math.round(wLMS.M * 100) / 100,
      p85: Math.round(getIdealValue(wLMS.L, wLMS.M, wLMS.S, 85) * 100) / 100,
      p97: Math.round(getIdealValue(wLMS.L, wLMS.M, wLMS.S, 97) * 100) / 100
    };
  }
  
  // Height metrics
  if (height) {
    const hLMS = interpolateLMS(heightData, ageMonths);
    const hZScore = calculateZScore(height, hLMS.L, hLMS.M, hLMS.S);
    result.height = {
      value: height,
      zScore: Math.round(hZScore * 100) / 100,
      percentile: Math.round(zScoreToPercentile(hZScore) * 10) / 10,
      ideal: Math.round(hLMS.M * 10) / 10,
      p3: Math.round(getIdealValue(hLMS.L, hLMS.M, hLMS.S, 3) * 10) / 10,
      p15: Math.round(getIdealValue(hLMS.L, hLMS.M, hLMS.S, 15) * 10) / 10,
      p50: Math.round(hLMS.M * 10) / 10,
      p85: Math.round(getIdealValue(hLMS.L, hLMS.M, hLMS.S, 85) * 10) / 10,
      p97: Math.round(getIdealValue(hLMS.L, hLMS.M, hLMS.S, 97) * 10) / 10
    };
  }
  
  // Head circumference metrics
  if (headCircumference && ageMonths <= 24) {
    const hcLMS = interpolateLMS(headData, ageMonths);
    const hcZScore = calculateZScore(headCircumference, hcLMS.L, hcLMS.M, hcLMS.S);
    result.headCircumference = {
      value: headCircumference,
      zScore: Math.round(hcZScore * 100) / 100,
      percentile: Math.round(zScoreToPercentile(hcZScore) * 10) / 10,
      ideal: Math.round(hcLMS.M * 10) / 10
    };
  }
  
  return result;
}

function getGrowthComparison(gender, ageMonths, currentData, previousData = null) {
  const current = calculateGrowthMetrics(
    gender, 
    ageMonths, 
    currentData.weight, 
    currentData.height, 
    currentData.headCircumference
  );
  
  const comparison = {
    current,
    previous: null,
    ideal: {
      weight: current.weight?.ideal,
      height: current.height?.ideal,
      headCircumference: current.headCircumference?.ideal
    },
    changes: null
  };
  
  if (previousData) {
    const prevAgeMonths = previousData.ageMonths || ageMonths - 1;
    comparison.previous = calculateGrowthMetrics(
      gender,
      prevAgeMonths,
      previousData.weight,
      previousData.height,
      previousData.headCircumference
    );
    
    comparison.changes = {
      weight: currentData.weight && previousData.weight 
        ? Math.round((currentData.weight - previousData.weight) * 100) / 100 
        : null,
      height: currentData.height && previousData.height 
        ? Math.round((currentData.height - previousData.height) * 10) / 10 
        : null,
      timeDelta: ageMonths - prevAgeMonths
    };
  }
  
  return comparison;
}

// CDC Quick Formulas for ideal weight/height estimation
function calculateIdealWeightCDC(ageYears) {
  if (ageYears < 2) {
    // For infants, use WHO standards (approximation)
    return 3.5 + (ageYears * 12 * 0.5); // ~0.5kg per month first year
  } else if (ageYears >= 2 && ageYears <= 5) {
    // 2-5 years: Weight(kg) = (Age × 2) + 8.5
    return (ageYears * 2) + 8.5;
  } else if (ageYears > 5 && ageYears <= 12) {
    // 6-12 years: Weight(kg) = (Age × 3) + 3
    return (ageYears * 3) + 3;
  } else {
    // >12 years: extrapolate
    return (ageYears * 3) + 3;
  }
}

function calculateIdealHeightCDC(ageYears) {
  if (ageYears < 1) {
    // Newborn ~50cm, grows ~25cm first year
    return 50 + (ageYears * 25);
  } else if (ageYears >= 1 && ageYears < 4) {
    // 1-4 years: ~75cm at 1 year, grows ~6cm/year
    return 75 + ((ageYears - 1) * 6);
  } else {
    // >4 years: Height(cm) = 100 + ((Age - 4) × 5)
    return 100 + ((ageYears - 4) * 5);
  }
}

// Calculate BMI and health status
function calculateBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function getBMIStatus(bmi, ageYears) {
  // Pediatric BMI percentiles (simplified)
  // These thresholds vary by age, this is a simplified version
  if (!bmi) return { status: 'unknown', color: '#9ca3af' };
  
  // For children, we use percentile-based cutoffs
  // This is a simplified approximation
  let underweightThreshold, normalThreshold, overweightThreshold;
  
  if (ageYears < 5) {
    underweightThreshold = 14;
    normalThreshold = 17;
    overweightThreshold = 18;
  } else if (ageYears < 10) {
    underweightThreshold = 14;
    normalThreshold = 18;
    overweightThreshold = 21;
  } else {
    underweightThreshold = 15;
    normalThreshold = 21;
    overweightThreshold = 25;
  }
  
  if (bmi < underweightThreshold) {
    return { status: 'underweight', color: '#3b82f6', label: 'Bajo peso' };
  } else if (bmi < normalThreshold) {
    return { status: 'healthy', color: '#22c55e', label: 'Saludable' };
  } else if (bmi < overweightThreshold) {
    return { status: 'overweight', color: '#f59e0b', label: 'Sobrepeso' };
  } else {
    return { status: 'obese', color: '#ef4444', label: 'Obesidad' };
  }
}

// Calculate 3D transformation parameters
function calculate3DTransformParams(currentWeight, currentHeight, idealWeight, idealHeight, ageYears) {
  const ratioWeight = currentWeight / idealWeight;
  const ratioHeight = currentHeight / idealHeight;
  
  const bmi = calculateBMI(currentWeight, currentHeight);
  const bmiStatus = getBMIStatus(bmi, ageYears);
  
  // Calculate body deformation intensity (0 = ideal, 1 = max deformation)
  // For overweight: positive values inflate the body
  // For underweight: negative values thin the body
  let bodyFatIntensity = 0;
  if (ratioWeight > 1) {
    bodyFatIntensity = Math.min((ratioWeight - 1) * 2, 1); // Max 1
  } else if (ratioWeight < 1) {
    bodyFatIntensity = Math.max((ratioWeight - 1) * 2, -0.5); // Min -0.5
  }
  
  // Specific body part deformations
  const abdominalExpansion = bodyFatIntensity > 0 ? bodyFatIntensity * 1.5 : 0;
  const facialRoundness = bodyFatIntensity > 0 ? bodyFatIntensity * 0.8 : 0;
  const limbThickness = bodyFatIntensity > 0 ? bodyFatIntensity * 0.6 : bodyFatIntensity * 0.3;
  
  return {
    scaleY: ratioHeight,
    scaleXZ: 1 + (bodyFatIntensity * 0.3), // Horizontal expansion
    bodyFatIntensity,
    abdominalExpansion,
    facialRoundness,
    limbThickness,
    bmi: bmi ? Math.round(bmi * 10) / 10 : null,
    bmiStatus,
    ratioWeight: Math.round(ratioWeight * 100) / 100,
    ratioHeight: Math.round(ratioHeight * 100) / 100
  };
}

// Get complete comparison data for 3D visualization
function getAdvancedGrowthComparison(gender, ageMonths, currentData, previousData = null) {
  const ageYears = ageMonths / 12;
  
  // Calculate ideal values using CDC formulas
  const idealWeight = Math.round(calculateIdealWeightCDC(ageYears) * 10) / 10;
  const idealHeight = Math.round(calculateIdealHeightCDC(ageYears) * 10) / 10;
  
  // Also get WHO percentile-based ideals for comparison
  const whoMetrics = calculateGrowthMetrics(gender, ageMonths, currentData.weight, currentData.height, currentData.headCircumference);
  
  const result = {
    ageMonths,
    ageYears: Math.round(ageYears * 10) / 10,
    
    // Current state
    current: {
      weight: currentData.weight,
      height: currentData.height,
      headCircumference: currentData.headCircumference,
      bmi: calculateBMI(currentData.weight, currentData.height),
      percentiles: {
        weight: whoMetrics.weight?.percentile,
        height: whoMetrics.height?.percentile
      }
    },
    
    // Ideal state (CDC formulas)
    ideal: {
      weight: idealWeight,
      height: idealHeight,
      source: 'CDC'
    },
    
    // WHO P50 for reference
    whoP50: {
      weight: whoMetrics.weight?.p50,
      height: whoMetrics.height?.p50
    },
    
    // Previous consultation (or null)
    previous: null,
    
    // 3D transformation parameters for current vs ideal
    transform3D: calculate3DTransformParams(
      currentData.weight,
      currentData.height,
      idealWeight,
      idealHeight,
      ageYears
    ),
    
    // Health status
    healthStatus: getBMIStatus(calculateBMI(currentData.weight, currentData.height), ageYears)
  };
  
  // Add previous consultation data if available
  if (previousData && previousData.weight && previousData.height) {
    const prevAgeMonths = previousData.ageMonths || ageMonths - 1;
    const prevAgeYears = prevAgeMonths / 12;
    const prevIdealWeight = calculateIdealWeightCDC(prevAgeYears);
    const prevIdealHeight = calculateIdealHeightCDC(prevAgeYears);
    
    result.previous = {
      weight: previousData.weight,
      height: previousData.height,
      ageMonths: prevAgeMonths,
      bmi: calculateBMI(previousData.weight, previousData.height),
      transform3D: calculate3DTransformParams(
        previousData.weight,
        previousData.height,
        prevIdealWeight,
        prevIdealHeight,
        prevAgeYears
      )
    };
    
    // Calculate changes
    result.changes = {
      weight: Math.round((currentData.weight - previousData.weight) * 100) / 100,
      height: Math.round((currentData.height - previousData.height) * 10) / 10,
      bmi: result.current.bmi && result.previous.bmi 
        ? Math.round((result.current.bmi - result.previous.bmi) * 10) / 10 
        : null,
      timeDeltaMonths: ageMonths - prevAgeMonths
    };
  }
  
  return result;
}

module.exports = {
  calculateGrowthMetrics,
  getGrowthComparison,
  getAdvancedGrowthComparison,
  calculateIdealWeightCDC,
  calculateIdealHeightCDC,
  calculateBMI,
  getBMIStatus,
  calculate3DTransformParams,
  interpolateLMS,
  calculateZScore,
  zScoreToPercentile
};
