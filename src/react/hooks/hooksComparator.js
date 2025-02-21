export class ReactHooksComparator {
  constructor(options = {}) {
    this.options = {
      stateHookWeight: 0.4,
      effectHookWeight: 0.4,
      customHookWeight: 0.2,
      ...options
    };
  }

  compareHooks(hooks1, hooks2) {
    if (!hooks1 || !hooks2) return 0;

    const similarities = {
      stateHooks: this.compareStateHooks(hooks1.stateHooks, hooks2.stateHooks),
      effectHooks: this.compareEffectHooks(hooks1.effectHooks, hooks2.effectHooks),
      customHooks: this.compareCustomHooks(hooks1.customHooks, hooks2.customHooks)
    };

    let totalWeight = 0;
    let weightedSum = 0;

    Object.entries(similarities).forEach(([key, value]) => {
      const weight = this.options[`${key}Weight`] || 0;
      totalWeight += weight;
      weightedSum += (value * weight);
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  compareStateHooks(hooks1 = [], hooks2 = []) {
    if (!hooks1.length || !hooks2.length) return 0;

    let totalSimilarity = 0;
    let maxSimilarity = Math.max(hooks1.length, hooks2.length);

    hooks1.forEach(hook1 => {
      const similarities = hooks2.map(hook2 => this.compareStateHook(hook1, hook2));
      totalSimilarity += Math.max(...similarities) || 0;
    });

    return totalSimilarity / maxSimilarity;
  }

  compareStateHook(hook1, hook2) {
    if (!hook1 || !hook2 || hook1.type !== hook2.type) return 0;

    let similarity = 0;
    let totalWeight = 0;
    
    // Compare initial values (weight: 0.5)
    totalWeight += 0.5;
    if (hook1.initialValue === hook2.initialValue) {
      similarity += 0.5;
    } else if (typeof hook1.initialValue === typeof hook2.initialValue) {
      similarity += 0.3;
    }

    // Compare setter naming patterns (weight: 0.5)
    if (hook1.setter && hook2.setter) {
      totalWeight += 0.5;
      const pattern1 = this.extractSetterPattern(hook1.setter);
      const pattern2 = this.extractSetterPattern(hook2.setter);
      if (pattern1 === pattern2) {
        similarity += 0.5;
      }
    }

    return totalWeight > 0 ? similarity / totalWeight : 0;
  }

  compareEffectHooks(hooks1 = [], hooks2 = []) {
    if (!hooks1.length || !hooks2.length) return 0;

    let totalSimilarity = 0;
    let maxSimilarity = Math.max(hooks1.length, hooks2.length);

    hooks1.forEach(hook1 => {
      const similarities = hooks2.map(hook2 => this.compareEffectHook(hook1, hook2));
      totalSimilarity += Math.max(...similarities) || 0;
    });

    return totalSimilarity / maxSimilarity;
  }

  compareEffectHook(hook1, hook2) {
    if (!hook1 || !hook2 || hook1.type !== hook2.type) return 0;

    let similarity = 0;
    let totalWeight = 0;

    // Compare cleanup presence (weight: 0.3)
    if (hook1.effect && hook2.effect) {
      totalWeight += 0.3;
      if (hook1.effect.hasCleanup === hook2.effect.hasCleanup) {
        similarity += 0.3;
      }
    }

    // Compare dependencies (weight: 0.7)
    if (hook1.dependencies && hook2.dependencies) {
      totalWeight += 0.7;
      const depsIntersection = hook1.dependencies.filter(dep => 
        hook2.dependencies.includes(dep)
      );
      const depsUnion = new Set([...hook1.dependencies, ...hook2.dependencies]);
      similarity += 0.7 * (depsIntersection.length / depsUnion.size);
    }

    return totalWeight > 0 ? similarity / totalWeight : 0;
  }

  compareCustomHooks(hooks1 = [], hooks2 = []) {
    if (!hooks1.length || !hooks2.length) return 0;

    let totalSimilarity = 0;
    let maxSimilarity = Math.max(hooks1.length, hooks2.length);

    hooks1.forEach(hook1 => {
      const similarities = hooks2.map(hook2 => this.compareCustomHook(hook1, hook2));
      totalSimilarity += Math.max(...similarities) || 0;
    });

    return totalSimilarity / maxSimilarity;
  }

  compareCustomHook(hook1, hook2) {
    if (!hook1 || !hook2 || hook1.type !== hook2.type) return 0;

    // Compare arguments
    if (!hook1.arguments || !hook2.arguments) return 0;

    const argsIntersection = hook1.arguments.filter((arg, index) => 
      arg === hook2.arguments[index]
    );
    const maxArgs = Math.max(hook1.arguments.length, hook2.arguments.length);

    return maxArgs > 0 ? argsIntersection.length / maxArgs : 0;
  }

  extractSetterPattern(setterName) {
    // Common patterns: setX, updateX, toggleX
    const patterns = ['set', 'update', 'toggle'];
    for (const pattern of patterns) {
      if (setterName.startsWith(pattern)) {
        return pattern;
      }
    }
    return 'other';
  }
}
