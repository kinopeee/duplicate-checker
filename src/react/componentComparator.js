class ReactComponentComparator {
  constructor(options = {}) {
    this.options = {
      weights: {
        props: 0.3,
        jsx: 0.3,
        styles: 0.2,
        hooks: 0.1,
        methods: 0.1
      },
      ...options
    };
  }

  compareComponents(comp1, comp2) {
    if (!comp1 || !comp2) return 0;

    const similarities = {
      props: this.compareProps(comp1.props, comp2.props),
      jsx: this.compareJSX(comp1.jsx, comp2.jsx),
      styles: this.compareStyles(comp1.styles, comp2.styles),
      hooks: this.compareHooks(comp1.hooks, comp2.hooks),
      methods: this.compareMethods(comp1.methods, comp2.methods)
    };

    // Calculate weighted similarity
    return Object.entries(similarities).reduce((total, [key, value]) => {
      return total + (value * this.options.weights[key]);
    }, 0);
  }

  compareProps(props1, props2) {
    if (!props1 || !props2) return 0;
    if (props1.length === 0 && props2.length === 0) return 1;

    const matchingProps = props1.filter(prop1 => 
      props2.some(prop2 => 
        prop1.name === prop2.name && 
        prop1.required === prop2.required && 
        prop1.defaultValue === prop2.defaultValue
      )
    );

    return matchingProps.length / Math.max(props1.length, props2.length);
  }

  compareJSX(jsx1, jsx2) {
    if (!jsx1 || !jsx2) return 0;
    return this.compareJSXNodes(jsx1, jsx2);
  }

  compareJSXNodes(node1, node2) {
    if (!node1 || !node2) return 0;
    if (node1.type !== node2.type) return 0;

    // Compare props
    const propsSimilarity = this.compareProps(node1.props, node2.props);

    // Compare children
    let childrenSimilarity = 0;
    if (node1.children.length === 0 && node2.children.length === 0) {
      childrenSimilarity = 1;
    } else if (node1.children.length > 0 && node2.children.length > 0) {
      const childSimilarities = node1.children.map((child1, index) => {
        const child2 = node2.children[index];
        return child2 ? this.compareJSXNodes(child1, child2) : 0;
      });
      childrenSimilarity = childSimilarities.reduce((a, b) => a + b, 0) / childSimilarities.length;
    }

    return (propsSimilarity + childrenSimilarity) / 2;
  }

  compareStyles(styles1, styles2) {
    if (!styles1 || !styles2) return 0;
    if (styles1.length === 0 && styles2.length === 0) return 1;

    const styleSimilarities = styles1.map(style1 => 
      Math.max(...styles2.map(style2 => this.compareStyleObjects(style1, style2)))
    );

    return styleSimilarities.reduce((a, b) => a + b, 0) / styleSimilarities.length;
  }

  compareStyleObjects(style1, style2) {
    const keys1 = Object.keys(style1);
    const keys2 = Object.keys(style2);
    const allKeys = new Set([...keys1, ...keys2]);

    let matchingProperties = 0;
    allKeys.forEach(key => {
      if (style1[key] === style2[key]) {
        matchingProperties++;
      }
    });

    return matchingProperties / allKeys.size;
  }

  compareHooks(hooks1, hooks2) {
    if (!hooks1 || !hooks2) return 0;
    if (hooks1.length === 0 && hooks2.length === 0) return 1;

    const matchingHooks = hooks1.filter(hook1 => 
      hooks2.some(hook2 => 
        hook1.name === hook2.name && 
        this.compareArrays(hook1.dependencies, hook2.dependencies)
      )
    );

    return matchingHooks.length / Math.max(hooks1.length, hooks2.length);
  }

  compareMethods(methods1, methods2) {
    if (!methods1 || !methods2) return 0;
    if (methods1.length === 0 && methods2.length === 0) return 1;

    const methodSimilarities = methods1.map(method1 => 
      Math.max(...methods2.map(method2 => this.compareMethod(method1, method2)))
    );

    return methodSimilarities.reduce((a, b) => a + b, 0) / methodSimilarities.length;
  }

  compareMethod(method1, method2) {
    if (method1.name !== method2.name) return 0;

    const paramSimilarity = this.compareArrays(method1.params, method2.params);
    const bodySimilarity = method1.body === method2.body ? 1 : 0;

    return (paramSimilarity + bodySimilarity) / 2;
  }

  compareArrays(arr1, arr2) {
    if (!arr1 || !arr2) return 0;
    if (arr1.length === 0 && arr2.length === 0) return 1;

    const matchingItems = arr1.filter(item1 => 
      arr2.some(item2 => JSON.stringify(item1) === JSON.stringify(item2))
    );

    return matchingItems.length / Math.max(arr1.length, arr2.length);
  }
}

module.exports = ReactComponentComparator;
