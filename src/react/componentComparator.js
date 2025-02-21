export class ReactComponentComparator {
  constructor(options = {}) {
    this.options = {
      weights: {
        props: 0.5,
        jsx: 0.5
      },
      ...options
    };
  }

  compareComponents(comp1, comp2) {
    if (!comp1 || !comp2) return 0;

    if (!comp1 || !comp2) return 0;

    const similarities = {
      props: this.compareProps(comp1.props, comp2.props),
      jsx: this.compareJSX(comp1.jsx, comp2.jsx)
    };

    const similarity = Object.entries(similarities).reduce((total, [key, value]) => {
      return total + (value * this.options.weights[key]);
    }, 0);

    // Return 1.0 for identical components, but add a small penalty for similar ones
    if (similarity === 1 && 
        JSON.stringify(comp1) === JSON.stringify(comp2)) {
      return 1;
    }
    return similarity > 0.99 ? 0.99 : similarity;
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
      const maxChildren = Math.max(node1.children.length, node2.children.length);
      const childSimilarities = node1.children.map((child1, index) => {
        const child2 = node2.children[index];
        return child2 ? this.compareJSXNodes(child1, child2) : 0;
      });
      childrenSimilarity = childSimilarities.reduce((a, b) => a + b, 0) / maxChildren;
    }

    // Weight type match more heavily
    const typeSimilarity = node1.type === node2.type ? 1 : 0;
    return (typeSimilarity * 0.4 + propsSimilarity * 0.3 + childrenSimilarity * 0.3);
  }
}
