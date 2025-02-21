export class ReactStyleComparator {
  constructor(options = {}) {
    this.options = {
      inlineStyleWeight: 0.4,
      classNameWeight: 0.4,
      styledComponentWeight: 0.2,
      ...options
    };
  }

  compareStyles(styles1, styles2) {
    if (!styles1 || !styles2) return 0;

    // If both objects are identical, return 1
    if (JSON.stringify(styles1) === JSON.stringify(styles2)) return 1;

    // Calculate individual similarities
    const similarities = {
      inlineStyles: styles1.inlineStyles && styles2.inlineStyles ? this.compareInlineStyles(styles1.inlineStyles, styles2.inlineStyles) : 0,
      classNames: styles1.classNames && styles2.classNames ? this.compareClassNames(styles1.classNames, styles2.classNames) : 0,
      styledComponents: styles1.styledComponents && styles2.styledComponents ? this.compareStyledComponents(styles1.styledComponents, styles2.styledComponents) : 0
    };

    let totalWeight = 0;
    let weightedSum = 0;

    Object.entries(similarities).forEach(([key, value]) => {
      const weight = this.options[`${key}Weight`];
      if (weight) {
        totalWeight += weight;
        weightedSum += (value * weight);
      }
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  compareInlineStyles(styles1 = [], styles2 = []) {
    if (!styles1.length || !styles2.length) return 0;
    
    let totalSimilarity = 0;
    let comparisons = 0;

    styles1.forEach(style1 => {
      styles2.forEach(style2 => {
        totalSimilarity += this.compareStyleObjects(style1, style2);
        comparisons++;
      });
    });

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  compareClassNames(classes1, classes2) {
    if (!classes1.length || !classes2.length) return 0;

    const intersection = classes1.filter(cls => classes2.includes(cls));
    const union = new Set([...classes1, ...classes2]);

    return intersection.length / union.size;
  }

  compareStyledComponents(comps1, comps2) {
    if (!comps1.length || !comps2.length) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    comps1.forEach(comp1 => {
      comps2.forEach(comp2 => {
        if (comp1.baseComponent === comp2.baseComponent) {
          totalSimilarity += this.compareStyledComponentStyles(comp1.styles, comp2.styles);
          comparisons++;
        }
      });
    });

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  compareStyleObjects(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length === 0 || keys2.length === 0) return 0;

    const intersection = keys1.filter(key => {
      return keys2.includes(key) && obj1[key] === obj2[key];
    });

    const union = new Set([...keys1, ...keys2]);
    return intersection.length / union.size;
  }

  compareStyledComponentStyles(styles1, styles2) {
    if (!styles1.length || !styles2.length) return 0;

    let totalSimilarity = 0;
    styles1.forEach((style1, i) => {
      const style2 = styles2[i];
      if (style2) {
        totalSimilarity += this.calculateStyleStringSimilarity(style1, style2);
      }
    });

    return totalSimilarity / Math.max(styles1.length, styles2.length);
  }

  calculateStyleStringSimilarity(str1, str2) {
    // Remove whitespace and normalize
    const normalized1 = str1.replace(/\s+/g, '');
    const normalized2 = str2.replace(/\s+/g, '');
    
    if (normalized1 === normalized2) return 1;

    // Calculate Levenshtein distance
    const m = normalized1.length;
    const n = normalized2.length;
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (normalized1[i - 1] === normalized2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j - 1] + 1,
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1
          );
        }
      }
    }

    const maxLength = Math.max(m, n);
    return 1 - (dp[m][n] / maxLength);
  }
}
